import { readFileSync } from 'node:fs';
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

  it('uses installed app SDK Runtime account transport instead of app-owned auth or Realm transport', () => {
    const runtimeClientSource = readFileSync(resolve(dataDir, 'runtime-client.ts'), 'utf8');
    const realmClientSource = readFileSync(resolve(dataDir, 'realm-client.ts'), 'utf8');
    const realmTransportSource = readFileSync(resolve(rendererRoot, 'app-shell', 'studio-realm-transport.ts'), 'utf8');
    const bridgeSource = readFileSync(resolve(rendererRoot, 'bridge', 'index.ts'), 'utf8');
    const appStoreSource = readFileSync(resolve(rendererRoot, 'app-shell', 'app-store.ts'), 'utf8');
    const studioPlatformSource = readFileSync(resolve(rendererRoot, 'app-shell', 'studio-platform.ts'), 'utf8');
    const combinedDataSource = `${runtimeClientSource}\n${realmClientSource}`;

    expect(combinedDataSource).not.toMatch(/VITE_REALM_ACCESS_TOKEN|external_principal|allowAnonymousRealm/);
    expect(combinedDataSource).not.toMatch(/createRealmClient|createPlatformClient/);
    expect(studioPlatformSource).toContain('createNimiClient');
    expect(studioPlatformSource).toContain('createInstalledNimiAppBootstrap');
    expect(studioPlatformSource).toContain('createStudioRealmBridgeOptions');
    expect(studioPlatformSource).not.toContain('createNimiLocalFirstPartyRuntimeAccountCaller');
    expect(studioPlatformSource).not.toContain('createNimiRuntimeAppSessionMetadataProvider');
    expect(studioPlatformSource).not.toContain('createNimiRuntimeFullAppRegistration');
    expect(studioPlatformSource).not.toContain('authorizeExternalPrincipal');
    expect(studioPlatformSource).not.toContain('AuthorizationPreset');
    expect(studioPlatformSource).not.toContain('protectedAccess');
    expect(studioPlatformSource).not.toContain('scopes: [...STUDIO_REALM_API_SCOPES]');
    expect(realmTransportSource).toContain('createRuntimeAccountMediatedRealmTransport');
    expect(realmTransportSource).not.toContain('invokeRealmUnary');
    expect(realmTransportSource).not.toContain('realm_persona_studio_realm_unary');
    expect(realmTransportSource).not.toContain('getAccessToken');
    expect(studioPlatformSource).not.toContain('getAccessToken');
    expect(studioPlatformSource).not.toContain('createRealmFetchTransport');
    expect(studioPlatformSource).not.toMatch(/VITE_REALM_ACCESS_TOKEN|refreshToken|sessionStore|subjectUserIdProvider/);
    expect(bridgeSource).not.toContain('getStudioRuntimeDefaults');
    expect(bridgeSource).not.toContain('getRuntimeDefaults');
    expect(bridgeSource).not.toContain('RuntimeDefaults');
    expect(bridgeSource).not.toContain('RealmDefaults');
    expect(bridgeSource).not.toContain('RuntimeExecutionDefaults');
    expect(appStoreSource).not.toContain('StudioRuntimeDefaults');
    expect(appStoreSource).not.toContain('import type { RuntimeDefaults');
    expect(appStoreSource).not.toContain('runtimeDefaults: RuntimeDefaults');
    expect(appStoreSource).not.toContain('setRuntimeDefaults: (defaults: RuntimeDefaults)');
    expect(appStoreSource).not.toContain('accessToken');
  });
});
