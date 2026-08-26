import type {
  NimiLocalAppPersonaCharacterCreateInput,
  NimiLocalAppPersonaCharacterProfileInput,
  NimiLocalAppPersonaCharacterWritableVisibility,
} from '@nimiplatform/sdk/app';
import type {
  RealmModel,
} from '@nimiplatform/sdk/realm/generated';
import { normalizeDisplaySafeHttpsUrl } from './persona-external-ref.js';

export type RealmPersonaCreationWorldDto = RealmModel<'WorldCoreDto'>;
export type RealmPersonaCreationWorldDetailDto = RealmModel<'WorldCoreDto'>;
export type RealmCreatePersonaInput = NimiLocalAppPersonaCharacterCreateInput;
export type RealmPersonaHandleAvailabilityDto = {
  available: boolean;
  normalized?: string;
  message?: string;
};

export const REALM_PERSONA_CREATE_SOURCE = 'Nimi App Access realm.personaCharacter.create';
export const REALM_PERSONA_HANDLE_CHECK_SOURCE = 'Nimi App Access realm.personaCharacter.listOwned';
export const REALM_WORLD_CORE_LIST_SOURCE = 'Nimi App Access realm.worldCore.list';

export type PersonaArchetype =
  | 'CARING'
  | 'PLAYFUL'
  | 'INTELLECTUAL'
  | 'CONFIDENT'
  | 'MYSTERIOUS'
  | 'ROMANTIC';

export const PERSONA_ARCHETYPES: readonly PersonaArchetype[] = [
  'CARING',
  'PLAYFUL',
  'INTELLECTUAL',
  'CONFIDENT',
  'MYSTERIOUS',
  'ROMANTIC',
];

export type PersonaTrait =
  | 'HUMOROUS'
  | 'SARCASTIC'
  | 'GENTLE'
  | 'DIRECT'
  | 'OPTIMISTIC'
  | 'REALISTIC'
  | 'DRAMATIC'
  | 'PASSIONATE'
  | 'REBELLIOUS'
  | 'INNOCENT'
  | 'WISE'
  | 'ECCENTRIC';

export const PERSONA_TRAITS: readonly PersonaTrait[] = [
  'HUMOROUS',
  'SARCASTIC',
  'GENTLE',
  'DIRECT',
  'OPTIMISTIC',
  'REALISTIC',
  'DRAMATIC',
  'PASSIONATE',
  'REBELLIOUS',
  'INNOCENT',
  'WISE',
  'ECCENTRIC',
];

export const PERSONA_TRAIT_MAX = 3;

export const REFERENCE_IMAGE_CANDIDATE_SLOT_COUNT = 4;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u;
export type ReferenceImageCandidateSlot = 0 | 1 | 2 | 3;

export function isReferenceImageCandidateSlot(value: unknown): value is ReferenceImageCandidateSlot {
  return Number.isInteger(value)
    && Number(value) >= 0
    && Number(value) < REFERENCE_IMAGE_CANDIDATE_SLOT_COUNT;
}

export type ReferenceImageCandidate = {
  draftKey: string;
  slot: ReferenceImageCandidateSlot;
  url: string;
  prompt: string;
  createdAt: string;
  sourceKind: 'generated' | 'imported';
  reviewState: 'candidate-only' | 'owner-selected';
};

export type AdoptReferenceImageCandidateResult =
  | {
    ok: true;
    referenceImageUrl: string;
    referenceImageCandidates: ReferenceImageCandidate[];
    targetSlot: ReferenceImageCandidateSlot;
  }
  | {
    ok: false;
    failure: 'draft-key-invalid' | 'reference-url-invalid' | 'candidate-timestamp-invalid' | 'candidate-slots-full';
  };

export type CreateRealmPersonaDraftInput = {
  handle: string;
  displayName: string;
  concept: string;
  description: string;
  ruleText: string;
  selectedWorldId: string;
  visibility: NimiLocalAppPersonaCharacterWritableVisibility | '';
  personaArchetype: PersonaArchetype | '';
  personaTraits: PersonaTrait[];
  /** Optional owner-selected display-safe HTTPS reference image URL adopted from one local candidate source. */
  referenceImageUrl: string;
  /** Owner-editable local image-generation input, initialized from the describe-stage prompt. */
  referenceImagePrompt: string;
  /** Client-only: the one-liner the owner typed in the describe phase. Not submitted to Realm. */
  originalDescription: string;
  /** Owner-written local prompt supplements. These are candidate input only. */
  speechSupplement?: string;
  boundarySupplement?: string;
  visualSupplement?: string;
  /** Local image candidates bound to this draft. Candidates are never Realm writes. */
  referenceImageCandidates?: ReferenceImageCandidate[];
};

