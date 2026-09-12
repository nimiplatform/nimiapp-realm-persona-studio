import { describe, expect, it, vi } from 'vitest';
import {
  classifyLocalImportMime, detectLocalAssetImportCapability, importLocalAssetFile,
  loadLocalImportedAssetRecords, removeLocalImportedAsset, LOCAL_IMPORT_STORAGE_PATH, LOCAL_IMPORT_MAX_BYTES,
} from './local-import-store.js';

function setup() {
  let value: unknown = [];
  const media = new Map<string, { bytes: Uint8Array; mimeType: string; sizeBytes: number }>();
  const upload = vi.fn(async (input: { bytes: Uint8Array; mimeType: string }) => {
    const artifactId = 'artifact-' + media.size;
    media.set(artifactId, { ...input, sizeBytes: input.bytes.byteLength });
    return { artifactId, sizeBytes: input.bytes.byteLength, mimeType: input.mimeType };
  });
  const read = vi.fn(async (id: string) => {
    const item = media.get(id);
    if (!item) throw new Error('ARTIFACT_FORBIDDEN');
    return item;
  });
  const writeJson = vi.fn(async (_path: string, next: unknown) => { value = structuredClone(next); });
  const readJson = vi.fn(async () => ({ value: structuredClone(value) }));
  const capability = detectLocalAssetImportCapability({ ai: { artifacts: { upload, read } }, storage: { readJson, writeJson } });
  const file = (name = 'portrait.png') => ({
    name, type: 'image/png', size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  }) as File;
  return { capability, file, upload, read, writeJson, readJson, media, value: () => value };
}

describe('protected local asset import', () => {
  it('admits only image MIME types in the installed published contract', () => {
    expect(classifyLocalImportMime(' IMAGE/PNG ')).toBe('image');
    for (const mime of ['audio/mpeg', 'image/svg+xml', 'video/mp4', 'application/pdf']) expect(classifyLocalImportMime(mime)).toBeNull();
  });
  it('rejects unavailable, empty, oversized and unsupported inputs before upload', async () => {
    const s = setup();
    expect(await importLocalAssetFile(s.file(), detectLocalAssetImportCapability({}))).toMatchObject({ ok: false, failure: 'capability-unavailable' });
    expect(await importLocalAssetFile({ ...s.file(), type: 'audio/wav' } as File, s.capability)).toMatchObject({ ok: false, failure: 'unsupported-media-type' });
    expect(await importLocalAssetFile({ ...s.file(), size: 0 } as File, s.capability)).toMatchObject({ ok: false, failure: 'unsupported-media-type' });
    expect(await importLocalAssetFile({ ...s.file(), size: LOCAL_IMPORT_MAX_BYTES + 1 } as File, s.capability)).toMatchObject({ ok: false, failure: 'file-too-large' });
    expect(s.upload).not.toHaveBeenCalled();
  });
  it('persists only metadata and restores the exact Runtime artifact', async () => {
    const s = setup();
    const added = await importLocalAssetFile(s.file(), s.capability);
    expect(added).toMatchObject({ ok: true, record: { artifactId: 'artifact-0', previewUrl: 'data:image/png;base64,AQID' } });
    expect(s.writeJson).toHaveBeenCalledWith(LOCAL_IMPORT_STORAGE_PATH, expect.any(Array));
    expect(JSON.stringify(s.value())).not.toMatch(/data:|blob:|previewUrl|AQID/);
    const reopened = await loadLocalImportedAssetRecords(s.capability);
    expect(reopened).toMatchObject({ unavailableCount: 0, failure: null, records: [added.record] });
  });
  it('retains missing artifact metadata and removes only the selected library entry', async () => {
    const s = setup();
    const first = await importLocalAssetFile(s.file(), s.capability);
    const second = await importLocalAssetFile(s.file('other.png'), s.capability);
    if (!first.ok || !second.ok) throw new Error('fixture import failed');
    s.media.delete(first.record.artifactId);
    expect(await loadLocalImportedAssetRecords(s.capability)).toMatchObject({
      unavailableCount: 1, records: [{ id: first.record.id, previewUrl: null }, { id: second.record.id }],
    });
    expect(await removeLocalImportedAsset(first.record.id, s.capability)).toEqual({ ok: true });
    expect((await loadLocalImportedAssetRecords(s.capability)).records.map((item) => item.id)).toEqual([second.record.id]);
    expect(s.media.has(second.record.artifactId)).toBe(true);
  });
  it('does not report success when storage fails and serializes concurrent writes', async () => {
    const s = setup();
    s.writeJson.mockRejectedValueOnce(new Error('storage unavailable'));
    expect(await importLocalAssetFile(s.file(), s.capability)).toMatchObject({ ok: false, failure: 'local-import-failed' });
    await Promise.all([importLocalAssetFile(s.file('one.png'), s.capability), importLocalAssetFile(s.file('two.png'), s.capability)]);
    expect((await loadLocalImportedAssetRecords(s.capability)).records).toHaveLength(2);
  });
  it('rejects corrupt metadata and mismatched read responses without erasing the index', async () => {
    const s = setup();
    await importLocalAssetFile(s.file(), s.capability);
    s.read.mockResolvedValueOnce({ bytes: new Uint8Array([1]), mimeType: 'audio/wav', sizeBytes: 1 });
    expect(await loadLocalImportedAssetRecords(s.capability)).toMatchObject({ unavailableCount: 1 });
    s.readJson.mockResolvedValueOnce({ value: [{ broken: true }] });
    expect(await removeLocalImportedAsset('01J00000000000000000000003', s.capability)).toEqual({ ok: false, failure: 'local-import-remove-failed' });
    expect((await loadLocalImportedAssetRecords(s.capability)).records).toHaveLength(1);
  });
});
