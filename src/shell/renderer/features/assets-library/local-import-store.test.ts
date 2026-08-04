import { describe, expect, it, vi } from 'vitest';
import {
  classifyLocalImportMime,
  detectLocalAssetImportCapability,
  importLocalAssetFile,
  loadLocalImportedAssetRecords,
} from './local-import-store.js';

const importedId = '01J00000000000000000000003';
const createdAt = '2026-08-04T12:00:00.000Z';

function createCapability() {
  const importFile = vi.fn(async () => ({
    id: importedId,
    mediaKind: 'image',
    sourceKind: 'imported',
    title: 'portrait.png',
    previewUrl: 'blob:https://app.example.test/imported',
    createdAt,
  }));
  const list = vi.fn(async () => ({
    assets: [{
      id: importedId,
      mediaKind: 'image',
      sourceKind: 'imported',
      title: 'portrait.png',
      previewUrl: 'https://cdn.example.test/portrait.png',
      createdAt,
    }, {
      id: '01J00000000000000000000004',
      mediaKind: 'audio',
      title: 'bad.mp3',
      createdAt,
    }],
  }));
  const remove = vi.fn(async () => ({ removed: true }));
  return {
    capability: detectLocalAssetImportCapability({ localAssets: { importFile, list, remove } }),
    importFile,
    list,
  };
}

describe('protected local asset import boundary', () => {
  it('classifies only image/* and audio/* MIME types', () => {
    expect(classifyLocalImportMime('image/png')).toBe('image');
    expect(classifyLocalImportMime(' AUDIO/MPEG ')).toBe('audio');
    expect(classifyLocalImportMime('application/pdf')).toBeNull();
    expect(classifyLocalImportMime('')).toBeNull();
  });

  it('rejects unsupported MIME before invoking any local operation', async () => {
    const { capability, importFile } = createCapability();
    const result = await importLocalAssetFile(
      new File(['not an image'], 'notes.txt', { type: 'text/plain' }),
      capability,
    );

    expect(result).toMatchObject({ ok: false, failure: 'unsupported-media-type', record: null });
    expect(importFile).not.toHaveBeenCalled();
  });

  it('returns an explicit capability-unavailable result when the SDK exposes no protected local import', async () => {
    const capability = detectLocalAssetImportCapability({});
    const result = await importLocalAssetFile(
      new File(['png'], 'portrait.png', { type: 'image/png' }),
      capability,
    );

    expect(capability).toMatchObject({ available: false, reasonCode: 'capability-unavailable' });
    expect(result).toMatchObject({ ok: false, failure: 'capability-unavailable', record: null });
  });

  it('uses the protected operation branch and counts malformed listed records', async () => {
    const { capability, importFile, list } = createCapability();
    const imported = await importLocalAssetFile(
      new File(['png'], 'portrait.png', { type: 'image/png' }),
      capability,
    );
    const listed = await loadLocalImportedAssetRecords(capability);

    expect(imported).toMatchObject({
      ok: true,
      source: 'protected-local-assets',
      record: {
        id: importedId,
        mediaKind: 'image',
        sourceKind: 'imported',
        title: 'portrait.png',
      },
    });
    expect(importFile).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u),
      mediaKind: 'image',
      sourceKind: 'imported',
      title: 'portrait.png',
    }));
    expect(list).toHaveBeenCalledTimes(1);
    expect(listed.records).toHaveLength(1);
    expect(listed.unavailableCount).toBe(1);
    expect(listed.failure).toBeNull();
  });
});
