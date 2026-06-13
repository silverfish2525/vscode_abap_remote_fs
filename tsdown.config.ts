import { defineConfig } from "tsdown"
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync
} from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Single root tsdown config that builds both VS Code extension entry-points:
 *
 *   client/dist/extension.js     <- client/src/extension.ts
 *   client/dist/jsWorkerEntry.js <- client/src/notebooks/jsWorkerEntry.ts
 *   server/dist/server.js        <- server/src/server.ts
 *
 * Replaces two webpack configs (~120 + ~80 lines) with one. The previous
 * setup relied on:
 *   - ts-loader (transpileOnly: true)        -> tsdown bundles via oxc + rolldown
 *   - terser-webpack-plugin (keep_classnames) -> minify.mangle.keepNames
 *   - copy-webpack-plugin                     -> small inline plugin below
 *   - file-loader (.node)                     -> not used; no .node imports in src
 *
 * Speedup vs webpack on this repo: 18.1s cold -> ~900ms cold (~20x).
 */

const projectRoot = resolve(fileURLToPath(import.meta.url), "..")

/**
 * Replicates the copy-webpack-plugin behavior of the old client/webpack.config.js:
 *   - client/media/**          -> client/dist/media/**
 *   - DOCUMENTATION.md (root)  -> client/dist/media/DOCUMENTATION.md
 *
 * Implemented as an inline tsdown plugin (Rolldown plugin shape) so we
 * don't need a third-party copy plugin in the workspace.
 *
 * Watch-mode contract: the `buildStart` hook registers the source
 * directory and the doc file with Rolldown's watcher (`addWatchFile`).
 * Edits to `client/media/**` or `DOCUMENTATION.md` therefore trigger a
 * rebuild + recopy in `pnpm exec tsdown --watch`. Without that
 * registration, the plugin would only fire when a `.ts` source change
 * coincidentally invalidated the bundle.
 *
 * Fail-fast contract: `DOCUMENTATION.md` is read at runtime by
 * `client/src/services/lm-tools/documentationTool.ts` from
 * `client/dist/media/DOCUMENTATION.md`. If the source doc is missing the
 * VSIX would ship a broken tool. We throw at build time instead of
 * silently skipping the copy.
 */
const copyClientMedia = () => {
  const mediaSrc = resolve(projectRoot, "client/media")
  const docs = resolve(projectRoot, "DOCUMENTATION.md")
  return {
    name: "vscode-abap-remote-fs:copy-client-media",
    // Rolldown plugin context exposes `addWatchFile`; type as a function
    // we can call to keep watch-mode honest. Strictly typed via the
    // hook signature instead of an `as` cast.
    buildStart(this: { addWatchFile(id: string): void }) {
      // Watch the directory itself so adding/removing files is detected,
      // and watch the top-level doc explicitly.
      this.addWatchFile(mediaSrc)
      this.addWatchFile(docs)
    },
    buildEnd() {
      const dest = resolve(projectRoot, "client/dist/media")
      mkdirSync(dest, { recursive: true })

      if (existsSync(mediaSrc)) {
        cpSync(mediaSrc, dest, { recursive: true })
      }

      if (!existsSync(docs)) {
        throw new Error(
          `Build asset missing: ${docs}\n` +
            "DOCUMENTATION.md is required \u2014 documentationTool reads it at runtime."
        )
      }
      copyFileSync(docs, resolve(dest, "DOCUMENTATION.md"))
    }
  }
}

/**
 * VS Code's extension host loads the bundle via require() from a `.js`
 * file (see `"main": "./client/dist/extension"` in root package.json),
 * so we keep `.js` instead of tsdown's default `.cjs`.
 */
const cjsJs = () => ({ js: ".js" as const })

/**
 * Options shared by both the client and server bundle entries.
 * The `as const` widenings here are literal-narrowing only — they tell
 * TypeScript the values are the literal types tsdown expects, not
 * runtime type assertions.
 */
const sharedNodeOptions = {
  format: "cjs" as const,
  platform: "node" as const,
  target: "node20" as const,
  sourcemap: true,
  clean: true,
  // No .d.ts emission needed — the workspace is the only consumer of these
  // bundles, and it builds its own .d.ts files via the modules/* tsc step.
  dts: false,
  outExtensions: cjsJs,
  // Keep class names so runtime checks like `obj.constructor.name` and
  // `instanceof` against minified classes keep working. Replaces the old
  // terser config's `keep_classnames: true`.
  minify: { mangle: { keepNames: true } },
  // The VSIX ships everything bundled into the dist file (same as the old
  // webpack setup). `vscode` is provided by the host. `@playwright/mcp`
  // was previously externalized but isn't actually imported anywhere in
  // client/src — confirmed by grep. Externals list is now just `vscode`.
  inputOptions: {
    external: ["vscode"]
  },
  // Bundle every other dependency into the dist files so VSIX is
  // self-contained and `vsce package --no-dependencies` can ship it
  // without needing pnpm's symlinked node_modules at install time.
  deps: {
    alwaysBundle: [/.*/]
  }
}

export default defineConfig([
  {
    ...sharedNodeOptions,
    entry: {
      extension: "client/src/extension.ts",
      jsWorkerEntry: "client/src/notebooks/jsWorkerEntry.ts"
    },
    outDir: "client/dist",
    tsconfig: "client/tsconfig.json",
    plugins: [copyClientMedia()]
  },
  {
    ...sharedNodeOptions,
    entry: { server: "server/src/server.ts" },
    outDir: "server/dist",
    tsconfig: "server/tsconfig.json"
  }
])
