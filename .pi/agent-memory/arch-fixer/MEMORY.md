# arch-fixer memory index

- [pr-01-followup-2026-06-08.md](./pr-01-followup-2026-06-08.md) — PR-01 (cleanup-dead-deps) re-fix: uuid v1→v4 transition comments + rmrf.mjs glob expansion for Windows cmd.exe.

## Repo cheats
- This repo (vscode-abap-remote-fs) ships **without** node_modules in agent checkouts. `npx tsc --noEmit` will fail with "Cannot find type definition file for 'jest'". Comment-only TS edits are safe — verify by reading them back. For semantic edits, run `npm ci` first.
- `clean` scripts: `client/package.json`, `server/package.json`, root `package.json` all delegate to `scripts/rmrf.mjs` (no rimraf dep). Root one uses a `*.vsix` glob — must be shell-independent.
- `crypto.randomUUID()` (Node v4) replaced the `uuid` dep in PR-01. Persisted call sites: `client/src/adt/debugger/debugListener.ts` (`getOrCreateIdeId` workspaceState, `getOrCreateTerminalId` ~/.SAP/ABAPDebugging/terminalId).
