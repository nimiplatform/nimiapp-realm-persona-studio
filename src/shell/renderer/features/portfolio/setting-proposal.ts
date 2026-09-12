import type { StudioTextCandidatePrompt } from './studio-text-candidate.js';
import { parseStrictRuntimeJsonObject } from './strict-runtime-json.js';
import {
  buildCharacterDeclaration,
  characterWritingFromDeclaration,
  characterWritingIssues,
  type CharacterDeclaration,
  type CharacterWriting,
} from './persona-character-authoring.js';

export const OWNER_SETTINGS_SAVE_SOURCE = 'Nimi App Access realm.personaCharacter.replace';
export const SETTINGS_AI_PROPOSAL_SOURCE = 'Nimi App Access ai.text.generateCandidate';

export type OwnerPersonaSettingsSnapshot = {
  displayName?: string | null;
  description?: string | null;
  greeting?: string | null;
  handle?: string | null;
  homeWorldId?: string | null;
  lorebookDeclaration?: CharacterDeclaration | null;
};
export type OwnerPersonaSettingsDraft = CharacterWriting & {
  displayName: string;
  description: string;
  greeting: string;
  handle: string;
  worldId: string;
  naturalLanguageIntent: string;
};
export const RUNTIME_PROPOSAL_STRING_FIELDS = [
  'displayName',
  'description',
  'greeting',
  'characterIdentity',
  'behaviorText',
  'speakingText',
  'boundariesText',
] as const;
export type RuntimeOwnerSettingsProposalPatch = Partial<
  Pick<OwnerPersonaSettingsDraft, (typeof RUNTIME_PROPOSAL_STRING_FIELDS)[number]>
>;
export type RuntimeOwnerSettingsProposal = {
  source: typeof SETTINGS_AI_PROPOSAL_SOURCE;
  candidate: true;
  truthWrite: false;
  draftPatch: RuntimeOwnerSettingsProposalPatch;
  changedSettingKeys: string[];
  rationale: string;
  rawText: string;
};
export type OwnerPersonaSettingsProposalContext = {
  ownerScope?: 'owner-created';
  displayName?: string | null;
  handle?: string | null;
  worldId?: string | null;
  worldName?: string | null;
};
export type OwnerPersonaSettingsUpdateInput = {
  displayName?: string | null;
  description?: string | null;
  greeting?: string | null;
  handle?: string | null;
  worldId?: string;
  lorebookDeclaration?: CharacterDeclaration;
};
export type OwnerSettingsPayloadPreview = {
  source: typeof OWNER_SETTINGS_SAVE_SOURCE;
  ownerReviewed: true;
  submitted: OwnerPersonaSettingsUpdateInput;
};
export type OwnerSettingsUpdateBuildResult =
  | {
      ok: true;
      changed: true;
      source: typeof OWNER_SETTINGS_SAVE_SOURCE;
      input: OwnerPersonaSettingsUpdateInput;
      changedSettingKeys: string[];
      preview: OwnerSettingsPayloadPreview;
    }
  | {
      ok: false;
      changed: false;
      source: typeof OWNER_SETTINGS_SAVE_SOURCE;
      failure: 'owner-settings-no-changes' | 'owner-settings-invalid';
      errors: string[];
      input: null;
    };

const text = (value: string) => value.replace(/\r\n?/g, '\n').trim();
const singleLine = (value: string) => text(value).replace(/[ \t]+/g, ' ');

