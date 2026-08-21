import { describe, expect, it, vi } from 'vitest';
import {
  CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS,
  CREATION_DRAFT_STORAGE_PATH_PREFIX,
  createCreationDraftKey,
  getCreationDraftStoragePath,
  isCreationDraftKey,
  loadCreationDraft,
  persistCreationDraft,
  type CreationDraftStorage,
} from './creation-draft-store.js';
import type { CreateRealmPersonaDraftInput } from './create-persona-draft.js';

function createStorage(): CreationDraftStorage & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    readJson: vi.fn(async (path: string) => {
      if (!values.has(path)) throw { code: 'not-found' };
      return { value: values.get(path) as never, sizeBytes: 1 };
    }),
    writeJson: vi.fn(async (path: string, value: Parameters<CreationDraftStorage['writeJson']>[1]) => {
      values.set(path, value);
      return { value, sizeBytes: 1 };
    }),
  };
}

const draftKey = '01J00000000000000000000001';
const draft: CreateRealmPersonaDraftInput = {
  handle: 'mira-prime',
  displayName: 'Mira Prime',
  concept: 'A precise public persona.',
  description: 'An owner-reviewed profile.',
  ruleText: 'Stay practical.',
  selectedWorldId: 'world-oasis',
  visibility: 'private',
  personaArchetype: 'INTELLECTUAL',
  personaTraits: ['WISE', 'DIRECT'],
  referenceImageUrl: 'https://cdn.example.test/mira.png',
  referenceImagePrompt: 'A precise persona portrait.',
  originalDescription: 'A precise persona for artifact review.',
  speechSupplement: 'Use calm, direct sentences.',
  boundarySupplement: 'Do not claim private memory.',
  visualSupplement: 'Cool night palette.',
  referenceImageCandidates: [{
    draftKey,
    slot: 0,
    url: 'https://cdn.example.test/mira.png',
    prompt: 'A precise persona portrait.',
    createdAt: '2026-08-04T12:00:00.000Z',
    sourceKind: 'generated',
    reviewState: 'owner-selected',
  }],
};

describe('creation draft protected persistence', () => {
  it('uses a canonical protected JSON path and generates valid ULIDs', () => {
    expect(CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS).toBe(800);
    expect(getCreationDraftStoragePath(draftKey)).toBe(`${CREATION_DRAFT_STORAGE_PATH_PREFIX}${draftKey}.json`);
    expect(isCreationDraftKey(createCreationDraftKey(1722772800000))).toBe(true);
    expect(isCreationDraftKey('not-a-draft-key')).toBe(false);
  });

  it('persists and strictly normalizes a complete owner-reviewed draft', async () => {
    const storage = createStorage();
    const persisted = await persistCreationDraft(draftKey, draft, storage, new Date('2026-08-04T13:00:00.000Z'));
    expect(persisted).toMatchObject({ ok: true });
    expect(storage.values.get(getCreationDraftStoragePath(draftKey))).toMatchObject({
      draftKey,
      updatedAt: '2026-08-04T13:00:00.000Z',
      handle: 'mira-prime',
      referenceImagePrompt: 'A precise persona portrait.',
      speechSupplement: 'Use calm, direct sentences.',
      referenceImageCandidates: draft.referenceImageCandidates,
    });
    expect(await loadCreationDraft(draftKey, storage)).toEqual(expect.objectContaining({
      ok: true,
      record: expect.objectContaining({ displayName: 'Mira Prime', draftKey }),
    }));
  });

  it('persists an owner-selected imported image without inventing a generation prompt', async () => {
    const storage = createStorage();
    const importedDraft: CreateRealmPersonaDraftInput = {
      ...draft,
      referenceImageUrl: 'https://cdn.example.test/imported.png',
      referenceImageCandidates: [{
        draftKey,
        slot: 1,
        url: 'https://cdn.example.test/imported.png',
        prompt: '',
        createdAt: '2026-08-04T12:30:00.000Z',
        sourceKind: 'imported',
        reviewState: 'owner-selected',
      }],
    };

    expect(await persistCreationDraft(draftKey, importedDraft, storage)).toMatchObject({ ok: true });
    expect(await loadCreationDraft(draftKey, storage)).toMatchObject({
      ok: true,
      record: {
        referenceImageUrl: 'https://cdn.example.test/imported.png',
        referenceImageCandidates: [{ sourceKind: 'imported', prompt: '' }],
      },
    });
  });

  it('treats a missing document as no draft and rejects malformed source records', async () => {
    const storage = createStorage();
    expect(await loadCreationDraft(draftKey, storage)).toEqual({ ok: true, record: null });

    storage.values.set(getCreationDraftStoragePath(draftKey), {
      ...draft,
      draftKey,
      updatedAt: '2026-08-04T13:00:00.000Z',
      referenceImageCandidates: [{ url: 'file:///fake.png' }],
    });
    expect(await loadCreationDraft(draftKey, storage)).toMatchObject({
      ok: false,
      failure: 'creation-draft-load-failed',
    });
  });

  it('returns typed failures for unavailable persistence and unreviewed image selection', async () => {
    const storage = createStorage();
    const throwingStorage: CreationDraftStorage = {
      readJson: storage.readJson,
      writeJson: vi.fn(async () => { throw new Error('quota'); }),
    };
    expect(await persistCreationDraft(draftKey, draft, throwingStorage)).toMatchObject({
      ok: false,
      failure: 'creation-draft-not-persistable',
      message: 'Draft could not be persisted through protected storage.',
    });
    expect(await persistCreationDraft('invalid', draft, storage)).toMatchObject({
      ok: false,
      failure: 'creation-draft-not-persistable',
    });
    expect(await persistCreationDraft(draftKey, { ...draft, personaTraits: ['WISE', 'DIRECT', 'GENTLE', 'REALISTIC'] }, storage)).toMatchObject({
      ok: false,
      failure: 'creation-draft-not-persistable',
    });
    expect(await persistCreationDraft(draftKey, {
      ...draft,
      referenceImageCandidates: draft.referenceImageCandidates?.map((candidate) => ({ ...candidate, reviewState: 'candidate-only' })),
    }, storage)).toMatchObject({
      ok: false,
      message: 'Draft reference image is not an owner-selected candidate.',
    });
  });

  it('rejects more than one candidate in the same ordered slot', async () => {
    const storage = createStorage();
    const duplicateSlotDraft: CreateRealmPersonaDraftInput = {
      ...draft,
      referenceImageCandidates: [
        ...(draft.referenceImageCandidates || []),
        {
          ...(draft.referenceImageCandidates?.[0] as NonNullable<CreateRealmPersonaDraftInput['referenceImageCandidates']>[number]),
          url: 'https://cdn.example.test/mira-duplicate.png',
          reviewState: 'candidate-only',
        },
      ],
    };

    expect(await persistCreationDraft(draftKey, duplicateSlotDraft, storage)).toMatchObject({
      ok: false,
      message: 'Draft contains more than one reference image candidate in the same slot.',
    });
  });
});
