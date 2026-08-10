import { describe, expect, it, vi } from 'vitest';
import type {
  NimiPortableAppAIConfig,
  NimiPortableAppAIConfigIntent,
} from '@nimiplatform/sdk/ai';
import {
  createStudioLocalCapabilityIntent,
  loadStudioAIConfig,
  overwriteStudioCapabilityIntent,
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
  overwrite?: (capabilities: readonly NimiPortableAppAIConfigIntent[]) => Promise<NimiPortableAppAIConfig>;
}): StudioAIConfigClient {
  return {
    aiConfig: {
      get: input.get,
      overwrite: input.overwrite ?? (async () => studioConfig()),
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

  it('builds a local capability intent without model or binding truth', () => {
    expect(createStudioLocalCapabilityIntent()).toEqual({
      capabilityContract: 'text.generate',
      requiredFeatures: [],
      route: { oneofKind: 'local', local: {} },
    });
    expect(JSON.stringify(createStudioLocalCapabilityIntent('image.generate')))
      .not.toMatch(/model|asset|binding|target|path/iu);
  });

  it('replaces the matching capability intent and preserves unrelated intents on overwrite', async () => {
    const cloudIntent: NimiPortableAppAIConfigIntent = {
      capabilityContract: 'image.generate',
      requiredFeatures: [],
      route: {
        oneofKind: 'cloud',
        cloud: {
          implementation: {
            implementationId: 'image.cloud',
            driverId: 'cloud.driver',
            driverDialect: 'v1',
          },
        },
      },
    };
    const staleTextIntent: NimiPortableAppAIConfigIntent = {
      capabilityContract: 'text.generate',
      requiredFeatures: ['legacy'],
      route: {
        oneofKind: 'cloud',
        cloud: {
          implementation: {
            implementationId: 'text.cloud',
            driverId: 'cloud.driver',
            driverDialect: 'v1',
          },
        },
      },
    };
    const overwrite = vi.fn(async (capabilities: readonly NimiPortableAppAIConfigIntent[]) =>
      studioConfig(...capabilities));
    const client = fakeClient({
      get: async () => studioConfig(cloudIntent, staleTextIntent),
      overwrite,
    });

    const next = await overwriteStudioCapabilityIntent(createStudioLocalCapabilityIntent(), client);

    expect(overwrite).toHaveBeenCalledTimes(1);
    expect(next.capabilities.map((intent) => intent.capabilityContract))
      .toEqual(['image.generate', 'text.generate']);
    expect(next.capabilities[0]).toEqual(cloudIntent);
    expect(next.capabilities[1]).toEqual({
      capabilityContract: 'text.generate',
      requiredFeatures: [],
      route: { oneofKind: 'local', local: {} },
    });
  });

  it('treats a missing current config as empty capabilities on overwrite', async () => {
    const overwrite = vi.fn(async (capabilities: readonly NimiPortableAppAIConfigIntent[]) =>
      studioConfig(...capabilities));
    const client = fakeClient({
      async get() {
        throw { reasonCode: 'AI_CONFIG_NOT_FOUND' };
      },
      overwrite,
    });

    const next = await overwriteStudioCapabilityIntent(createStudioLocalCapabilityIntent(), client);

    expect(overwrite).toHaveBeenCalledTimes(1);
    expect(next.capabilities).toEqual([createStudioLocalCapabilityIntent()]);
  });

  it('rejects any AIConfig projection not owned by the exact nimi.realm-persona-studio App', async () => {
    expect(() => requireStudioAIConfigOwner({
      owner: { owner: { oneofKind: 'app', app: { appId: 'other.app' } } },
      capabilities: [],
    })).toThrow(/exact nimi\.realm-persona-studio App/u);

    const client = fakeClient({
      async get() {
        throw { reasonCode: 'AI_CONFIG_NOT_FOUND' };
      },
      overwrite: async () => ({
        owner: { owner: { oneofKind: 'app', app: { appId: 'other.app' } } },
        capabilities: [],
      }),
    });
    await expect(overwriteStudioCapabilityIntent(createStudioLocalCapabilityIntent(), client))
      .rejects.toThrow(/exact nimi\.realm-persona-studio App/u);
  });
});
