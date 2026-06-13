/**
 * Vitest config covering the codemod helper tests in scripts/lib.
 * The codemods themselves are not tested here (they're mass-rewriting tools
 * that the migration commit verified end-to-end). We only test the shared
 * helper that gates every codemod.
 */
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["scripts/lib/**/*.test.ts"]
  }
})
