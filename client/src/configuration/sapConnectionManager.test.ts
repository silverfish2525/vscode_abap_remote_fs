vi.mock(
  "vscode",
  () => {
    const postMessageMock = vi.fn();
    const webviewMock = {
      html: "",
      postMessage: postMessageMock,
      onDidReceiveMessage: vi.fn(),
      cspSource: "none",
    };

    return {
      ViewColumn: { One: 1 },
      Uri: {
        file: (p: string) => ({ fsPath: p, toString: () => p }),
        joinPath: vi.fn((...args: any[]) => ({ fsPath: args.join("/") })),
      },
      ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
      workspace: {
        getConfiguration: vi.fn(),
        fs: {
          writeFile: vi.fn().mockResolvedValue(undefined),
        },
      },
    };
  },
);

vi.mock("../services/funMessenger", () => ({
  funWindow: {
    createWebviewPanel: vi.fn(),
    showWarningMessage: vi.fn(),
    showInputBox: vi.fn(),
    showQuickPick: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

vi.mock("../config", () => ({
  validateNewConfigId: vi.fn(() => (id: string) => undefined), // passes by default
  formatKey: vi.fn((k: string) => k.toLowerCase()),
  RemoteConfig: {},
}));

vi.mock("../services/abapCopilotLogger", () => ({
  logCommands: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../services/telemetry", () => ({
  logTelemetry: vi.fn(),
}));

vi.mock("../lib", () => {
  const vaultInstance = {
    deletePassword: vi.fn().mockResolvedValue(true),
    setPassword: vi.fn().mockResolvedValue(true),
    getPassword: vi.fn().mockResolvedValue(null),
  };
  return {
    PasswordVault: {
      get: vi.fn(() => vaultInstance),
    },
  };
});

vi.mock("abap_cloud_platform", () => ({
  isAbapServiceKey: vi.fn(() => false),
  cfCodeGrant: vi.fn(),
  getAbapSystemInfo: vi.fn(),
  getAbapUserInfo: vi.fn(),
  loginServer: vi.fn(),
  cfInfo: vi.fn(),
  cfPasswordGrant: vi.fn(),
  cfOrganizations: vi.fn(),
  cfSpaces: vi.fn(),
  cfServices: vi.fn(),
  cfServiceInstances: vi.fn(),
  cfInstanceServiceKeys: vi.fn(),
}));

import * as vscode from "vscode";
import { SapConnectionManager } from "./sapConnectionManager";
import { validateNewConfigId } from "../config";
import { logTelemetry } from "../services/telemetry";

// ---- helpers ----------------------------------------------------------------

let postMessageMock: Mock;
let disposeListenerMock: Mock;
let receiveMessageHandler: ((msg: any) => void) | undefined;

function makePanelMock() {
  postMessageMock = vi.fn();
  disposeListenerMock = vi.fn();
  receiveMessageHandler = undefined;

  return {
    webview: {
      html: "",
      postMessage: postMessageMock,
      onDidReceiveMessage: vi.fn((handler: any) => {
        receiveMessageHandler = handler;
        return { dispose: vi.fn() };
      }),
      cspSource: "none",
    },
    onDidDispose: vi.fn((cb: any) => {
      disposeListenerMock = cb;
      return { dispose: vi.fn() };
    }),
    reveal: vi.fn(),
    dispose: vi.fn(),
  };
}

function makeWorkspaceConfig(
  globalRemotes: Record<string, any> = {},
  workspaceRemotes: Record<string, any> = {},
) {
  return {
    inspect: vi.fn(() => ({
      globalValue: globalRemotes,
      workspaceValue: workspaceRemotes,
    })),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

function createManager(): { manager: SapConnectionManager; panel: any; extensionUri: vscode.Uri } {
  const panel = makePanelMock();
  (require("../services/funMessenger").funWindow.createWebviewPanel as Mock).mockReturnValue(panel);
  const extensionUri = vscode.Uri.file("/ext");
  SapConnectionManager.createOrShow(extensionUri);
  const manager = (SapConnectionManager as any).currentPanel as SapConnectionManager;
  return { manager, panel, extensionUri };
}

// ---- setup/teardown ---------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  (SapConnectionManager as any).currentPanel = undefined;
});

// ---- createOrShow -----------------------------------------------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("SapConnectionManager.createOrShow", () => {
  test("creates a new panel and stores it as currentPanel", () => {
    const { funWindow: w } = require("../services/funMessenger");
    (w.createWebviewPanel as Mock).mockReturnValue(makePanelMock());
    SapConnectionManager.createOrShow(vscode.Uri.file("/ext"));
    expect((SapConnectionManager as any).currentPanel).toBeDefined();
  });

  test("reuses existing panel on second call (reveal)", () => {
    const { funWindow: w } = require("../services/funMessenger");
    const panel = makePanelMock();
    (w.createWebviewPanel as Mock).mockReturnValue(panel);
    SapConnectionManager.createOrShow(vscode.Uri.file("/ext"));
    SapConnectionManager.createOrShow(vscode.Uri.file("/ext"));
    // createWebviewPanel should only be called once
    expect(w.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(panel.reveal).toHaveBeenCalled();
  });

  test("clears currentPanel when panel is disposed", () => {
    const { funWindow: w } = require("../services/funMessenger");
    const panel = makePanelMock();
    (w.createWebviewPanel as Mock).mockReturnValue(panel);
    SapConnectionManager.createOrShow(vscode.Uri.file("/ext"));
    expect((SapConnectionManager as any).currentPanel).toBeDefined();
    // Trigger dispose listener
    disposeListenerMock?.();
    expect((SapConnectionManager as any).currentPanel).toBeUndefined();
  });
});

// ---- message: ready / loadConnections ---------------------------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("message handling: ready / loadConnections", () => {
  test("sends connections to webview on 'ready' message", async () => {
    const cfg = makeWorkspaceConfig({ dev: { url: "https://h", username: "u" } });
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);
    createManager();

    await receiveMessageHandler!({ type: "ready" });

    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "connections" }));
  });

  test("sends connections to webview on 'loadConnections' message", async () => {
    const cfg = makeWorkspaceConfig({});
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);
    createManager();

    await receiveMessageHandler!({ type: "loadConnections" });

    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "connections" }));
  });

  test("connections message includes both user and workspace remotes", async () => {
    const cfg = makeWorkspaceConfig(
      { global_conn: { url: "https://g", username: "ug" } },
      { ws_conn: { url: "https://w", username: "uw" } },
    );
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);
    createManager();

    await receiveMessageHandler!({ type: "ready" });

    const call = postMessageMock.mock.calls.find((c: any[]) => c[0].type === "connections");
    expect(call![0].data.user).toHaveProperty("global_conn");
    expect(call![0].data.workspace).toHaveProperty("ws_conn");
  });
});

