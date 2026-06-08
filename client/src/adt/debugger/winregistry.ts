import { extensions } from "vscode";
// Local type declaration for the runtime API exposed by the
// `murbani.winregistry` VS Code extension.  We don't depend on the
// `vscode-windows-registry` npm module directly — the actual function is
// provided at runtime via `extension.exports`.
type GetStringRegKey = (
  hive:
    | "HKEY_CURRENT_USER"
    | "HKEY_LOCAL_MACHINE"
    | "HKEY_CLASSES_ROOT"
    | "HKEY_USERS"
    | "HKEY_CURRENT_CONFIG",
  path: string,
  name: string,
) => string | undefined;
const winregistryExtensionId = "murbani.winregistry";

export function getWinRegistryReader() {
  const ext = extensions.getExtension<{ GetStringRegKey: GetStringRegKey }>(winregistryExtensionId);
  if (!ext?.isActive) return;
  return ext.exports.GetStringRegKey;
}
