import type {
  RealmWorldCoreControllerCreateRealmPersonaOperationResponse,
} from '@nimiplatform/sdk/realm/generated';
import { createStudioRealmClient, type StudioRealmSurface } from '@renderer/data/realm-client.js';
import {
  normalizeOwnerPortfolio,
  normalizeOwnerPortfolioPersonaDetail,
  type OwnerPortfolioPersona,
  type OwnerPortfolioPersonaDetail,
} from './portfolio-data.js';
import {
  REALM_PERSONA_CREATE_SOURCE,
  normalizeCreateRealmPersonaDraft,
  normalizeRealmPersonaHandleAvailability,
  normalizeSelectableWorlds,
  normalizeSelectedWorldPreview,
  type NormalizedRealmPersonaHandleAvailability,
  type RealmPersonaCreationWorldDto,
  type RealmCreatePersonaInput,
  type ReviewedCreateRealmPersonaPayload,
  type SelectableRealmWorld,
  type SelectedWorldPreview,
} from './create-persona-draft.js';
import {
  getOwnerPersonaSettings,
  updateReviewedOwnerPersonaSettings,
  type RealmOwnerPersonaSettings,
  type RealmOwnerPersonaSettingsUpdateResult,
} from './portfolio-settings-client.js';
import {
  OWNER_SETTINGS_SAVE_SOURCE,
  createOwnerPersonaSettingsDraft,
} from './setting-proposal.js';

type StudioRealmClient = StudioRealmSurface;

type RealmCreatePersonaResponse = RealmWorldCoreControllerCreateRealmPersonaOperationResponse;

export type RealmPersonaCreateCanonicalFields = {
  id: string;
  state?: string;
  contentHash: string;
  homeWorldId: string;
};

export type RealmPersonaCreateResult =
  | {
    ok: true;
    source: typeof REALM_PERSONA_CREATE_SOURCE;
    persona: RealmCreatePersonaResponse;
    canonical: RealmPersonaCreateCanonicalFields;
  }
  | {
    ok: false;
    source: typeof REALM_PERSONA_CREATE_SOURCE;
    failure: 'realm-create-persona-failed' | 'realm-create-persona-missing-canonical-id';
    message: string;
  };

export type RealmPersonaCreateProfileSettingsCompletion =
  | {
    status: 'not-requested';
    truthWrite: false;
    description: '';
  }
  | {
    status: 'already-current';
    source: 'Realm WorldCoreController.getRealmPersonaSettings';
    truthWrite: false;
    description: string;
    settings: RealmOwnerPersonaSettings;
  }
  | {
    status: 'updated';
    source: typeof OWNER_SETTINGS_SAVE_SOURCE;
    truthWrite: true;
    description: string;
    submitted: Extract<RealmOwnerPersonaSettingsUpdateResult, { ok: true }>['submitted'];
    settings: RealmOwnerPersonaSettings;
  };

export type RealmPersonaCreateWithProfileSettingsResult =
  | {
    ok: true;
    source: typeof REALM_PERSONA_CREATE_SOURCE;
    persona: RealmCreatePersonaResponse;
    canonical: RealmPersonaCreateCanonicalFields;
    profileSettings: RealmPersonaCreateProfileSettingsCompletion;
  }
  | {
    ok: false;
    source: typeof REALM_PERSONA_CREATE_SOURCE;
    failure:
      | 'realm-create-persona-failed'
      | 'realm-create-persona-missing-canonical-id'
      | 'realm-create-persona-profile-settings-read-failed'
      | 'realm-create-persona-profile-settings-failed';
    message: string;
    createdCanonical?: RealmPersonaCreateCanonicalFields;
    settingsResult?: RealmOwnerPersonaSettingsUpdateResult;
  };

