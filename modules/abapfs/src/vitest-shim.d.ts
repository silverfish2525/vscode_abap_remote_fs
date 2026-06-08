// Vitest globals + jest-compat type shim for the abapfs module.
//
// Triple-slash reference brings in `vitest/globals` so describe/it/test/
// expect/vi etc. exist as ambient globals at compile time, and we re-add
// `fail()` which `@types/jest` declared globally and the tests rely on in
// a handful of "expected branch" assertions.

/// <reference types="vitest/globals" />

declare global {
  /** Drop-in replacement for jest's global `fail()`. */
  function fail(error?: unknown): never
}

export {}
