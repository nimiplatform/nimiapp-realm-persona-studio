import type { StudioTextCandidatePrompt } from './studio-text-candidate.js';
import { parseStrictRuntimeJsonObject } from './strict-runtime-json.js';

export const OWNER_SETTINGS_SAVE_SOURCE = 'Nimi App Access realm.personaCharacter.replace';
export const SETTINGS_AI_PROPOSAL_SOURCE = 'Nimi App Access ai.text.generateCandidate';
export const RAW_RULE_REVIEW_DEFERRED_REASON = 'raw rule text is not a PersonaCharacter profile field and remains a local candidate';

export type OwnerPersonaSettingsSnapshot = {
  displayName?: string | null;
  description?: string | null;
  greeting?: string | null;
  handle?: string | null;
  homeWorldId?: string | null;
  naturalLanguageIntent?: string | null;
  identity?: {
    publicRole?: string | null;
    worldview?: string | null;
  };
  personality?: {
    summary?: string | null;
    relationshipMode?: string | null;
    interests?: readonly string[];
    goals?: readonly string[];
  };
  communication?: {
    contentStyle?: string | null;
    formality?: 'casual' | 'formal' | 'slang';
    responseLength?: 'short' | 'medium' | 'long';
    sentiment?: 'positive' | 'neutral' | 'cynical';
  };
  boundaries?: {
    allowedThemes?: readonly string[];
    disallowedThemes?: readonly string[];
  };
  positioning?: {
    targetAudience?: string | null;
    positioning?: string | null;
  };
};

export type OwnerPersonaSettingsDraft = {
  displayName: string;
  description: string;
  greeting: string;
  handle: string;
  worldId: string;
  naturalLanguageIntent: string;
  publicRole: string;
  worldview: string;
  personalitySummary: string;
  relationshipMode: string;
  interestsText: string;
  goalsText: string;
  contentStyle: string;
  formality: string;
  responseLength: string;
  sentiment: string;
  allowedThemesText: string;
  disallowedThemesText: string;
  targetAudience: string;
  positioning: string;
  rawRuleTextCandidate: string;
};

export type RuntimeOwnerSettingsProposalPatch = Partial<Pick<
  OwnerPersonaSettingsDraft,
  | 'displayName'
  | 'description'
  | 'greeting'
  | 'naturalLanguageIntent'
  | 'publicRole'
  | 'worldview'
  | 'personalitySummary'
  | 'relationshipMode'
  | 'interestsText'
  | 'goalsText'
  | 'contentStyle'
  | 'formality'
  | 'responseLength'
  | 'sentiment'
  | 'allowedThemesText'
  | 'disallowedThemesText'
  | 'targetAudience'
  | 'positioning'
  | 'rawRuleTextCandidate'
>>;

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

export type NormalizedOwnerPersonaSettingsDraft = OwnerPersonaSettingsDraft & {
  interests: string[];
  goals: string[];
  allowedThemes: string[];
  disallowedThemes: string[];
};

export type OwnerPersonaSettingsUpdateInput = {
  displayName?: string | null;
  description?: string | null;
  greeting?: string | null;
  handle?: string | null;
  worldId?: string;
  naturalLanguageIntent?: string | null;
  identity?: {
    publicRole?: string | null;
    worldview?: string | null;
  };
  personality?: {
    summary?: string | null;
    relationshipMode?: string | null;
    interests?: readonly string[];
    goals?: readonly string[];
  };
  communication?: {
    contentStyle?: string | null;
    formality?: 'casual' | 'formal' | 'slang';
    responseLength?: 'short' | 'medium' | 'long';
    sentiment?: 'positive' | 'neutral' | 'cynical';
  };
  boundaries?: {
    allowedThemes?: readonly string[];
    disallowedThemes?: readonly string[];
  };
  positioning?: {
    targetAudience?: string | null;
    positioning?: string | null;
  };
};

export type OwnerSettingsPayloadPreview = {
  source: typeof OWNER_SETTINGS_SAVE_SOURCE;
  ownerReviewed: true;
  submitted: OwnerPersonaSettingsUpdateInput;
  rawRuleReview?: {
    deferred: true;
    reason: typeof RAW_RULE_REVIEW_DEFERRED_REASON;
    text: string;
  };
};

export type OwnerSettingsUpdateBuildResult =
  | {
    ok: true;
    changed: true;
    source: typeof OWNER_SETTINGS_SAVE_SOURCE;
    input: OwnerPersonaSettingsUpdateInput;
    changedSettingKeys: string[];
    rawRuleTextCandidate?: string;
    preview: OwnerSettingsPayloadPreview;
  }
  | {
    ok: false;
    changed: false;
    source: typeof OWNER_SETTINGS_SAVE_SOURCE;
    failure: 'owner-settings-no-changes' | 'owner-settings-invalid' | 'raw-rule-review-deferred';
    errors: string[];
    input: null;
    rawRuleTextCandidate?: string;
  };