export function createOwnerPersonaSettingsDraft(
  settings: OwnerPersonaSettingsSnapshot,
): OwnerPersonaSettingsDraft {
  return {
    ...characterWritingFromDeclaration(settings.lorebookDeclaration),
    displayName: settings.displayName ?? '',
    description: settings.description ?? '',
    greeting: settings.greeting ?? '',
    handle: settings.handle ?? '',
    worldId: settings.homeWorldId ?? '',
    naturalLanguageIntent: '',
  };
}
export function normalizeOwnerPersonaSettingsDraft(
  draft: OwnerPersonaSettingsDraft,
): OwnerPersonaSettingsDraft {
  return {
    displayName: singleLine(draft.displayName),
    description: text(draft.description),
    greeting: text(draft.greeting),
    handle: singleLine(draft.handle).replace(/^@+/u, '').toLocaleLowerCase(),
    worldId: singleLine(draft.worldId),
    naturalLanguageIntent: text(draft.naturalLanguageIntent),
    characterIdentity: text(draft.characterIdentity),
    behaviorText: text(draft.behaviorText),
    speakingText: text(draft.speakingText),
    boundariesText: text(draft.boundariesText),
  };
}
// @nimi-authority: rule.realm-persona-studio.setting.r012
export function buildRuntimeOwnerSettingsProposalPrompt(input: {
  personaId: string;
  current: OwnerPersonaSettingsSnapshot;
  draft: OwnerPersonaSettingsDraft;
  personaContext?: OwnerPersonaSettingsProposalContext;
  locale?: 'zh' | 'en';
}):
  | { ok: true; errors: []; payload: StudioTextCandidatePrompt }
  | { ok: false; errors: string[]; payload: null } {
  const draft = normalizeOwnerPersonaSettingsDraft(input.draft);
  if (!draft.naturalLanguageIntent)
    return { ok: false, errors: ['natural-language setting intent missing'], payload: null };
  const publicWriting = (value: OwnerPersonaSettingsDraft) =>
    Object.fromEntries(RUNTIME_PROPOSAL_STRING_FIELDS.map((key) => [key, value[key]]));
  return {
    ok: true,
    errors: [],
    payload: {
      surfaceId: 'realm-persona-studio.settings-proposal',
      params: { maxTokens: 2000, temperature: 0.3, topP: 1 },
      systemText: [
        'Edit the owner draft to satisfy the explicit ownerIntent. This is a bounded edit request, not a request to redesign the character.',
        'Return ONE JSON object, no code fences. Allowed string fields: displayName, description, greeting, characterIdentity, behaviorText, speakingText, boundariesText, rationale.',
        'First determine which fields the owner asked to edit. Return ONLY those changed fields and rationale. Omit every unrequested or unchanged field. If only description is requested, the ONLY output keys are description and rationale.',
        'Use currentDraft, including unsaved edits, as the starting point. Preserve every fact, phrase, name, and boundary the owner asks to retain. Do not turn a small edit into a rewrite.',
        'characterIdentity: at most 240 Unicode characters. behaviorText: 1-6 lines; speakingText: 1-4 lines; boundariesText: 1-6 lines. Every line at most 160 Unicode characters. Never leave these fields empty.',
        'Only when a field is requested: keep its writing concrete and consistent with the existing character. Do not invent new habits, biography, relationships, memories or prior conversations.',
        'Match changed text to the language requested by the owner, otherwise keep its existing language.',
        input.locale === 'en' ? 'Write rationale in English.' : input.locale === 'zh' ? 'rationale 必须使用简体中文，简要说明本次修改。' : 'Write rationale in the language of ownerIntent.',
        'Never include provider, model, LocalAgent, lifecycle, state, worldId, handle, avatarUrl, profileCoverUrl, raw rules, IDs, hidden configuration, or private memory.',
        'All output is editable candidate writing. The owner decides what to adopt.',
      ].join('\n'),
      userText: JSON.stringify({
        personaId: input.personaId,
        ...(input.personaContext ? { personaContext: input.personaContext } : {}),
        ownerIntent: draft.naturalLanguageIntent,
        currentDraft: publicWriting(draft),
      }),
    },
  };
}

