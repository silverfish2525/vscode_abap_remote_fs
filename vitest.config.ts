import { defineConfig } from "vitest/config"

// Root config — overridden by per-package vitest.config.ts files.
// Used when running `vitest` from repo root for cross-package smoke runs.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/__tests__/*.{ts,tsx,js}"]
  }
})
