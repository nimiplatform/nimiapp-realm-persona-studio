import { useEffect } from 'react';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ensureStudioI18nInitialized } from '../../../i18n/studio-i18n.js';
import { REALM_PERSONA_HANDLE_CHECK_SOURCE, validateCreateRealmPersonaReadiness, type CreateRealmPersonaDraftInput } from '../create-persona-draft.js';
import { BehaviorFields } from './behavior-fields.js';
import { createEmptyDraft, focusCreateField } from './draft-utils.js';
import { createFieldErrorsFromReadiness, firstInvalidCreateField } from './create-flow-copy.js';
import { useCreationDraft } from './use-creation-draft.js';

beforeAll(async () => { await ensureStudioI18nInitialized().changeLanguage('zh'); });
afterEach(cleanup);

const options = {
  selectableWorldIds: ['world-oasis'],
  handleAvailability: { checked: true, source: REALM_PERSONA_HANDLE_CHECK_SOURCE, handle: 'mira', normalized: 'mira', available: true },
} as const;

function Harness({ initialDraft, onReview }: {
  initialDraft: CreateRealmPersonaDraftInput;
  onReview: (draft: CreateRealmPersonaDraftInput) => void;
}) {
  const { state, actions, dispatch } = useCreationDraft('behavior-form-test');
  useEffect(() => { dispatch({ type: 'hydrate', draft: initialDraft }); }, [dispatch, initialDraft]);
  return <>
    <BehaviorFields draft={state.draft} fieldErrors={state.fieldErrors} updateDraft={actions.updateDraft} />
    <button onClick={() => {
      const readiness = validateCreateRealmPersonaReadiness(state.draft, { ...options, selectableWorldIds: [...options.selectableWorldIds] });
      actions.setFieldErrors(createFieldErrorsFromReadiness(readiness.errors));
      const first = firstInvalidCreateField(createFieldErrorsFromReadiness(readiness.errors));
      if (first) focusCreateField(first);
      onReview(state.draft);
    }}>Review</button>
  </>;
}

it('lets an owner fill missing fields, focuses the first error, and carries edits into the real create payload', async () => {
  let reviewed = createEmptyDraft();
  render(<Harness initialDraft={{ ...createEmptyDraft(), handle: 'mira', displayName: 'Mira', concept: 'A quiet observer', selectedWorldId: 'world-oasis', personaArchetype: 'CARING' }} onReview={(draft) => { reviewed = draft; }} />);
  fireEvent.click(screen.getByText('Review'));
  const rules = screen.getByRole('textbox', { name: 'TA 如何待人处事 必填' });
  await waitFor(() => expect(document.activeElement).toBe(rules));
  expect(rules.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('请填写说话方式。')).toBeTruthy();
  expect(screen.getByText('请填写行为边界。')).toBeTruthy();
  fireEvent.change(rules, { target: { value: '先倾听，再回应。' } });
  expect(screen.queryByText('请填写行为准则。')).toBeNull();
  expect(screen.getByText('请填写说话方式。')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: 'TA 如何说话 必填' }), { target: { value: '温柔简洁。' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'TA 会坚持什么底线 必填' }), { target: { value: '不索取隐私。' } });
  fireEvent.click(screen.getByText('Review'));
  const result = validateCreateRealmPersonaReadiness(reviewed, { ...options, selectableWorldIds: [...options.selectableWorldIds] });
  expect(result.ready).toBe(true);
  if (!result.ready) throw new Error('Expected complete reviewed draft');
  expect(result.payload.body.lorebookDeclaration).toMatchObject({ behavior: ['先倾听，再回应。'], speaking: ['温柔简洁。'], immutableBoundaries: ['不索取隐私。'] });
});

it('displays existing candidate values and rejects a whitespace-only owner edit', () => {
  render(<Harness initialDraft={{ ...createEmptyDraft(), ruleText: '候选行为', speechSupplement: '候选语气', boundarySupplement: '候选边界' }} onReview={() => undefined} />);
  expect(screen.getByDisplayValue('候选行为')).toBeTruthy();
  expect(screen.getByDisplayValue('候选语气')).toBeTruthy();
  expect(screen.getByDisplayValue('候选边界')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: 'TA 如何待人处事 必填' }), { target: { value: '  \n ' } });
  fireEvent.click(screen.getByText('Review'));
  expect(screen.getByText('请填写行为准则。')).toBeTruthy();
});
