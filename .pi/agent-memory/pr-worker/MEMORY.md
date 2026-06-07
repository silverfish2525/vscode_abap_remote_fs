# pr-worker memory — vscode_abap_remote_fs

## Project layout
- Monorepo root with `client/`, `server/`, `modules/{abapfs,abapObject,sharedapi}/`.
- Postinstall chain: `npm install` at root installs all sub-packages.
- TypeScript: 4.9.5 across the repo.
- `server/package-lock.json` is gitignored; root + client + modules have tracked locks.
- Active branch in user worktree: `master`. Agent should `git checkout -b ...` from master.
- The host worktree at `/Users/i584843/Documents/personal/dev/vscode_abap_remote_fs` already has master checked out, so agent worktrees can't reuse master directly — create the PR branch instead.

## Baselines (post PR-3)
- `client && npx tsc --noEmit` — 0 errors (after filtering `node_modules/zod`).
- `server && npx tsc --noEmit` — 0 errors (was 52 pre-PR-3).

## Key gotchas learned

### vscode-languageserver v10 (PR-3)
- v10 ships `exports`-only `package.json` (no `main` field). Classic `moduleResolution: "node"` cannot resolve it. Must use `node16`/`nodenext`/`bundler`. TS 4.9 supports `node16` even with `module: "commonjs"`.
- `createConnection` + `ProposedFeatures` are in `vscode-languageserver/node`, not the bare module.
- `WorkDoneProgress` (subpath import `vscode-languageserver/lib/progress`) is gone; use `WorkDoneProgressReporter` from the main entry.
- `CompletionItem.label` is now strictly `string` (no `CompletionItemLabelDetails` union); narrowing branches collapse to `never`.
- `GenericRequestHandler<R, E>` no longer accepts `R | undefined`; handlers must return `R | Thenable<R>` strictly. Make handlers `async` or always-return.

## PR briefs location
- User keeps PR briefs in `/Users/i584843/Documents/personal/dev/vscode_abap_remote_fs/.pi/pr-briefs/PR-NN-*.md`.
- These are NOT copied into agent worktrees. Read them by absolute path from the host repo when invoked.

## Out-of-scope reminders
- Do not touch tests, CI workflows, jest/webpack configs.
- `tsconfig.json` only when the PR explicitly requires it (PR-3 needed `server/tsconfig.json` moduleResolution change to make v10 resolvable — that counts as in-scope).
