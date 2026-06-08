/**
 * Tests for subagentFileOps.ts
 * Tests template processing, file operations, and agent enable/disable logic.
 */

vi.mock(
  "vscode",
  () => ({
    workspace: {
      getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn((key: string, def: any) => def),
        update: vi.fn().mockResolvedValue(undefined),
      }),
      fs: {
        readFile: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
        createDirectory: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn(),
        rename: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        readDirectory: vi.fn().mockResolvedValue([]),
      },
      openTextDocument: vi.fn().mockResolvedValue({}),
    },
    commands: {
      executeCommand: vi.fn().mockResolvedValue(undefined),
    },
    window: {
      showWarningMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      tabGroups: { all: [] },
    },
    Uri: {
      file: vi.fn((p: string) => ({ fsPath: p, toString: () => p })),
      joinPath: vi.fn((base: any, ...segs: string[]) => {
        const joined = [base?.fsPath || String(base), ...segs].join("/");
        return { fsPath: joined, toString: () => joined };
      }),
    },
    FileType: { File: 1, Directory: 2 },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    languages: {
      getDiagnostics: vi.fn().mockReturnValue([]),
    },
    TabInputText: class {
      constructor(public uri: any) {}
    },
    ConfigurationTarget: { Global: 1, Workspace: 2 },
  }),
  { virtual: true },
);

vi.mock("./funMessenger", () => ({
  funWindow: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    tabGroups: { all: [], close: vi.fn() },
  },
}));

vi.mock("./subagentRegistry", () => ({
  AGENT_REGISTRY: [
    { id: "abap-reader", templateFile: "abap-reader.agent.md", tools: ["tool1"] },
    { id: "abap-discoverer", templateFile: "abap-discoverer.agent.md", tools: null },
  ],
  getSubagentSettings: vi
    .fn()
    .mockReturnValue({ models: { "abap-reader": "gpt-4o", "abap-discoverer": "gpt-4o" } }),
  getWorkspaceFolder: vi
    .fn()
    .mockReturnValue({ fsPath: "/workspace", toString: () => "/workspace" }),
  getExtensionId: vi.fn().mockReturnValue("murbani.vscode-abap-remote-fs"),
  buildFullToolName: vi.fn((ext: string, t: string) => `${ext}_${t}`),
}));

