import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/__tests__/*.{ts,tsx,js}"],
    // Setup file mocks the LM tool security guard at the vitest layer so
    // tests can exercise tool.invoke() paths without forging a Copilot
    // tool-invocation token or MCP nonce. The bypass lives ONLY here, never
    // in production code.
    setupFiles: [resolve(__dirname, "src/tests/vitest-setup.ts")],
    // Tests in this file collection rely on the mocked vscode runtime API.
    // The alias points module resolution at a stub - vi.mock("vscode", ...)
    // factories in individual tests override it at runtime.
    alias: {
      vscode: resolve(__dirname, "src/tests/vscode-stub.ts")
    }
  }
})
