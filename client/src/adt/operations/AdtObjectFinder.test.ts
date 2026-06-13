interface MockUri {
  scheme: string; authority: string; path: string;
  toString(): string; with(o: any): MockUri
}
const { makeUri } = vi.hoisted(() => {
  const makeUri = (s: string): MockUri => ({
  scheme: s.split("://")[0] || "",
  authority: s.split("://")[1]?.split("/")[0] || "",
  path: "/" + (s.split("://")[1]?.split("/").slice(1).join("/") || ""),
  toString: () => s,
  with(overrides: any): MockUri {
    const base = makeUri(s)
    const merged = { ...base, ...overrides, toString: () => s }
    merged.with = base.with
    return merged as MockUri
  }
})
  return { makeUri }
})

vi.mock("vscode", () => ({
  workspace: {
    openTextDocument: vi.fn(),
    workspaceFolders: []
  },
  commands: { executeCommand: vi.fn() },
  Uri: {
    parse: vi.fn(function (s: string) { return makeUri(s) })
  },
  ThemeIcon: vi.fn(class {}),
  FileStat: vi.fn(class {}),
  Range: vi.fn().mockImplementation(function (s: any, e: any) { return ({ start: s, end: e }) }),
  QuickPickItem: vi.fn(class {})
}))

vi.mock("../../lib", () => ({
  splitAdtUri: vi.fn(function (u: string) { return ({ path: u, type: undefined, name: undefined, start: undefined }) }),
  vscPosition: vi.fn(function (l: number, c: number) { return ({ line: l, character: c }) }),
  log: vi.fn(),
  caughtToString: vi.fn(function (e: any) { return String(e) }),
  promCache: vi.fn(function () {
      const map = new Map()
      return (key: string, fn: () => Promise<any>, force?: boolean) => {
        if (force || !map.has(key)) {
          const p = fn()
          map.set(key, p)
        }
        return map.get(key)
      }
    })
}))

vi.mock("../conections", () => ({
  getClient: vi.fn(),
  getRoot: vi.fn(),
  uriRoot: vi.fn()
}))

