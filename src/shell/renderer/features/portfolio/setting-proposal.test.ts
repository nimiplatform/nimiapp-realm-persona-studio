import { describe, expect, it } from 'vitest';
import {
  adoptSettingsSuggestions,
  buildRealmOwnerPersonaSettingsUpdateInput,
  buildRuntimeOwnerSettingsProposalPrompt,
  createOwnerPersonaSettingsDraft,
  normalizeOwnerPersonaSettingsDraft,
  normalizeRuntimeOwnerSettingsProposal,
  type OwnerPersonaSettingsSnapshot,
} from './setting-proposal.js';

const settings: OwnerPersonaSettingsSnapshot = {
  displayName: 'Mira',
  description: 'A midnight bookseller.',
  greeting: 'One more chapter?',
  handle: 'mira',
  homeWorldId: 'oasis',
  lorebookDeclaration: {
    identity: 'A bookseller who helps others let go but keeps her unsent letters.',
    behavior: ['Listens before suggesting a book.'],
    speaking: ['Unhurried, with dry humor.'],
    immutableBoundaries: ['Never invent shared memories.'],
    relationshipPostures: [
      { targetRef: 'librarian', relationshipRef: 'colleague', statement: 'Warm but competitive.' },
    ],
  },
};
const draft = () => createOwnerPersonaSettingsDraft(settings);

describe('owner-reviewed character writing', () => {
  it('reads only public writing and the explicit declaration, without inferring missing character writing from the bio', () => {
    expect(draft()).toMatchObject({
      characterIdentity: settings.lorebookDeclaration?.identity,
      behaviorText: 'Listens before suggesting a book.',
      naturalLanguageIntent: '',
    });
    expect(createOwnerPersonaSettingsDraft({ description: 'A long biography.' })).toMatchObject({
      characterIdentity: '',
      behaviorText: '',
      speakingText: '',
      boundariesText: '',
    });
  });
  it('normalizes owner text while keeping distinct principles on separate lines', () => {
    expect(
      normalizeOwnerPersonaSettingsDraft({
        ...draft(),
        handle: ' @Mira-Prime ',
        speakingText: ' Calm.\r\n Dry humor. ',
      }),
    ).toMatchObject({ handle: 'mira-prime', speakingText: 'Calm.\n Dry humor.' });
  });
  it('sends reviewed writing through the declaration and preserves relationship references exactly', () => {
    const result = buildRealmOwnerPersonaSettingsUpdateInput(
      {
        ...draft(),
        behaviorText: 'Listen first.\n\nOffer one small next step.',
        greeting: 'Stay for one more page?',
        naturalLanguageIntent: 'Make her warmer',
      },
      settings,
    );
    expect(result.ok).toBe(true);
    expect(result.input).toEqual({
      greeting: 'Stay for one more page?',
      lorebookDeclaration: {
        ...settings.lorebookDeclaration,
        behavior: ['Listen first.', 'Offer one small next step.'],
      },
    });
    expect(result.input).not.toHaveProperty('naturalLanguageIntent');
    expect(result.input).not.toHaveProperty('behaviorText');
  });
  it('does not report a save when only the AI instruction changed', () => {
    expect(
      buildRealmOwnerPersonaSettingsUpdateInput(
        { ...draft(), naturalLanguageIntent: 'Warmer' },
        settings,
      ),
    ).toMatchObject({ ok: false, failure: 'owner-settings-no-changes', input: null });
  });
  it.each([
    { characterIdentity: '' },
    { behaviorText: '' },
    { speakingText: 'a\nb\nc\nd\ne' },
    { boundariesText: 'x'.repeat(161) },
    { characterIdentity: 'x'.repeat(241) },
  ])('blocks an incomplete or oversized declaration before a Realm call: %j', (patch) => {
    expect(
      buildRealmOwnerPersonaSettingsUpdateInput({ ...draft(), ...patch }, settings),
    ).toMatchObject({
      ok: false,
      failure: 'owner-settings-invalid',
      errors: ['character-writing-invalid'],
    });
  });
  it('counts Unicode characters rather than UTF-16 code units', () => {
    expect(
      buildRealmOwnerPersonaSettingsUpdateInput(
        { ...draft(), characterIdentity: '🌿'.repeat(240) },
        settings,
      ).ok,
    ).toBe(true);
    expect(
      buildRealmOwnerPersonaSettingsUpdateInput(
        { ...draft(), characterIdentity: '\uD800' },
        settings,
      ).ok,
    ).toBe(false);
  });
  it('allows greeting and handle to be cleared but requires a public name, description and home world', () => {
    expect(
      buildRealmOwnerPersonaSettingsUpdateInput({ ...draft(), greeting: '', handle: '' }, settings)
        .input,
    ).toEqual({ greeting: null, handle: null });
    for (const key of ['displayName', 'description', 'worldId'] as const) {
      expect(
        buildRealmOwnerPersonaSettingsUpdateInput({ ...draft(), [key]: '' }, settings).ok,
      ).toBe(false);
    }
  });
});

