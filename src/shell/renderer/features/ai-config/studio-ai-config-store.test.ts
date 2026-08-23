import { describe, expect, it, vi } from 'vitest';
import type {
  NimiAIConfigSnapshot,
  NimiPortableAppAIConfig,
  NimiPortableAppAIConfigIntent,
} from '@nimiplatform/sdk/ai';
import {
  loadStudioAIConfig,
  openStudioAIConfigurationInDesktop,
  requireStudioAIConfigOwner,
  type StudioAIConfigClient,
} from './studio-ai-config-store.js';

const STUDIO_OWNER = {
  owner: { oneofKind: 'app' as const, app: { appId: 'nimi.realm-persona-studio' } },
};

function studioConfig(...capabilities: NimiPortableAppAIConfigIntent[]): NimiPortableAppAIConfig {
  return { owner: STUDIO_OWNER, capabilities };
}

function fakeClient(input: {
  get: () => Promise<NimiAIConfigSnapshot>;
}): StudioAIConfigClient {
  return {
    aiConfig: {
      get: input.get,
      overwrite: vi.fn(),
      listOptions: vi.fn(),
    },
  };
}

describe('studio App AIConfig store on the Nimi App Access contract', () => {
  it('treats a null canonical snapshot as unconfigured without swallowing transport failure', async () => {
    await expect(loadStudioAIConfig(fakeClient({
      async get() {
        return { config: null, revision: '0', effectiveSelections: [] };
      },
    }))).resolves.toEqual({ config: null, revision: '0', effectiveSelections: [] });

    await expect(loadStudioAIConfig(fakeClient({
      async get() {
        throw { reasonCode: 'AI_CONFIG_PERSISTENCE_UNAVAILABLE' };
      },
    }))).rejects.toMatchObject({ reasonCode: 'AI_CONFIG_PERSISTENCE_UNAVAILABLE' });
  });

  it('rejects any AIConfig projection not owned by the exact nimi.realm-persona-studio App', async () => {
    expect(() => requireStudioAIConfigOwner({
      owner: { owner: { oneofKind: 'app', app: { appId: 'other.app' } } },
      capabilities: [],
    })).toThrow(/exact nimi\.realm-persona-studio App/u);

    const client = fakeClient({
      get: async () => ({
        config: {
          owner: { owner: { oneofKind: 'app', app: { appId: 'other.app' } } },
          capabilities: [],
        },
        revision: '1',
        effectiveSelections: [],
      }),
    });
    await expect(loadStudioAIConfig(client))
      .rejects.toThrow(/exact nimi\.realm-persona-studio App/u);
  });

  it('asks Nimi Desktop to open Studio in the AI models section', async () => {
    const openDesktop = vi.fn(async () => ({
      status: 'accepted' as const,
      confirmation: 'desktop-accepted' as const,
      bridgeId: 'desktop-open-bridge-1',
      requestId: 'desktop-open-request-1',
      appliedTarget: 'open-apps' as const,
    }));

    await expect(openStudioAIConfigurationInDesktop(openDesktop)).resolves.toBeUndefined();
    expect(openDesktop).toHaveBeenCalledWith({
      intent: {
        kind: 'open-apps',
        appId: 'nimi.realm-persona-studio',
        section: 'ai-models',
      },
    });
  });

  it('fails closed when Nimi Desktop rejects the owner configuration handoff', async () => {
    const openDesktop = vi.fn(async () => ({
      status: 'rejected' as const,
      reasonCode: 'desktop-open-desktop-not-ready' as const,
      actionHint: 'wait_for_desktop_ready' as const,
    }));

    await expect(openStudioAIConfigurationInDesktop(openDesktop)).rejects.toMatchObject({
      reasonCode: 'desktop-open-desktop-not-ready',
      actionHint: 'wait_for_desktop_ready',
    });
  });
});
