export {
  BridgeError,
  confirmDialog,
  createNimiLocalAppStandardShellSurface,
  focusMainWindow,
  hasElectronRuntime,
  hasNimiShellRuntime,
  hasTauriRuntime,
  installNimiShellRuntimeBridge,
  startWindowDrag,
} from '@nimiplatform/kit/shell/renderer/bridge';

export type {
  JsonObject,
  JsonPrimitive,
  JsonValue,
  NimiLocalAppStandardShellSurface,
  NimiLocalAppStorageRemoveResult,
} from '@nimiplatform/kit/shell/renderer/bridge';
