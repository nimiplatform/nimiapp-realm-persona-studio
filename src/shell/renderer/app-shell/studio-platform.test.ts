import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasTauriIpcRuntime } from './tauri-runtime.js';

function readSourceTree(root: string): string {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(root, entry.name);
      if (entry.isDirectory()) return [readSourceTree(path)];
      return /\.(?:cts|mts|ts|tsx)$/u.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
    })
    .join('\n');
}

describe('studio Desktop-supervised protected boundary', () => {
  it('uses only the local-app standard bridge and fails closed for unavailable product operations', () => {
    const studioPlatformSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/app-shell/studio-platform.ts'),
      'utf8',
    );
    const bootstrapSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/infra/studio-bootstrap.ts'),
      'utf8',
    );
    const combined = `${studioPlatformSource}\n${bootstrapSource}`;

    expect(studioPlatformSource).toContain('createNimiClient');
    expect(studioPlatformSource).toContain('createNimiLocalAppStandardShellSurface');
    expect(studioPlatformSource).toContain('standardShell: createNimiLocalAppStandardShellSurface()');
    expect(studioPlatformSource).toContain('REALM_PERSONA_STUDIO_APP_ID');
    expect(studioPlatformSource).toContain("reasonCode: STUDIO_CAPABILITY_UNAVAILABLE_REASON");
    expect(studioPlatformSource).not.toContain('createInstalledNimiAppBootstrap');
    expect(studioPlatformSource).not.toContain('createInstalledNimiAppStandardShellSurface');
    expect(studioPlatformSource).not.toContain('createStudioRealmBridgeOptions');
    expect(studioPlatformSource).not.toContain('createRuntimeAccountMediatedRealmTransport');
    expect(studioPlatformSource).not.toContain('readInstalledNimiAppLaunchBinding');
    expect(studioPlatformSource).not.toContain('caller:');
    expect(studioPlatformSource).not.toContain('realmBaseUrl');
    expect(combined).not.toMatch(/accessToken|refreshToken|sessionProof|launchNonce|releaseDigest/);
    expect(bootstrapSource).toContain('getStudioLocalAppClient().auth.status()');
    expect(bootstrapSource).toContain('session.sessionBound');
    expect(bootstrapSource).toContain('store.setProtectedSessionBound()');
    expect(bootstrapSource).toContain('store.setBootstrapReady(true)');
    expect(bootstrapSource).toContain('store.clearAuthSession()');
  });

  it('keeps SDK and Kit source aliases on their canonical shared owners', () => {
    const viteConfigSource = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
    const stylesSource = readFileSync(join(process.cwd(), 'src/shell/renderer/styles.css'), 'utf8');

    expect(viteConfigSource).toContain("find: /^@nimiplatform\\/sdk\\/runtime$/");
    expect(viteConfigSource).toContain("replacement: path.resolve(nimiSdkSourceRoot, 'runtime/index.ts')");
    expect(viteConfigSource).toContain("find: /^@nimiplatform\\/kit\\/shell\\/renderer\\/bootstrap$/");
    expect(viteConfigSource).toContain("replacement: path.resolve(nimiKitSourceRoot, 'shell/renderer/src/bootstrap/index.ts')");
    expect(stylesSource).toContain('@source "../../../../../nimi/kit/**/*.{ts,tsx}";');
    expect(stylesSource).not.toContain('@nimiplatform/kit/dist');
  });
});

describe('studio renderer transport gate', () => {
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
    const rendererRoot = resolve(process.cwd(), 'src/shell/renderer');
    const bridgeSource = readFileSync(resolve(rendererRoot, 'bridge', 'index.ts'), 'utf8');
    const studioPlatformSource = readFileSync(resolve(rendererRoot, 'app-shell', 'studio-platform.ts'), 'utf8');
    const worldCoreSource = readFileSync(resolve(rendererRoot, 'data', 'studio-world-core.ts'), 'utf8');
    const removedRealmTransportPath = resolve(rendererRoot, 'app-shell', 'studio-realm-transport.ts');
    const removedRealmClientPath = resolve(rendererRoot, 'data', 'realm-client.ts');
    const combined = readSourceTree(resolve(process.cwd(), 'src'));
    const retiredWorldCorePrefix = ['worldCore', 'Controller'].join('');
    const retiredRealmClientSpecifier = ['data/realm', '-client'].join('');
    const portableRealmAuthorityPattern = new RegExp([
      ['VITE_REALM', 'ACCESS_TOKEN'].join('_'),
      ['external', 'principal'].join('_'),
      ['allowAnonymous', 'Realm'].join(''),
    ].join('|'));

    expect(existsSync(removedRealmTransportPath)).toBe(false);
    expect(existsSync(removedRealmClientPath)).toBe(false);
    expect(combined).not.toMatch(portableRealmAuthorityPattern);
    expect(studioPlatformSource).toContain('localApp:');
    expect(studioPlatformSource).toContain('createNimiLocalAppStandardShellSurface');
    expect(studioPlatformSource).not.toMatch(/createStudioRealmBridgeOptions|createRuntimeAccountMediatedRealmTransport/);
    expect(studioPlatformSource).not.toMatch(/getAccessToken|createRealmFetchTransport|refreshToken|sessionStore/);
    expect(studioPlatformSource).not.toMatch(/appId:|runtime:|realm:/);
    expect(combined).not.toContain(retiredWorldCorePrefix);
    expect(combined).not.toContain(retiredRealmClientSpecifier);
    expect(worldCoreSource).toContain('client.realm.worldCore.list');
    expect(bridgeSource).not.toMatch(/RuntimeDefaults|RealmDefaults|readInstalledNimiAppLaunchBinding/);
  });
});
