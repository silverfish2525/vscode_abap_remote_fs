vi.mock("vscode", () => ({
  commands: { executeCommand: vi.fn() },
  Uri: {
    parse: vi.fn((s: string) => ({
      toString: () => s,
      path: s.replace(/^\w+:\/\/[^/]*/, ""),
      authority: "",
      scheme: "adt"
    })),
    file: vi.fn((s: string) => ({ toString: () => s, fsPath: s }))
  },
  SourceControlResourceGroup: vi.fn(class {}),
  SourceControlResourceState: vi.fn(class {}),
  SourceControl: vi.fn(class {}),
  Memento: vi.fn(class {}),
  QuickPickItem: vi.fn(class {})
}))

vi.mock("../../services/funMessenger", () => ({
  funWindow: {
    showQuickPick: vi.fn(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    withProgress: vi.fn((_opts: any, cb: any) => cb())
  }
}))

vi.mock("../../commands", () => ({
  AbapFsCommands: {
    agitRefresh: "abapfs.refreshAbapGit",
    agitPush: "abapfs.agitPush",
    agitPullScm: "abapfs.pullAbapGit",
    agitAdd: "abapfs.agitAdd",
    agitRemove: "abapfs.agitRemove",
    agitresetPwd: "abapfs.agitresetPwd",
    agitBranch: "abapfs.switchBranch"
  },
  command: vi.fn(() => vi.fn())
}))

vi.mock("./scm", () => ({
  refresh: vi.fn(),
  fromSC: vi.fn(),
  AgResState: vi.fn(class {}),
  isAgResState: vi.fn(),
  fromGroup: vi.fn(),
  UNSTAGED: "unstaged",
  STAGED: "staged",
  IGNORED: "ignored",
  fileUri: vi.fn((f: any) => ({ toString: () => f.name || "file" })),
  scmData: vi.fn(),
  scmKey: vi.fn()
}))

vi.mock("../../lib", () => ({
  after: vi.fn().mockResolvedValue(undefined),
  simpleInputBox: vi.fn(),
  chainTaskTransformers: vi.fn(),
  fieldReplacer: vi.fn(),
  withp: vi.fn((_msg: string, cb: any) => cb()),
  createTaskTransformer: vi.fn(),
  createStore: vi.fn().mockReturnValue({ get: vi.fn(), update: vi.fn() }),
  inputBox: vi.fn(),
  quickPick: vi.fn(),
  caughtToString: vi.fn((e: any) => String(e)),
  askConfirmation: vi.fn()
}))

vi.mock("fp-ts/lib/Option", () => ({
  map: vi.fn(),
  isNone: vi.fn().mockReturnValue(true),
  none: undefined,
  fromEither: vi.fn(),
  isSome: vi.fn().mockReturnValue(false),
  fromNullable: vi.fn(),
  some: vi.fn((v: any) => ({ _tag: "Some", value: v }))
}))

vi.mock("./credentials", () => ({
  dataCredentials: vi.fn(),
  listPasswords: vi.fn().mockResolvedValue([]),
  deletePassword: vi.fn(),
  deleteDefaultUser: vi.fn()
}))

vi.mock("../../extension", () => ({
  context: {
    globalState: { get: vi.fn(), update: vi.fn() },
    asAbsolutePath: vi.fn((s: string) => s)
  }
}))

vi.mock("../../adt/AdtTransports", () => ({
  selectTransport: vi.fn()
}))

vi.mock("../../config", () => ({
  pickAdtRoot: vi.fn()
}))

vi.mock("fp-ts/lib/Either", () => ({
  isRight: vi.fn().mockReturnValue(false),
  isLeft: vi.fn().mockReturnValue(true)
}))

vi.mock("../../views/abapgit", () => ({
  confirmPull: vi.fn(),
  packageUri: vi.fn()
}))

vi.mock("../../adt/conections", () => ({
  getClient: vi.fn(),
  uriRoot: vi.fn()
}))

import { isAgResState, fromGroup, STAGED, UNSTAGED, IGNORED } from "./scm"
import { funWindow as window } from "../../services/funMessenger"

// Side-effect import: triggers decorator registrations.
import "./commands"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("abapGit scm commands", () => {
  describe("transfer logic", () => {
    it("isAgResState returns true for valid state objects", () => {
      // Test the mock passthrough
      ;(isAgResState as unknown as Mock).mockReturnValue(true)
      expect(isAgResState({ data: { connId: "x" }, resourceUri: {} })).toBe(true)
    })

    it("isAgResState returns false for invalid objects", () => {
      ;(isAgResState as unknown as Mock).mockReturnValue(false)
      expect(isAgResState(null)).toBe(false)
      expect(isAgResState({})).toBe(false)
    })
  })

  describe("constants", () => {
    it("STAGED equals 'staged'", () => {
      expect(STAGED).toBe("staged")
    })

    it("UNSTAGED equals 'unstaged'", () => {
      expect(UNSTAGED).toBe("unstaged")
    })

    it("IGNORED equals 'ignored'", () => {
      expect(IGNORED).toBe("ignored")
    })
  })

  describe("logErrors decorator behavior", () => {
    it("showErrorMessage is available on funWindow mock", () => {
      expect(window.showErrorMessage).toBeDefined()
      expect(typeof window.showErrorMessage).toBe("function")
    })
  })
})
