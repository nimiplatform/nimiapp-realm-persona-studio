import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useCreationDraft } from './use-creation-draft.js';
import { createEmptyDraft } from './draft-utils.js';
import { PERSONA_SEED_SOURCE, type PersonaSeedGenerationResult } from '../persona-seed-generator.js';

afterEach(cleanup);
function seed(name: string): Extract<PersonaSeedGenerationResult, { ok: true }> {
  return {
    ok: true, source: PERSONA_SEED_SOURCE, rationale: 'Character writing candidate.', runtime: {},
    submitted: { surfaceId: 'test', systemText: '', userText: '', params: { maxTokens: 100, temperature: 0.7, topP: 1 } },
    seed: { displayName: name, handle: name.toLowerCase(), concept: `${name} runs a midnight bookshop.`, description: `Meet ${name}.`, greeting: 'One more page?', personaArchetype: 'MYSTERIOUS', personaTraits: ['GENTLE'], ruleText: 'Listen first.', speechStyle: 'Dry humor.', behaviorBoundary: 'Respect privacy.' },
  };
}
it('regenerates untouched AI fields while preserving owner edits and constraints', () => {
  const hook = renderHook(() => useCreationDraft('01M28SAN1W5EMEPCECY1K2T1NQ'));
  act(() => hook.result.current.dispatch({ type: 'hydrate', draft: { ...createEmptyDraft(), speechSupplement: 'Only speaks in short sentences.' } }));
  act(() => hook.result.current.actions.setStageReviewViaSeed(seed('Mira'), 'A bookseller'));
  act(() => hook.result.current.actions.updateDraft({ displayName: 'My name', greeting: 'My opening.' }));
  act(() => hook.result.current.actions.prepareSeedRun());
  act(() => hook.result.current.actions.setStageReviewViaSeed(seed('Luna'), 'A different bookseller'));
  expect(hook.result.current.state.draft).toMatchObject({ displayName: 'My name', greeting: 'My opening.', concept: 'Luna runs a midnight bookshop.', description: 'Meet Luna.', speechSupplement: 'Only speaks in short sentences.', originalDescription: 'A different bookseller' });
});
it('reopens an existing character draft directly in the editor, preserving its writing', () => {
  const hook = renderHook(() => useCreationDraft('01M28SAN1W5EMEPCECY1K2T1NQ'));
  act(() => hook.result.current.dispatch({ type: 'hydrate', draft: { ...createEmptyDraft(), displayName: 'Mira', greeting: 'Welcome back.' } }));
  expect(hook.result.current.state.stage).toBe('review');
  expect(hook.result.current.state.draft.greeting).toBe('Welcome back.');
  expect(hook.result.current.state.edited).toBe(false);
});
