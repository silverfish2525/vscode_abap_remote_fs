// Vitest globals + jest-compat type shim for the client package.
//
// Goal: keep the mechanical jest -> vitest migration purely mechanical,
// without forcing an `import { ... } from "vitest"` into every test file.
//
// 1. Triple-slash reference brings in `vitest/globals` so describe/it/test/
//    expect/vi etc. exist as ambient globals at compile time.
// 2. We re-export vitest's Mock / Mocked / MockedFunction / MockedClass /
//    MockedObject / MockInstance type aliases as globals (vitest only
//    exposes them as members of the `vitest` package).
// 3. We re-add `fail()`, which `@types/jest` declared globally and a
//    handful of "expected branch" assertions still rely on.

/// <reference types="vitest/globals" />

import type {
  Mock as ViMock,
  Mocked as ViMocked,
  MockedFunction as ViMockedFunction,
  MockedClass as ViMockedClass,
  MockedObject as ViMockedObject,
  MockInstance as ViMockInstance
} from "vitest"

declare global {
  type Mock<T extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown> = ViMock<T>
  type Mocked<T> = ViMocked<T>
  type MockedFunction<T extends (...args: unknown[]) => unknown> = ViMockedFunction<T>
  type MockedClass<T extends abstract new (...args: unknown[]) => unknown> = ViMockedClass<T>
  type MockedObject<T> = ViMockedObject<T>
  type MockInstance<T extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown> =
    ViMockInstance<T>

  /** Drop-in replacement for jest's global `fail()` — tests use it to abort
   *  on an unreachable branch. Throwing is good enough for vitest. */
  function fail(error?: unknown): never
}
