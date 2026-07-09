import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('studio Electron shell boundary', () => {
  it('provides the dual-shell Electron entrypoints and package scripts', () => {
    const requiredFiles = [
      'src-electron/main.ts',
      'src-electron/preload.cts',
      'src-electron/runtime-auth.ts',
      'tsconfig.electron.json',
      'scripts/run-electron-dev.mjs',
      'scripts/bundle-electron-preload.mjs',
    ];

    for (const file of requiredFiles) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(true);
    }

    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.['dev:electron']).toBeTruthy();
    expect(packageJson.scripts?.['build:electron']).toBeTruthy();
    expect(packageJson.scripts?.['typecheck:electron']).toBeTruthy();
  });

  it('installs only the Nimi Electron runtime bridge in preload', () => {
    const source = readFileSync(join(process.cwd(), 'src-electron/preload.cts'), 'utf8');

    expect(source).toContain('installNimiElectronRuntimeBridge');
    expect(source).not.toContain('contextBridge.exposeInMainWorld');
    expect(source).not.toContain('nodeIntegration');
    expect(source).not.toContain('fs');
  });

  it('registers Electron standard shell without forbidden installed-app capabilities', () => {
    const mainSource = readFileSync(join(process.cwd(), 'src-electron/main.ts'), 'utf8');
    const runtimeAuthSource = readFileSync(join(process.cwd(), 'src-electron/runtime-auth.ts'), 'utf8');

    expect(mainSource).toContain('registerNimiElectronRuntimeBridge');
    expect(mainSource).toContain('NIMI_STANDARD_SHELL_COMMANDS');
    expect(mainSource).toContain("NIMI_STANDARD_SHELL_COMMANDS['runtime.unary']");
    expect(mainSource).toContain("NIMI_STANDARD_SHELL_COMMANDS['runtime.streamOpen']");
    expect(mainSource).toContain("NIMI_STANDARD_SHELL_COMMANDS['runtime.streamClose']");
    expect(mainSource).toContain("NIMI_STANDARD_SHELL_COMMANDS['ai-config.get']");
    expect(mainSource).toContain("NIMI_STANDARD_SHELL_COMMANDS['ai-config.set']");
    expect(mainSource).toContain("NIMI_STANDARD_SHELL_COMMANDS['shell-ui.startWindowDrag']");
    expect(mainSource).toContain("NIMI_STANDARD_SHELL_COMMANDS['shell-ui.focusMainWindow']");
    expect(mainSource).toContain("NIMI_STANDARD_SHELL_COMMANDS['shell-ui.confirmDialog']");
    expect(mainSource).not.toContain('runtime-defaults.get');
    expect(mainSource).not.toContain('oauth.openExternalUrl');
    expect(mainSource).not.toContain('oauth.listenForCode');
    expect(mainSource).not.toContain('oauth.tokenExchange');
    expect(mainSource).not.toContain('auth.sessionLoad');
    expect(mainSource).not.toContain('auth.sessionSave');
    expect(mainSource).not.toContain('auth.sessionClear');
    expect(mainSource).not.toContain('electron.raw-ipc');
    expect(mainSource).not.toContain('node.raw-fs');
    expect(mainSource).not.toContain('local-agent.runtimeTrustedCaller');
    expect(runtimeAuthSource).toContain('createNimiElectronInstalledAppRuntimeAccountTrustedMetadataProvider');
    expect(runtimeAuthSource).toMatch(/requireText\(\s*process\.env\.NIMI_REALM_PERSONA_STUDIO_ELECTRON_LAUNCH_NONCE/);
    expect(runtimeAuthSource).toContain('NIMI_REALM_PERSONA_STUDIO_ELECTRON_REALM_BASE_URL');
    expect(runtimeAuthSource).toContain('new URL(realmBaseUrl).toString()');
    expect(runtimeAuthSource).not.toContain('ElectronRuntimeBridgeTrustedMetadataProvider | undefined');
    expect(runtimeAuthSource).not.toContain('RealmPersonaStudioRendererLaunchBinding | undefined');
    expect(runtimeAuthSource).not.toContain('return undefined');
    expect(runtimeAuthSource).not.toContain('resolveElectronRuntimeDefaults');
    expect(runtimeAuthSource).not.toContain('RuntimeDefaults');
    expect(runtimeAuthSource).not.toContain('createNimiRuntimeAppSessionMetadataProvider');
    expect(runtimeAuthSource).not.toContain('createNimiRuntimeFullAppRegistration');
  });
});
