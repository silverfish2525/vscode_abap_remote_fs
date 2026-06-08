import { defineConfig } from "tsdown"
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
} from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = resolve(fileURLToPath(import.meta.url), "..")

// Replicates the copy-webpack-plugin behavior of the old client/webpack.config.js:
//   - client/media/**          -> client/dist/media/**
//   - DOCUMENTATION.md (root)  -> client/dist/media/DOCUMENTATION.md
const copyClientMedia = () => ({
  name: "vscode-abap-remote-fs:copy-client-media",
  buildEnd() {
    const dest = resolve(projectRoot, "client/dist/media")
    mkdirSync(dest, { recursive: true })

    const mediaSrc = resolve(projectRoot, "client/media")
    if (existsSync(mediaSrc)) {
      cpSync(mediaSrc, dest, { recursive: true })
    }

    const docs = resolve(projectRoot, "DOCUMENTATION.md")
    if (existsSync(docs)) {
      copyFileSync(docs, resolve(dest, "DOCUMENTATION.md"))
    }
  },
})

// VS Code loads the extension as CommonJS from a .js file (see "main" in
// package.json), so we keep the .js extension instead of tsdown's default .cjs.
const cjsJs = () => ({ js: ".js" as const })

const sharedNodeOptions = {
  format: "cjs" as const,
  platform: "node" as const,
  target: "node18" as const,
  sourcemap: true,
  clean: true,
  dts: false,
  outExtensions: cjsJs,
  // Keep class names so runtime checks like `obj.constructor.name` and
  // `instanceof` against minified classes keep working. The old webpack
  // config did this via terser's keep_classnames.
  minify: { mangle: { keepNames: true } },
  // The VSIX is shipped with everything bundled into the dist file, the way
  // the old webpack config did. `vscode` is provided by the host and
  // `@playwright/mcp` is loaded dynamically and must stay external.
  inputOptions: {
    external: ["vscode", "@playwright/mcp"],
  },
  deps: {
    alwaysBundle: [/.*/],
  },
}

export default defineConfig([
  {
    ...sharedNodeOptions,
    entry: {
      extension: "client/src/extension.ts",
      jsWorkerEntry: "client/src/notebooks/jsWorkerEntry.ts",
    },
    outDir: "client/dist",
    tsconfig: "client/tsconfig.json",
    plugins: [copyClientMedia()],
  },
  {
    ...sharedNodeOptions,
    entry: { server: "server/src/server.ts" },
    outDir: "server/dist",
    tsconfig: "server/tsconfig.json",
  },
])
