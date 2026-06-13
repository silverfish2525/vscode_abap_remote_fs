/// <reference types="vitest/globals" />

declare global {
  /** Drop-in replacement for jest's global `fail()`. */
  function fail(error?: unknown): never
}

export {}