// ---- message: saveConnection - new connection -------------------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("message handling: saveConnection (new)", () => {
  test("saves new connection and sends success message", async () => {
    (validateNewConfigId as Mock).mockReturnValue((_id: string) => undefined);

    const connection = {
      url: "https://host:8443",
      username: "user",
      password: "",
      language: "en",
      allowSelfSigned: false,
      diff_formatter: "ADT formatter",
    };

    // First config call: get current remotes; second: verify save
    const cfg = {
      inspect: vi
        .fn()
        .mockReturnValueOnce({ globalValue: {}, workspaceValue: {} })
        .mockReturnValueOnce({ globalValue: { newConn: connection }, workspaceValue: {} }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "saveConnection",
      connectionId: "newConn",
      connection,
      target: "user",
      isEdit: false,
    });

    expect(cfg.update).toHaveBeenCalledWith(
      "remote",
      expect.objectContaining({ newConn: expect.any(Object) }),
      vscode.ConfigurationTarget.Global,
    );
    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    expect(logTelemetry).toHaveBeenCalledWith("command_connection_manager_save_called");
  });

  test("sends formValidationError when new connection id is invalid", async () => {
    (validateNewConfigId as Mock).mockReturnValue((_id: string) => "Key already in use");

    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: { newConn: {} }, workspaceValue: {} }),
      update: vi.fn(),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "saveConnection",
      connectionId: "newConn",
      connection: { url: "https://h", username: "u" },
      target: "user",
      isEdit: false,
    });

    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "formValidationError" }),
    );
    expect(cfg.update).not.toHaveBeenCalled();
  });

  test("rolls back and sends error when save verification fails", async () => {
    (validateNewConfigId as Mock).mockReturnValue((_id: string) => undefined);

    const connection = { url: "https://h", username: "u" };

    const cfg = {
      inspect: vi
        .fn()
        .mockReturnValueOnce({ globalValue: {}, workspaceValue: {} })
        .mockReturnValueOnce({ globalValue: {}, workspaceValue: {} }), // missing after save
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    receiveMessageHandler!({
      type: "saveConnection",
      connectionId: "failConn",
      connection,
      target: "user",
      isEdit: false,
    });

    // handleMessage is async but not awaited by the onDidReceiveMessage handler,
    // so we need to flush microtasks to let saveConnection complete
    await new Promise((r) => setImmediate(r));

    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  test("saves to workspace target when target is 'workspace'", async () => {
    (validateNewConfigId as Mock).mockReturnValue((_id: string) => undefined);

    const connection = { url: "https://h", username: "u" };
    const cfg = {
      inspect: vi
        .fn()
        .mockReturnValueOnce({ globalValue: {}, workspaceValue: {} })
        .mockReturnValueOnce({ globalValue: {}, workspaceValue: { wsConn: connection } }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "saveConnection",
      connectionId: "wsConn",
      connection,
      target: "workspace",
      isEdit: false,
    });

    expect(cfg.update).toHaveBeenCalledWith(
      "remote",
      expect.any(Object),
      vscode.ConfigurationTarget.Workspace,
    );
  });
});

// ---- message: deleteConnection ----------------------------------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("message handling: deleteConnection", () => {
  test("deletes connection and sends success message", async () => {
    const existing = { dev: { url: "https://h", username: "u" } };

    const cfg = {
      inspect: vi
        .fn()
        .mockReturnValueOnce({ globalValue: existing, workspaceValue: {} })
        .mockReturnValueOnce({ globalValue: {}, workspaceValue: {} }), // verified deleted
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    receiveMessageHandler!({
      type: "deleteConnection",
      connectionId: "dev",
      target: "user",
    });

    // handleMessage is async but not awaited by the onDidReceiveMessage handler
    await new Promise((r) => setImmediate(r));

    expect(cfg.update).toHaveBeenCalled();
    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    expect(logTelemetry).toHaveBeenCalledWith("command_connection_manager_delete_called");
  });

  test("rolls back and sends error when connection still exists after deletion", async () => {
    const existing = { dev: { url: "https://h", username: "u" } };

    const cfg = {
      inspect: vi
        .fn()
        .mockReturnValueOnce({ globalValue: existing, workspaceValue: {} })
        .mockReturnValueOnce({ globalValue: existing, workspaceValue: {} }), // still there!
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    receiveMessageHandler!({
      type: "deleteConnection",
      connectionId: "dev",
      target: "user",
    });

    await new Promise((r) => setImmediate(r));

    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  test("clears password from vault when deleting", async () => {
    const vault = require("../lib").PasswordVault.get();
    const existing = { dev: { url: "https://h", username: "myuser" } };

    const cfg = {
      inspect: vi
        .fn()
        .mockReturnValueOnce({ globalValue: existing, workspaceValue: {} })
        .mockReturnValueOnce({ globalValue: {}, workspaceValue: {} }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    receiveMessageHandler!({
      type: "deleteConnection",
      connectionId: "dev",
      target: "user",
    });

    await new Promise((r) => setImmediate(r));

    expect(vault.deletePassword).toHaveBeenCalledWith("vscode.abapfs.dev", "myuser");
  });
});

// ---- message: importFromJson ------------------------------------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("message handling: importFromJson", () => {
  test("merges imported connections and sends success", async () => {
    const existing = { dev1: { url: "https://h1", username: "u1" } };
    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: existing, workspaceValue: {} }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    const newConns = { dev2: { url: "https://h2", username: "u2" } };
    await receiveMessageHandler!({
      type: "importFromJson",
      jsonContent: JSON.stringify(newConns),
      target: "user",
    });

    expect(cfg.update).toHaveBeenCalledWith(
      "remote",
      expect.objectContaining({ dev1: expect.any(Object), dev2: expect.any(Object) }),
      vscode.ConfigurationTarget.Global,
    );
    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
  });

  test("sends error message when JSON is invalid", async () => {
    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: {}, workspaceValue: {} }),
      update: vi.fn(),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "importFromJson",
      jsonContent: "not-valid-json{{",
      target: "user",
    });

    expect(cfg.update).not.toHaveBeenCalled();
    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
});

