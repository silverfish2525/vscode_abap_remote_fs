vi.mock("vscode", () => ({
  FileSystemError: {
    FileNotFound: (msg: string) => new Error(`FileNotFound: ${msg}`)
  },
  workspace: {
    workspaceFolders: undefined
  },
  Uri: {
    parse: vi.fn((s: string) => ({ scheme: s.split("://")[0], authority: s.split("://")[1]?.split("/")[0], toString: () => s }))
  }
}), { virtual: true })

vi.mock("../config", () => ({
  RemoteManager: { get: vi.fn() },
  createClient: vi.fn()
}))

vi.mock("./debugger", () => ({ LogOutPendingDebuggers: vi.fn().mockResolvedValue([]) }))
vi.mock("../services/sapSystemValidator", () => ({
  SapSystemValidator: {
    getInstance: vi.fn().mockReturnValue({ validateSystemAccess: vi.fn().mockResolvedValue(undefined) })
  }
}))
vi.mock("../fs/LocalFsProvider", () => ({
  LocalFsProvider: { useLocalStorage: vi.fn().mockReturnValue(false) }
}))
vi.mock("../lib", () => ({ log: vi.fn() }))
vi.mock("abapfs", () => ({}))

import { ADTSCHEME, ADTURIPATTERN, abapUri, getClient, getRoot, rootIsConnected } from "./conections"

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("ADTSCHEME", () => {
  it("is 'adt'", () => {
    expect(ADTSCHEME).toBe("adt")
  })
})

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("ADTURIPATTERN", () => {
  it("matches ADT URI paths", () => {
    expect(ADTURIPATTERN.test("/sap/bc/adt/programs/programs/zprog")).toBe(true)
    expect(ADTURIPATTERN.test("/sap/bc/adt/classes/classes/zcl_test/source/main")).toBe(true)
  })

  it("does not match non-ADT paths", () => {
    expect(ADTURIPATTERN.test("/some/other/path")).toBe(false)
    expect(ADTURIPATTERN.test("/sap/bc/gui")).toBe(false)
  })
})

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("abapUri", () => {
  it("returns true for adt:// URIs", () => {
    const uri = { scheme: "adt" } as any
    expect(abapUri(uri)).toBe(true)
  })

  it("returns false for file:// URIs", () => {
    const uri = { scheme: "file" } as any
    expect(abapUri(uri)).toBe(false)
  })

  it("returns false/undefined for undefined", () => {
    expect(abapUri(undefined)).toBeFalsy()
  })

  it("returns false for untitled scheme", () => {
    const uri = { scheme: "untitled" } as any
    expect(abapUri(uri)).toBeFalsy()
  })
})

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("getClient", () => {
  it("throws when connection not established", () => {
    expect(() => getClient("nonexistent_conn")).toThrow()
  })

  it("throws with helpful message about inaccessible system", () => {
    expect(() => getClient("nonexistent_conn")).toThrow(/not accessible|not found/i)
  })
})

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("getRoot", () => {
  it("throws FileNotFound when root not established", () => {
    expect(() => getRoot("nonexistent_conn")).toThrow(/FileNotFound/)
  })
})

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("rootIsConnected", () => {
  it("returns false when workspaceFolders is undefined", () => {
    const { workspace } = require("vscode")
    workspace.workspaceFolders = undefined
    expect(rootIsConnected("myconn")).toBe(false)
  })

  it("returns false when no matching ADT folder", () => {
    const { workspace } = require("vscode")
    workspace.workspaceFolders = [
      { uri: { scheme: "file", authority: "myconn" } }
    ]
    expect(rootIsConnected("myconn")).toBe(false)
  })

  it("returns true when matching ADT folder exists", () => {
    const { workspace } = require("vscode")
    workspace.workspaceFolders = [
      { uri: { scheme: "adt", authority: "myconn" } }
    ]
    expect(rootIsConnected("myconn")).toBe(true)
  })

  it("is case-insensitive for connId", () => {
    const { workspace } = require("vscode")
    workspace.workspaceFolders = [
      { uri: { scheme: "adt", authority: "myconn" } }
    ]
    expect(rootIsConnected("MYCONN")).toBe(true)
  })
})