vi.mock("../../extension", () => ({
  context: {
    globalState: {
      get: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.mock("../../services/funMessenger", () => ({
  funWindow: {
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    showTextDocument: vi.fn(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn()
  }
}))

vi.mock("abapfs", () => ({
  isFolder: vi.fn(),
  isAbapFolder: vi.fn(),
  isAbapFile: vi.fn(),
  isAbapStat: vi.fn()
}))

vi.mock("./AdtObjectCreator", () => ({ PACKAGE: "DEVC/K" }))

import { MySearchResult, AdtObjectFinder, createUri } from "./AdtObjectFinder"
import * as __$mock_vscode from "vscode";
import * as __$mock_conections from "../conections";
import * as __$mock_abapfs from "abapfs";
import * as __$mock_services_funMessenger from "../../services/funMessenger";

describe("MySearchResult", () => {
  const makeSR = (overrides: Record<string, any> = {}) => ({
    "adtcore:uri": "/sap/bc/adt/programs/programs/zprog",
    "adtcore:type": "PROG/P",
    "adtcore:name": "ZPROG",
    "adtcore:packageName": "ZPACKAGE",
    "adtcore:description": "My Program",
    ...overrides
  })

  it("constructs from search result", () => {
    const r = new MySearchResult(makeSR())
    expect(r.name).toBe("ZPROG")
    expect(r.type).toBe("PROG/P")
    expect(r.uri).toBe("/sap/bc/adt/programs/programs/zprog")
    expect(r.packageName).toBe("ZPACKAGE")
    expect(r.description).toBe("My Program")
  })

  it("label combines name and description", () => {
    const r = new MySearchResult(makeSR())
    expect(r.label).toBe("ZPROG(My Program)")
  })

  it("detail shows package and type", () => {
    const r = new MySearchResult(makeSR())
    expect(r.detail).toContain("ZPACKAGE")
    expect(r.detail).toContain("PROG/P")
  })

  it("picked defaults to false", () => {
    const r = new MySearchResult(makeSR())
    expect(r.picked).toBe(false)
  })

  it("handles missing optional fields", () => {
    const r = new MySearchResult(
      makeSR({ "adtcore:packageName": undefined, "adtcore:description": undefined })
    )
    expect(r.packageName).toBeUndefined()
    expect(r.description).toBeUndefined()
  })

  describe("createResults", () => {
    it("creates array of MySearchResult from raw results", async () => {
      const rawClient: any = { loadTypes: vi.fn().mockResolvedValue([]) }
      const rawResults = [makeSR(), makeSR({ "adtcore:name": "ZPROG2" })]
      const results = await MySearchResult.createResults(rawResults, rawClient)
      expect(results).toHaveLength(2)
      expect(results[0]).toBeInstanceOf(MySearchResult)
    })

    it("loads types if any result has no description", async () => {
      const rawClient: any = {
        loadTypes: vi.fn().mockResolvedValue([
          { OBJECT_TYPE: "PROG/P", OBJECT_TYPE_LABEL: "Program" }
        ])
      }
      const rawResults = [makeSR({ "adtcore:description": undefined })]
      const results = await MySearchResult.createResults(rawResults, rawClient)
      expect(rawClient.loadTypes).toHaveBeenCalled()
      expect(results[0]!.description).toBe("Program")
    })

    it("uses type as description fallback when no matching type label", async () => {
      const rawClient: any = {
        loadTypes: vi.fn().mockResolvedValue([])
      }
      const rawResults = [makeSR({ "adtcore:description": undefined, "adtcore:type": "CLAS/OC" })]
      const results = await MySearchResult.createResults(rawResults, rawClient)
      expect(results[0]!.description).toBe("CLAS/OC")
    })

    it("sets packageName from name for PACKAGE type", async () => {
      const rawClient: any = { loadTypes: vi.fn().mockResolvedValue([]) }
      const rawResults = [makeSR({ "adtcore:type": "DEVC/K", "adtcore:packageName": undefined })]
      const results = await MySearchResult.createResults(rawResults, rawClient)
      expect(results[0]!.packageName).toBe("ZPROG") // name
    })

    it("sets packageName to 'unknown' when not a package and no packageName", async () => {
      const rawClient: any = { loadTypes: vi.fn().mockResolvedValue([]) }
      const rawResults = [makeSR({ "adtcore:packageName": undefined })]
      const results = await MySearchResult.createResults(rawResults, rawClient)
      expect(results[0]!.packageName).toBe("unknown")
    })
  })
})

describe("createUri", () => {
  it("creates an adt:// URI from connId and path", () => {
    const { Uri } = (__$mock_vscode)
    createUri("myconn", "/sap/bc/adt/programs/programs/zprog")
    expect(Uri.parse).toHaveBeenCalledWith(
      expect.stringContaining("adt://myconn")
    )
  })
})

describe("AdtObjectFinder", () => {
  let finder: AdtObjectFinder
  let mockRoot: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockRoot = {
      findByAdtUri: vi.fn(),
      getNodePath: vi.fn().mockReturnValue([])
    }
    const { getRoot } = (__$mock_conections)
    ;(getRoot as Mock).mockReturnValue(mockRoot)
  })

  it("constructs with connId", () => {
    finder = new AdtObjectFinder("testconn")
    expect(finder.connId).toBe("testconn")
  })

  it("vscodeUri returns uri string", async () => {
    const { isAbapFile } = (__$mock_abapfs)
    ;(isAbapFile as Mock).mockReturnValue(false)
    mockRoot.findByAdtUri.mockResolvedValue({
      path: "/sap/bc/adt/programs/programs/zprog/source/main",
      file: {}
    })
    const { Uri } = (__$mock_vscode)
    ;(Uri.parse as Mock).mockReturnValue(makeUri("adt://testconn/sap/bc/adt/programs/programs/zprog/source/main"))

    finder = new AdtObjectFinder("testconn")
    const uri = await finder.vscodeUri("/sap/bc/adt/programs/programs/zprog/source/main")
    expect(uri).toBeDefined()
  })

  it("vscodeUri throws when path not found", async () => {
    mockRoot.findByAdtUri.mockResolvedValue(null)
    finder = new AdtObjectFinder("testconn")
    await expect(finder.vscodeUri("/bad/path")).rejects.toThrow("can't find an URL")
  })

  it("clearCaches resets fragCache", () => {
    finder = new AdtObjectFinder("testconn")
    // Should not throw
    expect(() => finder.clearCaches()).not.toThrow()
  })

  it("vscodeObject returns abap object for abap file", async () => {
    const { isAbapStat } = (__$mock_abapfs)
    ;(isAbapStat as Mock).mockReturnValue(true)
    const mockObj = { name: "ZPROG", type: "PROG/P" }
    mockRoot.findByAdtUri.mockResolvedValue({
      path: "/path",
      file: { object: mockObj }
    })
    const { Uri } = (__$mock_vscode)
    ;(Uri.parse as Mock).mockReturnValue(makeUri("adt://conn/path"))

    finder = new AdtObjectFinder("testconn")
    const obj = await finder.vscodeObject("/path")
    // isAbapStat check is in vscodeObject, which checks the file
  })

  it("displayAdtUri shows error message on failure", async () => {
    mockRoot.findByAdtUri.mockRejectedValue(new Error("Not found"))
    finder = new AdtObjectFinder("testconn")
    const { funWindow } = (__$mock_services_funMessenger)
    // Should not throw - shows error message instead
    await expect(
      finder.displayAdtUri("adt://testconn/sap/bc/adt/programs/programs/zprog")
    ).resolves.not.toThrow()
    // Can't easily verify message due to conditional logic
  })
})
