/**
 * Tests for upgradeNotification.ts
 *
 * Source has TWO upgrade paths:
 *   1. v1 → v2 (lastVersion undefined or starts with "1."):
 *      Persists STATE_STATUS_BAR_PENDING=true and shows the blinking status
 *      bar (no toast).
 *   2. Regular version bump (lastVersion === "2.x" && !== currentVersion):
 *      Shows funWindow.showInformationMessage with a "What's New" button.
 *      "What's New" click opens the CHANGELOG.
 *
 * The status-bar item registers `abapfs.openUpgradeMarketplace` which opens
 * the marketplace URL on click and dismisses the bar permanently.
 */

vi.mock("vscode", () => ({
  env: { openExternal: vi.fn() },
  Uri: {
    parse: vi.fn((url: string) => ({
      toString: () => url
    }))
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  commands: { registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }) }
}))

vi.mock("./funMessenger", () => ({
  funWindow: {
    createStatusBarItem: vi.fn(),
    showInformationMessage: vi.fn().mockResolvedValue(undefined)
  }
}))

import * as vscode from "vscode"
import { checkUpgradeNotification } from "./upgradeNotification"
import { funWindow as window } from "./funMessenger"

const CHANGELOG_URL =
  "https://github.com/marcellourbani/vscode_abap_remote_fs/blob/master/CHANGELOG.md"
const MARKETPLACE_URL =
  "https://marketplace.visualstudio.com/items?itemName=murbani.vscode-abap-remote-fs"

const mockCreateStatusBarItem = window.createStatusBarItem as Mock
const mockShowInfoMessage = window.showInformationMessage as Mock
const mockEnvOpenExternal = vscode.env.openExternal as Mock
const mockRegisterCommand = vscode.commands.registerCommand as Mock

function makeStatusBarItem() {
  return {
    text: "",
    tooltip: "",
    command: "",
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn()
  }
}

