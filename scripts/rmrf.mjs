#!/usr/bin/env node
// Tiny native replacement for `rimraf` used in `clean` npm scripts.
// Recursively removes every path passed as a CLI argument. Missing paths are ignored.
import { rm } from "node:fs/promises"

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error("rmrf.mjs: no paths supplied")
  process.exit(1)
}

await Promise.all(
  targets.map(p => rm(p, { recursive: true, force: true }))
)
