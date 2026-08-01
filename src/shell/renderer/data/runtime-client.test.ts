import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasTauriIpcRuntime } from './runtime-client.js';

const dataDir = dirname(fileURLToPath(import.meta.url));
const rendererRoot = resolve(dataDir, '..');

describe('studio runtime client gate', () => {
  it('does not treat marker-only Tauri globals as available IPC runtime', () => {
    expect(hasTauriIpcRuntime({
      __TAURI__: {},
      __TAURI_INTERNALS__: {},
      __TAURI_IPC__: {},
      window: {
        __TAURI__: {},
        __TAURI_INTERNALS__: {},
        __TAURI_IPC__: {},
      },
    } as unknown as typeof globalThis)).toBe(false);
  });

  it('accepts only Nimi-owned Tauri invoke hooks as available IPC runtime', () => {
    const invoke = async () => undefined;

    expect(hasTauriIpcRuntime({ __NIMI_TAURI_TEST__: { invoke } } as unknown as typeof globalThis)).toBe(true);
    expect(hasTauriIpcRuntime({ __NIMI_TAURI_RUNTIME__: { invoke } } as unknown as typeof globalThis)).toBe(true);
    expect(hasTauriIpcRuntime({ __TAURI__: { core: { invoke } } } as unknown as typeof globalThis)).toBe(false);
    expect(hasTauriIpcRuntime({ __TAURI_INTERNALS__: { invoke } } as unknown as typeof globalThis)).toBe(false);
    expect(hasTauriIpcRuntime({ __TAURI_IPC__: { invoke } } as unknown as typeof globalThis)).toBe(false);
  });

  it('removes renderer-mediated Realm and portable session authority', () => {
    const runtimeClientSource = readFileSync(resolve(dataDir, 'runtime-client.ts'), 'utf8');
    const realmClientSource = readFileSync(resolve(dataDir, 'realm-client.ts'), 'utf8');
    const bridgeSource = readFileSync(resolve(rendererRoot, 'bridge', 'index.ts'), 'utf8');
    const studioPlatformSource = readFileSync(resolve(rendererRoot, 'app-shell', 'studio-platform.ts'), 'utf8');
    const removedRealmTransportPath = resolve(rendererRoot, 'app-shell', 'studio-realm-transport.ts');
    const combined = `${runtimeClientSource}\n${realmClientSource}\n${studioPlatformSource}`;

    expect(existsSync(removedRealmTransportPath)).toBe(false);
    expect(combined).not.toMatch(/VITE_REALM_ACCESS_TOKEN|external_principal|allowAnonymousRealm/);
    expect(studioPlatformSource).toContain('localApp:');
    expect(studioPlatformSource).toContain('createNimiLocalAppStandardShellSurface');
    expect(studioPlatformSource).not.toMatch(/createStudioRealmBridgeOptions|createRuntimeAccountMediatedRealmTransport/);
    expect(studioPlatformSource).not.toMatch(/getAccessToken|createRealmFetchTransport|refreshToken|sessionStore/);
    expect(studioPlatformSource).not.toMatch(/appId:|runtime:|realm:|permissions:/);
    expect(realmClientSource).not.toMatch(/createPost|createTextResource|create(Image|Video|Audio)DirectUpload|finalizeResource|listResources/);
    expect(bridgeSource).not.toMatch(/RuntimeDefaults|RealmDefaults|readInstalledNimiAppLaunchBinding/);
  });
});
