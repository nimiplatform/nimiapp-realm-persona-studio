import { describe, expect, it, vi } from 'vitest';
import {
  getLocalPostDraftStoragePath,
  loadLocalPostDraft,
  persistLocalPostDraft,
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
  };
}

describe('local persona post draft store', () => {
  it('persists only a local candidate through protected JSON storage', async () => {
    const storage = createStorage();
    const result = await persistLocalPostDraft({
      personaId: 'persona/one',
      caption: '  A source-backed local draft.  ',
      tagsText: '  #OASIS  ',
    }, storage, new Date('2026-08-10T12:00:00.000Z'));

    expect(result).toEqual({
      ok: true,
      record: {
        personaId: 'persona/one',
        caption: 'A source-backed local draft.',
        tagsText: '#OASIS',
        updatedAt: '2026-08-10T12:00:00.000Z',
        source: 'realm-persona-studio.local-post-draft-editor',
        candidateOnly: true,
        publicTruth: false,
      },
    });
    expect(getLocalPostDraftStoragePath('persona/one')).toBe('posts/drafts/persona%2Fone.json');
    expect(await loadLocalPostDraft('persona/one', storage)).toEqual(result);
  });

  it('fails closed for missing capability, invalid records, and blank captions', async () => {
    const storage = createStorage();
    expect(await loadLocalPostDraft('missing', storage)).toEqual({ ok: true, record: null });
    expect(await persistLocalPostDraft({ personaId: 'persona-1', caption: ' ', tagsText: '' }, storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-not-persistable',
    });
    expect(await persistLocalPostDraft({ personaId: 'persona-1', caption: 'Draft', tagsText: '' }, null)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-not-persistable',
    });

    storage.values.set(getLocalPostDraftStoragePath('persona-1'), {
      personaId: 'persona-1',
      caption: 'Looks valid but claims public truth.',
      tagsText: '',
      updatedAt: '2026-08-10T12:00:00.000Z',
      source: 'realm-persona-studio.local-post-draft-editor',
      candidateOnly: true,
      publicTruth: true,
    });
    expect(await loadLocalPostDraft('persona-1', storage)).toMatchObject({
      ok: false,
      failure: 'local-post-draft-load-failed',
    });
  });
});
