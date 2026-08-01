import type {
  RealmModel,
  RealmWorldCoreControllerGetWorldCoreOperationResponse,
  RealmWorldCoreControllerListWorldCoresOperationResponse,
} from '@nimiplatform/sdk/realm/generated';

export type RealmPersonaCreationWorldDto = RealmWorldCoreControllerListWorldCoresOperationResponse[number];
export type RealmPersonaCreationWorldDetailDto = RealmWorldCoreControllerGetWorldCoreOperationResponse;
export type RealmCreatePersonaInput = RealmModel<'CreatePersonaCharacterCoreDto'>;
export type RealmPersonaHandleAvailabilityDto = {
  available: boolean;
  normalized?: string;
  message?: string;
};

export const REALM_PERSONA_CREATE_SOURCE = 'Realm WorldCoreController.createRealmPersona';
export const REALM_PERSONA_CREATE_PATH = 'POST /api/realm/core/personas';
export const REALM_PERSONA_HANDLE_CHECK_SOURCE = 'Realm WorldCoreController.listRealmPersonas';
export const REALM_PERSONA_HANDLE_CHECK_PATH = 'GET /api/realm/core/personas';

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

export const PERSONA_TRAIT_MAX_RECOMMENDED = 3;

export type CreateRealmPersonaDraftInput = {
  handle: string;
  displayName: string;
  concept: string;
  description: string;
  ruleText: string;
  selectedWorldId: string;
  personaArchetype: PersonaArchetype | '';
  personaTraits: PersonaTrait[];
  /** Optional reference image URL produced by Runtime image generation in the AI-seeded create flow. */
  referenceImageUrl: string;
  /** Client-only: the one-liner the owner typed in the seed phase. Re-used as
   * the image-generation prompt seed. Not submitted to Realm. */
  originalDescription: string;
};

export type NormalizedCreateRealmPersonaDraft = {
  handle: string;
  displayName: string;
  concept: string;
  description: string;
  ruleText: string;
  selectedWorldId: string;
  personaArchetype: PersonaArchetype | '';
  personaTraits: PersonaTrait[];
  referenceImageUrl: string;
  originalDescription: string;
};

export type SelectableRealmWorld = {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  description: string;
  tagline: string;
  source: 'Realm WorldCoreController.listWorldCores';
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
  source: 'Realm WorldCoreController.getWorldCore';
};

export type ReviewedRealmCreatePersonaInput = {
  worldId: string;
  origin: RealmCreatePersonaInput['origin'];
  profile: RealmModel<'CharacterProfileCoreInputDto'>;
};

export type ReviewedCreateRealmPersonaPayload = {
  source: typeof REALM_PERSONA_CREATE_SOURCE;
  path: typeof REALM_PERSONA_CREATE_PATH;
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

function normalizeRuleLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizePersonaTraits(values: readonly PersonaTrait[] | readonly string[]): PersonaTrait[] {
  const known = new Set<PersonaTrait>(PERSONA_TRAITS);
  const seen = new Set<PersonaTrait>();
  const out: PersonaTrait[] = [];
  for (const value of values) {
    const trimmed = String(value || '').trim().toUpperCase() as PersonaTrait;
    if (!known.has(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeReferenceImageUrl(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export function normalizeCreateRealmPersonaDraft(input: CreateRealmPersonaDraftInput): NormalizedCreateRealmPersonaDraft {
  const rawPrimary = String(input.personaArchetype || '').trim().toUpperCase();
  const personaArchetype = (PERSONA_ARCHETYPES as readonly string[]).includes(rawPrimary)
    ? (rawPrimary as PersonaArchetype)
    : '';
  return {
    handle: normalizeHandle(input.handle),
    displayName: input.displayName.trim(),
    concept: input.concept.trim(),
    description: input.description.trim(),
    ruleText: input.ruleText.trim(),
    selectedWorldId: input.selectedWorldId.trim(),
    personaArchetype,
    personaTraits: normalizePersonaTraits(input.personaTraits || []),
    referenceImageUrl: normalizeReferenceImageUrl(input.referenceImageUrl || ''),
    originalDescription: String(input.originalDescription || '').trim(),
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
    message: response.message || 'A RealmPersona with this handle already exists in the owner portfolio.',
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
    source: 'Realm WorldCoreController.listWorldCores',
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
    source: 'Realm WorldCoreController.getWorldCore',
  };
}

function buildRealmPersonaProfileV1(draft: NormalizedCreateRealmPersonaDraft): RealmModel<'CharacterProfileCoreInputDto'> {
  const ruleLines = normalizeRuleLines(draft.ruleText);
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
      extensions: {
        review: {
          status: 'owner-reviewed',
        },
        personaStyle: {
          voice: 'owner-reviewed',
          pacing: 'responsive',
        },
        contentProfile: {
          topics: [],
          boundaries: [],
          guidelines: ruleLines.map((line, index) => ({
            guidelineId: `owner-reviewed-${index + 1}`,
            statement: line,
            source: 'realm-persona-studio',
          })),
        },
      },
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
  if (!draft.selectedWorldId) {
    errors.push('selected world missing');
  }
  if (!draft.personaArchetype) {
    errors.push('persona archetype missing');
  }
  if (draft.selectedWorldId && selectableWorldIds && !selectableWorldIds.has(draft.selectedWorldId)) {
    errors.push('selected world not source-backed by WorldCoreController.listWorldCores');
  }
  if (draft.handle) {
    if (!handleAvailability) {
      errors.push('handle availability not checked against WorldCoreController.listRealmPersonas');
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
    origin: {
      kind: 'manual',
      sourceId: `realm-persona-studio:${draft.handle}`,
      sourceVersion: 'owner-reviewed-v1',
    },
    profile: buildRealmPersonaProfileV1(draft),
  };

  return {
    ready: true,
    errors: [],
    source: REALM_PERSONA_CREATE_SOURCE,
    payload: {
      source: REALM_PERSONA_CREATE_SOURCE,
      path: REALM_PERSONA_CREATE_PATH,
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
