import { z } from "zod"

/**
 * Schema for the persisted folderMap.json file under the local ABAP FS storage root.
 * Tracks whether the storage was initialised and maps connection authority -> on-disk folder name.
 */
export const mappingStatusSchema = z.object({
  initialised: z.boolean(),
  mappings: z.record(z.string(), z.string())
})

export type MappingStatus = z.infer<typeof mappingStatusSchema>
