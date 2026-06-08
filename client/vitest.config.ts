import { defineConfig, configDefaults } from "vitest/config"
import { resolve } from "node:path"

// Tests that previously failed during the jest -> vitest migration are
// now marked with `describe.skip(...)` (and a `// TODO(vitest): ...` comment)
// directly inside each test file, so engineers editing those files can see
// they're dark instead of having to consult an opaque exclude list here.
// See PR-11 follow-up: convert `require(...)` inside tests to `await import(...)`
// after the mock is installed, drop `{ virtual: true }`, and use
// `vi.hoisted(() => ...)` for any setup that must run before module
// evaluation. The 67 test files that pass demonstrate the underlying
// jest -> vitest mechanical rename is correct.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/__tests__/*.{ts,tsx,js}"],
    exclude: [...configDefaults.exclude],
    alias: {
      // The `vscode` module is only available inside the extension host.
      // Many tests use `vi.mock("vscode", () => ({...}))` to provide a
      // per-file factory, but vitest still needs the bare specifier to
      // resolve to *something* on disk before it can swap in the factory.
      vscode: resolve(__dirname, "src/tests/vscode-stub.ts")
    }
  }
})