// ---- message: confirmDeleteConnection ---------------------------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("message handling: confirmDeleteConnection", () => {
  test("calls deleteConnection when user confirms", async () => {
    const { funWindow: w } = require("../services/funMessenger");
    (w.showWarningMessage as Mock).mockResolvedValue("Delete");

    const existing = { dev: { url: "https://h", username: "u" } };
    const cfg = {
      inspect: vi
        .fn()
        .mockReturnValueOnce({ globalValue: existing, workspaceValue: {} })
        .mockReturnValueOnce({ globalValue: {}, workspaceValue: {} }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "confirmDeleteConnection",
      connectionId: "dev",
      target: "user",
    });

    expect(cfg.update).toHaveBeenCalled();
  });

  test("does not delete when user cancels", async () => {
    const { funWindow: w } = require("../services/funMessenger");
    (w.showWarningMessage as Mock).mockResolvedValue(undefined);

    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: {}, workspaceValue: {} }),
      update: vi.fn(),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "confirmDeleteConnection",
      connectionId: "dev",
      target: "user",
    });

    expect(cfg.update).not.toHaveBeenCalled();
  });
});

// ---- message: bulkDelete ----------------------------------------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("message handling: bulkDelete", () => {
  test("removes multiple connections", async () => {
    const existing = {
      conn1: { url: "https://h1", username: "u1" },
      conn2: { url: "https://h2", username: "u2" },
      keep: { url: "https://h3", username: "u3" },
    };
    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: existing, workspaceValue: {} }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "bulkDelete",
      connectionNames: ["conn1", "conn2"],
      target: "user",
    });

    const savedRemotes = cfg.update.mock.calls[0][1];
    expect(savedRemotes).not.toHaveProperty("conn1");
    expect(savedRemotes).not.toHaveProperty("conn2");
    expect(savedRemotes).toHaveProperty("keep");
  });
});

