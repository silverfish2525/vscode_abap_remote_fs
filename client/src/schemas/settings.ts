import { z } from "zod"
import { log } from "../lib"

/**
 * Schemas for the user-facing settings under `abapfs.*`.
 *
 * VS Code's `workspace.getConfiguration("abapfs")` returns `any`-typed values
 * derived from JSON — these schemas validate the shape we actually consume
 * before we hand it on to typed call sites.
 *
 * We currently validate only `abapfs.remote`. The other `abapfs.*` settings
 * are read through `config.get<T>(key, default)` with explicit defaults at
 * each call site, which already provides a safety net; encoding them here
 * would just duplicate package.json's contributes-configuration schema. If a
 * future caller depends on the structural invariants of one of those, add
 * the schema here next to `remoteSettingsSchema`.
 */

// ---------- abapfs.remote.* ----------

const oauthSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  loginUrl: z.string(),
  saveCredentials: z.boolean().optional()
})

const sapGuiSchema = z.object({
  disabled: z.boolean().optional(),
  routerString: z.string().optional(),
  group: z.string().optional(),
  messageServer: z.string().optional(),
  messageServerPort: z.string().optional(),
  server: z.string().optional(),
  systemNumber: z.string().optional(),
  guiType: z
    .enum(["SAPGUI", "WEBGUI_CONTROLLED", "WEBGUI_UNSAFE", "WEBGUI_UNSAFE_EMBEDDED"])
    .optional()
})

/**
 * Schema for a single connection entry under `abapfs.remote.<connectionId>`.
 *
 * Mirrors the package.json `contributes.configuration.abapfs.remote.patternProperties`
 * shape and the runtime `RemoteConfig` interface in `client/src/config.ts`.
 *
 * `url` and `username` are the only fields the JSON schema marks as required;
 * everything else is optional with sensible runtime defaults applied later.
 */
export const remoteConnectionSchema = z
  .object({
    url: z.string(),
    username: z.string(),
    password: z.string().optional(),
    client: z.string().optional(),
    language: z.string().optional(),
    atcapprover: z.string().optional(),
    atcVariant: z.string().optional(),
    allowSelfSigned: z.boolean().optional(),
    customCA: z.string().optional(),
    diff_formatter: z
      .enum(["ADT formatter", "AbapLint", "Simple", "simple"])
      .optional(),
    maxDebugThreads: z.number().int().min(1).max(20).optional(),
    oauth: oauthSchema.optional(),
    sapGui: sapGuiSchema.optional()
  })
  // Forward-compat: tolerate unknown keys so that older clients do not reject
  // configuration written by newer clients.
  .loose()

/** Schema for the `abapfs.remote` object as a whole (record of connections). */
export const remoteSettingsSchema = z.record(z.string(), remoteConnectionSchema)

export type RemoteConnectionSettings = z.infer<typeof remoteConnectionSchema>
export type RemoteSettings = z.infer<typeof remoteSettingsSchema>

/**
 * Validate a value read from `workspace.getConfiguration("abapfs").get("remote")`.
 *
 * On parse failure the offending issues are logged through the extension's
 * output channel (so the user can see what is wrong with their settings.json)
 * and `undefined` is returned. Callers that need a guaranteed value should
 * fall back to an empty record.
 */
export function parseRemoteSettings(
  raw: unknown
): RemoteSettings | undefined {
  if (raw === undefined || raw === null) return {}
  const result = remoteSettingsSchema.safeParse(raw)
  if (result.success) return result.data
  log(
    "abapfs.remote settings failed validation:",
    JSON.stringify(result.error.issues, null, 2)
  )
  return undefined
}
