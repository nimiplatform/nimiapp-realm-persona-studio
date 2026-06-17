import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('studio host boundary', () => {
  it('does not expose broad Nimi local data roots through the Tauri asset protocol', () => {
    const tauriConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8'),
    ) as {
      app?: {
        security?: {
          assetProtocol?: {
            enable?: boolean;
            scope?: string[];
          };
          csp?: string;
        };
      };
    };

    expect(tauriConfig.app?.security?.assetProtocol?.enable).toBe(false);
    expect(tauriConfig.app?.security?.assetProtocol?.scope).toEqual([]);
    expect(tauriConfig.app?.security?.csp || '').not.toContain('asset:');
    expect(tauriConfig.app?.security?.csp || '').not.toContain('file:');
    expect(tauriConfig.app?.security?.csp || '').not.toContain('$HOME/.nimi');
  });

  it('does not register host commands or scopes that reveal Nimi storage roots', () => {
    const source = readFileSync(join(process.cwd(), 'src-tauri/src/main.rs'), 'utf8');
    const cargoToml = readFileSync(join(process.cwd(), 'src-tauri/Cargo.toml'), 'utf8');

    expect(source).not.toContain('realm_persona_studio_storage_dirs');
    expect(source).not.toContain('allow_directory');
    expect(source).not.toContain('resolve_nimi_data_dir');
    expect(source).not.toContain('resolve_nimi_dir');
    expect(cargoToml).not.toContain('protocol-asset');
  });
});
