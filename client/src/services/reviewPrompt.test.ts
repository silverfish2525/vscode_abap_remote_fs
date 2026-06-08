vi.mock(
  "vscode",
  () => ({
    window: {
      createStatusBarItem: vi.fn(),
      showInformationMessage: vi.fn(),
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
    Disposable: vi.fn().mockImplementation((fn: () => void) => ({ dispose: fn })),
    env: { openExternal: vi.fn() },
    Uri: { parse: vi.fn((url) => ({ toString: () => url })) },
    commands: { registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }) },
  }),
  { virtual: true },
);

import * as vscode from "vscode";
import { initializeReviewPrompt, incrementReviewCounter } from "./reviewPrompt";

const mockShowInfoMessage = vscode.window.showInformationMessage as Mock;
const mockCreateStatusBarItem = vscode.window.createStatusBarItem as Mock;
const mockEnvOpenExternal = vscode.env.openExternal as Mock;
const mockRegisterCommand = vscode.commands.registerCommand as Mock;

function makeStatusBarItem() {
  return {
    text: "",
    tooltip: "",
    command: "",
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  };
}

function makeContext(overrides: Record<string, any> = {}) {
  const state: Record<string, any> = {};
  const subscriptions: any[] = [];
  return {
    globalState: {
      get: vi.fn((key: string) => state[key]),
      update: vi.fn((key: string, value: any) => {
        state[key] = value;
      }),
      _state: state,
    },
    subscriptions,
    ...overrides,
  } as any as vscode.ExtensionContext;
}

// Reset module-level state between tests by re-importing
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // Re-apply the mock after resetModules
  vi.doMock(
    "vscode",
    () => ({
      window: {
        createStatusBarItem: vi.fn().mockReturnValue(makeStatusBarItem()),
        showInformationMessage: vi.fn().mockResolvedValue(undefined),
      },
      StatusBarAlignment: { Left: 1, Right: 2 },
      Disposable: vi.fn().mockImplementation((fn: () => void) => ({ dispose: fn })),
      env: { openExternal: vi.fn() },
      Uri: { parse: vi.fn((url) => ({ toString: () => url })) },
      commands: { registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }) },
    }),
    { virtual: true },
  );
});

