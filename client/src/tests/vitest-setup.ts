/**
 * Vitest setup file (loaded via test.setupFiles in client/vitest.config.ts).
 *
 * Why this file exists
 * --------------------
 * The LM tool security guard (`src/services/lm-tools/toolGuard.ts`) requires a
 * Copilot-validated `toolInvocationToken` or an MCP-issued nonce on every
 * `tool.invoke()` call. Both come from runtime infrastructure that does not
 * exist during unit tests. Without this stub, ~30 client test files cannot
 * exercise tool-invocation paths.
 *
 * Why this is safe (vs. modifying toolGuard itself)
 * -------------------------------------------------
 * The bypass lives ONLY in the test harness:
 *   - This file is loaded only by vitest (`setupFiles`), never bundled.
 *   - Production builds (tsdown) ignore `src/tests/**`.
 *   - There is no env-var or runtime flag in production code that can be
 *     flipped by a malicious extension to neutralize the guard.
 *
 * The mock makes `assertToolInvocationAuthorized()` a no-op and
 * `createMcpAuthorizedOptions()` return a plain options bag, both purely
 * within the vitest module-graph used at `vitest run` time.
 */

import { vi } from "vitest"

vi.mock("../services/lm-tools/toolGuard", async () => {
  const actual = await vi.importActual<
    typeof import("../services/lm-tools/toolGuard")
  >("../services/lm-tools/toolGuard")
  return {
    ...actual,
    assertToolInvocationAuthorized: vi.fn(),
    createMcpAuthorizedOptions: <T>(input: T) => ({ input }) as unknown
  }
})
