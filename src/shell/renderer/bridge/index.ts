export {
  BridgeError,
  confirmDialog,
  createInstalledNimiAppStandardShellSurface,
  focusMainWindow,
  hasElectronRuntime,
  hasNimiShellRuntime,
  hasTauriRuntime,
  installNimiShellRuntimeBridge,
  readInstalledNimiAppLaunchBinding,
  startWindowDrag,
} from '@nimiplatform/kit/shell/renderer/bridge';

export type {
  InstalledNimiAppLaunchBinding,
  InstalledNimiAppStandardShellSurface,
  InstalledNimiAppStorageRemoveJsonResult,
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from '@nimiplatform/kit/shell/renderer/bridge';
