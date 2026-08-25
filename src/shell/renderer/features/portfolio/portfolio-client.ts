import type {
  NimiLocalAppPersonaCharacter,
  NimiLocalAppPersonaCharacterFailureReason,
} from '@nimiplatform/sdk/app';
import { createNimiError } from '@nimiplatform/sdk/types';
import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';
import {
  getStudioWorldCoreById,
  listStudioWorldCores,
} from '@renderer/data/studio-world-core.js';
import {
  type OwnerPortfolioPersona,
  type OwnerPortfolioPersonaDetail,
  normalizeOwnerPortfolio,
  normalizeOwnerPortfolioPersonaDetail,
  personaCharacterFailureReason,
} from './portfolio-data.js';
import {
  REALM_PERSONA_CREATE_SOURCE,
  REALM_PERSONA_HANDLE_CHECK_SOURCE,
  normalizeSelectableWorlds,
  normalizeSelectedWorldPreview,
  type NormalizedRealmPersonaHandleAvailability,
  type RealmPersonaCreationWorldDto,
  type RealmCreatePersonaInput,
  type ReviewedCreateRealmPersonaPayload,
  type SelectableRealmWorld,
  type SelectedWorldPreview,
} from './create-persona-draft.js';
const OWNER_PERSONA_PAGE_SIZE = 500;

type RealmCreatePersonaResponse = NimiLocalAppPersonaCharacter;

export type RealmPersonaCreateCanonicalFields = {
  id: string;
  contentHash: string;
  homeWorldId: string;
  contentRevision: number;
  visibility: NimiLocalAppPersonaCharacter['visibility'];
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
    failure: NimiLocalAppPersonaCharacterFailureReason;
    message: string;
  };

export const REALM_PERSONA_DELETE_SOURCE = 'Nimi App Access realm.personaCharacter.delete' as const;

export type RealmPersonaDeleteResult =
  | {
    ok: true;
    source: typeof REALM_PERSONA_DELETE_SOURCE;
    personaCharacterId: string;
  }
  | {
    ok: false;
    source: typeof REALM_PERSONA_DELETE_SOURCE;
    failure: NimiLocalAppPersonaCharacterFailureReason;
  };

