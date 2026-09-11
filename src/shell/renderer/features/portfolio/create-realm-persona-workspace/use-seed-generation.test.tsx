import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { normalizeCreateRealmPersonaDraft } from '../create-persona-draft.js';
import type { PersonaSeedGenerationResult } from '../persona-seed-generator.js';
import type { PersonaDescriptionGenerationResult } from '../persona-description-generator.js';
import { createEmptyDraft } from './draft-utils.js';
import { useDescriptionReroll, useSeedGeneration } from './use-seed-generation.js';

const generation = vi.hoisted(() => ({ seed: vi.fn(), description: vi.fn() }));
vi.mock('../persona-seed-generator.js', () => ({ generatePersonaSeedFromDescription: generation.seed }));
vi.mock('../persona-description-generator.js', () => ({ generatePersonaDescriptionCandidate: generation.description }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const draft = createEmptyDraft();
const normalizedDraft = normalizeCreateRealmPersonaDraft(draft);

it('ignores an old seed after leaving and reopening the same draft', async () => {
  const old = deferred<PersonaSeedGenerationResult>();
  const latest = deferred<PersonaSeedGenerationResult>();
  generation.seed.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const actions = { prepareSeedRun: vi.fn(), setStageReviewViaSeed: vi.fn(), setSeedResult: vi.fn() };
  const hook = renderHook(({ draftKey }) => useSeedGeneration({ draftKey, draft, normalizedDraft, locale: 'en', actions }), { initialProps: { draftKey: 'draft-a' } });
  let first!: Promise<void>;
  act(() => { first = hook.result.current.runSeedGeneration(); });
  hook.rerender({ draftKey: 'draft-b' });
  hook.rerender({ draftKey: 'draft-a' });
  let second!: Promise<void>;
  act(() => { second = hook.result.current.runSeedGeneration(); });
  const result: PersonaSeedGenerationResult = { ok: false, source: 'Nimi App Access ai.text.generateCandidate', failure: 'persona-seed-invalid-output', cause: { kind: 'seed-output-invalid' }, submitted: null };
  await act(async () => { old.resolve(result); await first; });
  expect(actions.setSeedResult).not.toHaveBeenCalled();
  expect(hook.result.current.isGeneratingSeed).toBe(true);
  await act(async () => { latest.resolve(result); await second; });
  expect(actions.setSeedResult).toHaveBeenCalledTimes(1);
  expect(hook.result.current.isGeneratingSeed).toBe(false);
});

it('does not replace reopened owner text with an old description reroll', async () => {
  const old = deferred<PersonaDescriptionGenerationResult>();
  generation.description.mockReturnValueOnce(old.promise);
  const updateDraft = vi.fn();
  const hook = renderHook(({ draftKey }) => useDescriptionReroll({ draftKey, normalizedDraft, locale: 'en', t: (key) => key, isGeneratingSeed: false, updateDraft }), { initialProps: { draftKey: 'draft-a' } });
  let request!: Promise<void>;
  act(() => { request = hook.result.current.runDescriptionReroll(); });
  hook.rerender({ draftKey: 'draft-b' });
  hook.rerender({ draftKey: 'draft-a' });
  await act(async () => {
    old.resolve({ ok: true, source: 'Nimi App Access ai.text.generateCandidate', description: 'Stale idea', submitted: { surfaceId: 'test', systemText: '', userText: '', params: { maxTokens: 10, temperature: 1, topP: 1 } }, runtime: {} });
    await request;
  });
  expect(updateDraft).not.toHaveBeenCalled();
});
