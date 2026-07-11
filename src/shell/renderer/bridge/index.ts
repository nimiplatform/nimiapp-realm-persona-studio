export {
  BridgeError,
  confirmDialog,
  createInstalledNimiAppStandardShellSurface,
  focusMainWindow,
  hasElectronRuntime,
  hasNimiShellRuntime,
  hasTauriRuntime,
  installNimiShellRuntimeBridge,
  startWindowDrag,
} from '@nimiplatform/kit/shell/renderer/bridge';

export type {
  InstalledNimiAppStandardShellSurface,
  InstalledNimiAppStorageRemoveJsonResult,
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from '@nimiplatform/kit/shell/renderer/bridge';
