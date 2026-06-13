/**
 * Thin registry indirection for the LSP "trigger syntax check" hook.
 *
 * Why this exists
 * ---------------
 * `langClient.ts` statically imports `vscode-languageclient/node`, whose own
 * top-level `require("vscode")` is fatal in unit-test environments where
 * `vscode` is provided as a vitest module alias (Vite handles ESM imports
 * but not raw CJS `require()` for transitive deps). Any module that imports
 * from `langClient` therefore drags the language-client package into its
 * test closure and fails to load.
 *
 * Most consumers of `triggerSyntaxCheck` only need the *call* surface, not
 * the LanguageClient itself. This module captures that minimal surface as
 * a registry: `langClient.ts` registers the real implementation at
 * activation time, and consumers import from here \u2014 keeping their import
 * graph free of `vscode-languageclient`.
 */

let impl: ((uri: string) => Promise<void>) | undefined

/**
 * Register the actual trigger implementation. Called once at extension
 * activation by `langClient.ts` after the LanguageClient is constructed.
 */
export function setSyntaxCheckTrigger(fn: ((uri: string) => Promise<void>) | undefined): void {
  impl = fn
}

/**
 * Trigger the LSP server's syntax check for a URI. No-op when the
 * LanguageClient is not running (e.g. in unit tests, or before activation).
 */
export async function triggerSyntaxCheck(uri: string): Promise<void> {
  if (impl) await impl(uri)
}