// ---- message: requestBulkUsernameEdit / bulkEditUsername --------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("message handling: requestBulkUsernameEdit / bulkEditUsername", () => {
  test("prompts for username and updates connections", async () => {
    const { funWindow: w } = require("../services/funMessenger");
    (w.showInputBox as Mock).mockResolvedValue("newuser");

    const existing = {
      conn1: { url: "https://h1", username: "old1" },
      conn2: { url: "https://h2", username: "old2" },
    };
    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: existing, workspaceValue: {} }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "requestBulkUsernameEdit",
      connectionNames: ["conn1", "conn2"],
      target: "user",
    });

    const saved = cfg.update.mock.calls[0][1];
    expect(saved.conn1.username).toBe("newuser");
    expect(saved.conn2.username).toBe("newuser");
  });

  test("does not update when user cancels the username prompt", async () => {
    const { funWindow: w } = require("../services/funMessenger");
    (w.showInputBox as Mock).mockResolvedValue(undefined);

    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: {}, workspaceValue: {} }),
      update: vi.fn(),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "requestBulkUsernameEdit",
      connectionNames: ["conn1"],
      target: "user",
    });

    expect(cfg.update).not.toHaveBeenCalled();
  });

  test("bulkEditUsername directly updates usernames", async () => {
    const existing = { conn1: { url: "https://h", username: "old" } };
    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: existing, workspaceValue: {} }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "bulkEditUsername",
      connectionNames: ["conn1"],
      newUsername: "brandnew",
      target: "user",
    });

    expect(cfg.update.mock.calls[0][1].conn1.username).toBe("brandnew");
  });
});

// ---- message: confirmBulkDelete ---------------------------------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("message handling: confirmBulkDelete", () => {
  test("deletes after confirmation", async () => {
    const { funWindow: w } = require("../services/funMessenger");
    (w.showWarningMessage as Mock).mockResolvedValue("Delete All");

    const existing = {
      a: { url: "https://h1", username: "u" },
      b: { url: "https://h2", username: "u" },
    };
    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: existing, workspaceValue: {} }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "confirmBulkDelete",
      connectionNames: ["a", "b"],
      target: "user",
    });

    const saved = cfg.update.mock.calls[0][1];
    expect(saved).not.toHaveProperty("a");
    expect(saved).not.toHaveProperty("b");
  });

  test("does not delete when user cancels bulk confirm", async () => {
    const { funWindow: w } = require("../services/funMessenger");
    (w.showWarningMessage as Mock).mockResolvedValue(undefined);

    const cfg = {
      inspect: vi.fn().mockReturnValue({ globalValue: {}, workspaceValue: {} }),
      update: vi.fn(),
    };
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "confirmBulkDelete",
      connectionNames: ["a"],
      target: "user",
    });

    expect(cfg.update).not.toHaveBeenCalled();
  });
});

// ---- createCloudConnection: invalid service key ----------------------------

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("message handling: createCloudConnection (service key)", () => {
  test("sends error for invalid service key format", async () => {
    const { isAbapServiceKey } = require("abap_cloud_platform");
    (isAbapServiceKey as Mock).mockReturnValue(false);

    const cfg = makeWorkspaceConfig();
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "createCloudConnection",
      cloudType: "serviceKey",
      serviceKey: JSON.stringify({ url: "https://h" }),
      target: "user",
    });

    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  test("sends error for malformed JSON service key", async () => {
    const cfg = makeWorkspaceConfig();
    (vscode.workspace.getConfiguration as Mock).mockReturnValue(cfg);

    createManager();

    await receiveMessageHandler!({
      type: "createCloudConnection",
      cloudType: "serviceKey",
      serviceKey: "not-json{",
      target: "user",
    });

    expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
});
