type TauriInvoke = (command: string, payload?: unknown) => Promise<unknown>;
type TauriTestHook = {
  invoke?: TauriInvoke;
};
type TauriRuntimeHook = TauriTestHook;

export type TauriRuntimeGlobal = typeof globalThis & {
  __NIMI_TAURI_TEST__?: TauriTestHook;
  __NIMI_TAURI_RUNTIME__?: TauriRuntimeHook;
  window?: TauriRuntimeGlobal;
};

export function hasTauriIpcRuntime(value: TauriRuntimeGlobal = globalThis as TauriRuntimeGlobal): boolean {
  return Boolean(
    typeof value.__NIMI_TAURI_TEST__?.invoke === 'function'
      || typeof value.window?.__NIMI_TAURI_TEST__?.invoke === 'function'
      || typeof value.__NIMI_TAURI_RUNTIME__?.invoke === 'function'
      || typeof value.window?.__NIMI_TAURI_RUNTIME__?.invoke === 'function',
  );
}
