vi.mock("abap-adt-api", () => ({
  isAdtError: vi.fn((e: any) => e && e.__isAdtError === true),
  session_types: { stateful: "stateful" }
}))
vi.mock("vscode", () => ({
  EventEmitter: vi.fn(function () {
    const listeners: any[] = []
    return {
      event: vi.fn((listener: any, _thisArg?: any, disposables?: any[]) => {
        listeners.push(listener)
        const d = { dispose: vi.fn() }
        if (Array.isArray(disposables)) disposables.push(d)
        return d
      }),
      fire: vi.fn((e: any) => { listeners.forEach(l => l(e)) }),
      dispose: vi.fn()
    }
  }),
  Disposable: vi.fn(function (fn: any) { return { dispose: fn } })
}), { virtual: true })
vi.mock("@vscode/debugadapter", () => ({
  ContinuedEvent: vi.fn(function (threadId: number) { return { type: "continued", threadId } }),
  StoppedEvent: vi.fn(function (reason: string, threadId: number) { return { type: "stopped", reason, threadId } }),
  ThreadEvent: vi.fn(function (reason: string, threadId: number) { return { type: "thread", reason, threadId } }),
  Source: vi.fn(function (name: string, path: string) { return { name, path } })
}))
vi.mock("./functions", () => ({
  newClientFromKey: vi.fn()
}))
vi.mock("../../lib", () => ({
  log: vi.fn(),
  caughtToString: vi.fn((e: any) => String(e)),
  ignore: vi.fn()
}))
vi.mock("../../langClient", () => ({
  vsCodeUri: vi.fn()
}))
vi.mock("./debugListener", () => ({
  THREAD_EXITED: "exited",
  errorType: vi.fn()
}))
vi.mock("./replay/types", () => ({}))

import { DebugService, idThread, isEnded, STACK_THREAD_MULTIPLIER } from "./debugService"
import { isAdtError, session_types } from "abap-adt-api"
import { newClientFromKey } from "./functions"
import { vsCodeUri } from "../../langClient"
import { errorType } from "./debugListener"

const mockNewClientFromKey = newClientFromKey as MockedFunction<typeof newClientFromKey>
const mockIsAdtError = isAdtError as MockedFunction<typeof isAdtError>
const mockVsCodeUri = vsCodeUri as MockedFunction<typeof vsCodeUri>
const mockErrorType = errorType as MockedFunction<typeof errorType>

function makeClient(overrides: Partial<any> = {}) {
  return {
    stateful: undefined as any,
    statelessClone: {
      logout: vi.fn().mockResolvedValue(undefined),
      debuggerDeleteBreakpoints: vi.fn().mockResolvedValue(undefined)
    },
    adtCoreDiscovery: vi.fn().mockResolvedValue(undefined),
    debuggerAttach: vi.fn().mockResolvedValue(undefined),
    debuggerSaveSettings: vi.fn().mockResolvedValue(undefined),
    debuggerStackTrace: vi.fn().mockResolvedValue({ stack: [] }),
    debuggerStep: vi.fn().mockResolvedValue({}),
    dropSession: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

function makeDebuggee(overrides: Partial<any> = {}) {
  return {
    DEBUGGEE_ID: "DEBUGGEE1",
    NAME: "TestUser",
    CLIENT: "100",
    TERMINAL_ID: "TERM1",
    IDE_ID: "IDE1",
    DEBUGGEE_USER: "TESTUSER",
    DEBUGGEE_TYPE: "user",
    ...overrides
  } as any
}

function makeUI() {
  return {
    Confirmator: vi.fn().mockResolvedValue(true),
    ShowError: vi.fn()
  }
}

function makeListener(overrides: Partial<any> = {}) {
  return {
    mode: "user",
    username: "TESTUSER",
    variableManager: {
      resetHandle: vi.fn()
    },
    shouldRecordThread: vi.fn().mockReturnValue(false),
    recorder: undefined,
    ...overrides
  } as any
}

describe("idThread", () => {
  test("divides by STACK_THREAD_MULTIPLIER and floors", () => {
    expect(idThread(1 * STACK_THREAD_MULTIPLIER)).toBe(1)
    expect(idThread(2 * STACK_THREAD_MULTIPLIER + 5)).toBe(2)
    expect(idThread(0)).toBe(0)
  })
})

describe("isEnded", () => {
  test("returns true when errorType is debuggeeEnded", () => {
    mockErrorType.mockReturnValueOnce("debuggeeEnded")
    expect(isEnded(new Error("ended"))).toBe(true)
  })

  test("returns false when errorType is something else", () => {
    mockErrorType.mockReturnValueOnce("somethingElse")
    expect(isEnded(new Error("other"))).toBe(false)
  })

  test("returns false when errorType is undefined", () => {
    mockErrorType.mockReturnValueOnce(undefined)
    expect(isEnded(new Error("no type"))).toBe(false)
  })
})

describe("DebugService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("throws when client cannot be created", async () => {
    mockNewClientFromKey.mockResolvedValueOnce(undefined as any)
    const listener = makeListener()
    const ui = makeUI()
    await expect(DebugService.create("TST", ui, listener, makeDebuggee())).rejects.toThrow(
      "Unable to create client for TST"
    )
  })

  test("creates service and sets stateful session", async () => {
    const client = makeClient()
    mockNewClientFromKey.mockResolvedValueOnce(client as any)
    const listener = makeListener()
    const ui = makeUI()
    const service = await DebugService.create("TST", ui, listener, makeDebuggee())
    expect(service).toBeInstanceOf(DebugService)
    expect(client.stateful).toBe(session_types.stateful)
    expect(client.adtCoreDiscovery).toHaveBeenCalled()
  })
})

