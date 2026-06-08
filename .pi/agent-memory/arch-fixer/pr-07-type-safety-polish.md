---
name: PR-07 type-safety polish — arch-fix details
description: How the four arch-review recommendations on PR-07 were resolved
type: project
---

## Verdict
`Worth merging with notes` → addressed each explicit note.

## What landed in the arch-fix branch (`refactor/type-safety-polish-arch-fix`)
4 commits, additive on top of `refactor/type-safety-polish`:

1. **Discriminated unions for webview messages** (`webviewManager.ts`).
   - Added `DataQueryMessage` (3 variants) and `DependencyGraphMessage` (6 variants) at top of file, derived by grepping `vscode.postMessage(...)` call sites in `client/media/dataQuery.js` + `client/media/dependencyGraph.js`.
   - Typed `handleWebviewMessage(message: DataQueryMessage, ...)` and `handleGraphMessage(message: DependencyGraphMessage, ...)`.
   - Dropped the `(c: any)` and `(r as any)[f]` casts inside the `exportCSV` branch — the discriminated union narrows the case body.
   - **Note**: the brief suggested `columns: QueryResultColumn[]` but the actual JS sends tabulator column shapes `{title, field}`. I introduced a small `ExportCSVColumn` interface (`{title?, field?, name?}`) instead so the existing fallback chain (`c.title || c.field || c.name`) stays valid without `any`.

2. **Export `TransportsOfUserExt` + adopt in `transportTool.ts`** (`views/transports.ts`, `services/lm-tools/transportTool.ts`).
   - `transports.ts`: changed the local `type` declaration to `export type`.
   - `transportTool.ts`: imported `ADTClient` and `TransportsOfUserExt`; replaced four `client: any` params with `client: ADTClient`; cast `readTransports(...)` result once to `TransportsOfUserExt` so `transports[category]` and `target[status]` typecheck against `as const` tuples.

3. **Inline `ActivationResult` intersection** (`AdtObjectActivator.ts`).
   - Deleted the 9-line `ActivationFailureResult` helper (and its TODO comment).
   - `summarizeFailure` now takes `result: ActivationResult` directly.
   - Per-message extension lives at the `.map` callback as `(m: ActivationResultMessage & Partial<{longText: unknown; message: unknown; msg: unknown}>) => …`.
   - The bare-`InactiveObject` widening on `result.inactive` is isolated to a single localized cast at the trust boundary, with a 4-line comment.
   - Net: ~9 line reduction; vocabulary now matches abap-adt-api (no "failure" drift).

4. **`isObjectShape` predicate in `feedParsers.ts`**.
   - Added `const isObjectShape = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object"` inside `parseFeedResponse`.
   - Three repeated `feedData && typeof feedData === "object" && "x" in feedData` branches collapsed into one nested guard with three `in`-checks. Pure cosmetic.

## Skipped from the review
None. All four explicit recommendations implemented.

## Verification at end
- `client && npx tsc --noEmit` clean (no errors after filtering `node_modules/zod`).
- `server && npx tsc --noEmit` shows 59 pre-existing errors — same count as `refactor/type-safety-polish`. No new server breakage (server wasn't touched).
- Diff vs PR branch: 5 files, +145/−72.
