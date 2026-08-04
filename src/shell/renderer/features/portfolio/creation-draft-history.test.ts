import { describe, expect, it, vi } from 'vitest';
import {
  CREATION_DRAFT_HISTORY_STORAGE_PATH,
  groupCreationDraftHistoryByRecency,
  loadCreationDraftHistory,
  removeCreationDraftHistoryEntry,
  upsertCreationDraftHistoryEntry,
  type CreationDraftHistoryEntry,
  type CreationDraftHistoryStorage,
} from './creation-draft-history.js';

function createStorage(): CreationDraftHistoryStorage & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    readJson: vi.fn(async (path: string) => {
      if (!values.has(path)) throw { code: 'not-found' };
      return { value: values.get(path) as never, sizeBytes: 1 };
    }),
    writeJson: vi.fn(async (path: string, value: Parameters<CreationDraftHistoryStorage['writeJson']>[1]) => {
      values.set(path, value);
      return { value, sizeBytes: 1 };
    }),
    removeJson: vi.fn(async (path: string) => ({ removed: values.delete(path) })),
  };
}

const entries: CreationDraftHistoryEntry[] = [
  {
    draftKey: '01J00000000000000000000001',
    displayName: 'Today draft',
    worldName: 'Oasis',
    archetype: 'CARING',
    updatedAt: '2026-08-04T12:00:00.000Z',
  },
  {
    draftKey: '01J00000000000000000000002',
    displayName: 'Yesterday draft',
    updatedAt: '2026-08-03T12:00:00.000Z',
  },
  {
    draftKey: '01J00000000000000000000003',
    displayName: 'Earlier draft',
    updatedAt: '2026-08-01T12:00:00.000Z',
  },
];

describe('creation draft history protected storage', () => {
  it('normalizes each row, drops malformed rows, and keeps the canonical path', async () => {
    const storage = createStorage();
    storage.values.set(CREATION_DRAFT_HISTORY_STORAGE_PATH, [
      entries[0]!,
      { ...entries[1]!, draftKey: 'not-a-ulid' },
      { ...entries[2]!, updatedAt: 'not-a-date' },
      { ...entries[2]!, displayName: '  Earlier draft  ', extra: 'ignored' },
    ]);

    expect(await loadCreationDraftHistory(storage)).toEqual({
      ok: true,
      entries: [entries[0]!, { ...entries[2]!, displayName: 'Earlier draft' }],
      unavailableCount: 2,
    });
  });

  it('upserts by draft key, moves the row to the front, and removes it', async () => {
    const storage = createStorage();
    await upsertCreationDraftHistoryEntry(entries[0]!, storage);
    await upsertCreationDraftHistoryEntry(entries[1]!, storage);
    const updated = await upsertCreationDraftHistoryEntry({
      ...entries[0]!,
      displayName: 'Renamed draft',
      updatedAt: '2026-08-04T13:00:00.000Z',
    }, storage);

    expect(updated).toEqual({
      ok: true,
      entries: [
        { ...entries[0]!, displayName: 'Renamed draft', updatedAt: '2026-08-04T13:00:00.000Z' },
        entries[1]!,
      ],
    });
    expect(await removeCreationDraftHistoryEntry(entries[0]!.draftKey, storage)).toEqual({ ok: true, entries: [entries[1]!] });
    expect(await loadCreationDraftHistory(storage)).toEqual({ ok: true, entries: [entries[1]!], unavailableCount: 0 });
  });

  it('caps history at fifty normalized rows', async () => {
    const storage = createStorage();
    const manyEntries = Array.from({ length: 51 }, (_, index) => ({
      draftKey: `01J${'0'.repeat(21)}${String(index + 10).padStart(2, '0')}`,
      displayName: `Draft ${index}`,
      updatedAt: `2026-08-04T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }));

    for (const entry of manyEntries) await upsertCreationDraftHistoryEntry(entry, storage);

    const loaded = await loadCreationDraftHistory(storage);
    expect(loaded.entries).toHaveLength(50);
    expect(loaded.entries[0]?.draftKey).toBe(manyEntries[50]!.draftKey);
  });
});

describe('creation draft history recency groups', () => {
  it('returns stable today, yesterday, and earlier groups with localized label keys', () => {
    const groups = groupCreationDraftHistoryByRecency(entries, new Date('2026-08-04T18:00:00.000Z'));

    expect(groups.map((group) => group.id)).toEqual(['today', 'yesterday', 'earlier']);
    expect(groups.map((group) => group.labelKey)).toEqual([
      'shell.sidebar.history.today',
      'shell.sidebar.history.yesterday',
      'shell.sidebar.history.earlier',
    ]);
    expect(groups[0]?.entries).toEqual([entries[0]!]);
    expect(groups[1]?.entries).toEqual([entries[1]!]);
    expect(groups[2]?.entries).toEqual([entries[2]!]);
  });
});
