vi.mock("vscode", () => ({
  Uri: {
    parse: vi.fn((s: string) => ({ scheme: "adt", path: "/path", toString: () => s }))
  },
  FileStat: vi.fn()
}), { virtual: true })

vi.mock("../../services/funMessenger", () => ({
  funWindow: {
    showQuickPick: vi.fn(),
    showInputBox: vi.fn()
  }
}))

vi.mock("../AdtTransports", () => ({ selectTransport: vi.fn() }))

vi.mock("../../lib", () => ({
  fieldOrder: () => () => 0,
  quickPick: vi.fn(),
  rfsExtract: vi.fn(),
  rfsTaskEither: vi.fn(),
  rfsTryCatch: vi.fn(),
  log: vi.fn()
}))

vi.mock("./AdtObjectFinder", () => ({
  MySearchResult: vi.fn(),
  AdtObjectFinder: vi.fn().mockImplementation(() => ({
    findObject: vi.fn(),
    vscodeUriWithFile: vi.fn()
  })),
  pathSequence: vi.fn().mockReturnValue([]),
  createUri: vi.fn()
}))

vi.mock("../conections", () => ({
  getClient: vi.fn().mockReturnValue({ username: "TESTUSER", validateNewObject: vi.fn().mockResolvedValue(true), createObject: vi.fn() }),
  getRoot: vi.fn().mockReturnValue({ getNode: vi.fn() })
}))

vi.mock("abapfs", () => ({
  isAbapFolder: vi.fn().mockReturnValue(false),
  isAbapStat: vi.fn().mockImplementation((x: any) => x != null && typeof x === "object" && x.object != null),
  isFolder: vi.fn().mockReturnValue(false)
}))

vi.mock("abapobject", () => ({ fromNode: vi.fn() }))

vi.mock("abap-adt-api", () => ({
  CreatableTypes: new Map([
    ["PROG/P", { typeId: "PROG/P", label: "Program", maxLen: 40 }],
    ["CLAS/OC", { typeId: "CLAS/OC", label: "Class", maxLen: 30 }],
    ["DEVC/K", { typeId: "DEVC/K", label: "Package", maxLen: 30 }]
  ]),
  objectPath: vi.fn((type: string, name?: string, parent?: string) => `/sap/bc/adt/${type}/${name}`),
  parentTypeId: vi.fn().mockReturnValue("DEVC/K"),
  isGroupType: vi.fn().mockReturnValue(false),
  isPackageType: vi.fn().mockReturnValue(false),
  isBindingOptions: vi.fn().mockReturnValue(false),
  hasPackageOptions: vi.fn().mockReturnValue(false),
  BindinTypes: [],
  PackageTypes: []
}))

vi.mock("fp-ts/lib/pipeable", () => ({ pipe: vi.fn((v: any) => v) }))
vi.mock("fp-ts/lib/TaskEither", () => ({
  bind: vi.fn(),
  chain: vi.fn(),
  map: vi.fn()
}))

import { AdtObjectCreator, selectObjectType, PACKAGE, TMPPACKAGE } from "./AdtObjectCreator"

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("constants", () => {
  it("PACKAGE is DEVC/K", () => {
    expect(PACKAGE).toBe("DEVC/K")
  })

  it("TMPPACKAGE is $TMP", () => {
    expect(TMPPACKAGE).toBe("$TMP")
  })
})

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("selectObjectType", () => {
  it("calls showQuickPick with all creatable types when no parent type", async () => {
    const { funWindow } = require("../../services/funMessenger")
    ;(funWindow.showQuickPick as Mock).mockResolvedValue({
      typeId: "PROG/P",
      label: "Program",
      maxLen: 40
    })
    const result = await selectObjectType()
    expect(funWindow.showQuickPick).toHaveBeenCalled()
    expect(result?.typeId).toBe("PROG/P")
  })

  it("returns undefined when user cancels", async () => {
    const { funWindow } = require("../../services/funMessenger")
    ;(funWindow.showQuickPick as Mock).mockResolvedValue(undefined)
    const result = await selectObjectType()
    expect(result).toBeUndefined()
  })

  it("filters types by parent type when parentType is provided", async () => {
    const { funWindow } = require("../../services/funMessenger")
    ;(funWindow.showQuickPick as Mock).mockResolvedValue(undefined)
    const { parentTypeId } = require("abap-adt-api")
    ;(parentTypeId as Mock).mockReturnValue("DEVC/K")
    await selectObjectType("DEVC/K")
    expect(funWindow.showQuickPick).toHaveBeenCalled()
  })
})

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("AdtObjectCreator", () => {
  let creator: AdtObjectCreator

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset isAbapStat to its original implementation (clearAllMocks doesn't reset mockReturnValue)
    const { isAbapStat } = require("abapfs")
    ;(isAbapStat as Mock).mockImplementation((x: any) => x != null && typeof x === "object" && x.object != null)
    creator = new AdtObjectCreator("testconn")
  })

  it("constructs with connId", () => {
    expect(creator).toBeDefined()
  })

  it("guessParentByType returns empty string when no match", () => {
    const { isAbapStat } = require("abapfs")
    ;(isAbapStat as Mock).mockReturnValue(false)
    const result = creator.guessParentByType([], "DEVC/K")
    expect(result).toBe("")
  })

  it("guessParentByType finds matching type in hierarchy", () => {
    const { isAbapStat } = require("abapfs")
    ;(isAbapStat as Mock).mockReturnValue(true)
    const hierarchy: any[] = [
      { object: { type: "DEVC/K", name: "ZPACKAGE" } },
      { object: { type: "PROG/P", name: "ZPROG" } }
    ]
    const result = creator.guessParentByType(hierarchy, "DEVC/K")
    expect(result).toBe("ZPACKAGE")
  })

  it("guessParentByType returns empty when no matching type", () => {
    const { isAbapStat } = require("abapfs")
    ;(isAbapStat as Mock).mockReturnValue(true)
    const hierarchy: any[] = [{ object: { type: "PROG/P", name: "ZPROG" } }]
    const result = creator.guessParentByType(hierarchy, "DEVC/K")
    expect(result).toBe("")
  })

  it("getObjectTypes loads types from client", async () => {
    const { getClient } = require("../conections")
    const { getRoot } = require("../conections")
    ;(getClient as Mock).mockReturnValue({
      loadTypes: vi.fn().mockResolvedValue([
        { OBJECT_TYPE: "PROG/P", PARENT_OBJECT_TYPE: "" }
      ])
    })
    ;(getRoot as Mock).mockReturnValue({
      getNode: vi.fn().mockReturnValue(null)
    })
    const { Uri } = require("vscode")
    const uri = Uri.parse("adt://conn/path")
    const types = await creator.getObjectTypes(uri)
    expect(Array.isArray(types)).toBe(true)
  })

  it("createObject returns undefined when user cancels type selection", async () => {
    // createObject calls guessOrSelectObjectType which needs a non-empty hierarchy
    // With empty hierarchy, selectObjectType is called - mock it to return undefined (cancelled)
    const { funWindow } = require("../../services/funMessenger")
    ;(funWindow.showQuickPick as Mock).mockResolvedValue(undefined)
    // getRoot returns a root that getNodePath returns [] for
    const { getRoot } = require("../conections")
    ;(getRoot as Mock).mockReturnValue({
      getNode: vi.fn().mockReturnValue(null),
      getNodePath: vi.fn().mockReturnValue([])
    })
    const { pathSequence } = require("./AdtObjectFinder")
    ;(pathSequence as Mock).mockReturnValue([])
    const result = await creator.createObject(undefined)
    expect(result).toBeUndefined()
  })
})