// Separate describe block that doesn't use resetModules so imports work
// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("initializeReviewPrompt", () => {
  test("stores first activation date when not already stored", () => {
    // Use fresh require after beforeEach resetModules
    const { initializeReviewPrompt: init } = require("./reviewPrompt");

    const ctx = makeContext();
    (ctx.globalState.get as Mock).mockReturnValue(undefined);

    init(ctx);

    const updateCalls = (ctx.globalState.update as Mock).mock.calls;
    const firstActivationCall = updateCalls.find(
      (c: any[]) => c[0] === "abapfs.reviewPrompt.firstActivationDate",
    );
    expect(firstActivationCall).toBeDefined();
    expect(typeof firstActivationCall![1]).toBe("string");
  });

  test("does NOT overwrite existing activation date", () => {
    const { initializeReviewPrompt: init } = require("./reviewPrompt");

    const existingDate = "2024-01-01T00:00:00.000Z";
    const ctx = makeContext();
    (ctx.globalState.get as Mock).mockImplementation((key: string) => {
      if (key === "abapfs.reviewPrompt.firstActivationDate") return existingDate;
      return undefined;
    });

    init(ctx);

    const updateCalls = (ctx.globalState.update as Mock).mock.calls;
    const activationDateUpdates = updateCalls.filter(
      (c: any[]) => c[0] === "abapfs.reviewPrompt.firstActivationDate",
    );
    expect(activationDateUpdates).toHaveLength(0);
  });

  test("does not throw on error", () => {
    const { initializeReviewPrompt: init } = require("./reviewPrompt");

    // Pass a broken context
    const brokenCtx = {
      globalState: {
        get: vi.fn().mockImplementation(() => {
          throw new Error("state error");
        }),
        update: vi.fn(),
      },
      subscriptions: [],
    } as any;

    expect(() => init(brokenCtx)).not.toThrow();
  });
});

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("incrementReviewCounter", () => {
  test("increments counter in globalState", () => {
    const { initializeReviewPrompt: init, incrementReviewCounter: inc } = require("./reviewPrompt");

    const ctx = makeContext();
    let count = 0;
    (ctx.globalState.get as Mock).mockImplementation((key: string) => {
      if (key === "abapfs.reviewPrompt.usageCount") return count;
      return undefined;
    });
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      if (key === "abapfs.reviewPrompt.usageCount") count = val;
    });

    init(ctx);
    inc();
    inc();
    inc();

    expect(count).toBe(3);
  });

  test("does nothing when context is not initialized", () => {
    // Don't call initializeReviewPrompt — just call incrementReviewCounter directly
    const { incrementReviewCounter: inc } = require("./reviewPrompt");
    expect(() => inc()).not.toThrow();
  });

  test("handles counter increment error silently", () => {
    const { initializeReviewPrompt: init, incrementReviewCounter: inc } = require("./reviewPrompt");

    const ctx = makeContext();
    (ctx.globalState.get as Mock).mockImplementation(() => {
      throw new Error("state error");
    });
    (ctx.globalState.update as Mock).mockImplementation(() => {});

    init(ctx);
    expect(() => inc()).not.toThrow();
  });
});

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("review prompt conditions", () => {
  test("prompt is NOT shown when usage count is below threshold (100)", () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init, incrementReviewCounter: inc } = require("./reviewPrompt");
    const mockVscode = require("vscode");
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);

    const ctx = makeContext();
    const state: Record<string, any> = {};
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    // Set activation date far in the past (100 days ago)
    state["abapfs.reviewPrompt.firstActivationDate"] = new Date(
      Date.now() - 100 * 24 * 60 * 60 * 1000,
    ).toISOString();
    state["abapfs.reviewPrompt.usageCount"] = 50; // below 100 threshold

    init(ctx);

    vi.runAllTimers();
    expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test("prompt is NOT shown when days threshold not met (< 7 days)", () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);

    const ctx = makeContext();
    const state: Record<string, any> = {};
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    // Set activation date to today (0 days elapsed)
    state["abapfs.reviewPrompt.firstActivationDate"] = new Date().toISOString();
    state["abapfs.reviewPrompt.usageCount"] = 200; // above threshold

    init(ctx);

    vi.runAllTimers();
    expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test("prompt is NOT shown when neverShowAgain is true", () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.neverShowAgain": true,
      "abapfs.reviewPrompt.usageCount": 200,
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 100 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);

    vi.runAllTimers();
    expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test("prompt IS shown when both usage >= 100 AND days >= 7", () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);
    mockVscode.window.createStatusBarItem = vi.fn().mockReturnValue(makeStatusBarItem());
    mockVscode.commands.registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.usageCount": 150,
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);

    // The prompt is scheduled with a 5-minute delay
    vi.runAllTimers();
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("ABAP Remote FS"),
      "⭐ Rate Now",
      "Remind Me Later",
      "Never Show Again",
    );
    vi.useRealTimers();
  });

  test("prompt is NOT shown twice in the same session", () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init, incrementReviewCounter: inc } = require("./reviewPrompt");
    const mockVscode = require("vscode");
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);
    mockVscode.window.createStatusBarItem = vi.fn().mockReturnValue(makeStatusBarItem());
    mockVscode.commands.registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.usageCount": 150,
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);
    vi.runAllTimers();
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledTimes(1);

    // Re-evaluate by incrementing counter to a multiple of 10
    state["abapfs.reviewPrompt.usageCount"] = 199;
    inc(); // becomes 200, triggers evaluateAndSchedule
    vi.runAllTimers();

    // Should still be exactly 1 call due to promptShownThisSession
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("review prompt button handlers", () => {
  test("'Rate Now' opens marketplace URL and sets permanent dismissal", async () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");

    // Simulate user clicking "⭐ Rate Now"
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue("⭐ Rate Now");
    mockVscode.window.createStatusBarItem = vi.fn().mockReturnValue(makeStatusBarItem());
    mockVscode.commands.registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.usageCount": 200,
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);
    vi.runAllTimers();

    // Wait for the promise chain to settle
    await Promise.resolve();
    await Promise.resolve();

    expect(mockVscode.env.openExternal).toHaveBeenCalledWith(
      expect.objectContaining({ toString: expect.any(Function) }),
    );
    expect(state["abapfs.reviewPrompt.neverShowAgain"]).toBe(true);
    expect(state["abapfs.reviewPrompt.statusBarDismissed"]).toBe(true);
    vi.useRealTimers();
  });

  test("'Never Show Again' sets permanent dismissal without opening URL", async () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");

    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue("Never Show Again");
    mockVscode.window.createStatusBarItem = vi.fn().mockReturnValue(makeStatusBarItem());
    mockVscode.commands.registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.usageCount": 200,
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);
    vi.runAllTimers();

    await Promise.resolve();
    await Promise.resolve();

    expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    expect(state["abapfs.reviewPrompt.neverShowAgain"]).toBe(true);
    expect(state["abapfs.reviewPrompt.statusBarDismissed"]).toBe(true);
    vi.useRealTimers();
  });

  test("'Remind Me Later' resets usage counter and first activation date", async () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");

    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue("Remind Me Later");
    mockVscode.window.createStatusBarItem = vi.fn().mockReturnValue(makeStatusBarItem());
    mockVscode.commands.registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.usageCount": 200,
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);
    vi.runAllTimers();

    await Promise.resolve();
    await Promise.resolve();

    // "Remind Me Later" resets both counter and date to undefined
    expect(state["abapfs.reviewPrompt.usageCount"]).toBeUndefined();
    expect(state["abapfs.reviewPrompt.firstActivationDate"]).toBeUndefined();
    // neverShowAgain should NOT be set
    expect(state["abapfs.reviewPrompt.neverShowAgain"]).toBeUndefined();
    vi.useRealTimers();
  });

  test("dismissing prompt (X button / undefined) resets counter like 'Remind Me Later'", async () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");

    // undefined means user dismissed without clicking any button
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);
    mockVscode.window.createStatusBarItem = vi.fn().mockReturnValue(makeStatusBarItem());
    mockVscode.commands.registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.usageCount": 200,
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);
    vi.runAllTimers();

    await Promise.resolve();
    await Promise.resolve();

    // Same as "Remind Me Later" — resets tracking
    expect(state["abapfs.reviewPrompt.usageCount"]).toBeUndefined();
    expect(state["abapfs.reviewPrompt.firstActivationDate"]).toBeUndefined();
    vi.useRealTimers();
  });
});

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("review prompt counter logic", () => {
  test("evaluateAndSchedule is triggered every 10th increment", () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init, incrementReviewCounter: inc } = require("./reviewPrompt");
    const mockVscode = require("vscode");
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);
    mockVscode.window.createStatusBarItem = vi.fn().mockReturnValue(makeStatusBarItem());
    mockVscode.commands.registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      "abapfs.reviewPrompt.usageCount": 0,
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);

    // Increment 99 times — should not trigger prompt (count < 100)
    for (let i = 0; i < 99; i++) {
      inc();
    }
    vi.runAllTimers();
    expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();

    // The 100th increment — now count=100, and 100 % 10 === 0, so evaluateAndSchedule runs
    inc();
    vi.runAllTimers();
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test("counter starts at 0 on fresh install (no state)", () => {
    const { initializeReviewPrompt: init, incrementReviewCounter: inc } = require("./reviewPrompt");

    const ctx = makeContext();
    const state: Record<string, any> = {};
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);
    inc();

    // Counter should go from undefined (0) to 1
    expect(state["abapfs.reviewPrompt.usageCount"]).toBe(1);
  });
});

