import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

function readOptionalSource(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('studio Desktop-supervised auth boundary', () => {
  let bridgeSource = '';
  let authProviderSource = '';
  let bootstrapSource = '';

  beforeAll(() => {
    bridgeSource = readFileSync(join(process.cwd(), 'src/shell/renderer/bridge/index.ts'), 'utf8');
    authProviderSource = readFileSync(join(process.cwd(), 'src/shell/renderer/app-shell/auth-provider.tsx'), 'utf8');
    bootstrapSource = readFileSync(join(process.cwd(), 'src/shell/renderer/infra/studio-bootstrap.ts'), 'utf8');
  });

  it('does not expose renderer OAuth, credential, launch-binding, or Runtime defaults helpers', () => {
    expect(bridgeSource).toContain('createNimiLocalAppStandardShellSurface');
    expect(bridgeSource).not.toContain('createInstalledNimiAppStandardShellSurface');
    expect(bridgeSource).not.toMatch(/oauth|TokenExchange|getStudioRuntimeDefaults|readInstalledNimiAppLaunchBinding/);
    expect(bridgeSource).not.toMatch(/NIMI_REALM_URL|VITE_NIMI_REALM_BASE_URL|localhost:3002/);
  });

  it('removes app-local login and shows an actionable capability-unavailable state', () => {
    const removedAuthSources = [
      'src/shell/renderer/features/auth/studio-auth-adapter.ts',
      'src/shell/renderer/features/auth/studio-login-page.tsx',
    ].map((path) => readOptionalSource(join(process.cwd(), path))).join('\n');

    expect(removedAuthSources).not.toMatch(/DesktopShellAuthPage|createRuntimeAccountBrowserBroker|oauthLogin/);
    expect(authProviderSource).toContain("t('shell.protectedSession.requiredTitle')");
    expect(authProviderSource).toContain("t('shell.protectedSession.requiredReason')");
    expect(authProviderSource).toContain("t('shell.protectedSession.operationsUnavailable')");
    expect(authProviderSource).toContain('disabled');
    expect(authProviderSource).toContain("t('common.retry')");
  });

  it('keeps bootstrap fail closed without app-owned Runtime defaults', () => {
    expect(bootstrapSource).not.toMatch(/RuntimeDefaults|VITE_NIMI_REALM_BASE_URL|getStudioRuntimeDefaults/);
    expect(bootstrapSource).toContain('getStudioLocalAppClient().auth.status()');
    expect(bootstrapSource).toContain('createStudioProtectedOperationUnavailableError');
    expect(bootstrapSource).toContain('store.setBootstrapReady(true)');
  });
});
