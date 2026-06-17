import { describe, expect, it, vi } from 'vitest';
import {
  appendLocalCreativeAssetHistory,
  loadLocalCreativeAssetHistory,
} from './creative-asset-history.js';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe('local creative asset history', () => {
  it('persists app-local candidate history per persona without public truth', () => {
    const storage = createStorage();

    const next = appendLocalCreativeAssetHistory('persona-1', {
      id: 'history-1',
      createdAt: '2026-05-22T00:00:00.000Z',
      kind: 'runtime-image-candidate',
      label: 'Runtime image candidate',
        source: 'Runtime ScenarioService.submitScenarioJob image.generate',
      detail: 'artifact-image-1',
      artifactIds: ['artifact-image-1'],
    }, storage);

    expect(next).toEqual([{
      id: 'history-1',
      personaId: 'persona-1',
      createdAt: '2026-05-22T00:00:00.000Z',
      kind: 'runtime-image-candidate',
      label: 'Runtime image candidate',
        source: 'Runtime ScenarioService.submitScenarioJob image.generate',
      publicTruth: false,
      detail: 'artifact-image-1',
      artifactIds: ['artifact-image-1'],
    }]);
    expect(loadLocalCreativeAssetHistory('persona-1', storage)).toEqual(next);
    expect(loadLocalCreativeAssetHistory('persona-2', storage)).toEqual([]);
  });

  it('drops malformed or public-truth records when loading', () => {
    const storage = createStorage();
    storage.setItem('realm-persona-studio.creative-asset-history.persona-1', JSON.stringify([
      {
        id: 'bad-public',
        kind: 'identity-resource-upload',
        label: 'Bad public',
        createdAt: '2026-05-22T00:00:00.000Z',
        source: 'Realm ResourcesService direct upload + finalizeResource',
        detail: 'resource-1',
        publicTruth: true,
      },
      {
        id: 'good-local',
        kind: 'identity-resource-upload',
        label: 'Identity Resource upload',
        createdAt: '2026-05-22T00:00:00.000Z',
        source: 'Realm ResourcesService direct upload + finalizeResource',
        detail: 'resource-2',
        resourceId: 'resource-2',
        publicTruth: false,
      },
    ]));

    expect(loadLocalCreativeAssetHistory('persona-1', storage)).toEqual([{
      id: 'good-local',
      personaId: 'persona-1',
      kind: 'identity-resource-upload',
      label: 'Identity Resource upload',
      createdAt: '2026-05-22T00:00:00.000Z',
      source: 'Realm ResourcesService direct upload + finalizeResource',
      publicTruth: false,
      detail: 'resource-2',
      resourceId: 'resource-2',
    }]);
  });

  it('persists avatar package candidates as local-only history', () => {
    const storage = createStorage();

    const next = appendLocalCreativeAssetHistory('persona-1', {
      id: 'avatar-package-1',
      createdAt: '2026-05-22T00:00:00.000Z',
      kind: 'avatar-package-candidate',
      label: 'Avatar package candidate',
      source: 'Runtime ScenarioService.submitScenarioJob image.generate',
      detail: 'LIVE2D / artifact-avatar-design-sheet',
      artifactIds: ['artifact-avatar-design-sheet'],
    }, storage);

    expect(next[0]).toMatchObject({
      id: 'avatar-package-1',
      personaId: 'persona-1',
      kind: 'avatar-package-candidate',
      label: 'Avatar package candidate',
      publicTruth: false,
      detail: 'LIVE2D / artifact-avatar-design-sheet',
      artifactIds: ['artifact-avatar-design-sheet'],
    });
    expect(loadLocalCreativeAssetHistory('persona-1', storage)).toEqual(next);
  });
});
