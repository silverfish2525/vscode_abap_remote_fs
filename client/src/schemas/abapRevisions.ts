import { z } from "zod"

/**
 * Schema for a single ABAP revision reference, as embedded in merge-conflict
 * payloads coming from the abapGit / SCM bridge.
 */
export const revisionSchema = z.object({
  uri: z.string(),
  date: z.string(),
  author: z.string(),
  version: z.string(),
  versionTitle: z.string()
})

export type RevisionRef = z.infer<typeof revisionSchema>

/**
 * Schema for the merge-conflict descriptor passed to AbapFsCommands.mergeEditor
 * when invoked with structured arguments (rather than a Uri).
 */
export const conflictDetailsSchema = z.object({
  conflicting: z.string(),
  transport: z.string(),
  uri: z.string(),
  incoming: revisionSchema,
  conflict: revisionSchema
})

export type ConflictDetails = z.infer<typeof conflictDetailsSchema>
