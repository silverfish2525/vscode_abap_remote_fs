# Arch-Fixer Memory — vscode_abap_remote_fs

## Project shape
- Monorepo: `client/` (VS Code extension), `server/` (LSP server), `modules/` (shared libs).
- TS check: `cd client && npx tsc --noEmit 2>&1 | grep -v 'node_modules/zod' | head -5`
- Server has ~59 pre-existing TS errors on `tier1-integrated`-derived branches because:
  - `vscode-abap-remote-fs-sharedapi` (in `modules/sharedapi`) isn't built unless `npm i` is run at repo root (postinstall script: `inst_dep_sharedapi && inst_dep_object && inst_dep_abapfs`).
  - `vscode-languageserver` peer mismatch (`Position`, `CodeAction`, etc. missing).
  - Treat as baseline; only fail if my changes *increase* the count.
- `client/` and `server/` need separate `npm i` (no workspaces declared).

## Verification snippet (paste-ready)
```bash
# baseline: switch to PR branch, count, switch back
cd $repo && git checkout <pr-branch> && cd server && npx tsc --noEmit 2>&1 | grep -c 'error TS'
cd .. && git checkout <my-branch>
```
Always **switch branches**, don't `git checkout <branch> -- .` to compare — that pollutes the index.

## Conventions seen in repo
- `…Ext` suffix for upstream-augmenting type aliases (e.g. `TransportsOfUserExt`).
- `as const` tuples for category iteration over `TransportsOfUser` buckets.
- Comments tagging trust boundaries: `// TODO(upstream): …` plus link.

## PR-07 specifics
See `pr-07-type-safety-polish.md` for the four sub-fixes and how the inline-vs-helper trade-off was resolved.