export type NormalizedCreateRealmPersonaDraft = {
  handle: string;
  displayName: string;
  concept: string;
  description: string;
  ruleText: string;
  selectedWorldId: string;
  visibility: NimiLocalAppPersonaCharacterWritableVisibility | '';
  personaArchetype: PersonaArchetype | '';
  personaTraits: PersonaTrait[];
  referenceImageUrl: string;
  referenceImagePrompt: string;
  originalDescription: string;
  speechSupplement: string;
  boundarySupplement: string;
  visualSupplement: string;
  referenceImageCandidates: ReferenceImageCandidate[];
};

export type SelectableRealmWorld = {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  description: string;
  tagline: string;
  source: typeof REALM_WORLD_CORE_LIST_SOURCE;
};

export type SelectedWorldPreview = {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  contentRating: string | null;
  tagline: string;
  description: string;
  overview: string;
  themes: string[];
  personaCount: number | null;
  nativeCreationState: string | null;
  source: typeof REALM_WORLD_CORE_LIST_SOURCE;
};

export type ReviewedRealmCreatePersonaInput = RealmCreatePersonaInput;

export type ReviewedCreateRealmPersonaPayload = {
  source: typeof REALM_PERSONA_CREATE_SOURCE;
  publicFields: {
    handle: string;
    displayName: string;
    concept?: string;
    description?: string;
    rulesText?: string;
  };
  body: ReviewedRealmCreatePersonaInput;
};

export type CreateRealmPersonaReadiness =
  | {
    ready: false;
    errors: string[];
    source: typeof REALM_PERSONA_CREATE_SOURCE;
    payload: null;
  }
  | {
    ready: true;
    errors: [];
    source: typeof REALM_PERSONA_CREATE_SOURCE;
    payload: ReviewedCreateRealmPersonaPayload;
  };

export type CreateRealmPersonaReadinessOptions = {
  selectableWorldIds?: string[];
  handleAvailability?: NormalizedRealmPersonaHandleAvailability | null | undefined;
};

export type NormalizedRealmPersonaHandleAvailability =
  | {
    checked: true;
    source: typeof REALM_PERSONA_HANDLE_CHECK_SOURCE;
    handle: string;
    normalized: string;
    available: true;
    message?: string;
  }
  | {
    checked: true;
    source: typeof REALM_PERSONA_HANDLE_CHECK_SOURCE;
    handle: string;
    normalized: string;
    available: false;
    message: string;
  };

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, '').toLocaleLowerCase();
}