// Runtime AI proposal output must never carry these keys. handle and worldId
// stay forbidden there: proposals are bounded to the visible text fields.
const FORBIDDEN_PROPOSAL_SETTING_KEYS = new Set([
  'handle',
  'worldId',
  'avatarUrl',
  'profileCoverUrl',
  'provider',
  'model',
  'localAgent',
  'lifecycle',
  'state',
  'dna',
  'personaRule',
  'personaRules',
  'ruleText',
]);

// Owner-reviewed replace input admits handle (profile.identity.handle,
// setting.r002) and worldId (top-level replace DTO field); the remaining keys
// are still never submittable through the settings path.
const FORBIDDEN_UPDATE_SETTING_KEYS = new Set([
  'avatarUrl',
  'profileCoverUrl',
  'provider',
  'model',
  'localAgent',
  'lifecycle',
  'state',
  'dna',
  'personaRule',
  'personaRules',
  'ruleText',
]);

const RUNTIME_PROPOSAL_STRING_FIELDS = [
  'displayName',
  'description',
  'greeting',
  'rawRuleTextCandidate',
] as const;

const RUNTIME_PROPOSAL_OUTPUT_KEYS = [
  ...RUNTIME_PROPOSAL_STRING_FIELDS,
  'rationale',
] as const;

function normalizeLineText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}

function compactProfileText(value: string): string {
  return normalizeLineText(value).replace(/[ \t]+/g, ' ');
}

function listToText(values: readonly string[] | undefined): string {
  return values?.join(', ') ?? '';
}

function parseListText(value: string): string[] {
  return normalizeLineText(value)
    .split(/[,\n]/g)
    .map((item) => compactProfileText(item))
    .filter(Boolean);
}

function proposalValueToText(value: unknown): string | null {
  if (typeof value === 'string') {
    return normalizeLineText(value);
  }
  if (Array.isArray(value)) {
    const lines = value
      .map((item) => typeof item === 'string' ? compactProfileText(item) : '')
      .filter(Boolean);
    return lines.length > 0 ? lines.join(', ') : null;
  }
  return null;
}

function normalizeNullableText(value: string): string | null {
  const normalized = normalizeLineText(value);
  return normalized ? normalized : null;
}

function normalizeNullableSingleLine(value: string): string | null {
  const normalized = compactProfileText(value);
  return normalized ? normalized : null;
}

function hasOwnKeys(value: object): boolean {
  return Object.keys(value).length > 0;
}

function addNullableChange<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  proposed: string | null,
  current: string | null | undefined,
) {
  if (proposed !== (current ?? null)) {
    target[key] = proposed as T[keyof T];
  }
}

export function createOwnerPersonaSettingsDraft(settings: OwnerPersonaSettingsSnapshot): OwnerPersonaSettingsDraft {
  return {
    displayName: settings.displayName ?? '',
    description: settings.description ?? '',
    greeting: settings.greeting ?? '',
    handle: settings.handle ?? '',
    worldId: settings.homeWorldId ?? '',
    naturalLanguageIntent: settings.naturalLanguageIntent ?? '',
    publicRole: settings.identity?.publicRole ?? '',
    worldview: settings.identity?.worldview ?? '',
    personalitySummary: settings.personality?.summary ?? '',
    relationshipMode: settings.personality?.relationshipMode ?? '',
    interestsText: listToText(settings.personality?.interests),
    goalsText: listToText(settings.personality?.goals),
    contentStyle: settings.communication?.contentStyle ?? '',
    formality: settings.communication?.formality ?? '',
    responseLength: settings.communication?.responseLength ?? '',
    sentiment: settings.communication?.sentiment ?? '',
    allowedThemesText: listToText(settings.boundaries?.allowedThemes),
    disallowedThemesText: listToText(settings.boundaries?.disallowedThemes),
    targetAudience: settings.positioning?.targetAudience ?? '',
    positioning: settings.positioning?.positioning ?? '',
    rawRuleTextCandidate: '',
  };
}

function normalizeHandleText(value: string): string {
  return compactProfileText(value).replace(/^@+/u, '').toLocaleLowerCase();
}

