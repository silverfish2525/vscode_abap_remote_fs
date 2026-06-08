vi.mock(
  "vscode",
  () => {
    const TabInputTextDiff = vi.fn();
    return {
      commands: { executeCommand: vi.fn() },
      Uri: {
        parse: vi.fn((s: string) => ({
          toString: () => s,
          path: s.replace(/^\w+:\/\/[^/]*/, ""),
          authority: s.match(/^\w+:\/\/([^/]*)/)?.[1] || "",
          scheme: s.match(/^(\w+):/)?.[1] || "",
          with: vi.fn(function (this: any, overrides: any) {
            return { ...this, ...overrides, toString: () => s };
          }),
        })),
      },
      ProgressLocation: { Notification: 15 },
      workspace: {},
      QuickPickItem: {},
      TabInputTextDiff,
    };
  },
  { virtual: true },
);

vi.mock("../../services/funMessenger", () => ({
  funWindow: {
    showQuickPick: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    tabGroups: {
      activeTabGroup: { activeTab: null },
    },
    withProgress: vi.fn((_opts: any, cb: any) => cb({}, { isCancellationRequested: false })),
  },
}));

vi.mock("../../adt/conections", () => ({
  abapUri: vi.fn(),
  uriRoot: vi.fn(),
  getOrCreateRoot: vi.fn(),
  getClient: vi.fn(),
  ADTSCHEME: "adt",
  rootIsConnected: vi.fn(),
}));

vi.mock("./abaprevisionservice", () => ({
  AbapRevisionService: {
    get: vi.fn().mockReturnValue({
      uriRevisions: vi.fn().mockResolvedValue([]),
    }),
  },
  revLabel: vi.fn((rev: any, fallback: string) => rev?.version || fallback),
}));

vi.mock("./documentprovider", () => ({
  decodeRevisioUrl: vi.fn(),
  revisionUri: vi.fn((uri: any, rev: any, norm?: boolean) => ({
    ...uri,
    scheme: "adt_revision",
    revision: rev,
  })),
  ADTREVISIONSCHEME: "adt_revision",
}));

vi.mock("./quickdiff", () => ({
  AbapQuickDiff: {
    get: vi.fn().mockReturnValue({ setCurrentRev: vi.fn() }),
  },
}));

vi.mock("../../config", () => ({
  RemoteManager: {
    get: vi.fn().mockReturnValue({
      selectConnection: vi.fn().mockResolvedValue({ remote: null, userCancel: true }),
    }),
  },
  formatKey: vi.fn((s: string) => s.toLowerCase()),
}));

vi.mock("abapfs", () => ({
  isAbapFile: vi.fn(),
}));

vi.mock("../../lib", () => ({
  caughtToString: vi.fn((e: any) => String(e)),
  atob: vi.fn((s: string) => Buffer.from(s, "base64").toString()),
  btoa: vi.fn((s: string) => Buffer.from(s).toString("base64")),
}));

vi.mock("io-ts", () => ({
  type: vi.fn().mockReturnValue({ decode: vi.fn() }),
  string: "string",
}));

vi.mock("fp-ts/lib/Either", () => ({
  isRight: vi.fn().mockReturnValue(false),
}));

vi.mock("../../langClient", () => ({
  vsCodeUri: vi.fn(),
}));

vi.mock("../../commands", () => ({
  AbapFsCommands: {
    changequickdiff: "abapfs.changequickdiff",
    remotediff: "abapfs.remotediff",
    comparediff: "abapfs.comparediff",
    prevRevLeft: "abapfs.prevRevLeft",
    nextRevLeft: "abapfs.nextRevLeft",
    prevRevRight: "abapfs.prevRevRight",
    nextRevRight: "abapfs.nextRevRight",
    mergeEditor: "abapfs.openMergeEditor",
    clearScmGroup: "abapfs.clearScmGroup",
    filterScmGroup: "abapfs.filterScmGroup",
    opendiff: "abapfs.opendiff",
    opendiffNormalized: "abapfs.opendiffNormalized",
    togglediffNormalize: "abapfs.togglediffNormalize",
  },
  command: vi.fn(() => vi.fn()),
}));