function normalizePersonaTraits(values: readonly PersonaTrait[] | readonly string[]): PersonaTrait[] {
  const known = new Set<PersonaTrait>(PERSONA_TRAITS);
  const seen = new Set<PersonaTrait>();
  const out: PersonaTrait[] = [];
  for (const value of values || []) {
    const trimmed = String(value || '').trim().toUpperCase() as PersonaTrait;
    if (!known.has(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeReferenceImageUrl(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return normalizeDisplaySafeHttpsUrl(trimmed) ?? '';
}

function normalizeSupplement(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isIsoDateTime(value: string): boolean {
  return ISO_DATE_TIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function normalizeReferenceImageCandidates(values: unknown): ReferenceImageCandidate[] {
  if (!Array.isArray(values)) return [];
  const candidates = values.flatMap((value) => {
    const record = readRecord(value);
    if (
      !record
      || typeof record.draftKey !== 'string'
      || !/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(record.draftKey.trim())
      || typeof record.url !== 'string'
      || typeof record.prompt !== 'string'
      || typeof record.createdAt !== 'string'
      || !isReferenceImageCandidateSlot(record.slot)
    ) {
      return [];
    }
    const draftKey = record.draftKey.trim();
    const url = normalizeReferenceImageUrl(record.url);
    const prompt = record.prompt.trim();
    const createdAt = record.createdAt.trim();
    const sourceKind = record.sourceKind === 'generated' || record.sourceKind === 'imported'
      ? record.sourceKind
      : null;
    const reviewState = record.reviewState === 'candidate-only' || record.reviewState === 'owner-selected'
      ? record.reviewState
      : null;
    if (
      !url
      || (sourceKind === 'generated' && !prompt)
      || !isIsoDateTime(createdAt)
      || !sourceKind
      || !reviewState
    ) return [];
    const candidate: ReferenceImageCandidate = {
      draftKey,
      slot: record.slot,
      url,
      prompt,
      createdAt,
      sourceKind,
      reviewState,
    };
    return [candidate];
  });
  const seenSlots = new Set<ReferenceImageCandidateSlot>();
  return candidates
    .filter((candidate) => {
      if (seenSlots.has(candidate.slot)) return false;
      seenSlots.add(candidate.slot);
      return true;
    })
    .sort((left, right) => left.slot - right.slot);
}

export function adoptImportedReferenceImageCandidate(
  input: CreateRealmPersonaDraftInput,
  draftKey: string,
  url: string,
  createdAt = new Date().toISOString(),
): AdoptReferenceImageCandidateResult {
  if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(draftKey.trim())) {
    return { ok: false, failure: 'draft-key-invalid' };
  }
  const normalizedUrl = normalizeReferenceImageUrl(url);
  if (!normalizedUrl) return { ok: false, failure: 'reference-url-invalid' };
  const normalizedCreatedAt = createdAt.trim();
  if (!isIsoDateTime(normalizedCreatedAt)) return { ok: false, failure: 'candidate-timestamp-invalid' };

  const draft = normalizeCreateRealmPersonaDraft(input);
  const existingCandidate = draft.referenceImageCandidates.find((candidate) => candidate.url === normalizedUrl);
  const selectedCandidate = draft.referenceImageCandidates.find((candidate) => candidate.reviewState === 'owner-selected');
  const firstEmptySlot = Array.from(
    { length: REFERENCE_IMAGE_CANDIDATE_SLOT_COUNT },
    (_, slot) => slot as ReferenceImageCandidateSlot,
  ).find((slot) => !draft.referenceImageCandidates.some((candidate) => candidate.slot === slot));
  const targetSlot = existingCandidate?.slot ?? firstEmptySlot ?? selectedCandidate?.slot;
  if (targetSlot === undefined) return { ok: false, failure: 'candidate-slots-full' };

  const candidate: ReferenceImageCandidate = {
    draftKey: draftKey.trim(),
    slot: targetSlot,
    url: normalizedUrl,
    prompt: '',
    createdAt: normalizedCreatedAt,
    sourceKind: 'imported',
    reviewState: 'owner-selected',
  };
  const referenceImageCandidates: ReferenceImageCandidate[] = [
    ...draft.referenceImageCandidates
      .filter((current) => current.slot !== targetSlot)
      .map((current) => ({ ...current, reviewState: 'candidate-only' as const })),
    candidate,
  ]
    .sort((left, right) => left.slot - right.slot);

  return {
    ok: true,
    referenceImageUrl: normalizedUrl,
    referenceImageCandidates,
    targetSlot,
  };
}

function normalizeDraftText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeCreateRealmPersonaDraft(input: CreateRealmPersonaDraftInput): NormalizedCreateRealmPersonaDraft {
  const rawPrimary = normalizeDraftText(input.personaArchetype).toUpperCase();
  const personaArchetype = (PERSONA_ARCHETYPES as readonly string[]).includes(rawPrimary)
    ? (rawPrimary as PersonaArchetype)
    : '';
  return {
    handle: normalizeHandle(normalizeDraftText(input.handle)),
    displayName: normalizeDraftText(input.displayName),
    concept: normalizeDraftText(input.concept),
    description: normalizeDraftText(input.description),
    ruleText: normalizeDraftText(input.ruleText),
    selectedWorldId: normalizeDraftText(input.selectedWorldId),
    visibility: input.visibility === 'private' || input.visibility === 'unlisted' || input.visibility === 'public'
      ? input.visibility
      : '',
    personaArchetype,
    personaTraits: normalizePersonaTraits(Array.isArray(input.personaTraits) ? input.personaTraits : []),
    referenceImageUrl: normalizeReferenceImageUrl(input.referenceImageUrl),
    referenceImagePrompt: normalizeDraftText(input.referenceImagePrompt),
    originalDescription: normalizeDraftText(input.originalDescription),
    speechSupplement: normalizeSupplement(input.speechSupplement),
    boundarySupplement: normalizeSupplement(input.boundarySupplement),
    visualSupplement: normalizeSupplement(input.visualSupplement),
    referenceImageCandidates: normalizeReferenceImageCandidates(input.referenceImageCandidates),
  };
}

export function normalizeRealmPersonaHandleAvailability(
  handle: string,
  response: RealmPersonaHandleAvailabilityDto,
): NormalizedRealmPersonaHandleAvailability {
  const normalized = readString(response.normalized) || normalizeHandle(handle);
  if (response.available) {
    return {
      checked: true,
      source: REALM_PERSONA_HANDLE_CHECK_SOURCE,
      handle: normalizeHandle(handle),
      normalized,
      available: true,
      ...(response.message ? { message: response.message } : {}),
    };
  }

  return {
    checked: true,
    source: REALM_PERSONA_HANDLE_CHECK_SOURCE,
    handle: normalizeHandle(handle),
    normalized,
    available: false,
    message: response.message || 'A PersonaCharacter with this handle already exists in the owner portfolio.',
  };
}

export function normalizeSelectableWorld(world: RealmPersonaCreationWorldDto): SelectableRealmWorld {
  const core = readRecord(world.core);
  const identity = readRecord(core?.identity);
  const presentation = readRecord(core?.presentation);
  return {
    id: world.id,
    name: readString(identity?.name) || readString(presentation?.displayName) || readString(presentation?.title) || world.id,
    type: readString(identity?.worldType) || world.visibility,
    status: world.visibility,
    description: readString(identity?.summary) || '',
    tagline: readString(presentation?.tagline) || readString(identity?.tagline) || '',
    source: REALM_WORLD_CORE_LIST_SOURCE,
  };
}

export function normalizeSelectableWorlds(worlds: RealmPersonaCreationWorldDto[]): SelectableRealmWorld[] {
  return worlds.map(normalizeSelectableWorld);
}

export function selectOasisDefaultWorld(worlds: SelectableRealmWorld[]): SelectableRealmWorld | null {
  return worlds.find((world) => world.id === 'OASIS')
    || worlds.find((world) => world.type === 'OASIS')
    || worlds.find((world) => world.id.toLocaleLowerCase() === 'oasis')
    || worlds.find((world) => world.name.toLocaleLowerCase() === 'oasis')
    || null;
}

export type SelectableRealmWorldGroups = {
  recommended: SelectableRealmWorld[];
  others: SelectableRealmWorld[];
};

/**
 * OASIS is a local presentation recommendation only. The source-backed world
 * list remains the complete selectable set and no other world is promoted.
 */
export function groupSelectableRealmWorldsForPicker(worlds: readonly SelectableRealmWorld[]): SelectableRealmWorldGroups {
  const oasis = selectOasisDefaultWorld([...worlds]);
  if (!oasis) {
    return { recommended: [], others: [...worlds] };
  }
  return {
    recommended: [oasis],
    others: worlds.filter((world) => world.id !== oasis.id),
  };
}

export const splitSelectableRealmWorldsForPicker = groupSelectableRealmWorldsForPicker;

export function normalizeSelectedWorldPreview(world: RealmPersonaCreationWorldDetailDto): SelectedWorldPreview {
  const core = readRecord(world.core);
  const identity = readRecord(core?.identity);
  const presentation = readRecord(core?.presentation);
  const themes = Array.isArray(identity?.themes)
    ? identity.themes.filter((theme): theme is string => typeof theme === 'string' && theme.length > 0)
    : [];
  const entities = Array.isArray(core?.entities) ? core.entities : [];

  return {
    id: world.id,
    name: readString(identity?.name) || readString(presentation?.displayName) || readString(presentation?.title) || world.id,
    type: readString(identity?.worldType) || world.visibility,
    status: world.visibility,
    contentRating: null,
    tagline: readString(presentation?.tagline) || readString(identity?.tagline) || '',
    description: readString(identity?.summary) || '',
    overview: readString(identity?.summary) || '',
    themes,
    personaCount: entities.length,
    nativeCreationState: null,
    source: REALM_WORLD_CORE_LIST_SOURCE,
  };
}

function buildRealmPersonaProfileV1(draft: NormalizedCreateRealmPersonaDraft): NimiLocalAppPersonaCharacterProfileInput {
  return {
    profileSchemaVersion: 'realm.character-profile-core/v1',
    identity: {
      handle: draft.handle,
      name: draft.displayName,
      summary: draft.description || draft.concept,
    },
    presentation: {
      displayName: draft.displayName,
      profileLine: draft.description || draft.concept,
    },
    narrative: {
      summary: draft.concept || draft.description,
      archetype: draft.personaArchetype,
      traits: draft.personaTraits,
    },
    interactionProfile: {
      interactionModes: ['conversation'],
    },
    assets: {
      resourceRefs: [],
      ...(draft.referenceImageUrl
        ? {
            externalRefs: [{
              refId: 'reference-image-1',
              kind: 'referenceImage',
              uri: draft.referenceImageUrl,
              purpose: 'visual-reference',
            }],
          }
        : {}),
      intents: [],
    },
    authoring: {
      source: 'realm-persona-studio',
      notes: [],
    },
  };
}

export function validateCreateRealmPersonaReadiness(
  input: CreateRealmPersonaDraftInput,
  options: CreateRealmPersonaReadinessOptions = {},
): CreateRealmPersonaReadiness {
  const draft = normalizeCreateRealmPersonaDraft(input);
  const errors: string[] = [];
  const selectableWorldIds = options.selectableWorldIds
    ? new Set(options.selectableWorldIds.map((worldId) => worldId.trim()).filter(Boolean))
    : null;
  const handleAvailability = options.handleAvailability;

  if (!draft.handle) {
    errors.push('handle missing');
  }
  if (!draft.displayName) {
    errors.push('display name missing');
  }
  if (!draft.concept) {
    errors.push('concept missing');
  }
  if (!draft.ruleText) {
    errors.push('behavior principle missing');
  }
  if (!draft.speechSupplement) {
    errors.push('speaking principle missing');
  }
  if (!draft.boundarySupplement) {
    errors.push('immutable boundary missing');
  }
  if (!draft.selectedWorldId) {
    errors.push('selected world missing');
  }
  if (!draft.visibility) {
    errors.push('visibility missing');
  }
  const rawArchetype = typeof input.personaArchetype === 'string' ? input.personaArchetype.trim().toUpperCase() : '';
  if (rawArchetype && !(PERSONA_ARCHETYPES as readonly string[]).includes(rawArchetype)) {
    errors.push('persona archetype outside closed value set');
  } else if (!draft.personaArchetype) {
    errors.push('persona archetype missing');
  }

  const rawTraits = Array.isArray(input.personaTraits) ? input.personaTraits : [];
  const normalizedRawTraits = rawTraits.map((trait) => String(trait || '').trim().toUpperCase());
  const hasUnknownTrait = normalizedRawTraits.some((trait) => !(PERSONA_TRAITS as readonly string[]).includes(trait));
  if (hasUnknownTrait) {
    errors.push('persona trait outside closed value set');
  }
  if (new Set(normalizedRawTraits).size > PERSONA_TRAIT_MAX) {
    errors.push('persona traits exceed hard maximum of 3');
  }

  const selectedReferenceCandidates = draft.referenceImageCandidates
    .filter((candidate) => candidate.reviewState === 'owner-selected');
  if (selectedReferenceCandidates.length > 1) {
    errors.push('more than one reference image candidate is owner-selected');
  }
  if (
    draft.referenceImageUrl
    && !selectedReferenceCandidates.some((candidate) => candidate.url === draft.referenceImageUrl)
  ) {
    errors.push('reference image candidate is not owner-selected');
  }

  if (draft.selectedWorldId && selectableWorldIds && !selectableWorldIds.has(draft.selectedWorldId)) {
    errors.push('selected world not source-backed by Nimi App Access realm.worldCore.list');
  }
  if (draft.handle) {
    if (!handleAvailability) {
      errors.push('handle availability not checked against owner PersonaCharacter portfolio');
    } else if (handleAvailability.handle !== draft.handle && handleAvailability.normalized !== draft.handle) {
      errors.push('handle availability not checked for the current normalized handle');
    } else if (!handleAvailability.available) {
      errors.push(`handle unavailable: ${handleAvailability.message}`);
    }
  }

  if (errors.length > 0) {
    return {
      ready: false,
      errors,
      source: REALM_PERSONA_CREATE_SOURCE,
      payload: null,
    };
  }

  const body: ReviewedRealmCreatePersonaInput = {
    worldId: draft.selectedWorldId,
    visibility: draft.visibility as NimiLocalAppPersonaCharacterWritableVisibility,
    origin: {
      kind: 'manual',
      sourceId: `realm-persona-studio:${draft.handle}`,
      sourceVersion: 'owner-reviewed-v1',
    },
    lorebookDeclaration: {
      identity: draft.concept,
      behavior: [draft.ruleText],
      speaking: [draft.speechSupplement],
      immutableBoundaries: [draft.boundarySupplement],
      relationshipPostures: [],
    },
    profile: buildRealmPersonaProfileV1(draft),
  };

  return {
    ready: true,
    errors: [],
    source: REALM_PERSONA_CREATE_SOURCE,
    payload: {
      source: REALM_PERSONA_CREATE_SOURCE,
      publicFields: {
        handle: draft.handle,
        displayName: draft.displayName,
        ...(draft.concept ? { concept: draft.concept } : {}),
        ...(draft.description ? { description: draft.description } : {}),
        ...(draft.ruleText ? { rulesText: draft.ruleText } : {}),
      },
      body,
    },
  };
}