import * as vscode from "vscode";
import {
  processTemplate,
  loadTemplate,
  refreshExplorer,
  closeAgentEditors,
  disableAgentFiles,
  hasDisabledAgentFiles,
  enableSubagentsCore,
  disableSubagentsCore,
} from "./subagentFileOps";
import { getWorkspaceFolder } from "./subagentRegistry";

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("subagentFileOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // processTemplate
  // ============================================================================
  describe("processTemplate", () => {
    it("replaces {{MODEL}} with provided model", () => {
      const result = processTemplate("model: '{{MODEL}}'", "gpt-4o", null, "ext-id");
      expect(result).toBe("model: 'gpt-4o'");
    });

    it("removes model line when model is empty string", () => {
      const result = processTemplate("model: '{{MODEL}}'\nother: content", "", null, "ext-id");
      expect(result).not.toContain("{{MODEL}}");
    });

    it("replaces {{TOOLS}} with full tool names when tools provided", () => {
      const result = processTemplate("tools: [{{TOOLS}}]", "gpt-4o", ["tool1", "tool2"], "ext-id");
      expect(result).toContain("ext-id_tool1");
      expect(result).toContain("ext-id_tool2");
    });

    it("removes tools line when tools is null", () => {
      const result = processTemplate(
        "tools: [{{TOOLS}}]\nother: content",
        "gpt-4o",
        null,
        "ext-id",
      );
      expect(result).not.toContain("{{TOOLS}}");
    });

    it("replaces multiple occurrences of {{MODEL}}", () => {
      const result = processTemplate(
        "model: {{MODEL}}\n# Using {{MODEL}}",
        "gpt-4o",
        null,
        "ext-id",
      );
      expect(result).toBe("model: gpt-4o\n# Using gpt-4o");
    });

    it("handles template with no placeholders", () => {
      const result = processTemplate("# Static content", "gpt-4o", null, "ext-id");
      expect(result).toBe("# Static content");
    });

    it("quotes tool names with single quotes", () => {
      const result = processTemplate("tools: [{{TOOLS}}]", "gpt-4o", ["myTool"], "ext");
      expect(result).toContain("'ext_myTool'");
    });
  });

  // ============================================================================
  // loadTemplate
  // ============================================================================
  describe("loadTemplate", () => {
    const mockContext = {
      extensionPath: "/ext",
      subscriptions: [],
    } as any;

    it("loads template from dist path first", async () => {
      const content = Buffer.from("template content");
      (vscode.workspace.fs.readFile as Mock).mockResolvedValueOnce(content);
      const result = await loadTemplate(mockContext, "test.agent.md");
      expect(result).toBe("template content");
    });

    it("falls back to dev path when dist path fails", async () => {
      (vscode.workspace.fs.readFile as Mock)
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce(Buffer.from("dev content"));
      const result = await loadTemplate(mockContext, "test.agent.md");
      expect(result).toBe("dev content");
    });

    it("throws when both paths fail", async () => {
      (vscode.workspace.fs.readFile as Mock)
        .mockRejectedValueOnce(new Error("not found"))
        .mockRejectedValueOnce(new Error("also not found"));
      await expect(loadTemplate(mockContext, "missing.md")).rejects.toThrow(
        "Could not load template",
      );
    });
  });

  // ============================================================================
  // refreshExplorer
  // ============================================================================
  describe("refreshExplorer", () => {
    it("executes the refreshFilesExplorer command", async () => {
      vi.useFakeTimers();
      const promise = refreshExplorer();
      await vi.runAllTimersAsync();
      await promise;
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "workbench.files.action.refreshFilesExplorer",
      );
      vi.useRealTimers();
    });

    it("does not throw when command fails", async () => {
      vi.useFakeTimers();
      (vscode.commands.executeCommand as Mock).mockRejectedValueOnce(new Error("no command"));
      const promise = refreshExplorer();
      await vi.runAllTimersAsync();
      await expect(promise).resolves.not.toThrow();
      vi.useRealTimers();
    });
  });

  // ============================================================================
  // closeAgentEditors
  // ============================================================================
  describe("closeAgentEditors", () => {
    it("closes tabs that contain .github/agents/ path", async () => {
      const { TabInputText } = vscode as any;
      const mockTab = {
        input: new TabInputText({ fsPath: "/workspace/.github/agents/abap-reader.agent.md" }),
      };
      const mockTabGroups = {
        all: [{ tabs: [mockTab] }],
        close: vi.fn().mockResolvedValue(undefined),
      };
      const { funWindow } = require("./funMessenger");
      funWindow.tabGroups = mockTabGroups;

      const workspaceUri = { fsPath: "/workspace" } as any;
      await closeAgentEditors(workspaceUri);
      expect(mockTabGroups.close).toHaveBeenCalledWith(mockTab);
    });

    it("does not close tabs outside agents folder", async () => {
      const { TabInputText } = vscode as any;
      const mockTab = {
        input: new TabInputText({ fsPath: "/workspace/src/main.ts" }),
      };
      const mockTabGroups = {
        all: [{ tabs: [mockTab] }],
        close: vi.fn(),
      };
      const { funWindow } = require("./funMessenger");
      funWindow.tabGroups = mockTabGroups;

      const workspaceUri = { fsPath: "/workspace" } as any;
      await closeAgentEditors(workspaceUri);
      expect(mockTabGroups.close).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // hasDisabledAgentFiles
  // ============================================================================
  describe("hasDisabledAgentFiles", () => {
    it("returns true when agents_disabled folder exists", async () => {
      (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({});
      const result = await hasDisabledAgentFiles({ fsPath: "/workspace" } as any);
      expect(result).toBe(true);
    });

    it("returns false when agents_disabled folder does not exist", async () => {
      (vscode.workspace.fs.stat as Mock).mockRejectedValueOnce(new Error("not found"));
      const result = await hasDisabledAgentFiles({ fsPath: "/workspace" } as any);
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // disableAgentFiles
  // ============================================================================
  describe("disableAgentFiles", () => {
    it("returns true after successful rename", async () => {
      (vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({}); // agents dir exists
      (vscode.workspace.fs.delete as Mock).mockRejectedValueOnce(new Error("not found")); // disabled dir doesn't exist
      vi.useFakeTimers();
      const promise = disableAgentFiles({ fsPath: "/workspace" } as any);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toBe(true);
      vi.useRealTimers();
    });

    it("returns false when agents folder does not exist", async () => {
      (vscode.workspace.fs.stat as Mock).mockRejectedValueOnce(new Error("not found"));
      const result = await disableAgentFiles({ fsPath: "/workspace" } as any);
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // disableSubagentsCore
  // ============================================================================
  describe("disableSubagentsCore", () => {
    it("returns success=true", async () => {
      (getWorkspaceFolder as Mock).mockReturnValue({ fsPath: "/workspace" });
      (vscode.workspace.fs.stat as Mock).mockRejectedValue(new Error("not found"));
      const result = await disableSubagentsCore();
      expect(result.success).toBe(true);
    });

    it("updates abapfs.subagents.enabled to false", async () => {
      (getWorkspaceFolder as Mock).mockReturnValue({ fsPath: "/workspace" });
      (vscode.workspace.fs.stat as Mock).mockRejectedValue(new Error("not found"));
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      (vscode.workspace.getConfiguration as Mock).mockReturnValue({
        get: vi.fn((k: string, d: any) => d),
        update: mockUpdate,
      });
      await disableSubagentsCore();
      expect(mockUpdate).toHaveBeenCalledWith(
        "enabled",
        false,
        vscode.ConfigurationTarget.Workspace,
      );
    });
  });
});
