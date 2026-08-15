import { describe, expect, it, vi } from 'vitest';
import type {
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
  get: () => Promise<NimiPortableAppAIConfig>;
}): StudioAIConfigClient {
  return {
    aiConfig: {
      get: input.get,
    },
  };
}

describe('studio App AIConfig store on the Nimi App Access contract', () => {
  it('treats AI_CONFIG_NOT_FOUND as one unconfigured App AIConfig projection', async () => {
    await expect(loadStudioAIConfig(fakeClient({
      async get() {
        throw { reasonCode: 'AI_CONFIG_NOT_FOUND' };
      },
    }))).resolves.toBeNull();

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
        owner: { owner: { oneofKind: 'app', app: { appId: 'other.app' } } },
        capabilities: [],
      }),
    });
    await expect(loadStudioAIConfig(client))
      .rejects.toThrow(/exact nimi\.realm-persona-studio App/u);
  });

  it('asks Nimi Desktop to open the Studio App configuration surface', async () => {
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
