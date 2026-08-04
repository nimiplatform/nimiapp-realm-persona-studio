import { describe, expect, it, vi } from 'vitest';
import {
  CREATIVE_ASSET_HISTORY_STORAGE_PATH,
  appendLocalCreativeAssetHistory,
  loadAllLocalCreativeAssetHistory,
  loadLocalCreativeAssetHistory,
  type CreativeAssetHistoryStorage,
} from './creative-asset-history.js';

function createStorage(): CreativeAssetHistoryStorage & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    readJson: vi.fn(async (path: string) => {
      if (!values.has(path)) throw { code: 'not-found' };
      return { value: values.get(path) as never, sizeBytes: 1 };
    }),
    writeJson: vi.fn(async (path: string, value: Parameters<CreativeAssetHistoryStorage['writeJson']>[1]) => {
      values.set(path, value);
      return { value, sizeBytes: 1 };
    }),
  };
}

describe('protected local creative asset history', () => {
  it('persists persona provenance and keeps histories isolated by persona', async () => {
    const storage = createStorage();
    const next = await appendLocalCreativeAssetHistory('persona-1', {
      id: '01J00000000000000000000011',
      createdAt: '2026-05-22T00:00:00.000Z',
      sourceContentHash: 'hash-persona-1',
      kind: 'runtime-image-candidate',
      sourceKind: 'generated',
      reviewState: 'candidate-only',
      label: 'Runtime image candidate',
      source: 'Runtime ScenarioService.submitScenarioJob image.generate',
      detail: 'artifact-image-1',
      artifactIds: ['artifact-image-1'],
    }, storage);

    expect(next).toMatchObject({
      ok: true,
      records: [{
        id: '01J00000000000000000000011',
        personaId: 'persona-1',
        sourceContentHash: 'hash-persona-1',
        reviewState: 'candidate-only',
        publicTruth: false,
      }],
    });
    expect(await loadLocalCreativeAssetHistory('persona-1', storage)).toMatchObject({ ok: true, records: next.records });
    expect(await loadLocalCreativeAssetHistory('persona-2', storage)).toMatchObject({ ok: true, records: [] });
  });

  it('drops malformed records while reporting their source unavailability', async () => {
    const storage = createStorage();
    storage.values.set(CREATIVE_ASSET_HISTORY_STORAGE_PATH, [
      {
        id: 'bad-local',
        personaId: 'persona-1',
        kind: 'identity-resource-upload',
        sourceKind: 'imported',
        reviewState: 'owner-reviewed',
        sourceContentHash: 'hash-persona-1',
        label: 'Broken id',
        createdAt: '2026-05-22T00:00:00.000Z',
        source: 'Realm ResourcesService',
        publicTruth: false,
        detail: 'resource-1',
      },
      {
        id: '01J00000000000000000000012',
        personaId: 'persona-1',
        kind: 'identity-resource-upload',
        sourceKind: 'imported',
        reviewState: 'owner-reviewed',
        sourceContentHash: 'hash-persona-1',
        label: 'Identity Resource upload',
        createdAt: '2026-05-22T00:00:00.000Z',
        source: 'Realm ResourcesService',
        publicTruth: false,
        detail: 'resource-1',
      },
    ]);

    const loaded = await loadAllLocalCreativeAssetHistory(storage);
    expect(loaded).toMatchObject({ ok: true, unavailableCount: 1 });
    expect(loaded.records).toHaveLength(1);
  });

  it('retains origin draft provenance only after canonical creation rebinding', async () => {
    const storage = createStorage();
    const persisted = await appendLocalCreativeAssetHistory('persona-1', {
      id: '01J00000000000000000000013',
      createdAt: '2026-05-22T00:00:00.000Z',
      sourceContentHash: 'hash-persona-1',
      originDraftKey: '01J00000000000000000000001',
      kind: 'avatar-package-candidate',
      sourceKind: 'generated',
      reviewState: 'owner-reviewed',
      label: 'Avatar package candidate',
      source: 'Runtime ScenarioService.submitScenarioJob image.generate',
      detail: 'https://cdn.example.test/avatar.png',
      previewUrl: 'https://cdn.example.test/avatar.png',
      artifactIds: ['artifact-avatar-1'],
    }, storage);

    expect(persisted.record).toMatchObject({
      personaId: 'persona-1',
      sourceContentHash: 'hash-persona-1',
      originDraftKey: '01J00000000000000000000001',
      reviewState: 'owner-reviewed',
    });
  });
});
