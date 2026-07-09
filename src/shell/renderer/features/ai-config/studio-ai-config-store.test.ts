import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('studio-ai-config-store shell boundary', () => {
  it('uses standard shell ai-config instead of app-local browser model config storage', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/shell/renderer/features/ai-config/studio-ai-config-store.ts'),
      'utf8',
    );
    const bridgeSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/bridge/index.ts'),
      'utf8',
    );

    expect(source).toContain('createInstalledNimiAppStandardShellSurface');
    expect(source).toContain('aiConfig.get');
    expect(source).toContain('aiConfig.set');
    expect(source).not.toContain('createNimiAIConfigStore');
    expect(source).not.toContain('resolveBrowserStorage');
    expect(source).not.toContain('window.localStorage');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('STUDIO_AI_CONFIG_STORAGE_PREFIX');
    expect(source).not.toContain('STUDIO_AI_CONFIG_QUARANTINE_PREFIX');
    expect(source).not.toContain('STUDIO_AI_CONFIG_STORAGE_INDEX_KEY');
    expect(bridgeSource).not.toContain('node.raw-fs');
    expect(bridgeSource).not.toContain('electron.raw-ipc');
  });
});