function makeContext(
  opts: {
    lastVersion?: string
    upgradeDismissed?: boolean
    statusBarPending?: boolean
  } = {}
) {
  const state: Record<string, unknown> = {}
  if (opts.lastVersion !== undefined) state["abapfs.lastVersion"] = opts.lastVersion
  if (opts.upgradeDismissed !== undefined)
    state["abapfs.upgradeStatusBarDismissed"] = opts.upgradeDismissed
  if (opts.statusBarPending !== undefined)
    state["abapfs.upgradeStatusBarPending"] = opts.statusBarPending

  const subscriptions: { dispose(): void }[] = []
  return {
    extension: { packageJSON: { version: "2.1.0" } },
    globalState: {
      get: vi.fn((key: string) => state[key]),
      update: vi.fn((key: string, value: unknown) => {
        state[key] = value
      })
    },
    subscriptions
  } as unknown as vscode.ExtensionContext
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  const item = makeStatusBarItem()
  mockCreateStatusBarItem.mockReturnValue(item)
  mockShowInfoMessage.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("checkUpgradeNotification — v1 → v2 path (status bar)", () => {
  test("undefined lastVersion shows the blinking status bar", () => {
    const ctx = makeContext({ lastVersion: undefined })
    checkUpgradeNotification(ctx)
    expect(mockCreateStatusBarItem).toHaveBeenCalled()
  })

  test("lastVersion starting with '1.' shows the blinking status bar", () => {
    const ctx = makeContext({ lastVersion: "1.9.9" })
    checkUpgradeNotification(ctx)
    expect(mockCreateStatusBarItem).toHaveBeenCalled()
  })

  test("v1 upgrade does NOT call showInformationMessage", () => {
    const ctx = makeContext({ lastVersion: undefined })
    checkUpgradeNotification(ctx)
    expect(mockShowInfoMessage).not.toHaveBeenCalled()
  })

  test("v1 upgrade persists STATE_STATUS_BAR_PENDING=true", () => {
    const ctx = makeContext({ lastVersion: undefined })
    checkUpgradeNotification(ctx)
    const updateCalls = (ctx.globalState.update as Mock).mock.calls
    const pendingUpdate = updateCalls.find(
      (c: unknown[]) => c[0] === "abapfs.upgradeStatusBarPending"
    )
    expect(pendingUpdate).toBeDefined()
    expect(pendingUpdate?.[1]).toBe(true)
  })
})

describe("checkUpgradeNotification — regular v2.x upgrade (toast)", () => {
  test("v2.0.0 → v2.1.0 shows the showInformationMessage toast", () => {
    const ctx = makeContext({ lastVersion: "2.0.0" })
    checkUpgradeNotification(ctx)
    expect(mockShowInfoMessage).toHaveBeenCalled()
  })

  test("toast message mentions the new version", () => {
    const ctx = makeContext({ lastVersion: "2.0.0" })
    checkUpgradeNotification(ctx)
    const message = mockShowInfoMessage.mock.calls[0]?.[0] as string
    expect(message).toContain("2.1.0")
  })

  test("toast button is 'What's New'", () => {
    const ctx = makeContext({ lastVersion: "2.0.0" })
    checkUpgradeNotification(ctx)
    const args = mockShowInfoMessage.mock.calls[0]
    expect(args).toContain("What's New")
  })

  test("'What's New' click opens the CHANGELOG", async () => {
    mockShowInfoMessage.mockResolvedValue("What's New")
    const ctx = makeContext({ lastVersion: "2.0.0" })
    checkUpgradeNotification(ctx)
    // Resolve the .then() in showVersionUpgradeNotification
    await Promise.resolve()
    await Promise.resolve()
    expect(mockEnvOpenExternal).toHaveBeenCalled()
    const parseCalls = (vscode.Uri.parse as Mock).mock.calls
    expect(parseCalls.some((c: unknown[]) => c[0] === CHANGELOG_URL)).toBe(true)
  })

  test("dismissing the toast does not open the CHANGELOG", async () => {
    mockShowInfoMessage.mockResolvedValue(undefined)
    const ctx = makeContext({ lastVersion: "2.0.0" })
    checkUpgradeNotification(ctx)
    await Promise.resolve()
    await Promise.resolve()
    expect(mockEnvOpenExternal).not.toHaveBeenCalled()
  })

  test("regular v2 upgrade does NOT show the status bar", () => {
    const ctx = makeContext({ lastVersion: "2.0.0" })
    checkUpgradeNotification(ctx)
    expect(mockCreateStatusBarItem).not.toHaveBeenCalled()
  })
})

describe("checkUpgradeNotification — already current", () => {
  test("does NOT show the toast when already on the current version", () => {
    const ctx = makeContext({ lastVersion: "2.1.0" })
    checkUpgradeNotification(ctx)
    expect(mockShowInfoMessage).not.toHaveBeenCalled()
  })

  test("does NOT show the status bar when already on a v2.x version", () => {
    const ctx = makeContext({ lastVersion: "2.1.0" })
    checkUpgradeNotification(ctx)
    expect(mockCreateStatusBarItem).not.toHaveBeenCalled()
  })
})

describe("checkUpgradeNotification — version persistence", () => {
  test("always updates stored version to current", () => {
    const ctx = makeContext({ lastVersion: "1.5.0" })
    checkUpgradeNotification(ctx)
    const updateCalls = (ctx.globalState.update as Mock).mock.calls
    const versionUpdate = updateCalls.find((c: unknown[]) => c[0] === "abapfs.lastVersion")
    expect(versionUpdate?.[1]).toBe("2.1.0")
  })

  test("updates version even when not upgrading from v1", () => {
    const ctx = makeContext({ lastVersion: "2.0.5" })
    checkUpgradeNotification(ctx)
    const updateCalls = (ctx.globalState.update as Mock).mock.calls
    const versionUpdate = updateCalls.find((c: unknown[]) => c[0] === "abapfs.lastVersion")
    expect(versionUpdate?.[1]).toBe("2.1.0")
  })
})

describe("checkUpgradeNotification — status bar lifecycle", () => {
  test("does NOT create the status bar item when previously dismissed", () => {
    const ctx = makeContext({ lastVersion: undefined, upgradeDismissed: true })
    checkUpgradeNotification(ctx)
    expect(mockCreateStatusBarItem).not.toHaveBeenCalled()
  })

  test("status bar item is shown immediately", () => {
    const item = makeStatusBarItem()
    mockCreateStatusBarItem.mockReturnValue(item)
    const ctx = makeContext({ lastVersion: undefined })
    checkUpgradeNotification(ctx)
    expect(item.show).toHaveBeenCalled()
  })

  test("status bar item blinks between two states", () => {
    const item = makeStatusBarItem()
    mockCreateStatusBarItem.mockReturnValue(item)
    const ctx = makeContext({ lastVersion: undefined })
    checkUpgradeNotification(ctx)
    const initialText = item.text
    vi.advanceTimersByTime(1500)
    const textAfterBlink = item.text
    vi.advanceTimersByTime(1500)
    const textAfterSecondBlink = item.text
    expect(textAfterBlink).not.toBe(initialText)
    expect(textAfterSecondBlink).toBe(initialText)
  })

  test("registers the marketplace command", () => {
    const ctx = makeContext({ lastVersion: undefined })
    checkUpgradeNotification(ctx)
    expect(mockRegisterCommand).toHaveBeenCalledWith(
      "abapfs.openUpgradeMarketplace",
      expect.any(Function)
    )
  })

  test("status bar item is added to context subscriptions", () => {
    const item = makeStatusBarItem()
    mockCreateStatusBarItem.mockReturnValue(item)
    const ctx = makeContext({ lastVersion: undefined })
    checkUpgradeNotification(ctx)
    expect(ctx.subscriptions.length).toBeGreaterThan(0)
  })

  test("invoking the registered command opens the marketplace and dismisses", () => {
    const item = makeStatusBarItem()
    mockCreateStatusBarItem.mockReturnValue(item)
    const ctx = makeContext({ lastVersion: undefined })
    checkUpgradeNotification(ctx)

    // Pull the registered command callback and invoke it
    const callback = mockRegisterCommand.mock.calls[0]?.[1] as (() => void) | undefined
    expect(callback).toBeTypeOf("function")
    callback?.()

    expect(mockEnvOpenExternal).toHaveBeenCalled()
    const parseCalls = (vscode.Uri.parse as Mock).mock.calls
    expect(parseCalls.some((c: unknown[]) => c[0] === MARKETPLACE_URL)).toBe(true)

    const updateCalls = (ctx.globalState.update as Mock).mock.calls
    const dismissedUpdate = updateCalls.find(
      (c: unknown[]) => c[0] === "abapfs.upgradeStatusBarDismissed"
    )
    expect(dismissedUpdate?.[1]).toBe(true)
  })
})