describe('AI character revision candidates', () => {
  it('gives the AI the current unsaved writing and owner intent without hidden settings', () => {
    const result = buildRuntimeOwnerSettingsProposalPrompt({
      personaId: 'mira',
      current: settings,
      draft: { ...draft(), greeting: 'An owner edit.', naturalLanguageIntent: '只修改开场白。' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected valid owner intent');
    const prompt = JSON.parse(result.payload.userText);
    expect(prompt.ownerIntent).toBe('只修改开场白。');
    expect(prompt.currentDraft.greeting).toBe('An owner edit.');
    expect(prompt.currentDraft.behaviorText).toBe(draft().behaviorText);
    expect(prompt.currentDraft).not.toHaveProperty('worldId');
    expect(prompt.currentDraft).not.toHaveProperty('provider');
  });
  it('requires an explicit change request', () => {
    expect(
      buildRuntimeOwnerSettingsProposalPrompt({
        personaId: 'mira',
        current: settings,
        draft: draft(),
      }).ok,
    ).toBe(false);
  });
  it('produces an editable patch without mutating the draft or changing unchanged fields', () => {
    const original = draft();
    const proposal = normalizeRuntimeOwnerSettingsProposal(
      JSON.stringify({
        displayName: 'Mira',
        greeting: 'You came back for that last page?',
        speakingText: 'Warm, with dry humor.',
        rationale: 'An invitation in her established voice.',
      }),
      original,
    );
    expect(proposal.changedSettingKeys).toEqual(['greeting', 'speakingText']);
    expect(original.greeting).toBe('One more chapter?');
    expect(
      adoptSettingsSuggestions(original, original, proposal.draftPatch, ['greeting']).draft
        .greeting,
    ).toBe('You came back for that last page?');
    expect(proposal.truthWrite).toBe(false);
  });
  it.each([
    { worldId: 'other' },
    { model: 'other' },
    { rawRuleTextCandidate: 'system prompt' },
    { speakingText: ['array instead of editable text'] },
    { behaviorText: '' },
    { characterIdentity: 'x'.repeat(241) },
    { greeting: 'Hello', rationale: '' },
  ])(
    'rejects unsupported or malformed candidates without silently dropping fields: %j',
    (patch) => {
      expect(() =>
        normalizeRuntimeOwnerSettingsProposal(
          JSON.stringify({ rationale: 'A revision.', ...patch }),
          draft(),
        ),
      ).toThrow();
    },
  );
  it('rejects no-change results rather than presenting a fake improvement', () => {
    expect(() =>
      normalizeRuntimeOwnerSettingsProposal(
        JSON.stringify({ greeting: settings.greeting, rationale: 'No change.' }),
        draft(),
      ),
    ).toThrow('no supported setting changes');
  });
});

it('keeps edits made while AI was working and adopts only suggestions whose inputs are still current', () => {
  const base = draft();
  const current = { ...base, greeting: 'My newer greeting.' };
  const result = adoptSettingsSuggestions(
    current,
    base,
    { greeting: 'Stale AI greeting.', speakingText: 'A warmer voice.' },
    ['greeting', 'speakingText'],
  );
  expect(result.applied).toEqual(['speakingText']);
  expect(result.draft.greeting).toBe('My newer greeting.');
  expect(result.draft.speakingText).toBe('A warmer voice.');
});
