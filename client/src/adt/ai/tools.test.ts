vi.mock("vscode", () => ({
  ExtensionContext: vi.fn()
}), { virtual: true })

vi.mock("./search", () => ({
  SearchTool: vi.fn().mockImplementation(() => ({ id: "search" }))
}))

vi.mock("./unit", () => ({
  UnitTool: vi.fn().mockImplementation(() => ({ id: "unit" }))
}))

vi.mock("./activate", () => ({
  ActivateTool: vi.fn().mockImplementation(() => ({ id: "activate" }))
}))

vi.mock("../../services/lm-tools/toolRegistry", () => ({
  registerToolWithRegistry: vi.fn(() => ({ dispose: vi.fn() }))
}))

import { registerChatTools } from "./tools"
import { registerToolWithRegistry } from "../../services/lm-tools/toolRegistry"
import { ActivateTool } from "./activate"

const mockRegisterTool = registerToolWithRegistry as MockedFunction<typeof registerToolWithRegistry>

describe("registerChatTools", () => {
  let mockContext: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockContext = { subscriptions: { push: vi.fn() } }
  })

  test("registers the activate tool", () => {
    registerChatTools(mockContext)

    expect(mockRegisterTool).toHaveBeenCalledWith("abap_activate", expect.any(Object))
  })

  test("pushes disposable to subscriptions", () => {
    registerChatTools(mockContext)

    expect(mockContext.subscriptions.push).toHaveBeenCalled()
  })

  test("creates an ActivateTool instance", () => {
    registerChatTools(mockContext)

    expect(ActivateTool).toHaveBeenCalledTimes(1)
  })

  test("registers only activate tool (search and unit are dead code after early return)", () => {
    registerChatTools(mockContext)

    // The function returns early after registering abap_activate
    // search and unit are never registered
    expect(mockRegisterTool).toHaveBeenCalledTimes(1)
    expect(mockRegisterTool).toHaveBeenCalledWith("abap_activate", expect.any(Object))
    expect(mockRegisterTool).not.toHaveBeenCalledWith("abap_search", expect.any(Object))
    expect(mockRegisterTool).not.toHaveBeenCalledWith("abap_unit", expect.any(Object))
  })
})
