import {
  buildStudioTextRequestParameters,
  buildStudioRuntimeMetadata,
  resolveStudioTextCallParams,
  studioTextMessage,
  type StudioTextGeneratePayload,
} from './studio-ai-runtime.js';
import { parseStrictRuntimeJsonObject } from './strict-runtime-json.js';

export const OWNER_SETTINGS_SAVE_SOURCE = 'Realm WorldCoreController.replaceRealmPersona';
export const SETTINGS_AI_PROPOSAL_SOURCE = 'Runtime runtime.ai.text.generate';
export const RAW_RULE_REVIEW_DEFERRED_REASON = 'raw rule text is not a RealmPersona core field; owner guidelines must be structured before save';

export type OwnerPersonaSettingsSnapshot = {
  displayName?: string | null;
  description?: string | null;
  greeting?: string | null;
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

const FORMALITY_VALUES = ['casual', 'formal', 'slang'] as const;
const RESPONSE_LENGTH_VALUES = ['short', 'medium', 'long'] as const;
const SENTIMENT_VALUES = ['positive', 'neutral', 'cynical'] as const;
const FORBIDDEN_SETTING_KEYS = new Set([
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

const RUNTIME_PROPOSAL_STRING_FIELDS = [
  'displayName',
  'description',
  'greeting',
  'naturalLanguageIntent',
  'publicRole',
  'worldview',
  'personalitySummary',
  'relationshipMode',
  'interestsText',
  'goalsText',
  'contentStyle',
  'allowedThemesText',
  'disallowedThemesText',
  'targetAudience',
  'positioning',
  'rawRuleTextCandidate',
] as const;

const RUNTIME_PROPOSAL_ENUM_FIELDS = {
  formality: FORMALITY_VALUES,
  responseLength: RESPONSE_LENGTH_VALUES,
  sentiment: SENTIMENT_VALUES,
} as const;

const RUNTIME_PROPOSAL_OUTPUT_KEYS = [
  ...RUNTIME_PROPOSAL_STRING_FIELDS,
  ...Object.keys(RUNTIME_PROPOSAL_ENUM_FIELDS),
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

function sameStringArray(left: readonly string[] | undefined, right: readonly string[]): boolean {
  const normalizedLeft = left ?? [];
  return normalizedLeft.length === right.length && normalizedLeft.every((value, index) => value === right[index]);
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

function addStringArrayChange<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  proposed: string[],
  current: readonly string[] | undefined,
) {
  if (!sameStringArray(current, proposed)) {
    target[key] = proposed as T[keyof T];
  }
}

function validateEnum<T extends readonly string[]>(value: string, allowed: T, label: string, errors: string[]): T[number] | undefined {
  const normalized = compactProfileText(value);
  if (!normalized) {
    return undefined;
  }
  if (!allowed.includes(normalized)) {
    errors.push(`${label} must be one of: ${allowed.join(', ')}`);
    return undefined;
  }
  return normalized as T[number];
}

export function createOwnerPersonaSettingsDraft(settings: OwnerPersonaSettingsSnapshot): OwnerPersonaSettingsDraft {
  return {
    displayName: settings.displayName ?? '',
    description: settings.description ?? '',
    greeting: settings.greeting ?? '',
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

export function normalizeOwnerPersonaSettingsDraft(draft: OwnerPersonaSettingsDraft): NormalizedOwnerPersonaSettingsDraft {
  return {
    displayName: compactProfileText(draft.displayName),
    description: normalizeLineText(draft.description),
    greeting: normalizeLineText(draft.greeting),
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

export function assertNoForbiddenOwnerSettingsFields(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_SETTING_KEYS.has(key)) {
      return key;
    }
    const nestedViolation = assertNoForbiddenOwnerSettingsFields(nested);
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
}): { ok: true; errors: []; payload: StudioTextGeneratePayload } | { ok: false; errors: string[]; payload: null } {
  const normalizedDraft = normalizeOwnerPersonaSettingsDraft(input.draft);
  const personaContext = input.personaContext;
  const callParams = resolveStudioTextCallParams('realm-persona-studio.settings-proposal', {
    maxTokens: 900,
    temperature: 0.2,
  });
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
        ...callParams,
      },
      request: {
        model: { modelId: callParams.model },
        messages: [
          studioTextMessage('system', [
            'You propose owner-reviewed RealmPersona core settings only.',
            'Return one JSON object with admitted draft field names only.',
            'Allowed fields: displayName, description, greeting, naturalLanguageIntent, publicRole, worldview, personalitySummary, relationshipMode, interestsText, goalsText, contentStyle, formality, responseLength, sentiment, allowedThemesText, disallowedThemesText, targetAudience, positioning, rawRuleTextCandidate, rationale.',
            'Do not include provider, model, LocalAgent, lifecycle, state, worldId, handle, avatarUrl, profileCoverUrl, dna, personaRule, or personaRules.',
            'The owner must review the result before any Realm save.',
          ].join('\n')),
          studioTextMessage('user', JSON.stringify({
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
            currentSettings: input.current,
            currentDraft: normalizedDraft,
          })),
        ],
        parameters: buildStudioTextRequestParameters(
          callParams,
          {
            ...buildStudioRuntimeMetadata('realm-persona-studio.settings-proposal'),
            domain: 'realm-persona-studio.settings-proposal',
          },
        ),
      },
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

  for (const [field, allowed] of Object.entries(RUNTIME_PROPOSAL_ENUM_FIELDS)) {
    const value = proposalValueToText(record[field]);
    if (!value) {
      continue;
    }
    if (!(allowed as readonly string[]).includes(value)) {
      throw new Error(`Runtime settings proposal rejected invalid ${field}.`);
    }
    const typedField = field as keyof typeof RUNTIME_PROPOSAL_ENUM_FIELDS;
    if (value !== baseDraft[typedField]) {
      draftPatch[typedField] = value;
      changedSettingKeys.push(field);
    }
  }

  if (changedSettingKeys.length === 0) {
    throw new Error('Runtime settings proposal returned no admitted setting changes.');
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
  addNullableChange(input, 'naturalLanguageIntent', normalizeNullableText(normalized.naturalLanguageIntent), current.naturalLanguageIntent);

  const identity: NonNullable<OwnerPersonaSettingsUpdateInput['identity']> = {};
  addNullableChange(identity, 'publicRole', normalizeNullableSingleLine(normalized.publicRole), current.identity?.publicRole);
  addNullableChange(identity, 'worldview', normalizeNullableText(normalized.worldview), current.identity?.worldview);
  if (hasOwnKeys(identity)) {
    input.identity = identity;
  }

  const personality: NonNullable<OwnerPersonaSettingsUpdateInput['personality']> = {};
  addNullableChange(personality, 'summary', normalizeNullableText(normalized.personalitySummary), current.personality?.summary);
  addNullableChange(personality, 'relationshipMode', normalizeNullableSingleLine(normalized.relationshipMode), current.personality?.relationshipMode);
  addStringArrayChange(personality, 'interests', normalized.interests, current.personality?.interests);
  addStringArrayChange(personality, 'goals', normalized.goals, current.personality?.goals);
  if (hasOwnKeys(personality)) {
    input.personality = personality;
  }

  const communication: NonNullable<OwnerPersonaSettingsUpdateInput['communication']> = {};
  addNullableChange(communication, 'contentStyle', normalizeNullableText(normalized.contentStyle), current.communication?.contentStyle);
  const formality = validateEnum(normalized.formality, FORMALITY_VALUES, 'formality', errors);
  const responseLength = validateEnum(normalized.responseLength, RESPONSE_LENGTH_VALUES, 'response length', errors);
  const sentiment = validateEnum(normalized.sentiment, SENTIMENT_VALUES, 'sentiment', errors);
  if (formality && formality !== current.communication?.formality) {
    communication.formality = formality;
  }
  if (responseLength && responseLength !== current.communication?.responseLength) {
    communication.responseLength = responseLength;
  }
  if (sentiment && sentiment !== current.communication?.sentiment) {
    communication.sentiment = sentiment;
  }
  if (hasOwnKeys(communication)) {
    input.communication = communication;
  }

  const boundaries: NonNullable<OwnerPersonaSettingsUpdateInput['boundaries']> = {};
  addStringArrayChange(boundaries, 'allowedThemes', normalized.allowedThemes, current.boundaries?.allowedThemes);
  addStringArrayChange(boundaries, 'disallowedThemes', normalized.disallowedThemes, current.boundaries?.disallowedThemes);
  if (hasOwnKeys(boundaries)) {
    input.boundaries = boundaries;
  }

  const positioning: NonNullable<OwnerPersonaSettingsUpdateInput['positioning']> = {};
  addNullableChange(positioning, 'targetAudience', normalizeNullableText(normalized.targetAudience), current.positioning?.targetAudience);
  addNullableChange(positioning, 'positioning', normalizeNullableText(normalized.positioning), current.positioning?.positioning);
  if (hasOwnKeys(positioning)) {
    input.positioning = positioning;
  }

  changedSettingKeys.push(...Object.keys(input));

  const forbiddenKey = assertNoForbiddenOwnerSettingsFields(input);
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
