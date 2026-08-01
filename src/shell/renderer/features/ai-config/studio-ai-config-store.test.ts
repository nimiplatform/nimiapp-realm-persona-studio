import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('studio-ai-config-store shell boundary', () => {
  it('fails closed without an admitted protected AI-config operation', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/shell/renderer/features/ai-config/studio-ai-config-store.ts'),
      'utf8',
    );
    const bridgeSource = readFileSync(
      join(process.cwd(), 'src/shell/renderer/bridge/index.ts'),
      'utf8',
    );

    expect(source).toContain('createStudioProtectedOperationUnavailableError');
    expect(source).toContain('hydrateStudioAIConfigFromProtectedBridge');
    expect(source).toContain('persistStudioAIConfigToProtectedBridge');
    expect(source).not.toContain('createInstalledNimiAppStandardShellSurface');
    expect(source).not.toContain('aiConfig.get');
    expect(source).not.toContain('aiConfig.set');
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