export type RealmPersonaHandleAvailabilityResult =
  | {
    ok: true;
    truthWrite: false;
    availability: NormalizedRealmPersonaHandleAvailability;
  }
  | {
    ok: false;
    truthWrite: false;
    failure: 'persona-handle-invalid' | 'realm-persona-handle-check-failed' | 'realm-persona-handle-check-invalid-response';
    message: string;
    availability: null;
  };

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function buildRealmCreatePersonaInput(payload: ReviewedCreateRealmPersonaPayload): RealmCreatePersonaInput {
  return {
    homeWorldId: payload.body.homeWorldId,
    origin: payload.body.origin,
    core: payload.body.core,
  };
}

export function normalizeRealmPersonaCreateResult(persona: RealmCreatePersonaResponse): RealmPersonaCreateResult {
  if (!persona || typeof persona !== 'object') {
    return {
      ok: false,
      source: REALM_PERSONA_CREATE_SOURCE,
      failure: 'realm-create-persona-missing-canonical-id',
      message: 'Realm create RealmPersona returned no persona object.',
    };
  }

  const record = persona as unknown as Record<string, unknown>;
  const id = readOptionalString(record, 'id');
  const contentHash = readOptionalString(record, 'contentHash');
  const homeWorldId = readOptionalString(record, 'homeWorldId');
  if (!id) {
    return {
      ok: false,
      source: REALM_PERSONA_CREATE_SOURCE,
      failure: 'realm-create-persona-missing-canonical-id',
      message: 'Realm create RealmPersona returned no canonical persona id.',
    };
  }
  if (!contentHash || !homeWorldId) {
    return {
      ok: false,
      source: REALM_PERSONA_CREATE_SOURCE,
      failure: 'realm-create-persona-missing-canonical-id',
      message: 'Realm create RealmPersona returned incomplete canonical source fields.',
    };
  }

  const state = readOptionalString(record, 'state');
  const core = record.core && typeof record.core === 'object' ? record.core as Record<string, unknown> : {};
  return {
    ok: true,
    source: REALM_PERSONA_CREATE_SOURCE,
    persona,
    canonical: {
      id,
      contentHash,
      homeWorldId,
      ...(state ? { state } : readOptionalString(core, 'state') ? { state: readOptionalString(core, 'state') } : {}),
    },
  };
}
export async function listOwnerPortfolioPersonas(realm: StudioRealmClient = createStudioRealmClient()): Promise<OwnerPortfolioPersona[]> {
  const personas = await realm.worldCoreControllerListRealmPersonas({ path: {} });
  return normalizeOwnerPortfolio(personas);
}

