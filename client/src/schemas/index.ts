/**
 * Public exports for `client/src/schemas/`.
 *
 * Centralised so call sites can `import { ... } from "../schemas"` without
 * caring about which file the schema lives in.
 */

export {
  mappingStatusSchema,
  type MappingStatus
} from "./folderMap"

export {
  revisionSchema,
  conflictDetailsSchema,
  type RevisionRef,
  type ConflictDetails
} from "./abapRevisions"

export {
  mainProgramSchema,
  commLogTogglePayloadSchema,
  uriRequestSchema,
  searchProgressSchema,
  commLogEntryDataSchema,
  type MainProgramMessage,
  type CommLogTogglePayloadMessage,
  type UriRequestMessage,
  type SearchProgressMessage,
  type CommLogEntryDataMessage
} from "./lspMessages"

export {
  remoteConnectionSchema,
  remoteSettingsSchema,
  parseRemoteSettings,
  type RemoteConnectionSettings,
  type RemoteSettings
} from "./settings"