export function normalizeRuntimeOwnerSettingsProposal(
  outputText: string,
  baseDraft: OwnerPersonaSettingsDraft,
): RuntimeOwnerSettingsProposal {
  const record = parseStrictRuntimeJsonObject({
    rawText: outputText,
    label: 'Runtime settings proposal',
    allowedKeys: [...RUNTIME_PROPOSAL_STRING_FIELDS, 'rationale'],
  });
  const draftPatch: RuntimeOwnerSettingsProposalPatch = {};
  for (const key of RUNTIME_PROPOSAL_STRING_FIELDS) {
    if (!(key in record)) continue;
    if (typeof record[key] !== 'string')
      throw new Error(`Runtime settings proposal rejected invalid ${key}.`);
    const value = text(record[key]);
    if (key !== 'greeting' && !value)
      throw new Error(`Runtime settings proposal rejected invalid ${key}.`);
    if (value !== baseDraft[key]) draftPatch[key] = value;
  }
  if (
    characterWritingIssues({ ...baseDraft, ...draftPatch }).some((field) => field in draftPatch)
  ) {
    throw new Error('Runtime settings proposal rejected invalid character writing.');
  }
  const changedSettingKeys = Object.keys(draftPatch);
  if (!changedSettingKeys.length)
    throw new Error('Runtime settings proposal returned no supported setting changes.');
  if (typeof record.rationale !== 'string' || !record.rationale.trim())
    throw new Error('Runtime settings proposal rejected invalid rationale.');
  return {
    source: SETTINGS_AI_PROPOSAL_SOURCE,
    candidate: true,
    truthWrite: false,
    draftPatch,
    changedSettingKeys,
    rationale: record.rationale.trim(),
    rawText: outputText,
  };
}
export function adoptSettingsSuggestions(
  draft: OwnerPersonaSettingsDraft,
  generatedFrom: OwnerPersonaSettingsDraft,
  patch: RuntimeOwnerSettingsProposalPatch,
  keys: Array<keyof RuntimeOwnerSettingsProposalPatch>,
): { draft: OwnerPersonaSettingsDraft; applied: Array<keyof RuntimeOwnerSettingsProposalPatch> } {
  const applied = keys.filter(
    (key) => patch[key] !== undefined && draft[key] === generatedFrom[key],
  );
  return {
    draft: { ...draft, ...Object.fromEntries(applied.map((key) => [key, patch[key]])) },
    applied,
  };
}

// @nimi-authority: rule.realm-persona-studio.setting.r005
// @nimi-authority: rule.realm-persona-studio.setting.r015
export function buildRealmOwnerPersonaSettingsUpdateInput(
  draft: OwnerPersonaSettingsDraft,
  current: OwnerPersonaSettingsSnapshot,
): OwnerSettingsUpdateBuildResult {
  const normalized = normalizeOwnerPersonaSettingsDraft(draft);
  const input: OwnerPersonaSettingsUpdateInput = {};
  const errors: string[] = [];
  for (const key of ['displayName', 'description', 'greeting', 'handle'] as const) {
    const value = normalized[key] || null;
    if (value !== (current[key] ?? null)) input[key] = value;
  }
  if (input.displayName === null)
    errors.push(
      'displayName cannot be empty because PersonaCharacter profile.presentation.displayName is required',
    );
  if (input.description === null)
    errors.push(
      'description cannot be empty because PersonaCharacter profile.identity.summary is required',
    );
  if (normalized.worldId !== (current.homeWorldId ?? '').trim()) {
    if (!normalized.worldId)
      errors.push('worldId cannot be empty because PersonaCharacter replace requires a home world');
    else input.worldId = normalized.worldId;
  }
  const savedWriting = characterWritingFromDeclaration(current.lorebookDeclaration);
  if (
    (Object.keys(savedWriting) as Array<keyof CharacterWriting>).some(
      (key) => normalized[key] !== savedWriting[key],
    )
  ) {
    try {
      input.lorebookDeclaration = buildCharacterDeclaration(
        normalized,
        current.lorebookDeclaration?.relationshipPostures ?? [],
      );
    } catch {
      errors.push('character-writing-invalid');
    }
  }
  const changedSettingKeys = Object.keys(input);
  if (errors.length || !changedSettingKeys.length) {
    return {
      ok: false,
      changed: false,
      source: OWNER_SETTINGS_SAVE_SOURCE,
      failure: errors.length ? 'owner-settings-invalid' : 'owner-settings-no-changes',
      errors: errors.length ? errors : ['owner settings have no reviewed changes'],
      input: null,
    };
  }
  return {
    ok: true,
    changed: true,
    source: OWNER_SETTINGS_SAVE_SOURCE,
    input,
    changedSettingKeys,
    preview: { source: OWNER_SETTINGS_SAVE_SOURCE, ownerReviewed: true, submitted: input },
  };
}