export type RealmPersonaCreateProfileSettingsCompletion =
  {
    status: 'not-applicable';
    truthWrite: false;
    description: '';
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
    failure: NimiLocalAppPersonaCharacterFailureReason;
    message: string;
    createdCanonical?: RealmPersonaCreateCanonicalFields;
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

export function buildRealmCreatePersonaInput(payload: ReviewedCreateRealmPersonaPayload): RealmCreatePersonaInput {
  return payload.body;
}

export function normalizeRealmPersonaCreateResult(persona: RealmCreatePersonaResponse): RealmPersonaCreateResult {
  return {
    ok: true,
    source: REALM_PERSONA_CREATE_SOURCE,
    persona,
    canonical: {
      id: persona.id,
      contentHash: persona.contentHash,
      homeWorldId: persona.worldId,
      contentRevision: persona.contentRevision,
      visibility: persona.visibility,
    },
  };
}

async function listAllOwnedPersonaCharacters(): Promise<readonly NimiLocalAppPersonaCharacter[]> {
  const client = getStudioLocalAppClient().realm.personaCharacter;
  const items: NimiLocalAppPersonaCharacter[] = [];
  const seenCursors = new Set<string>();
  const seenPersonaIds = new Set<string>();
  let afterId: string | undefined;

  while (true) {
    const page = await client.listOwned({
      take: OWNER_PERSONA_PAGE_SIZE,
      ...(afterId ? { afterId } : {}),
    });
    for (const persona of page.items) {
      if (seenPersonaIds.has(persona.id)) {
        throw createNimiError({
          message: 'PersonaCharacter owner pagination returned a duplicate persona id.',
          reasonCode: 'contract-invalid',
          actionHint: 'retry_after_contract_repair',
          source: 'sdk',
        });
      }
      seenPersonaIds.add(persona.id);
      items.push(persona);
    }
    if (!page.nextAfterId) return items;
    if (seenCursors.has(page.nextAfterId)) {
      throw createNimiError({
        message: 'PersonaCharacter owner pagination returned a repeated cursor.',
        reasonCode: 'contract-invalid',
        actionHint: 'retry_after_contract_repair',
        source: 'sdk',
      });
    }
    seenCursors.add(page.nextAfterId);
    afterId = page.nextAfterId;
  }
}

// @nimi-authority: rule.realm-persona-studio.persona.r003
export async function listOwnerPortfolioPersonas(): Promise<OwnerPortfolioPersona[]> {
  return normalizeOwnerPortfolio(await listAllOwnedPersonaCharacters());
}

export async function getOwnerPortfolioPersonaDetail(
  personaId: string,
): Promise<OwnerPortfolioPersonaDetail> {
  const persona = await getStudioLocalAppClient().realm.personaCharacter.getOwned(personaId);
  return normalizeOwnerPortfolioPersonaDetail(persona);
}

// @nimi-authority: rule.realm-persona-studio.acceptance.r003
export async function deleteOwnerPortfolioPersona(personaId: string): Promise<RealmPersonaDeleteResult> {
  try {
    const result = await getStudioLocalAppClient().realm.personaCharacter.delete(personaId);
    return {
      ok: true,
      source: REALM_PERSONA_DELETE_SOURCE,
      personaCharacterId: result.personaCharacterId,
    };
  } catch (error) {
    return {
      ok: false,
      source: REALM_PERSONA_DELETE_SOURCE,
      failure: personaCharacterFailureReason(error),
    };
  }
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
  handle: string,
): Promise<RealmPersonaHandleAvailabilityResult> {
  const normalized = handle.trim().replace(/^@+/u, '').toLocaleLowerCase();
  if (!normalized) {
    return {
      ok: false,
      truthWrite: false,
      failure: 'persona-handle-invalid',
      message: 'PersonaCharacter handle is invalid.',
      availability: null,
    };
  }
  try {
    const personas = await listAllOwnedPersonaCharacters();
    const conflict = personas.some((persona) => persona.profile.identity.handle?.trim().toLocaleLowerCase() === normalized);
    return {
      ok: true,
      truthWrite: false,
      availability: conflict
        ? {
            checked: true,
            source: REALM_PERSONA_HANDLE_CHECK_SOURCE,
            handle: normalized,
            normalized,
            available: false,
            message: 'A PersonaCharacter with this handle already exists in the owner portfolio.',
          }
        : {
            checked: true,
            source: REALM_PERSONA_HANDLE_CHECK_SOURCE,
            handle: normalized,
            normalized,
            available: true,
          },
    };
  } catch (error) {
    return {
      ok: false,
      truthWrite: false,
      failure: 'realm-persona-handle-check-failed',
      message: personaCharacterFailureReason(error),
      availability: null,
    };
  }
}

// @nimi-authority: rule.realm-persona-studio.persona.r009
export async function createReviewedRealmPersona(
  payload: ReviewedCreateRealmPersonaPayload,
): Promise<RealmPersonaCreateResult> {
  try {
    const persona = await getStudioLocalAppClient().realm.personaCharacter.create(
      buildRealmCreatePersonaInput(payload),
    );
    return normalizeRealmPersonaCreateResult(persona);
  } catch (error) {
    const reason = personaCharacterFailureReason(error);
    return {
      ok: false,
      source: REALM_PERSONA_CREATE_SOURCE,
      failure: reason,
      message: reason,
    };
  }
}

export async function createReviewedRealmPersonaWithProfileSettings(
  payload: ReviewedCreateRealmPersonaPayload,
): Promise<RealmPersonaCreateWithProfileSettingsResult> {
  const result = await createReviewedRealmPersona(payload);
  if (!result.ok) return result;
  return {
    ...result,
    profileSettings: {
      status: 'not-applicable',
      truthWrite: false,
      description: '',
    },
  };
}

export * from './portfolio-media-client.js';
export * from './portfolio-post-client.js';
export * from './portfolio-settings-client.js';
