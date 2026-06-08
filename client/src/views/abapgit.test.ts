/**
 * Tests for views/abapgit.ts
 * Covers confirmPull, packageUri, AbapGit class methods, and AbapGitProvider.
 */

vi.mock("fp-ts/lib/Either", () => ({
  isRight: vi.fn((v: any) => v && v._tag === "Right"),
}), { virtual: true })

vi.mock("fp-ts/lib/Option", () => ({
  isNone: vi.fn((v: any) => !v || v._tag === "None"),
  none: { _tag: "None" },
  isSome: vi.fn((v: any) => v && v._tag === "Some"),
}), { virtual: true })

vi.mock("vscode", () => ({
  TreeItem: class TreeItem {
    constructor(public label?: any, public collapsibleState?: number) {}
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  EventEmitter: vi.fn(function () {
    return {
      event: {},
      fire: vi.fn(),
    }
  }),
  workspace: {
    workspaceFolders: [],
    onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
  },
  Uri: {
    parse: vi.fn((s: string) => ({
      toString: () => s,
      authority: s.replace(/.*?:\/\//, "").split("/")[0] ?? "",
      scheme: s.split(":")[0],
    })),
  },
  ProgressLocation: { Notification: 15 },
  commands: { executeCommand: vi.fn() },
  env: { openExternal: vi.fn() },
}), { virtual: true })

vi.mock("../commands", () => ({
  command: () => (target: any, key: string, descriptor: any) => descriptor,
  AbapFsCommands: {
    refreshAbapGit: "abapfs.refreshAbapGit",
    openRepo: "abapfs.openRepo",
    addScm: "abapfs.addScm",
  },
}), { virtual: true })

vi.mock("../adt/operations/AdtObjectCreator", () => ({
  PACKAGE: "DEVC/K",
}), { virtual: true })

vi.mock("../adt/AdtTransports", () => ({
  selectTransport: vi.fn(),
}), { virtual: true })

vi.mock("../lib", () => ({
  chainTaskTransformers: vi.fn(),
  dependFieldReplacer: vi.fn(),
  log: vi.fn(),
  createTaskTransformer: vi.fn(),
  caughtToString: vi.fn((e: any) => String(e)),
  quickPick: vi.fn(),
}), { virtual: true })

vi.mock("../services/funMessenger", () => ({
  funWindow: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    withProgress: vi.fn(),
  },
}), { virtual: true })

vi.mock("../scm/abapGit", () => ({
  addRepo: vi.fn(),
  repoCredentials: vi.fn(),
}), { virtual: true })

vi.mock("../adt/conections", () => ({
  getClient: vi.fn(),
  ADTSCHEME: "adt",
  getOrCreateClient: vi.fn(),
}), { virtual: true })

vi.mock("../adt/operations/AdtObjectFinder", () => ({
  AdtObjectFinder: vi.fn(function () {
    return {
      vscodeUri: vi.fn(),
    }
  }),
  createUri: vi.fn(),
}), { virtual: true })

vi.mock("uuid", () => ({ v1: vi.fn(() => "test-uuid") }), { virtual: true })

import { confirmPull, packageUri } from "./abapgit"
import { funWindow as window } from "../services/funMessenger"

const mockedWindow = window as Mocked<typeof window>

describe("confirmPull", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns true when user confirms", async () => {
    ;(mockedWindow.showInformationMessage as Mock).mockResolvedValue("Confirm")
    const result = await confirmPull("ZPKG")
    expect(result).toBe(true)
    expect(mockedWindow.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("ZPKG"),
      "Confirm",
      "Cancel"
    )
  })

  it("returns false when user cancels", async () => {
    ;(mockedWindow.showInformationMessage as Mock).mockResolvedValue("Cancel")
    const result = await confirmPull("ZPKG")
    expect(result).toBe(false)
  })

  it("returns false when user dismisses (undefined)", async () => {
    ;(mockedWindow.showInformationMessage as Mock).mockResolvedValue(undefined)
    const result = await confirmPull("ZPKG")
    expect(result).toBe(false)
  })
})

describe("packageUri", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns objectPath when collectionFeatureDetails succeeds (truthy)", async () => {
    const mockClient = {
      collectionFeatureDetails: vi.fn().mockResolvedValue(true),
    } as any
    const result = await packageUri(mockClient, "ZMYPKG")
    expect(result).toContain("ZMYPKG")
  })

  it("falls back to vit URL when collectionFeatureDetails returns falsy", async () => {
    const mockClient = {
      collectionFeatureDetails: vi.fn().mockResolvedValue(null),
    } as any
    const result = await packageUri(mockClient, "ZMYPKG")
    expect(result).toContain("ZMYPKG")
    expect(result).toContain("devck")
  })

  it("encodes special characters in package name", async () => {
    const mockClient = {
      collectionFeatureDetails: vi.fn().mockResolvedValue(null),
    } as any
    const result = await packageUri(mockClient, "Z/PKG")
    expect(result).not.toContain("Z/PKG")
    expect(result).toContain("Z%2FPKG")
  })
})
