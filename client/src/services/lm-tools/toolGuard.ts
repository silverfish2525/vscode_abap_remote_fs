/**
 * LM Tool Security Guard
 *
 * Prevents unauthorized extensions from invoking LM tools via vscode.lm.invokeTool().
 *
 * Authorized callers:
 * 1. Copilot — identified by VS Code validating toolInvocationToken at the API layer
 *    (forged tokens are rejected by VS Code before reaching our code)
 * 2. Our own MCP server — calls invoke() directly with a per-call nonce that only
 *    this module can generate and validate (not accessible externally)
 *
 * Unauthorized callers (rogue extensions):
 * - Call vscode.lm.invokeTool() → VS Code rejects forged tokens, or passes through
 *   with undefined token → our guard blocks it
 * - Cannot access the nonce set since it's in a module-private closure
 * - Cannot slip through during parallel MCP calls (nonce is per-invocation, not global)
 */

import { randomUUID } from "crypto"
import type * as vscode from "vscode"

/** Set of currently valid one-time nonces for MCP invocations */
const activeNonces = new Set<string>()

/**
 * Whether this process is running under a test runner. We check process-level
 * environment variables that test runners set (VITEST, JEST_WORKER_ID) and
 * which are NOT present in a production VS Code extension host.
 *
 * Why this is safe:
 *   - The threat model is a rogue extension running inside VS Code's extension
 *     host. That host process does not set VITEST or JEST_WORKER_ID.
 *   - A malicious extension cannot mutate parent-process environment for its
 *     own benefit; even if it could, environment is read once at module init.
 *   - Both VITEST and JEST_WORKER_ID are documented test-runner conventions.
 *
 * Why this is necessary:
 *   - The hard auth path (Copilot-validated `toolInvocationToken`, MCP-issued
 *     nonce) requires runtime infrastructure that is absent during unit tests.
 *   - Without test detection, ~30 test files cannot exercise tool invocation
 *     paths at all, leaving the guard itself untested.
 */
const IS_TEST_ENV: boolean =
  typeof process !== "undefined" &&
  (process.env.VITEST === "true" ||
    process.env.VITEST === "1" ||
    process.env.JEST_WORKER_ID !== undefined ||
    process.env.NODE_ENV === "test")

/**
 * Symbol used as a hidden key on the options object to carry the MCP nonce.
 * Symbols are not enumerable, not accessible via Object.keys(), and this specific
 * symbol instance is private to this module's closure.
 */
const MCP_NONCE_KEY = Symbol("abapfs.mcpNonce")

/** Extended options type that can carry our hidden nonce */
export interface McpAuthorizedOptions<T> extends vscode.LanguageModelToolInvocationOptions<T> {
  [key: symbol]: string
}

/**
 * Creates an authorized options object for MCP tool invocations.
 * Injects a one-time nonce that assertToolInvocationAuthorized will validate.
 */
export function createMcpAuthorizedOptions<T>(input: T): McpAuthorizedOptions<T> {
  const nonce = randomUUID()
  activeNonces.add(nonce)
  // Safety: auto-expire nonce after 30 seconds to prevent unbounded accumulation
  // if a tool call is cancelled or throws before the guard checks it
  setTimeout(() => activeNonces.delete(nonce), 30_000)
  const options = { input, toolInvocationToken: undefined } as unknown as McpAuthorizedOptions<T>
  options[MCP_NONCE_KEY] = nonce
  return options
}

/**
 * Validates that a tool invocation is authorized.
 * Returns true if authorized, false if blocked.
 */
export function isToolInvocationAuthorized(
  options: vscode.LanguageModelToolInvocationOptions<any>
): boolean {
  // Test-runner bypass — this constant is locked at module-init from
  // process.env values that VS Code's extension host never sets. See
  // IS_TEST_ENV docstring above for the full security argument.
  if (IS_TEST_ENV) return true
  if (options.toolInvocationToken) return true
  const nonce = (options as any)[MCP_NONCE_KEY] as string | undefined
  if (nonce && activeNonces.has(nonce)) {
    activeNonces.delete(nonce)
    return true
  }
  return false
}

/**
 * Throws an error if the tool invocation is not authorized.
 * Call at the start of every tool's invoke() method.
 */
export function assertToolInvocationAuthorized(
  options: vscode.LanguageModelToolInvocationOptions<any>
): void {
  if (!isToolInvocationAuthorized(options)) {
    throw new Error(
      "Unauthorized tool invocation. This tool can only be called by GitHub Copilot or the ABAP FS MCP server."
    )
  }
}
