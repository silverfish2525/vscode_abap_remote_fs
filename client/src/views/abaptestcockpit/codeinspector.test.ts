import { getVariant, runInspectorByAdtUrl, runInspector, findingPragmas } from "./codeinspector"

vi.mock("vscode", () => ({
  Uri: {
    parse: vi.fn(function (s: string) { return ({ toString: () => s, scheme: "adt", authority: "sys" }) })
  }
}))

vi.mock("../../adt/conections", () => ({
  getClient: vi.fn()
}))

vi.mock("../../adt/operations/AdtObjectFinder", () => ({
  findAbapObject: vi.fn()
}))

vi.mock("../../config", () => ({
  RemoteManager: {
    get: vi.fn()
  }
}))

vi.mock("./functions", () => ({
  extractPragmas: vi.fn()
}))

import { getClient } from "../../adt/conections"
import { findAbapObject } from "../../adt/operations/AdtObjectFinder"
import { RemoteManager } from "../../config"
import { extractPragmas } from "./functions"

const mockGetClient = getClient as MockedFunction<typeof getClient>
const mockFindAbapObject = findAbapObject as MockedFunction<typeof findAbapObject>
const mockRemoteManager = RemoteManager.get as MockedFunction<typeof RemoteManager.get>
const mockExtractPragmas = extractPragmas as MockedFunction<typeof extractPragmas>

describe("getVariant", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns variant from connection config when atcVariant is set", async () => {
    const mockCheckVariant = { id: "myvariant" }
    const mockClient = {
      atcCheckVariant: vi.fn().mockResolvedValue(mockCheckVariant),
      atcCustomizing: vi.fn()
    }
    mockRemoteManager.mockReturnValue({
      byId: vi.fn().mockReturnValue({ atcVariant: "MYVARIANT" })
    } as any)

    const result = await getVariant(mockClient as any, "myconn")

    expect(mockClient.atcCheckVariant).toHaveBeenCalledWith("MYVARIANT")
    expect(result).toEqual({ variant: "MYVARIANT", checkVariant: mockCheckVariant })
  })

  it("throws when atcVariant is configured but checkVariant is falsy", async () => {
    const mockClient = {
      atcCheckVariant: vi.fn().mockResolvedValue(null),
      atcCustomizing: vi.fn()
    }
    mockRemoteManager.mockReturnValue({
      byId: vi.fn().mockReturnValue({ atcVariant: "BADVARIANT" })
    } as any)

    await expect(getVariant(mockClient as any, "myconn")).rejects.toThrow(
      "No ATC variant found for system myconn"
    )
  })

  it("falls back to system customizing when no atcVariant in config", async () => {
    const mockCheckVariant = { id: "system_variant" }
    const mockClient = {
      atcCheckVariant: vi.fn().mockResolvedValue(mockCheckVariant),
      atcCustomizing: vi.fn().mockResolvedValue({
        properties: [{ name: "systemCheckVariant", value: "DEFAULT" }]
      })
    }
    mockRemoteManager.mockReturnValue({
      byId: vi.fn().mockReturnValue({})
    } as any)

    const result = await getVariant(mockClient as any, "myconn")

    expect(mockClient.atcCustomizing).toHaveBeenCalled()
    expect(mockClient.atcCheckVariant).toHaveBeenCalledWith("DEFAULT")
    expect(result).toEqual({ variant: "DEFAULT", checkVariant: mockCheckVariant })
  })

  it("throws when no connection found", async () => {
    const mockClient = {
      atcCheckVariant: vi.fn().mockResolvedValue(null),
      atcCustomizing: vi.fn().mockResolvedValue({
        properties: [{ name: "systemCheckVariant", value: "DEFAULT" }]
      })
    }
    mockRemoteManager.mockReturnValue({
      byId: vi.fn().mockReturnValue(null)
    } as any)

    await expect(getVariant(mockClient as any, "myconn")).rejects.toThrow(
      "No ATC variant found for system myconn"
    )
  })

  it("throws when systemCheckVariant not in customizing properties", async () => {
    const mockClient = {
      atcCheckVariant: vi.fn().mockResolvedValue(null),
      atcCustomizing: vi.fn().mockResolvedValue({
        properties: []
      })
    }
    mockRemoteManager.mockReturnValue({
      byId: vi.fn().mockReturnValue({})
    } as any)

    await expect(getVariant(mockClient as any, "myconn")).rejects.toThrow(
      "No ATC variant found for system myconn"
    )
  })
})

