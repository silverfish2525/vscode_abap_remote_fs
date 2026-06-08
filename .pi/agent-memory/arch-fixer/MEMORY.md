# arch-fixer memory — abap-remote-fs project

## Project shape
- Monorepo: `client/` (vscode extension), `server/` (LSP), `modules/{abapfs,abapObject,sharedapi}`.
- TS strict, modules built with `npx tsc` in each module dir before `client` typechecks.
- Decorators heavily used in `client/src/commands/commands.ts`, `scm/abapGit/commands.ts`, etc. (`@command`, `@logErrors`, `@findSC`). DO NOT remove `experimentalDecorators` from tsconfig.

## Verification recipe
- Modules need build first: `cd modules/sharedapi && npx tsc; cd ../abapObject && npx tsc; cd ../abapfs && npx tsc`.
- Pre-existing baseline: 1 client error in `appInsightsService.test.ts` (missing `applicationinsights` module) — unrelated to any fix.
- Server typechecks clean by default.
- `npm install` in client requires `--legacy-peer-deps` (ts-jest@29 peer caps TS at <6 while project is on TS 6).
- ⚠️ npm install on this branch CAN modify `client/package-lock.json` (drops `tslib` peer entry). Restore lockfile before committing.

## Type idiom for synthetic upstream messages
When the upstream lib type (`abap-adt-api` `ActivationResultMessage`) demands fields the local code doesn't actually have, prefer:
```ts
type SyntheticX = Pick<X, "required"> & Partial<Omit<X, "required">>
const v = { required: "..." } satisfies SyntheticX
```
Then widen the consumer's type (e.g. `ActivationFailureResult.messages[number]`) to accept the partial — downstream readers already guard each field.
