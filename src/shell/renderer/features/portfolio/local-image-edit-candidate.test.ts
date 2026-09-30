import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_IMPORT_MAX_BYTES, type LocalImportCapabilityStatus } from '../assets-library/local-import-store.js';
import { loadLocalCreativeAssetHistory } from './creative-asset-history.js';
import { saveLocalImageEditCandidate } from './local-image-edit-candidate.js';

const { readPreview } = vi.hoisted(() => ({ readPreview: vi.fn() }));
vi.mock('./studio-media-candidate.js', async (original) => ({
  ...await original<typeof import('./studio-media-candidate.js')>(), readStudioMediaArtifactPreview: readPreview,
}));
const bytes = new Uint8Array([1, 2, 3]);
const persona = { id: 'persona-edited', contentHash: 'hash-edited' };
type Operations = Extract<LocalImportCapabilityStatus, { available: true }>['operations'];
type JsonValue = Awaited<ReturnType<Operations['storage']['readJson']>>['value'];
function protectedOperations() {
  const values = new Map<string, JsonValue>();
  const upload = vi.fn<Operations['artifacts']['upload']>(async () => ({ artifactId: 'artifact-edited', mimeType: 'image/jpeg', sizeBytes: 3 }));
  const read = vi.fn<Operations['artifacts']['read']>(async () => ({ bytes, mimeType: 'image/jpeg', sizeBytes: 3 }));
  const readJson = vi.fn<Operations['storage']['readJson']>(async (path) => ({ value: values.get(path) ?? [], sizeBytes: 2 }));
  const writeJson = vi.fn<Operations['storage']['writeJson']>(async (path, value) => { values.set(path, value); return { value, sizeBytes: 2 }; });
  const capability = { available: true, evidence: 'test protected operations', operations: {
    artifacts: { upload, read }, storage: { readJson, writeJson },
  } } satisfies LocalImportCapabilityStatus;
  return { capability, values, upload, read, writeJson };
}
beforeEach(() => { readPreview.mockReset(); });

describe('edited image durable candidate', () => {
  it('uploads once and reopens the reviewed candidate from compact artifact metadata', async () => {
    const operations = protectedOperations();
    expect(await saveLocalImageEditCandidate(persona, bytes, 'Owner crop and effects', operations.capability)).toEqual({ ok: true });
    expect(operations.upload).toHaveBeenCalledWith({ bytes, mimeType: 'image/jpeg' });
    expect(operations.read).toHaveBeenCalledWith('artifact-edited');
    expect(JSON.stringify([...operations.values.values()])).not.toContain('data:');
    readPreview.mockResolvedValue('data:image/jpeg;base64,AQID');
    const restored = await loadLocalCreativeAssetHistory(persona.id, operations.capability.operations.storage);
    expect(restored).toMatchObject({ ok: true, records: [{
      artifactIds: ['artifact-edited'], sourceContentHash: persona.contentHash,
      reviewState: 'owner-reviewed', publicTruth: false, previewUrl: 'data:image/jpeg;base64,AQID',
    }] });
  });

  it('does not upload oversized exports or claim unavailable storage succeeded', async () => {
    const operations = protectedOperations();
    expect(await saveLocalImageEditCandidate(persona, new Uint8Array(LOCAL_IMPORT_MAX_BYTES + 1), 'Edit', operations.capability))
      .toEqual({ ok: false, failure: 'file-too-large' });
    expect(operations.upload).not.toHaveBeenCalled();
    expect(await saveLocalImageEditCandidate(persona, bytes, 'Edit', {
      available: false, reasonCode: 'capability-unavailable', reason: 'Missing carrier', evidence: 'test',
    })).toEqual({ ok: false, failure: 'capability-unavailable' });
  });

  it('rejects mismatched artifact metadata without writing a candidate', async () => {
    const operations = protectedOperations();
    operations.upload.mockResolvedValue({ artifactId: 'artifact-edited', mimeType: 'image/png', sizeBytes: 3 });
    expect(await saveLocalImageEditCandidate(persona, bytes, 'Edit', operations.capability))
      .toEqual({ ok: false, failure: 'artifact-unavailable' });
    expect(operations.writeJson).not.toHaveBeenCalled();
  });

  it('preserves existing metadata when the candidate index write fails', async () => {
    const operations = protectedOperations();
    operations.writeJson.mockRejectedValue(new Error('Storage denied'));
    expect(await saveLocalImageEditCandidate(persona, bytes, 'Edit', operations.capability))
      .toEqual({ ok: false, failure: 'history-unavailable' });
    expect(operations.values.size).toBe(0);
  });

  it('does not write history when the uploaded artifact cannot be read', async () => {
    const operations = protectedOperations();
    operations.read.mockRejectedValue(new Error('Artifact unavailable'));
    expect(await saveLocalImageEditCandidate(persona, bytes, 'Edit', operations.capability))
      .toEqual({ ok: false, failure: 'artifact-unavailable' });
    expect(operations.writeJson).not.toHaveBeenCalled();
  });
});
