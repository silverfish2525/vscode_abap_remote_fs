// Vitest globals shim for the server package — brings in `vitest/globals`
// so describe/it/test/expect/vi etc. exist as ambient globals at compile
// time. Server tests don't use the legacy `jest.Mock` / `fail()` patterns,
// so this file is intentionally smaller than the client / module shims.

/// <reference types="vitest/globals" />

export {}
