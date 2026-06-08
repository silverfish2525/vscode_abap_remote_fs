import { z } from "zod"

/**
 * Schemas for the custom RPC messages we layer on top of vscode-languageclient
 * (defined in `vscode-abap-remote-fs-sharedapi`'s `Methods` enum).
 *
 * These are validated at the receiving boundary on the client side. They
 * protect the client against malformed or accidentally-versioned payloads from
 * the language server process.
 */

// ---------- request params (client -> server) ----------

/** Param of `Methods.updateMainProgram` (sent from client to server). */
export const mainProgramSchema = z.object({
  includeUri: z.string(),
  mainProgramUri: z.string()
})

/** Param of `Methods.commLogToggle` (sent from client to server). */
export const commLogTogglePayloadSchema = z.object({
  active: z.boolean(),
  connId: z.string()
})

// ---------- request params (server -> client) ----------

/** Param of `Methods.vsUri` (sent from server to client). */
export const uriRequestSchema = z.object({
  confKey: z.string(),
  uri: z.string(),
  mainInclude: z.boolean()
})

/** Param of `Methods.setSearchProgress` (sent from server to client). */
export const searchProgressSchema = z.object({
  progress: z.number(),
  hits: z.number(),
  ended: z.boolean()
})

// ---------- notification params (server -> client) ----------

/**
 * Param of `Methods.commLogEntry` (sent from server to client).
 *
 * `LogData` originates from `abap-adt-api`; we only validate the wrapper
 * envelope (`connId` + `logData` is an object), not the wire shape of
 * `logData`, since that is owned by the upstream library and changes there
 * should not break our message boundary.
 */
export const commLogEntryDataSchema = z.object({
  connId: z.string(),
  logData: z.object({}).loose()
})

// ---------- inferred types ----------

export type MainProgramMessage = z.infer<typeof mainProgramSchema>
export type CommLogTogglePayloadMessage = z.infer<typeof commLogTogglePayloadSchema>
export type UriRequestMessage = z.infer<typeof uriRequestSchema>
export type SearchProgressMessage = z.infer<typeof searchProgressSchema>
export type CommLogEntryDataMessage = z.infer<typeof commLogEntryDataSchema>
