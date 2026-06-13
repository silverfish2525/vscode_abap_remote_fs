/* eslint-disable */
/**
 * Locate the repo root from `process.cwd()` and fail fast if the marker
 * files aren't where we expect. Centralizing this here keeps the codemods
 * portable across clones and CI checkouts.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export function resolveProjectRoot(): string {
  const root = process.cwd()
  const pkgPath = resolve(root, "package.json")
  if (!existsSync(pkgPath)) {
    throw new Error(
      `[codemod] No package.json at ${root}. Run from the repo root: \`cd /path/to/vscode_abap_remote_fs\`.`
    )
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string }
  if (pkg.name !== "vscode-abap-remote-fs") {
    throw new Error(
      `[codemod] cwd is "${pkg.name}", not "vscode-abap-remote-fs". Run from the repo root.`
    )
  }
  // Sanity: ensure the test layout matches what we walk.
  for (const required of ["client/src", "server/src", "modules/abapfs/src", "modules/abapObject/src"]) {
    if (!existsSync(resolve(root, required))) {
      throw new Error(
        `[codemod] Expected directory not found: ${required}. Has the repo layout changed?`
      )
    }
  }
  return root
}
