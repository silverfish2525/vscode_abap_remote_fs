import { defineConfig } from "vitest/config"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const setupFiles = [resolve(__dirname, "setenv.js")].filter(existsSync)

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/__tests__/*.{ts,tsx,js}"],
    setupFiles,
    alias: {
      // mirrors the jest moduleNameMapper that pointed at the compiled
      // out/tests/vscode_alias_for_test.js — vitest can load the .ts source
      // directly so we point at it instead.
      vscode: resolve(__dirname, "src/tests/vscode_alias_for_test.ts")
    }
  }
})