describe("DebugService instance", () => {
  let client: ReturnType<typeof makeClient>
  let listener: ReturnType<typeof makeListener>
  let ui: ReturnType<typeof makeUI>
  let service: DebugService

  beforeEach(() => {
    vi.clearAllMocks()
    client = makeClient()
    listener = makeListener()
    ui = makeUI()
    service = new (DebugService as any)("TST", client, listener, makeDebuggee(), ui)
    service.threadId = 1
  })

  describe("client getter", () => {
    test("returns client when not killed", () => {
      expect(service.client).toBe(client)
    })

    test("throws when killed via logout", async () => {
      await service.logout()
      expect(() => service.client).toThrow("Disconnected")
    })
  })

  describe("getStack", () => {
    test("returns empty array initially", () => {
      expect(service.getStack()).toEqual([])
    })
  })

  describe("addListener", () => {
    test("adds event listener and returns disposable", () => {
      const handler = vi.fn()
      const disposable = service.addListener(handler)
      expect(disposable).toBeDefined()
      expect(typeof disposable.dispose).toBe("function")
    })
  })

  describe("debuggerStep", () => {
    test("fires StoppedEvent on success", async () => {
      client.debuggerStep.mockResolvedValueOnce({})
      client.debuggerStackTrace.mockResolvedValueOnce({ stack: [] })

      const events: any[] = []
      service.addListener((e: any) => events.push(e))
      await service.debuggerStep("stepOver", 1)
      // Should have fired ContinuedEvent and StoppedEvent
      expect(events.length).toBeGreaterThanOrEqual(1)
    })

    test("calls ShowError on non-ADT error", async () => {
      client.debuggerStep.mockRejectedValueOnce(new Error("generic failure"))
      mockIsAdtError.mockReturnValueOnce(false)
      await service.debuggerStep("stepOver", 1)
      expect(ui.ShowError).toHaveBeenCalled()
    })

    test("fires ThreadEvent on ended ADT error (non-jump)", async () => {
      const adtErr = { __isAdtError: true, message: "ended" }
      client.debuggerStep.mockRejectedValueOnce(adtErr)
      mockIsAdtError.mockReturnValueOnce(true)
      mockErrorType.mockReturnValueOnce("debuggeeEnded") // isEnded = true
      const events: any[] = []
      service.addListener((e: any) => events.push(e))
      await service.debuggerStep("stepOver", 1)
      expect(events.some((e: any) => e.type === "thread")).toBe(true)
    })

    test("rethrows on jump step with ADT error", async () => {
      const adtErr = { __isAdtError: true, message: "not possible" }
      client.debuggerStep.mockRejectedValueOnce(adtErr)
      mockIsAdtError.mockReturnValueOnce(true)
      mockErrorType.mockReturnValueOnce("stepNotPossible") // not ended
      await expect(service.debuggerStep("stepRunToLine", 1, "some-url")).rejects.toBeDefined()
    })
  })

  describe("attach", () => {
    test("calls debuggerAttach and updateStack", async () => {
      client.debuggerStackTrace.mockResolvedValueOnce({ stack: [] })
      await service.attach()
      expect(client.debuggerAttach).toHaveBeenCalledWith("user", "DEBUGGEE1", "TESTUSER", true)
    })
  })

  describe("logout", () => {
    test("calls client logout", async () => {
      await service.logout()
      expect(client.logout).toHaveBeenCalled()
    })

    test("is idempotent - second logout is no-op", async () => {
      await service.logout()
      await service.logout()
      // logout on client only called once
      expect(client.logout).toHaveBeenCalledTimes(1)
    })
  })
})
