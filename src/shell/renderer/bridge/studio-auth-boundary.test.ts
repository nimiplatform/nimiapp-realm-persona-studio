import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

function readOptionalSource(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('studio installed-app auth and Tauri boundary', () => {
  let tauriMainSource = '';
  let bridgeSource = '';
  let authProviderSource = '';
  let bootstrapSource = '';

  beforeAll(() => {
    tauriMainSource = readFileSync(join(process.cwd(), 'src-tauri/src/main.rs'), 'utf8');
    bridgeSource = readFileSync(join(process.cwd(), 'src/shell/renderer/bridge/index.ts'), 'utf8');
    authProviderSource = readFileSync(join(process.cwd(), 'src/shell/renderer/app-shell/auth-provider.tsx'), 'utf8');
    bootstrapSource = readFileSync(join(process.cwd(), 'src/shell/renderer/infra/studio-bootstrap.ts'), 'utf8');
  });

  it('registers only the installed artifact standard-shell command', () => {
    expect(tauriMainSource).toContain('RuntimeBridgeAppHost::platform_default()');
    expect(tauriMainSource).toContain('nimi_shell_tauri_installed_app_standard_shell_handler![]');
    expect(tauriMainSource).not.toContain('installed_app_launch');
    expect(tauriMainSource).not.toContain('resolve_installed_nimi_app_launch_binding_from_env');
    expect(tauriMainSource).not.toContain('append_invoke_initialization_script');
    expect(tauriMainSource).not.toContain('NIMI_REALM_PERSONA_STUDIO_TAURI_LAUNCH_NONCE');
    expect(tauriMainSource).not.toMatch(/runtime_(unary|stream|defaults|bridge_status)/);
    expect(tauriMainSource).not.toMatch(/ai_config|data_(read|write)|storage|oauth|auth_session|shell_ui/);
  });

  it('does not expose renderer OAuth, credential, launch-binding, or Runtime defaults helpers', () => {
    expect(bridgeSource).toContain('createInstalledNimiAppStandardShellSurface');
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
    expect(bootstrapSource).toContain('runStudioBootstrap({ force: true })');
    expect(bootstrapSource).toContain('store.setBootstrapReady(true)');
  });
});
