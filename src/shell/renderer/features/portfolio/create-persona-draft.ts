import type {
  RealmWorldCoreControllerCreateRealmPersonaOperationRequest,
  RealmWorldCoreControllerGetWorldCoreOperationResponse,
  RealmWorldCoreControllerListWorldCoresOperationResponse,
} from '@nimiplatform/sdk/realm/generated';

export type RealmPersonaCreationWorldDto = RealmWorldCoreControllerListWorldCoresOperationResponse[number];
export type RealmPersonaCreationWorldDetailDto = RealmWorldCoreControllerGetWorldCoreOperationResponse;
export type RealmCreatePersonaInput = RealmWorldCoreControllerCreateRealmPersonaOperationRequest['body'];
export type RealmPersonaHandleAvailabilityDto = {
  available: boolean;
  normalized?: string;
  message?: string;
};

export const REALM_PERSONA_CREATE_SOURCE = 'Realm WorldCoreController.createRealmPersona';
export const REALM_PERSONA_CREATE_PATH = 'POST /api/realm/core/personas';
export const REALM_PERSONA_HANDLE_CHECK_SOURCE = 'Realm WorldCoreController.listRealmPersonas';
export const REALM_PERSONA_HANDLE_CHECK_PATH = 'GET /api/realm/core/personas';

export type DnaPrimaryArchetype =
  | 'CARING'
  | 'PLAYFUL'
  | 'INTELLECTUAL'
  | 'CONFIDENT'
  | 'MYSTERIOUS'
  | 'ROMANTIC';

export const DNA_PRIMARY_ARCHETYPES: readonly DnaPrimaryArchetype[] = [
  'CARING',
  'PLAYFUL',
  'INTELLECTUAL',
  'CONFIDENT',
  'MYSTERIOUS',
  'ROMANTIC',
];

export type DnaSecondaryTrait =
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

export const DNA_SECONDARY_TRAITS: readonly DnaSecondaryTrait[] = [
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

export const DNA_SECONDARY_MAX_RECOMMENDED = 3;

export type CreateRealmPersonaDraftInput = {
  handle: string;
  displayName: string;
  concept: string;
  description: string;
  ruleText: string;
  selectedWorldId: string;
  dnaPrimary: DnaPrimaryArchetype | '';
  dnaSecondary: DnaSecondaryTrait[];
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
  dnaPrimary: DnaPrimaryArchetype | '';
  dnaSecondary: DnaSecondaryTrait[];
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
  homeWorldId: string;
  origin: RealmCreatePersonaInput['origin'];
  core: Record<string, unknown>;
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

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

function normalizeDnaSecondary(values: readonly DnaSecondaryTrait[] | readonly string[]): DnaSecondaryTrait[] {
  const known = new Set<DnaSecondaryTrait>(DNA_SECONDARY_TRAITS);
  const seen = new Set<DnaSecondaryTrait>();
  const out: DnaSecondaryTrait[] = [];
  for (const value of values) {
    const trimmed = String(value || '').trim().toUpperCase() as DnaSecondaryTrait;
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
  const rawPrimary = String(input.dnaPrimary || '').trim().toUpperCase();
  const dnaPrimary = (DNA_PRIMARY_ARCHETYPES as readonly string[]).includes(rawPrimary)
    ? (rawPrimary as DnaPrimaryArchetype)
    : '';
  return {
    handle: normalizeHandle(input.handle),
    displayName: input.displayName.trim(),
    concept: input.concept.trim(),
    description: input.description.trim(),
    ruleText: input.ruleText.trim(),
    selectedWorldId: input.selectedWorldId.trim(),
    dnaPrimary,
    dnaSecondary: normalizeDnaSecondary(input.dnaSecondary || []),
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
  return {
    id: world.id,
    name: readString(core?.name) || readString(core?.displayName) || world.id,
    type: readString(core?.type) || world.visibility,
    status: world.visibility,
    description: readString(core?.description) || '',
    tagline: readString(core?.tagline) || readString(core?.motto) || '',
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
  const themes = Array.isArray(core?.themes)
    ? core.themes.filter((theme): theme is string => typeof theme === 'string' && theme.length > 0)
    : [];

  return {
    id: world.id,
    name: readString(core?.name) || readString(core?.displayName) || world.id,
    type: readString(core?.type) || world.visibility,
    status: world.visibility,
    contentRating: readString(core?.contentRating) || null,
    tagline: readString(core?.tagline) || readString(core?.motto) || '',
    description: readString(core?.description) || '',
    overview: readString(core?.overview) || '',
    themes,
    personaCount: readNumber(core?.characterCount),
    nativeCreationState: readString(core?.nativeCreationState) || null,
    source: 'Realm WorldCoreController.getWorldCore',
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
  if (!draft.dnaPrimary) {
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

  const ruleLines = normalizeRuleLines(draft.ruleText);
  const dnaPrimary = draft.dnaPrimary as DnaPrimaryArchetype;
  const body: ReviewedRealmCreatePersonaInput = {
    homeWorldId: draft.selectedWorldId,
    origin: {
      kind: 'manual',
      sourceId: `realm-persona-studio:${draft.handle}`,
      sourceVersion: 'owner-reviewed-v1',
    },
    core: {
      handle: draft.handle,
      displayName: draft.displayName,
      concept: draft.concept,
      homeWorldId: draft.selectedWorldId,
      dnaPrimary,
      dnaSecondary: draft.dnaSecondary,
      ...(draft.description ? { description: draft.description } : {}),
      ...(ruleLines.length > 0
        ? { ownerReviewedGuidelines: { format: 'line-list-v1', lines: ruleLines, text: draft.ruleText } }
        : {}),
      ...(draft.referenceImageUrl ? { referenceImageUrl: draft.referenceImageUrl, avatarUrl: draft.referenceImageUrl } : {}),
    },
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
