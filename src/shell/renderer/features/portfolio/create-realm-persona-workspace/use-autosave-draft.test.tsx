import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { normalizeCreateRealmPersonaDraft } from '../create-persona-draft.js';
import { createEmptyDraft } from './draft-utils.js';
import { useAutosaveDraft } from './use-autosave-draft.js';
import type { StudioTranslator } from './types.js';

const storage = vi.hoisted(() => ({ persist: vi.fn(), history: vi.fn(), notify: vi.fn() }));
vi.mock('../creation-draft-store.js', () => ({
  CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS: 800,
  persistCreationDraft: storage.persist,
  dispatchCreationDraftHistoryUpdated: storage.notify,
}));
vi.mock('../creation-draft-history.js', () => ({ upsertCreationDraftHistoryEntry: storage.history }));
const t: StudioTranslator = (key) => key;
const setAutosave = vi.fn();
const draft = { ...createEmptyDraft(), displayName: 'Mira', greeting: 'One more chapter?' };
const params = {
  draftKey: '01M28SAN1W5EMEPCECY1K2T1NQ', draft, edited: true, draftLoadState: 'ready' as const,
  draftHistoryLabel: 'Mira', selectedWorldName: undefined, normalizedDraft: normalizeCreateRealmPersonaDraft(draft), t, setAutosave,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  storage.persist.mockImplementation(async (_key, value) => ({ ok: true, record: { ...value, updatedAt: '2026-09-12T00:00:00.000Z' } }));
  storage.history.mockResolvedValue({ ok: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('flushes the latest writing when the owner leaves before the debounce completes', async () => {
  const hook = renderHook((input) => useAutosaveDraft(input), { initialProps: params });
  const latest = { ...draft, greeting: 'Wait—this book might be yours.' };
  hook.rerender({ ...params, draft: latest, normalizedDraft: normalizeCreateRealmPersonaDraft(latest) });
  await act(async () => { hook.unmount(); });
  expect(storage.persist).toHaveBeenCalledTimes(1);
  expect(storage.persist).toHaveBeenCalledWith(params.draftKey, expect.objectContaining({ greeting: latest.greeting }));
  expect(storage.history).toHaveBeenCalledTimes(1);
});

it('flushes explicitly once without a duplicate timer write', async () => {
  const hook = renderHook(() => useAutosaveDraft(params));
  await act(async () => { await hook.result.current(); });
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(storage.persist).toHaveBeenCalledTimes(1);
  expect(storage.notify).toHaveBeenCalledTimes(1);
});
