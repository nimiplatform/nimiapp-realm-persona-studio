import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

function readOptionalSource(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('studio installed app auth and shell boundary', () => {
  let tauriMainSource = '';
  let bridgeSource = '';
  let studioAuthAdapterSource = '';
  let studioLoginPageSource = '';
  let authProviderSource = '';
  let bootstrapSource = '';

  beforeAll(() => {
    tauriMainSource = readFileSync(join(process.cwd(), 'src-tauri/src/main.rs'), 'utf8');
    bridgeSource = readFileSync(join(process.cwd(), 'src/shell/renderer/bridge/index.ts'), 'utf8');
    studioAuthAdapterSource = readOptionalSource(
      join(process.cwd(), 'src/shell/renderer/features/auth/studio-auth-adapter.ts'),
    );
    studioLoginPageSource = readOptionalSource(
      join(process.cwd(), 'src/shell/renderer/features/auth/studio-login-page.tsx'),
    );
    authProviderSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/app-shell/auth-provider.tsx'),
      'utf8',
    );
    bootstrapSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/infra/studio-bootstrap.ts'),
      'utf8',
    );
  });

  it('does not expose renderer OAuth, token exchange, or Runtime defaults helpers', () => {
    expect(bridgeSource).not.toContain('studioTauriOAuthBridge');
    expect(bridgeSource).not.toContain('oauthListenForCode');
    expect(bridgeSource).not.toContain('openExternalUrl');
    expect(bridgeSource).not.toContain('oauthTokenExchange');
    expect(bridgeSource).not.toContain('TauriOAuthBridge');
    expect(bridgeSource).not.toContain('getStudioRuntimeDefaults');
    expect(bridgeSource).not.toContain('getRuntimeDefaults');
    expect(bridgeSource).not.toContain('NIMI_REALM_URL');
    expect(bridgeSource).not.toContain('VITE_NIMI_REALM_BASE_URL');
    expect(bridgeSource).not.toContain('localhost:3002');
  });

  it('does not register installed-app-forbidden Tauri capabilities', () => {
    expect(tauriMainSource).not.toContain('oauth::');
    expect(tauriMainSource).not.toContain('oauth_listen_for_code');
    expect(tauriMainSource).not.toContain('open_external_url');
    expect(tauriMainSource).not.toContain('runtime_bridge_status');
    expect(tauriMainSource).not.toContain('runtime_defaults');
    expect(tauriMainSource).not.toContain('auth_session');
    expect(tauriMainSource).not.toContain('sessionLoad');
    expect(tauriMainSource).not.toContain('sessionSave');
    expect(tauriMainSource).not.toContain('sessionClear');
    expect(tauriMainSource).not.toContain('local_agent');
    expect(tauriMainSource).not.toContain('raw_ipc');
    expect(tauriMainSource).not.toContain('raw_fs');
  });

  it('projects installed app launch binding through the shared Kit Tauri helper', () => {
    expect(tauriMainSource).toContain('nimi_shell_tauri::installed_app_launch');
    expect(tauriMainSource).toContain('resolve_installed_nimi_app_launch_binding_from_env');
    expect(tauriMainSource).toContain('build_installed_nimi_app_launch_binding_script');
    expect(tauriMainSource).toContain('append_invoke_initialization_script');
    expect(tauriMainSource).toContain('NIMI_REALM_PERSONA_STUDIO_TAURI_LAUNCH_NONCE');
  });

  it('uses kit shell-ui instead of app-local drag/focus/confirm commands', () => {
    expect(tauriMainSource).toContain('shell_ui::start_window_drag');
    expect(tauriMainSource).toContain('shell_ui::focus_main_window');
    expect(tauriMainSource).toContain('shell_ui::confirm_dialog');
    expect(tauriMainSource).not.toContain('realm_persona_studio_start_window_drag');
    expect(tauriMainSource).not.toMatch(/async fn start_window_drag/);
    expect(tauriMainSource).not.toMatch(/async fn focus_main_window/);
    expect(tauriMainSource).not.toMatch(/async fn confirm_dialog/);
  });

  it('removes app-local login and browser OAuth broker code paths', () => {
    const authSources = `${studioAuthAdapterSource}\n${studioLoginPageSource}\n${authProviderSource}`;

    expect(authSources).not.toContain('DesktopShellAuthPage');
    expect(authSources).not.toContain('createRuntimeAccountBrowserBroker');
    expect(authSources).not.toContain('oauthBridge');
    expect(authSources).not.toContain('oauthLogin');
    expect(authSources).not.toContain('StudioLoginPage');
    expect(authProviderSource).toContain('Desktop shared Runtime account required');
    expect(authProviderSource).toContain('capability-unavailable');
  });

  it('keeps bootstrap fail-closed instead of falling back to app-owned Runtime defaults', () => {
    expect(bootstrapSource).not.toContain('getStudioRuntimeDefaults');
    expect(bootstrapSource).not.toContain('RuntimeDefaults');
    expect(bootstrapSource).not.toContain('VITE_NIMI_REALM_BASE_URL');
    expect(bootstrapSource).toContain('runStudioBootstrap({ force: true })');
    expect(bootstrapSource).toContain('store.setBootstrapError');
  });
});