import { commands, Uri } from "vscode";
import { funWindow as window } from "../../services/funMessenger";
import { abapUri } from "../../adt/conections";
import { AbapRevisionService } from "./abaprevisionservice";
import { displayRevDiff, versionRevisions } from "./commands";
import { decodeRevisioUrl, revisionUri } from "./documentprovider";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("displayRevDiff", () => {
  it("calls vscode.diff with correct title and revision URIs", async () => {
    const uri = Uri.parse("adt://dev100/some/path/object.abap");
    const leftRev = {
      uri: "rev1",
      version: "v1",
      date: "2024-01-01",
      author: "user",
      versionTitle: "",
    };
    const rightRev = {
      uri: "rev2",
      version: "v2",
      date: "2024-01-02",
      author: "user",
      versionTitle: "",
    };

    await displayRevDiff(rightRev, leftRev, uri);

    expect(revisionUri).toHaveBeenCalledWith(uri, leftRev, false);
    expect(revisionUri).toHaveBeenCalledWith(uri, rightRev, false);
    expect(commands.executeCommand).toHaveBeenCalledWith(
      "vscode.diff",
      expect.anything(),
      expect.anything(),
      expect.stringContaining("->"),
    );
  });

  it("uses 'initial' label when leftRev is undefined", async () => {
    const uri = Uri.parse("adt://dev100/some/path/object.abap");

    await displayRevDiff(
      { uri: "r", version: "v", date: "", author: "", versionTitle: "" },
      undefined,
      uri,
    );

    expect(commands.executeCommand).toHaveBeenCalledWith(
      "vscode.diff",
      expect.anything(),
      expect.anything(),
      expect.stringContaining("initial"),
    );
  });

  it("uses 'current' label when rightRev is undefined", async () => {
    const uri = Uri.parse("adt://dev100/some/path/object.abap");

    await displayRevDiff(
      undefined,
      { uri: "r", version: "v", date: "", author: "", versionTitle: "" },
      uri,
    );

    expect(commands.executeCommand).toHaveBeenCalledWith(
      "vscode.diff",
      expect.anything(),
      expect.anything(),
      expect.stringContaining("current"),
    );
  });

  it("passes normalize flag to revisionUri", async () => {
    const uri = Uri.parse("adt://dev100/some/path/object.abap");
    const rev = { uri: "r", version: "v", date: "", author: "", versionTitle: "" };

    await displayRevDiff(rev, rev, uri, true);

    expect(revisionUri).toHaveBeenCalledWith(uri, rev, true);
  });
});

describe("versionRevisions", () => {
  it("returns undefined when decodeRevisioUrl returns undefined", async () => {
    (decodeRevisioUrl as Mock).mockReturnValue(undefined);
    const uri = Uri.parse("adt_revision://dev100/path");
    const result = await versionRevisions(uri);
    expect(result).toBeUndefined();
  });

  it("returns undefined when revision not found in loaded revisions", async () => {
    const innerUri = Uri.parse("adt://dev100/path");
    const revision = { uri: "not-found-uri", version: "1", date: "", author: "", versionTitle: "" };
    (decodeRevisioUrl as Mock).mockReturnValue({
      uri: innerUri,
      revision,
      normalized: false,
    });
    const service = { uriRevisions: vi.fn().mockResolvedValue([]) };
    (AbapRevisionService.get as Mock).mockReturnValue(service);

    const uri = Uri.parse("adt_revision://dev100/path");
    const result = await versionRevisions(uri);
    expect(result).toBeUndefined();
  });

  it("returns revision details when found", async () => {
    const innerUri = Uri.parse("adt://dev100/path");
    const revision = {
      uri: "found-uri",
      version: "2",
      date: "2024-01-01",
      author: "user",
      versionTitle: "",
    };
    (decodeRevisioUrl as Mock).mockReturnValue({
      uri: innerUri,
      revision,
      normalized: true,
    });
    const service = { uriRevisions: vi.fn().mockResolvedValue([revision]) };
    (AbapRevisionService.get as Mock).mockReturnValue(service);

    const uri = Uri.parse("adt_revision://dev100/path");
    const result = await versionRevisions(uri, false);

    expect(result).toBeDefined();
    expect(result!.revision).toBe(revision);
    expect(result!.normalized).toBe(true);
    expect(result!.uri).toBe(innerUri);
  });
});
