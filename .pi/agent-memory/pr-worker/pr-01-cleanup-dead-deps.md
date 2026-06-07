---
name: PR-01 cleanup dead deps and native swaps
description: Branch chore/cleanup-dead-deps-and-native-swaps — remove unused deps + replace uuid/open/rimraf with native equivalents
type: project
---

# PR-01 — cleanup-dead-deps-and-native-swaps

Branch: `chore/cleanup-dead-deps-and-native-swaps`
Off: `master` (HEAD `6fb627c`)
Result: 7 commits, 11 files changed, +36 / −733

## Deps deleted
- client deps: `chromadb`, `html2canvas`, `tough-cookie`, `vscode-test-adapter-api`, `xml2js`, `uuid`, `open`
- client devDeps: `@types/mocha`, `@types/open`, `@types/vscode-windows-registry`, `@types/uuid`, `rimraf`
- root deps: `xml2js`
- root devDeps: `concurrently`, `rimraf`
- server devDeps: `rimraf`
- modules/abapObject devDeps: `fs@0.0.1-security` (typo-squatter)

## Refactors
- `uuid.v1()` → `crypto.randomUUID()` in:
  - `client/src/adt/debugger/debugListener.ts`
  - `client/src/views/abapgit.ts`
  - Note: brief mentioned `v4 as uuidv4`; actual code used `v1`. Both are 36-char UUID strings. Behavior delta: timestamp UUID → random UUID. Acceptable per brief intent.
- `open` (the npm pkg) → `vscode.env.openExternal(Uri.file(...))` in `client/src/adt/sapgui/sapgui.ts`. Removed dead `linux` variable + `xdg-open` workaround.
- `rimraf <paths>` in npm `clean` scripts → `node scripts/rmrf.mjs <paths>` (root, client, server). New file `scripts/rmrf.mjs` (~14 lines) wraps `node:fs/promises` `rm({recursive:true,force:true})`.

## Verification
- client tsc: 0 errors (baseline 0) ✓
- server tsc: 52 errors (baseline 52) ✓
- All deleted dep names: 0 src imports remain ✓
- `node scripts/rmrf.mjs <existing> <missing>` — removes existing, ignores missing ✓

## Out-of-scope (deferred)
- Root `@types/mocha` still present — not listed in brief, left alone.
- `lodash` (server) and `ramda` (client) deferred to PR-2.