describe("runInspectorByAdtUrl", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates ATC run and returns worklist", async () => {
    const mockWorklist = { objects: [] }
    const mockRun = { id: "run1", timestamp: "2024-01-01" }
    const mockClient = {
      createAtcRun: vi.fn().mockResolvedValue(mockRun),
      atcWorklists: vi.fn().mockReturnValue(mockWorklist)
    }

    const result = await runInspectorByAdtUrl("/some/uri", "MYVARIANT", mockClient as any)

    expect(mockClient.createAtcRun).toHaveBeenCalledWith("MYVARIANT", "/some/uri")
    expect(mockClient.atcWorklists).toHaveBeenCalledWith(
      "run1",
      "2024-01-01",
      "99999999999999999999999999999999"
    )
    expect(result).toBe(mockWorklist)
  })
})

describe("runInspector", () => {
  beforeEach(() => vi.clearAllMocks())

  it("loads structure if not present and delegates to runInspectorByAdtUrl", async () => {
    const mockWorklist = { objects: [] }
    const mockRun = { id: "run1", timestamp: "ts" }
    const mockClient = {
      createAtcRun: vi.fn().mockResolvedValue(mockRun),
      atcWorklists: vi.fn().mockReturnValue(mockWorklist)
    }
    const mockObject = {
      structure: null,
      loadStructure: vi.fn().mockResolvedValue(undefined),
      contentsPath: vi.fn().mockReturnValue("/some/path")
    }
    mockFindAbapObject.mockResolvedValue(mockObject as any)

    const mockUri = { toString: () => "adt://sys/path" } as any
    const result = await runInspector(mockUri, "MYVARIANT", mockClient as any)

    expect(mockFindAbapObject).toHaveBeenCalledWith(mockUri)
    expect(mockObject.loadStructure).toHaveBeenCalled()
    expect(mockObject.contentsPath).toHaveBeenCalled()
    expect(result).toBe(mockWorklist)
  })

  it("skips loadStructure when structure already present", async () => {
    const mockWorklist = { objects: [] }
    const mockRun = { id: "run1", timestamp: "ts" }
    const mockClient = {
      createAtcRun: vi.fn().mockResolvedValue(mockRun),
      atcWorklists: vi.fn().mockReturnValue(mockWorklist)
    }
    const mockObject = {
      structure: { name: "already loaded" },
      loadStructure: vi.fn(),
      contentsPath: vi.fn().mockReturnValue("/some/path")
    }
    mockFindAbapObject.mockResolvedValue(mockObject as any)

    await runInspector({} as any, "MYVARIANT", mockClient as any)

    expect(mockObject.loadStructure).not.toHaveBeenCalled()
  })
})

describe("findingPragmas", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches pragma from finding link and extracts pragmas", async () => {
    const mockPragmas = ["##NO_TEXT"]
    mockExtractPragmas.mockReturnValue(mockPragmas)
    const mockClient = {
      httpClient: {
        request: vi.fn().mockResolvedValue({ body: "<html>pragma content</html>" })
      }
    }
    mockGetClient.mockReturnValue(mockClient as any)

    const mockFinding = {
      link: { href: "/sap/bc/adt/atc/issues/docs/1" }
    } as any

    const result = await findingPragmas("myconn", mockFinding)

    expect(mockGetClient).toHaveBeenCalledWith("myconn")
    expect(mockClient.httpClient.request).toHaveBeenCalledWith("/sap/bc/adt/atc/issues/docs/1")
    expect(mockExtractPragmas).toHaveBeenCalledWith("<html>pragma content</html>")
    expect(result).toEqual(mockPragmas)
  })

  it("returns empty array when no pragmas found", async () => {
    mockExtractPragmas.mockReturnValue([])
    const mockClient = {
      httpClient: {
        request: vi.fn().mockResolvedValue({ body: "<html>no pragma</html>" })
      }
    }
    mockGetClient.mockReturnValue(mockClient as any)

    const result = await findingPragmas("conn", { link: { href: "/doc" } } as any)
    expect(result).toEqual([])
  })
})
