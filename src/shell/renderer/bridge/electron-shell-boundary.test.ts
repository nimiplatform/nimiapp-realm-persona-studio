import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('studio managed-web Desktop carrier boundary', () => {
  it('uses the shared managed-web carrier with no App-owned Electron host', () => {
    for (const removed of [
      'src-electron/main.ts',
      'src-electron/preload.cts',
      'src-electron/runtime-auth.ts',
      'tsconfig.electron.json',
      'scripts/bundle-electron-preload.mjs',
      'scripts/run-electron-dev.mjs',
    ]) {
      expect(existsSync(join(process.cwd(), removed)), removed).toBe(false);
    }

    const buildProfile = readFileSync(join(process.cwd(), '.nimi/config/build-profile.yaml'), 'utf8');
    expect(buildProfile).toContain('build_profile_ref: managed-web-pnpm-vite');
    expect(buildProfile).toContain('desktop-universal:');
    expect(buildProfile).toContain('payload_path: dist/renderer');
    expect(buildProfile).toContain('runtime_entry: payload/index.html');

    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
      main?: string;
    };
    expect(packageJson.main).toBeUndefined();
    expect(packageJson.scripts?.dev).toBe('nimi-app dev --shell electron');
    expect(packageJson.scripts?.['dev:shell']).toBe('nimi-app dev');
    expect(packageJson.scripts?.['build:electron']).toBeUndefined();
    expect(packageJson.scripts?.['typecheck:electron']).toBeUndefined();
    expect(packageJson.scripts?.postinstall).toBeUndefined();
    expect(packageJson.devDependencies?.electron).toBeUndefined();
    expect(packageJson.devDependencies?.['@electron/packager']).toBeUndefined();
  });

  it('declares App Access domains, window geometry, and mediated storage without retired vocabulary', () => {
    const manifestSource = readFileSync(join(process.cwd(), 'nimi.app.yaml'), 'utf8');
    const retiredManifestKey = ['per', 'missions'].join('');

    expect(manifestSource).toContain('app_access:');
    expect(manifestSource).toContain('- realm.data');
    expect(manifestSource).toContain('- runtime.consume');
    expect(manifestSource).not.toContain('agent.local');
    expect(manifestSource).not.toContain(retiredManifestKey);
    expect(manifestSource).toContain('renderer_origin: http://127.0.0.1:1450');
    expect(manifestSource).toContain('kind: nimi-mediated-default');
    expect(manifestSource).toContain('title_bar_style: native');
    expect(manifestSource).not.toContain('declared_nimi_api_scopes');
    expect(manifestSource).not.toContain('runtime.artifacts');
  });
});
