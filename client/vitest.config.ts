import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/__tests__/*.{ts,tsx,js}"],
    // Tests in this file collection rely on the mocked vscode runtime API.
    // The alias points module resolution at a stub - vi.mock("vscode", ...)
    // factories in individual tests override it at runtime.
    //
    // The `abapfs` and `abapobject` aliases route to the workspace TS source
    // instead of the compiled `out/*.js`. Vitest's vscode alias only applies
    // to imports going through Vite's transformer; CJS `require("vscode")`
    // calls inside compiled-and-shipped .js files in `out/` bypass the alias.
    // Loading the source directly keeps the whole import graph inside Vite.
    alias: {
      vscode: resolve(__dirname, "src/tests/vscode-stub.ts"),
      abapfs: resolve(__dirname, "../modules/abapfs/src/index.ts"),
      abapobject: resolve(__dirname, "../modules/abapObject/src/index.ts")
    }
  }
})
