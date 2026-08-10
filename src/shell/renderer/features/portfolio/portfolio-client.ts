import type {
  RealmModel,
} from '@nimiplatform/sdk/realm/generated';
import { requireStudioProtectedOperation } from '@renderer/app-shell/studio-platform.js';
import {
  getStudioWorldCoreById,
  listStudioWorldCores,
} from '@renderer/data/studio-world-core.js';
import {
  type OwnerPortfolioPersona,
  type OwnerPortfolioPersonaDetail,
} from './portfolio-data.js';
import {
  REALM_PERSONA_CREATE_SOURCE,
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
  type RealmOwnerPersonaSettings,
  type RealmOwnerPersonaSettingsUpdateResult,
} from './portfolio-settings-client.js';
import { OWNER_SETTINGS_SAVE_SOURCE } from './setting-proposal.js';

type RealmCreatePersonaResponse = RealmModel<'PersonaCharacterCoreDto'>;

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
    status: 'not-applicable';
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
    worldId: payload.body.worldId,
    origin: payload.body.origin,
    profile: payload.body.profile,
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
  const homeWorldId = readOptionalString(record, 'worldId');
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
  const core = record.profile && typeof record.profile === 'object' ? record.profile as Record<string, unknown> : {};
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
export async function listOwnerPortfolioPersonas(): Promise<OwnerPortfolioPersona[]> {
  requireStudioProtectedOperation('Owner Realm Persona portfolio listing');
}

export async function getOwnerPortfolioPersonaDetail(
  _personaId: string,
): Promise<OwnerPortfolioPersonaDetail> {
  requireStudioProtectedOperation('Owner Realm Persona detail reading');
}

export async function listCreateRealmPersonaSelectableWorlds(): Promise<SelectableRealmWorld[]> {
  const worlds = await listStudioWorldCores({ take: 100 });
  return normalizeSelectableWorlds([...worlds] as RealmPersonaCreationWorldDto[]);
}

export async function getCreateRealmPersonaWorldPreview(
  worldId: string,
): Promise<SelectedWorldPreview | null> {
  const world = await getStudioWorldCoreById(worldId);
  return world ? normalizeSelectedWorldPreview(world) : null;
}

export async function checkCreateRealmPersonaHandleAvailability(
  _handle: string,
): Promise<RealmPersonaHandleAvailabilityResult> {
  requireStudioProtectedOperation('Realm Persona handle availability checking');
}

export async function createReviewedRealmPersona(
  _payload: ReviewedCreateRealmPersonaPayload,
): Promise<RealmPersonaCreateResult> {
  requireStudioProtectedOperation('Reviewed Realm Persona creation');
}

export async function createReviewedRealmPersonaWithProfileSettings(
  _payload: ReviewedCreateRealmPersonaPayload,
): Promise<RealmPersonaCreateWithProfileSettingsResult> {
  requireStudioProtectedOperation('Reviewed Realm Persona creation with profile settings');
}

export * from './portfolio-media-client.js';
export * from './portfolio-post-client.js';
export * from './portfolio-settings-client.js';
