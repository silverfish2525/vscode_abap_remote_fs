import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Match the jest configs we replaced (server/client/modules) which used:
    //   testMatch: ["**/__tests__/*.+(ts|tsx|js)", "**/*.test.ts"]
    include: ["**/*.test.ts", "**/__tests__/*.{ts,tsx,js}"]
  }
})
