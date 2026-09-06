import { describe, expect, it, vi } from 'vitest';
import { isAppUlid } from '@renderer/app-shell/app-ulid.js';
import {
  deleteLocalPostDraft,
  getLocalPostDraftStoragePath,
  loadLocalPostDrafts,
  saveLocalPostDraft,
  type LocalPostDraftRecord,
  type LocalPostDraftStorage,
} from './local-post-draft-store.js';

function createStorage(): LocalPostDraftStorage & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    readJson: vi.fn(async (path: string) => {
      if (!values.has(path)) throw { code: 'not-found' };
      return { value: values.get(path) as never, sizeBytes: 1 };
    }),
    writeJson: vi.fn(async (path: string, value: Parameters<LocalPostDraftStorage['writeJson']>[1]) => {
      values.set(path, value);
      return { value, sizeBytes: 1 };
    }),
    removeJson: vi.fn(async (path: string) => ({ removed: values.delete(path) })),
  };
}

function draftInput(caption: string) {
  return {
    personaId: 'persona-1',
    caption,
    tagsText: '',
    visibility: 'public' as const,
    category: null,
    attachments: [],
  };
}

describe('local persona post draft store', () => {
  it('keeps both drafts when saves start concurrently', async () => {
    const storage = createStorage();
    const results = await Promise.all([
      saveLocalPostDraft(draftInput('First concurrent draft.'), storage),
      saveLocalPostDraft(draftInput('Second concurrent draft.'), storage),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    const loaded = await loadLocalPostDrafts('persona-1', storage);
    expect(loaded.ok && loaded.records.map((record) => record.caption)).toEqual([
      'Second concurrent draft.', 'First concurrent draft.',
    ]);
  });

  it('does not resurrect a deleted draft when another save overlaps', async () => {
    const storage = createStorage();
    const created = await saveLocalPostDraft(draftInput('Delete me.'), storage);
    if (!created.ok) throw new Error('Expected a persisted draft');
    await Promise.all([
      deleteLocalPostDraft('persona-1', created.record.id, storage),
      saveLocalPostDraft(draftInput('Keep me.'), storage),
    ]);
    const loaded = await loadLocalPostDrafts('persona-1', storage);
    expect(loaded.ok && loaded.records.map((record) => record.caption)).toEqual(['Keep me.']);
  });

  it('persists a local candidate with a stable ULID through protected JSON storage', async () => {
    const storage = createStorage();
    const result = await saveLocalPostDraft({
      personaId: 'persona/one',
      caption: '  A source-backed local draft.  ',
      tagsText: '  #OASIS  ',
      visibility: 'friends',
      category: 'daily',
      attachments: [],
    }, storage, new Date('2026-08-10T12:00:00.000Z'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isAppUlid(result.record.id)).toBe(true);
    expect(result.record).toMatchObject({
      personaId: 'persona/one',
      caption: 'A source-backed local draft.',
      tagsText: '#OASIS',
      visibility: 'friends',
      category: 'daily',
      attachments: [],
      updatedAt: '2026-08-10T12:00:00.000Z',
      source: 'realm-persona-studio.local-post-draft-editor',
      candidateOnly: true,
      publicTruth: false,
    });
    expect(getLocalPostDraftStoragePath('persona/one')).toBe('posts/drafts/persona%2Fone.json');
    expect(await loadLocalPostDrafts('persona/one', storage)).toEqual({ ok: true, records: [result.record] });
  });

  it('keeps multiple drafts per persona without a count limit, newest first', async () => {
    const storage = createStorage();
    const first = await saveLocalPostDraft(draftInput('First draft.'), storage, new Date('2026-08-10T12:00:00.000Z'));
    const second = await saveLocalPostDraft(draftInput('Second draft.'), storage, new Date('2026-08-10T13:00:00.000Z'));
    const third = await saveLocalPostDraft(draftInput('Third draft.'), storage, new Date('2026-08-10T14:00:00.000Z'));
    expect(first.ok && second.ok && third.ok).toBe(true);
    if (!first.ok || !second.ok || !third.ok) return;

    expect(third.records.map((record) => record.id)).toEqual([third.record.id, second.record.id, first.record.id]);
    expect(third.records.map((record) => record.caption)).toEqual(['Third draft.', 'Second draft.', 'First draft.']);

    const loaded = await loadLocalPostDrafts('persona-1', storage);
    expect(loaded).toEqual({ ok: true, records: third.records });
  });

  it('updates an existing draft in place when its draftId is saved again', async () => {
    const storage = createStorage();
    const created = await saveLocalPostDraft(draftInput('Original copy.'), storage, new Date('2026-08-10T12:00:00.000Z'));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await saveLocalPostDraft({
      ...draftInput('Revised copy.'),
      draftId: created.record.id,
    }, storage, new Date('2026-08-11T09:30:00.000Z'));

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.record.id).toBe(created.record.id);
    expect(updated.records).toHaveLength(1);
    expect(updated.record).toMatchObject({
      caption: 'Revised copy.',
      updatedAt: '2026-08-11T09:30:00.000Z',
    });
    expect(await loadLocalPostDrafts('persona-1', storage)).toEqual({ ok: true, records: [updated.record] });
  });

  it('deletes drafts one by one and removes the document when the last draft goes away', async () => {
    const storage = createStorage();
    const first = await saveLocalPostDraft(draftInput('First draft.'), storage, new Date('2026-08-10T12:00:00.000Z'));
    const second = await saveLocalPostDraft(draftInput('Second draft.'), storage, new Date('2026-08-10T13:00:00.000Z'));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(await deleteLocalPostDraft('persona-1', second.record.id, storage)).toEqual({
      ok: true,
      records: [first.record],
    });
    expect(storage.values.has(getLocalPostDraftStoragePath('persona-1'))).toBe(true);

    expect(await deleteLocalPostDraft('persona-1', first.record.id, storage)).toEqual({ ok: true, records: [] });
    expect(storage.removeJson).toHaveBeenCalledWith(getLocalPostDraftStoragePath('persona-1'));
    expect(storage.values.has(getLocalPostDraftStoragePath('persona-1'))).toBe(false);
    expect(await loadLocalPostDrafts('persona-1', storage)).toEqual({ ok: true, records: [] });
  });

  it('treats deleting an unknown draft id as a no-op success', async () => {
    const storage = createStorage();
    const created = await saveLocalPostDraft(draftInput('Kept draft.'), storage);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const unknownId = created.record.id.replace(/^./, created.record.id[0] === '0' ? '1' : '0');
    expect(await deleteLocalPostDraft('persona-1', unknownId, storage)).toEqual({
      ok: true,
      records: [created.record],
    });
  });

  it('persists attachment metadata only and restores it without media bytes', async () => {
    const storage = createStorage();
    const result = await saveLocalPostDraft({
      ...draftInput('Draft with media candidates.'),
      attachments: [
        { id: 'att-1', mediaKind: 'image', fileName: ' cover.png ', mimeType: 'image/png', sizeBytes: 1204 },
        { id: 'att-2', mediaKind: 'video', fileName: 'clip.mp4', mimeType: 'video/mp4', sizeBytes: 98301 },
      ],
    }, storage, new Date('2026-08-10T12:00:00.000Z'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.attachments).toEqual([
      { id: 'att-1', mediaKind: 'image', fileName: 'cover.png', mimeType: 'image/png', sizeBytes: 1204 },
      { id: 'att-2', mediaKind: 'video', fileName: 'clip.mp4', mimeType: 'video/mp4', sizeBytes: 98301 },
    ]);
    expect(await loadLocalPostDrafts('persona-1', storage)).toEqual({ ok: true, records: [result.record] });

    expect(await saveLocalPostDraft({
      ...draftInput('Draft'),
      attachments: [{ id: 'att-3', mediaKind: 'image', fileName: 'notes.txt', mimeType: 'text/plain', sizeBytes: 10 } as never],
    }, storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-not-persistable',
    });

    storage.values.set(getLocalPostDraftStoragePath('persona-1'), [{
      id: result.record.id,
      personaId: 'persona-1',
      caption: 'Stored with an invalid attachment.',
      tagsText: '',
      updatedAt: '2026-08-10T12:00:00.000Z',
      source: 'realm-persona-studio.local-post-draft-editor',
      candidateOnly: true,
      publicTruth: false,
      attachments: [{ id: 'att-4', mediaKind: 'image', fileName: 'fake.png', mimeType: 'text/plain', sizeBytes: 10 }],
    }]);
    expect(await loadLocalPostDrafts('persona-1', storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-load-failed',
    });
  });

  it('fails closed for missing capability, invalid input, and invalid stored documents', async () => {
    const storage = createStorage();
    expect(await loadLocalPostDrafts('missing', storage)).toEqual({ ok: true, records: [] });
    expect(await saveLocalPostDraft({ ...draftInput(' ') }, storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-not-persistable',
    });
    expect(await saveLocalPostDraft(draftInput('Draft'), null)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-not-persistable',
    });
    expect(await saveLocalPostDraft({ ...draftInput('Draft'), visibility: 'everyone' as never }, storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-not-persistable',
    });
    expect(await saveLocalPostDraft({ ...draftInput('Draft'), category: 'random' as never }, storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-not-persistable',
    });
    expect(await saveLocalPostDraft({ ...draftInput('Draft'), draftId: 'not-a-ulid' }, storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-not-persistable',
    });
    expect(await deleteLocalPostDraft('persona-1', 'not-a-ulid', storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-delete-failed',
    });
    expect(await deleteLocalPostDraft('persona-1', '01ARZ3NDEKTSV4RRFFQ69G5FAV', null)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-delete-failed',
    });

    const path = getLocalPostDraftStoragePath('persona-1');
    // Legacy single-record document shape is not a draft list.
    storage.values.set(path, {
      personaId: 'persona-1',
      caption: 'Legacy single draft document.',
      tagsText: '',
      updatedAt: '2026-08-10T12:00:00.000Z',
      source: 'realm-persona-studio.local-post-draft-editor',
      candidateOnly: true,
      publicTruth: false,
    });
    expect(await loadLocalPostDrafts('persona-1', storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-load-failed',
    });

    storage.values.set(path, [{
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      personaId: 'persona-1',
      caption: 'Looks valid but claims public truth.',
      tagsText: '',
      updatedAt: '2026-08-10T12:00:00.000Z',
      source: 'realm-persona-studio.local-post-draft-editor',
      candidateOnly: true,
      publicTruth: true,
    }]);
    expect(await loadLocalPostDrafts('persona-1', storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-load-failed',
    });

    storage.values.set(path, [
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        personaId: 'persona-1',
        caption: 'Duplicate id one.',
        tagsText: '',
        updatedAt: '2026-08-10T12:00:00.000Z',
        source: 'realm-persona-studio.local-post-draft-editor',
        candidateOnly: true,
        publicTruth: false,
      },
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        personaId: 'persona-1',
        caption: 'Duplicate id two.',
        tagsText: '',
        updatedAt: '2026-08-10T13:00:00.000Z',
        source: 'realm-persona-studio.local-post-draft-editor',
        candidateOnly: true,
        publicTruth: false,
      },
    ]);
    expect(await loadLocalPostDrafts('persona-1', storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-load-failed',
    });
  });

  it('rejects incomplete stored drafts without adding compatibility defaults', async () => {
    const storage = createStorage();
    storage.values.set(getLocalPostDraftStoragePath('persona-1'), [{
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      personaId: 'persona-1',
      caption: 'Stored before visibility and category existed.',
      tagsText: '',
      updatedAt: '2026-08-10T12:00:00.000Z',
      source: 'realm-persona-studio.local-post-draft-editor',
      candidateOnly: true,
      publicTruth: false,
    }]);
    expect(await loadLocalPostDrafts('persona-1', storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-load-failed',
    });

    storage.values.set(getLocalPostDraftStoragePath('persona-1'), [{
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      personaId: 'persona-1',
      caption: 'Stored with an unsupported visibility.',
      tagsText: '',
      visibility: 'everyone',
      updatedAt: '2026-08-10T12:00:00.000Z',
      source: 'realm-persona-studio.local-post-draft-editor',
      candidateOnly: true,
      publicTruth: false,
    }]);
    expect(await loadLocalPostDrafts('persona-1', storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-load-failed',
    });
  });
});