export function normalizeOwnerPersonaSettingsDraft(draft: OwnerPersonaSettingsDraft): NormalizedOwnerPersonaSettingsDraft {
  return {
    displayName: compactProfileText(draft.displayName),
    description: normalizeLineText(draft.description),
    greeting: normalizeLineText(draft.greeting),
    handle: normalizeHandleText(draft.handle),
    worldId: compactProfileText(draft.worldId),
    naturalLanguageIntent: normalizeLineText(draft.naturalLanguageIntent),
    publicRole: compactProfileText(draft.publicRole),
    worldview: normalizeLineText(draft.worldview),
    personalitySummary: normalizeLineText(draft.personalitySummary),
    relationshipMode: compactProfileText(draft.relationshipMode),
    interestsText: normalizeLineText(draft.interestsText),
    goalsText: normalizeLineText(draft.goalsText),
    contentStyle: normalizeLineText(draft.contentStyle),
    formality: compactProfileText(draft.formality),
    responseLength: compactProfileText(draft.responseLength),
    sentiment: compactProfileText(draft.sentiment),
    allowedThemesText: normalizeLineText(draft.allowedThemesText),
    disallowedThemesText: normalizeLineText(draft.disallowedThemesText),
    targetAudience: normalizeLineText(draft.targetAudience),
    positioning: normalizeLineText(draft.positioning),
    rawRuleTextCandidate: normalizeLineText(draft.rawRuleTextCandidate),
    interests: parseListText(draft.interestsText),
    goals: parseListText(draft.goalsText),
    allowedThemes: parseListText(draft.allowedThemesText),
    disallowedThemes: parseListText(draft.disallowedThemesText),
  };
}

export function assertNoForbiddenOwnerSettingsFields(
  value: unknown,
  forbiddenKeys: ReadonlySet<string> = FORBIDDEN_PROPOSAL_SETTING_KEYS,
): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenKeys.has(key)) {
      return key;
    }
    const nestedViolation = assertNoForbiddenOwnerSettingsFields(nested, forbiddenKeys);
    if (nestedViolation) {
      return nestedViolation;
    }
  }

  return null;
}

