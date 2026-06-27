import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from './index.js';

describe('studio auth bridge boundary', () => {
  let tauriMainSource = '';
  let studioAuthAdapterSource = '';
  let studioLoginPageSource = '';
  let authProviderSource = '';
  let bootstrapSource = '';
  let stylesSource = '';

  beforeAll(() => {
    tauriMainSource = readFileSync(
      join(process.cwd(), 'src-tauri/src/main.rs'),
      'utf8',
    );
    studioAuthAdapterSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/features/auth/studio-auth-adapter.ts'),
      'utf8',
    );
    studioLoginPageSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/features/auth/studio-login-page.tsx'),
      'utf8',
    );
    authProviderSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/app-shell/auth-provider.tsx'),
      'utf8',
    );
    bootstrapSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/infra/studio-bootstrap.ts'),
      'utf8',
    );
    stylesSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/styles.css'),
      'utf8',
    );
  });

  it('does not export oauthTokenExchange from the Studio renderer bridge', () => {
    expect('oauthTokenExchange' in bridge).toBe(false);
  });

  it('fails closed if the kit auth bridge type tries to exchange tokens', async () => {
    await expect(bridge.studioTauriOAuthBridge.oauthTokenExchange({
      provider: 'CODEX',
      clientId: 'nimi.realm-persona-studio',
      code: 'code',
      redirectUri: 'http://127.0.0.1/callback',
      codeVerifier: 'verifier',
    })).rejects.toThrow('does not expose OAuth token exchange');
  });

  it('does not register oauth_token_exchange in the Tauri invoke handler', () => {
    expect(tauriMainSource).not.toContain('oauth_commands::oauth_token_exchange');
    expect(tauriMainSource).not.toContain('oauth_token_exchange,');
  });

  it('does not register token-bearing RuntimeDefaults in the Tauri invoke handler', () => {
    expect(tauriMainSource).not.toMatch(/runtime_defaults::runtime_defaults|defaults::runtime_defaults/);
    expect(bootstrapSource).toContain('getStudioRuntimeDefaults');
  });

  it('registers standard shell capabilities and shell-ui aliases through Kit', () => {
    expect(tauriMainSource).toContain('use nimi_shell_tauri::capabilities::{oauth, runtime, session_logging}');
    expect(tauriMainSource).toContain('oauth::open_external_url');
    expect(tauriMainSource).toContain('oauth::oauth_listen_for_code');
    expect(tauriMainSource).toContain('runtime::runtime_bridge_unary');
    expect(tauriMainSource).toContain('runtime::runtime_bridge_stream_open');
    expect(tauriMainSource).toContain('runtime::runtime_bridge_stream_close');
    expect(tauriMainSource).toContain('runtime::runtime_bridge_status');
    expect(tauriMainSource).toContain('confirm_dialog');
    expect(tauriMainSource).toContain('start_window_drag');
    expect(tauriMainSource).toContain('focus_main_window');
    expect(tauriMainSource).not.toContain('use nimi_shell_tauri::oauth_commands');
    expect(tauriMainSource).not.toContain('use nimi_shell_tauri::runtime_bridge');
  });

  it('preserves Runtime-admitted local Realm host while normalizing missing ports', async () => {
    const previousNimiRealmUrl = process.env['NIMI_REALM_URL'];
    const previousViteRealmBaseUrl = process.env['VITE_NIMI_REALM_BASE_URL'];

    try {
      delete process.env['NIMI_REALM_URL'];
      delete process.env['VITE_NIMI_REALM_BASE_URL'];
      await expect(bridge.getStudioRuntimeDefaults()).resolves.toEqual({
        realm: { realmBaseUrl: 'http://localhost:3002' },
      });

      process.env['NIMI_REALM_URL'] = 'http://localhost';
      await expect(bridge.getStudioRuntimeDefaults()).resolves.toEqual({
        realm: { realmBaseUrl: 'http://localhost:3002' },
      });

      process.env['NIMI_REALM_URL'] = 'http://127.0.0.1';
      await expect(bridge.getStudioRuntimeDefaults()).resolves.toEqual({
        realm: { realmBaseUrl: 'http://127.0.0.1:3002' },
      });
    } finally {
      if (previousNimiRealmUrl === undefined) {
        delete process.env['NIMI_REALM_URL'];
      } else {
        process.env['NIMI_REALM_URL'] = previousNimiRealmUrl;
      }
      if (previousViteRealmBaseUrl === undefined) {
        delete process.env['VITE_NIMI_REALM_BASE_URL'];
      } else {
        process.env['VITE_NIMI_REALM_BASE_URL'] = previousViteRealmBaseUrl;
      }
    }
  });

  it('keeps Runtime complete-login as an explicit code-only proof envelope', () => {
    expect(studioAuthAdapterSource).toContain('createRuntimeAccountBrowserBroker');
    expect(studioAuthAdapterSource).not.toContain('runtime.account.completeLogin');
    expect(studioAuthAdapterSource).not.toContain('runtime.account.beginLogin');
    expect(studioAuthAdapterSource).not.toContain("refreshToken: ''");
    expect(studioAuthAdapterSource).not.toContain("sealedCompletionTicket: ''");
    expect(studioAuthAdapterSource).not.toContain("uxTraceId: ''");
  });

  it('passes Kit desktop auth status banners through the Studio login page', () => {
    expect(studioLoginPageSource).toContain('DesktopShellAuthPage');
    expect(studioLoginPageSource).toContain('authError: statusMessage');
    expect(studioLoginPageSource).toContain('setStatusBanner');
    expect(studioLoginPageSource).toContain("hintVisibility: 'always'");
  });

  it('uses Kit bootstrap surfaces instead of app-local loading chrome', () => {
    expect(authProviderSource).toContain('AmbientBackground');
    expect(authProviderSource).toContain('LoadingSkeleton');
    expect(authProviderSource).toContain('InlineAlert');
    expect(authProviderSource).toContain('runStudioBootstrap({ force: true })');
    expect(authProviderSource).not.toContain('ras-fullscreen-center');
    expect(authProviderSource).not.toContain('ras-spinner');
    expect(stylesSource).not.toContain('.ras-fullscreen-center');
    expect(stylesSource).not.toContain('.ras-spinner');
    expect(stylesSource).toMatch(/\.ras-entry-fallback__panel\s*{[^}]*position:\s*relative;[^}]*z-index:\s*1;/s);
  });

  it('clears stale bootstrap failure state before Runtime retry execution', () => {
    expect(bootstrapSource).toContain('store.setBootstrapReady(false)');
    expect(bootstrapSource).toContain('store.setBootstrapError(null)');
  });
});
