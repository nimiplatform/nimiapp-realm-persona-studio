import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('studio Desktop-supervised protected boundary', () => {
  it('uses only the local-app standard bridge and fails closed for unadmitted product operations', () => {
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