export async function getOwnerPortfolioPersonaDetail(
  personaId: string,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<OwnerPortfolioPersonaDetail> {
  const persona = await realm.worldCoreControllerGetRealmPersona({ path: { personaId: personaId } });
  return normalizeOwnerPortfolioPersonaDetail(persona);
}

export async function listCreateRealmPersonaSelectableWorlds(
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<SelectableRealmWorld[]> {
  const worlds = await realm.worldCoreControllerListWorldCores({ path: {}, query: { take: 100 } });
  return normalizeSelectableWorlds(worlds as RealmPersonaCreationWorldDto[]);
}

export async function getCreateRealmPersonaWorldPreview(
  worldId: string,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<SelectedWorldPreview> {
  const world = await realm.worldCoreControllerGetWorldCore({ path: { worldId } });
  return normalizeSelectedWorldPreview(world);
}

export async function checkCreateRealmPersonaHandleAvailability(
  handle: string,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmPersonaHandleAvailabilityResult> {
  const normalizedHandle = normalizeCreateRealmPersonaDraft({
    handle,
    displayName: '',
    concept: '',
    description: '',
    ruleText: '',
    selectedWorldId: '',
    dnaPrimary: '',
    dnaSecondary: [],
    referenceImageUrl: '',
    originalDescription: '',
  }).handle;
  if (!normalizedHandle) {
    return {
      ok: false,
      truthWrite: false,
      failure: 'persona-handle-invalid',
      message: 'Persona handle check requires a non-empty normalized handle.',
      availability: null,
    };
  }

  try {
    const personas = await realm.worldCoreControllerListRealmPersonas({ path: {} });
    const unavailable = personas.some((persona) => {
      const core = persona.core && typeof persona.core === 'object' ? persona.core as Record<string, unknown> : {};
      const identity = core.identity && typeof core.identity === 'object'
        ? core.identity as Record<string, unknown>
        : {};
      const handle = readOptionalString(identity, 'handle');
      return handle?.toLocaleLowerCase() === normalizedHandle;
    });
    const response = {
      available: !unavailable,
      normalized: normalizedHandle,
      ...(unavailable ? { message: 'A RealmPersona with this handle already exists in the owner portfolio.' } : {}),
    };
    return {
      ok: true,
      truthWrite: false,
      availability: normalizeRealmPersonaHandleAvailability(normalizedHandle, response),
    };
  } catch (error) {
    return {
      ok: false,
      truthWrite: false,
      failure: 'realm-persona-handle-check-failed',
      message: error instanceof Error ? error.message : 'RealmPersona handle availability check failed.',
      availability: null,
    };
  }
}

export async function createReviewedRealmPersona(
  payload: ReviewedCreateRealmPersonaPayload,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmPersonaCreateResult> {
  try {
    const persona = await realm.worldCoreControllerCreateRealmPersona({
      path: {},
      body: buildRealmCreatePersonaInput(payload),
    });
    return normalizeRealmPersonaCreateResult(persona);
  } catch (error) {
    return {
      ok: false,
      source: REALM_PERSONA_CREATE_SOURCE,
      failure: 'realm-create-persona-failed',
      message: error instanceof Error ? error.message : 'Realm create RealmPersona failed.',
    };
  }
}

export async function createReviewedRealmPersonaWithProfileSettings(
  payload: ReviewedCreateRealmPersonaPayload,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmPersonaCreateWithProfileSettingsResult> {
  const createResult = await createReviewedRealmPersona(payload, realm);
  if (!createResult.ok) {
    return createResult;
  }

  const profileDescription = (payload.publicFields.description || '').trim();
  if (!profileDescription) {
    return {
      ...createResult,
      profileSettings: {
        status: 'not-requested',
        truthWrite: false,
        description: '',
      },
    };
  }

  let currentSettings: RealmOwnerPersonaSettings;
  try {
    currentSettings = await getOwnerPersonaSettings(createResult.canonical.id, realm);
  } catch (error) {
    return {
      ok: false,
      source: REALM_PERSONA_CREATE_SOURCE,
      failure: 'realm-create-persona-profile-settings-read-failed',
      message: error instanceof Error ? error.message : 'Realm owner settings read failed after create.',
      createdCanonical: createResult.canonical,
    };
  }

  if ((currentSettings.description || '').trim() === profileDescription) {
    return {
      ...createResult,
      profileSettings: {
        status: 'already-current',
        source: 'Realm WorldCoreController.getRealmPersonaSettings',
        truthWrite: false,
        description: profileDescription,
        settings: currentSettings,
      },
    };
  }

  const settingsDraft = {
    ...createOwnerPersonaSettingsDraft(currentSettings),
    description: profileDescription,
  };
  const settingsResult = await updateReviewedOwnerPersonaSettings(
    createResult.canonical.id,
    settingsDraft,
    currentSettings,
    realm,
  );
  if (!settingsResult.ok) {
    return {
      ok: false,
      source: REALM_PERSONA_CREATE_SOURCE,
      failure: 'realm-create-persona-profile-settings-failed',
      message: settingsResult.message,
      createdCanonical: createResult.canonical,
      settingsResult,
    };
  }

  return {
    ...createResult,
    profileSettings: {
      status: 'updated',
      source: OWNER_SETTINGS_SAVE_SOURCE,
      truthWrite: true,
      description: profileDescription,
      submitted: settingsResult.submitted,
      settings: settingsResult.settings,
    },
  };
}

export * from './portfolio-media-client.js';
export * from './portfolio-post-client.js';
export * from './portfolio-settings-client.js';
