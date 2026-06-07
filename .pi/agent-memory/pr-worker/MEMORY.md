# pr-worker memory index

Project: vscode_abap_remote_fs (https://github.com/marcellourbani/vscode_abap_remote_fs)

## Repo shape
- Monorepo: root + `client/` + `server/` + `modules/{abapfs,abapObject,sharedapi}`
- Root `npm install` triggers `postinstall` which cascades into modules and client/server
- Lockfiles tracked at root, client/, modules/abapObject, modules/abapfs (despite `.gitignore` containing `package-lock.json` — pre-existing tracked entries override)
- `server/package-lock.json` is **not** tracked

## TSC baselines (after `npm install`)
- `client && npx tsc --noEmit | grep -v 'node_modules/zod' | grep 'error TS'` → **0**
- `server && npx tsc --noEmit | grep 'error TS'` → **52** (baseline, ignore)
- The agent profile said "52 baseline" for server — confirmed correct.

## Useful greps
- All uuid call sites used `v1` (timestamp), not `v4`. Migrated to `randomUUID()` (v4) — format-compatible.
- `open` had a single call site in `client/src/adt/sapgui/sapgui.ts` (used to launch a `.sap` shortcut file). Replaced with `vscode.env.openExternal(Uri.file(...))`. The `linux` xdg-open workaround is no longer needed — VS Code handles it.

## PRs done
- See [pr-01-cleanup-dead-deps.md](./pr-01-cleanup-dead-deps.md)

## Out-of-scope rules surfaced by briefs (track for future)
- PR-2 owns `lodash` and `ramda` — do not touch in unrelated PRs.
- Never touch: `*.test.ts`, `.github/workflows/`, `jest.config.js`, `webpack.config.js`, `tsconfig.json` (unless brief explicitly targets them).
