import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('studio Electron protected installed-app boundary', () => {
  it('keeps the standard Electron entrypoints and removes app-owned Runtime auth', () => {
    for (const file of [
      'src-electron/main.ts',
      'src-electron/preload.cts',
      'tsconfig.electron.json',
      'scripts/run-electron-dev.mjs',
      'scripts/bundle-electron-preload.mjs',
    ]) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(true);
    }
    expect(existsSync(join(process.cwd(), 'src-electron/runtime-auth.ts'))).toBe(false);

    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.['dev:electron']).toBeTruthy();
    expect(packageJson.scripts?.['build:electron']).toBeTruthy();
    expect(packageJson.scripts?.['typecheck:electron']).toBeTruthy();
  });

  it('installs only the Nimi preload bridge', () => {
    const source = readFileSync(join(process.cwd(), 'src-electron/preload.cts'), 'utf8');

    expect(source).toContain('installNimiElectronRuntimeBridge');
    expect(source).not.toContain('contextBridge.exposeInMainWorld');
    expect(source).not.toContain('nodeIntegration');
    expect(source).not.toContain('fs');
  });

  it('binds the native installed host to the installed standard-shell capability set', () => {
    const mainSource = readFileSync(join(process.cwd(), 'src-electron/main.ts'), 'utf8');

    expect(mainSource).toContain('registerNimiElectronRuntimeBridge');
    expect(mainSource).toContain('createNimiElectronInstalledHost()');
    expect(mainSource).toContain('NIMI_INSTALLED_NIMI_APP_STANDARD_SHELL_CAPABILITY_SET_ID');
    expect(mainSource).toContain('standardShellHost:');
    expect(mainSource).not.toContain('NIMI_STANDARD_SHELL_COMMANDS');
    expect(mainSource).not.toMatch(/runtimeAuth|trustedMetadataProvider|additionalArguments|LAUNCH_NONCE|releaseDigest/);
    expect(mainSource).not.toMatch(/ai-config\.(get|set)|runtime\.(unary|streamOpen|streamClose)|auth\.session|oauth\./);
    expect(mainSource).not.toMatch(/electron\.raw-ipc|node\.raw-fs|local-agent\.runtimeTrustedCaller/);
  });
});
