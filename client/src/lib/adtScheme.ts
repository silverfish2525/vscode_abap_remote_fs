/**
 * ADT URI scheme constant.
 *
 * Lives in `lib/` (not `adt/conections.ts`) so that low-level utility code
 * in `lib/vscodefunctions.ts` can reference it without dragging the entire
 * `adt/` subtree (and its transitive `vscode-languageclient` dependency)
 * into every consumer of `lib/`. Critical for keeping the test surface
 * small \u2014 importing from `lib/` should never load adt/connection state.
 */
export const ADTSCHEME = "adt"

/** Path pattern used by ADT URLs returned from the backend. */
export const ADTURIPATTERN = /\/sap\/bc\/adt\//