export function buildRuntimeOwnerSettingsProposalPrompt(input: {
  personaId: string;
  current: OwnerPersonaSettingsSnapshot;
  draft: OwnerPersonaSettingsDraft;
  personaContext?: OwnerPersonaSettingsProposalContext;
}): { ok: true; errors: []; payload: StudioTextCandidatePrompt } | { ok: false; errors: string[]; payload: null } {
  const normalizedDraft = normalizeOwnerPersonaSettingsDraft(input.draft);
  const personaContext = input.personaContext;
  const intent = normalizedDraft.naturalLanguageIntent;
  const errors: string[] = [];

  if (!intent) {
    errors.push('natural-language setting intent missing');
  }

  if (errors.length > 0) {
    return { ok: false as const, errors, payload: null };
  }

  return {
    ok: true as const,
    errors: [],
    payload: {
      surfaceId: 'realm-persona-studio.settings-proposal',
      params: {
        maxTokens: 900,
        temperature: 0.2,
        topP: 1,
      },
      systemText: [
        'You propose owner-reviewed PersonaCharacter native profile settings only.',
        'Return one JSON object with supported draft field names only.',
        'Allowed fields: displayName, description, greeting, rawRuleTextCandidate, rationale.',
        'Do not include provider, model, LocalAgent, lifecycle, state, worldId, handle, avatarUrl, profileCoverUrl, dna, personaRule, or personaRules.',
        'The owner must review the result before any Realm save.',
      ].join('\n'),
      userText: JSON.stringify({
        personaId: input.personaId,
        ...(personaContext ? {
          personaContext: {
            ownerScope: personaContext.ownerScope ?? 'owner-created',
            displayName: personaContext.displayName ?? null,
            handle: personaContext.handle ?? null,
            worldId: personaContext.worldId ?? null,
            worldName: personaContext.worldName ?? null,
          },
        } : {}),
        ownerIntent: intent,
        currentSettings: {
          displayName: input.current.displayName ?? null,
          description: input.current.description ?? null,
          greeting: input.current.greeting ?? null,
        },
        currentDraft: {
          displayName: normalizedDraft.displayName,
          description: normalizedDraft.description,
          greeting: normalizedDraft.greeting,
          naturalLanguageIntent: normalizedDraft.naturalLanguageIntent,
          rawRuleTextCandidate: normalizedDraft.rawRuleTextCandidate,
        },
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
    allowedKeys: RUNTIME_PROPOSAL_OUTPUT_KEYS,
  });

  const forbiddenKey = assertNoForbiddenOwnerSettingsFields(record);
  if (forbiddenKey) {
    throw new Error(`Runtime settings proposal rejected forbidden ${forbiddenKey}.`);
  }

  const draftPatch: RuntimeOwnerSettingsProposalPatch = {};
  const changedSettingKeys: string[] = [];

  for (const field of RUNTIME_PROPOSAL_STRING_FIELDS) {
    const value = proposalValueToText(record[field]);
    if (value !== null && value !== baseDraft[field]) {
      draftPatch[field] = value;
      changedSettingKeys.push(field);
    }
  }

  if (changedSettingKeys.length === 0) {
    throw new Error('Runtime settings proposal returned no supported setting changes.');
  }

  return {
    source: SETTINGS_AI_PROPOSAL_SOURCE,
    candidate: true,
    truthWrite: false,
    draftPatch,
    changedSettingKeys,
    rationale: proposalValueToText(record.rationale) || 'Runtime returned a settings candidate for owner review.',
    rawText: outputText,
  };
}

export function applyRuntimeOwnerSettingsProposal(
  draft: OwnerPersonaSettingsDraft,
  proposal: RuntimeOwnerSettingsProposal,
): OwnerPersonaSettingsDraft {
  return {
    ...draft,
    ...proposal.draftPatch,
  };
}

export type ConsistencySuggestionPartition = {
  visible: Partial<Pick<OwnerPersonaSettingsDraft, 'displayName' | 'description' | 'greeting'>>;
  deferredKeys: string[];
};

const CONSISTENCY_VISIBLE_FIELDS = ['displayName', 'description', 'greeting'] as const;

export function partitionConsistencySuggestions(
  patch: RuntimeOwnerSettingsProposalPatch,
): ConsistencySuggestionPartition {
  const visible: ConsistencySuggestionPartition['visible'] = {};
  const deferredKeys: string[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    if ((CONSISTENCY_VISIBLE_FIELDS as readonly string[]).includes(key)) {
      visible[key as keyof ConsistencySuggestionPartition['visible']] = value;
    } else {
      deferredKeys.push(key);
    }
  }

  return { visible, deferredKeys };
}

export function buildRealmOwnerPersonaSettingsUpdateInput(
  draft: OwnerPersonaSettingsDraft,
  current: OwnerPersonaSettingsSnapshot,
): OwnerSettingsUpdateBuildResult {
  const normalized = normalizeOwnerPersonaSettingsDraft(draft);
  const input: OwnerPersonaSettingsUpdateInput = {};
  const changedSettingKeys: string[] = [];
  const errors: string[] = [];

  addNullableChange(input, 'displayName', normalizeNullableSingleLine(normalized.displayName), current.displayName);
  addNullableChange(input, 'description', normalizeNullableText(normalized.description), current.description);
  addNullableChange(input, 'greeting', normalizeNullableText(normalized.greeting), current.greeting);
  addNullableChange(input, 'handle', normalizeNullableSingleLine(normalized.handle), current.handle);
  if (normalized.worldId !== (compactProfileText(current.homeWorldId ?? ''))) {
    if (!normalized.worldId) {
      errors.push('worldId cannot be empty because PersonaCharacter replace requires a home world');
    } else {
      input.worldId = normalized.worldId;
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'displayName') && input.displayName === null) {
    errors.push('displayName cannot be empty because PersonaCharacter profile.presentation.displayName is required');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'description') && input.description === null) {
    errors.push('description cannot be empty because PersonaCharacter profile.identity.summary is required');
  }

  changedSettingKeys.push(...Object.keys(input));

  const forbiddenKey = assertNoForbiddenOwnerSettingsFields(input, FORBIDDEN_UPDATE_SETTING_KEYS);
  if (forbiddenKey) {
    errors.push(`owner settings update rejected: forbidden ${forbiddenKey} present`);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      changed: false,
      source: OWNER_SETTINGS_SAVE_SOURCE,
      failure: 'owner-settings-invalid',
      errors,
      input: null,
      ...(normalized.rawRuleTextCandidate ? { rawRuleTextCandidate: normalized.rawRuleTextCandidate } : {}),
    };
  }

  if (!hasOwnKeys(input)) {
    return {
      ok: false,
      changed: false,
      source: OWNER_SETTINGS_SAVE_SOURCE,
      failure: normalized.rawRuleTextCandidate ? 'raw-rule-review-deferred' : 'owner-settings-no-changes',
      errors: [normalized.rawRuleTextCandidate ? RAW_RULE_REVIEW_DEFERRED_REASON : 'owner settings have no reviewed changes'],
      input: null,
      ...(normalized.rawRuleTextCandidate ? { rawRuleTextCandidate: normalized.rawRuleTextCandidate } : {}),
    };
  }

  const preview: OwnerSettingsPayloadPreview = {
    source: OWNER_SETTINGS_SAVE_SOURCE,
    ownerReviewed: true,
    submitted: input,
    ...(normalized.rawRuleTextCandidate
      ? {
        rawRuleReview: {
          deferred: true,
          reason: RAW_RULE_REVIEW_DEFERRED_REASON,
          text: normalized.rawRuleTextCandidate,
        },
      }
      : {}),
  };

  return {
    ok: true,
    changed: true,
    source: OWNER_SETTINGS_SAVE_SOURCE,
    input,
    changedSettingKeys,
    ...(normalized.rawRuleTextCandidate ? { rawRuleTextCandidate: normalized.rawRuleTextCandidate } : {}),
    preview,
  };
}
