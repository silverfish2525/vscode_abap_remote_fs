#!/usr/bin/env node
// Tiny native replacement for `rimraf` used in `clean` npm scripts.
// Recursively removes every path passed as a CLI argument. Missing paths are ignored.
//
// Glob support: each argument is checked for `*` / `?` / `[`. Matching args are
// expanded against their parent directory using `fs.readdirSync` + a simple
// glob-to-regex (only `*` and `?` are honoured, no brace/extglob). This makes
// patterns like `*.vsix` work uniformly on POSIX shells and Windows cmd.exe,
// the latter of which does NOT expand globs before invoking node.
import { rm } from "node:fs/promises"
import { readdirSync } from "node:fs"
import { dirname, basename, join } from "node:path"

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error("rmrf.mjs: no paths supplied")
  process.exit(1)
}

const globToRegex = (glob) => {
  // Escape regex metacharacters except our two wildcards, then translate.
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
  return new RegExp(`^${re}$`)
}

const expand = (pattern) => {
  if (!/[*?[]/.test(pattern)) return [pattern]
  const dir = dirname(pattern) || "."
  const base = basename(pattern)
  const re = globToRegex(base)
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return [] // directory missing — same semantics as `rm -rf` on a missing path
  }
  return entries.filter(e => re.test(e)).map(e => (dir === "." ? e : join(dir, e)))
}

const targets = args.flatMap(expand)

await Promise.all(
  targets.map(p => rm(p, { recursive: true, force: true }))
)