// TODO(vitest): re-enable after virtual-mock support / migration debt resolved (see PR-11 follow-up)
describe.skip("review prompt status bar", () => {
  test("status bar item is created when prompt is shown and not dismissed", () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");
    const mockBarItem = makeStatusBarItem();
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);
    mockVscode.window.createStatusBarItem = vi.fn().mockReturnValue(mockBarItem);
    mockVscode.commands.registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.usageCount": 200,
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);
    vi.runAllTimers();

    expect(mockVscode.window.createStatusBarItem).toHaveBeenCalled();
    expect(mockBarItem.show).toHaveBeenCalled();
    expect(mockBarItem.text).toContain("Rate ABAP FS");
    vi.useRealTimers();
  });

  test("status bar is NOT created when statusBarDismissed is true", () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);
    mockVscode.window.createStatusBarItem = vi.fn().mockReturnValue(makeStatusBarItem());
    mockVscode.commands.registerCommand = vi.fn().mockReturnValue({ dispose: vi.fn() });

    const ctx = makeContext();
    const state: Record<string, any> = {
      "abapfs.reviewPrompt.usageCount": 200,
      "abapfs.reviewPrompt.firstActivationDate": new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      "abapfs.reviewPrompt.statusBarDismissed": true,
    };
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);
    vi.runAllTimers();

    expect(mockVscode.window.createStatusBarItem).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test("fresh install: first activation date is recorded, no prompt shown", () => {
    vi.useFakeTimers();
    const { initializeReviewPrompt: init } = require("./reviewPrompt");
    const mockVscode = require("vscode");
    mockVscode.window.showInformationMessage = vi.fn().mockResolvedValue(undefined);

    const ctx = makeContext();
    const state: Record<string, any> = {};
    (ctx.globalState.get as Mock).mockImplementation((key: string) => state[key]);
    (ctx.globalState.update as Mock).mockImplementation((key: string, val: any) => {
      state[key] = val;
    });

    init(ctx);

    // First activation date should be stored
    expect(state["abapfs.reviewPrompt.firstActivationDate"]).toBeDefined();
    expect(typeof state["abapfs.reviewPrompt.firstActivationDate"]).toBe("string");

    vi.runAllTimers();
    // No prompt — usage count is 0 (or undefined)
    expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
