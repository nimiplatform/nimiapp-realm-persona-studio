import type {
  NimiLocalAppPersonaCharacter,
  NimiLocalAppPersonaCharacterFailureReason,
  NimiLocalAppPersonaCharacterProfileInput,
  NimiLocalAppPersonaCharacterReplaceInput,
  NimiLocalAppPersonaCharacterVisibility,
  NimiLocalAppPersonaCharacterWritableVisibility,
} from '@nimiplatform/sdk/app';
import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';
import {
  runStudioTextCandidate,
  type StudioTextCandidatePrompt,
  type StudioTextCandidateRunner,
} from './studio-text-candidate.js';
import {
  personaCharacterFailureReason,
  type OwnerPortfolioPersonaDetail,
  type SettingField,
} from './portfolio-data.js';
import {
  OWNER_SETTINGS_SAVE_SOURCE,
  SETTINGS_AI_PROPOSAL_SOURCE,
  buildRealmOwnerPersonaSettingsUpdateInput,
  buildRuntimeOwnerSettingsProposalPrompt,
  normalizeRuntimeOwnerSettingsProposal,
  type OwnerPersonaSettingsProposalContext,
  type OwnerPersonaSettingsDraft,
  type OwnerPersonaSettingsSnapshot,
  type OwnerPersonaSettingsUpdateInput,
  type RuntimeOwnerSettingsProposal,
} from './setting-proposal.js';

type RealmPersonaCharacterDto = NimiLocalAppPersonaCharacter;

export type RealmPersonaVisibilitySettings = {
  visibility: NimiLocalAppPersonaCharacterVisibility;
  persona: RealmPersonaCharacterDto;
};
type RealmPersonaVisibilityUpdateInput = { visibility: NimiLocalAppPersonaCharacterWritableVisibility };
export type RealmOwnerPersonaSettings = OwnerPersonaSettingsSnapshot & {
  id: string;
  contentHash: string;
  homeWorldId: string;
  visibility: RealmPersonaCharacterDto['visibility'];
  origin: RealmPersonaCharacterDto['origin'];
  profile: RealmPersonaCharacterDto['profile'];
  persona: RealmPersonaCharacterDto;
};
type RealmOwnerPersonaSettingsUpdateInput = NimiLocalAppPersonaCharacterReplaceInput;
export const REALM_PERSONA_VISIBILITY_SOURCE = 'Nimi App Access realm.personaCharacter.replace';
export const PERSONA_VISIBILITY_VALUES = ['private', 'unlisted', 'public'] as const;

export type PersonaVisibilityValue = typeof PERSONA_VISIBILITY_VALUES[number];
export type PersonaVisibilityDraft = { visibility: string };

export type RealmPersonaVisibilityUpdateResult =
  | {
    ok: true;
    source: typeof REALM_PERSONA_VISIBILITY_SOURCE;
    lifecycleTruth: false;
    submitted: RealmPersonaVisibilityUpdateInput;
    settings: RealmPersonaVisibilitySettings;
  }
  | {
    ok: false;
    source: typeof REALM_PERSONA_VISIBILITY_SOURCE;
    lifecycleTruth: false;
    failure: NimiLocalAppPersonaCharacterFailureReason;
    message: string;
    submitted: RealmPersonaVisibilityUpdateInput | null;
    draft: PersonaVisibilityDraft;
  };

export type RealmOwnerPersonaSettingsUpdateResult =
  | {
    ok: true;
    source: typeof OWNER_SETTINGS_SAVE_SOURCE;
    truthWrite: true;
    submitted: RealmOwnerPersonaSettingsUpdateInput;
    settings: RealmOwnerPersonaSettings;
  }
  | {
    ok: false;
    source: typeof OWNER_SETTINGS_SAVE_SOURCE;
    truthWrite: false;
    failure: NimiLocalAppPersonaCharacterFailureReason;
    message: string;
    submitted: RealmOwnerPersonaSettingsUpdateInput | null;
    draft: OwnerPersonaSettingsDraft;
  };

export type RuntimeOwnerSettingsProposalResult =
  | {
    ok: true;
    source: typeof SETTINGS_AI_PROPOSAL_SOURCE;
    candidate: true;
    truthWrite: false;
    proposal: RuntimeOwnerSettingsProposal;
    submitted: StudioTextCandidatePrompt;
    runtime: {
      traceId?: string;
      finishReason?: string;
    };
  }
  | {
    ok: false;
    source: typeof SETTINGS_AI_PROPOSAL_SOURCE;
    candidate: false;
    truthWrite: false;
    failure:
      | 'runtime-settings-proposal-payload-invalid'
      | 'runtime-settings-proposal-failed'
      | 'runtime-settings-proposal-invalid-output';
    message: string;
    submitted: StudioTextCandidatePrompt | null;
  };

function proposalContextText(field: SettingField): string | null {
  if (field.status === 'available') {
    return field.value;
  }
  return null;
}

export function buildPortfolioSettingsProposalContext(persona: OwnerPortfolioPersonaDetail): OwnerPersonaSettingsProposalContext {
  return {
    ownerScope: persona.ownerScope,
    displayName: proposalContextText(persona.displayName),
    handle: proposalContextText(persona.handle),
    worldId: proposalContextText(persona.world),
    worldName: proposalContextText(persona.world),
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function writeRecordSection(
  core: Record<string, unknown>,
  key: string,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...core,
    [key]: {
      ...readRecord(core[key]),
      ...patch,
    },
  };
}

export function readPersonaVisibility(persona: RealmPersonaCharacterDto): RealmPersonaVisibilitySettings {
  return { visibility: persona.visibility, persona };
}

export function readPersonaSettings(persona: RealmPersonaCharacterDto): RealmOwnerPersonaSettings {
  const profile = persona.profile;
  return {
    id: persona.id,
    contentHash: persona.contentHash,
    homeWorldId: persona.worldId,
    visibility: persona.visibility,
    origin: persona.origin,
    profile,
    persona,
    displayName: profile.presentation.displayName || profile.identity.name || null,
    description: profile.identity.summary || profile.presentation.profileLine || null,
    greeting: profile.interactionProfile.greeting ?? null,
    naturalLanguageIntent: null,
    identity: {},
    personality: {},
    communication: {},
    boundaries: {},
    positioning: {},
  };
}

export function mergeOwnerSettingsProfile(
  profile: NimiLocalAppPersonaCharacterProfileInput,
  patch: OwnerPersonaSettingsUpdateInput,
): NimiLocalAppPersonaCharacterProfileInput {
  let next: Record<string, unknown> = { ...profile };

  if (Object.prototype.hasOwnProperty.call(patch, 'displayName') && patch.displayName) {
    next = writeRecordSection(next, 'identity', { name: patch.displayName });
    next = writeRecordSection(next, 'presentation', { displayName: patch.displayName });
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
    if (patch.description) {
      next = writeRecordSection(next, 'identity', { summary: patch.description });
      next = writeRecordSection(next, 'presentation', { profileLine: patch.description });
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'greeting')) {
    if (patch.greeting === null) {
      const { greeting: _greeting, ...interactionProfile } = readRecord(next.interactionProfile);
      next = { ...next, interactionProfile };
    } else {
      next = writeRecordSection(next, 'interactionProfile', { greeting: patch.greeting });
    }
  }

  return next as NimiLocalAppPersonaCharacterProfileInput;
}

export function buildPersonaCharacterReplaceInput(
  current: RealmOwnerPersonaSettings,
  profile: NimiLocalAppPersonaCharacterProfileInput,
  visibility: NimiLocalAppPersonaCharacterWritableVisibility,
): NimiLocalAppPersonaCharacterReplaceInput {
  return {
    personaCharacterId: current.id,
    baseContentHash: current.contentHash,
    worldId: current.homeWorldId,
    visibility,
    origin: current.origin,
    profile,
  };
}

function isPersonaVisibilityValue(value: string): value is PersonaVisibilityValue {
  return PERSONA_VISIBILITY_VALUES.includes(value as PersonaVisibilityValue);
}

export function createPersonaVisibilityDraft(settings: RealmPersonaVisibilitySettings): PersonaVisibilityDraft {
  return { visibility: settings.visibility };
}

export function buildRealmUpdateVisibilityInput(
  draft: PersonaVisibilityDraft,
  current: RealmPersonaVisibilitySettings,
): { input: RealmPersonaVisibilityUpdateInput | null; errors: string[] } {
  if (current.visibility === 'system') {
    return { input: null, errors: ['system visibility is read-only'] };
  }
  if (!isPersonaVisibilityValue(draft.visibility)) {
    return { input: null, errors: ['visibility must be private, unlisted, or public'] };
  }
  if (draft.visibility === current.visibility) {
    return { input: null, errors: ['visibility settings have no reviewed changes'] };
  }
  return { input: { visibility: draft.visibility }, errors: [] };
}
export async function getPersonaVisibilitySettings(
  personaId: string,
): Promise<RealmPersonaVisibilitySettings> {
  const persona = await getStudioLocalAppClient().realm.personaCharacter.getOwned(personaId);
  return readPersonaVisibility(persona);
}

export async function getOwnerPersonaSettings(
  personaId: string,
): Promise<RealmOwnerPersonaSettings> {
  const persona = await getStudioLocalAppClient().realm.personaCharacter.getOwned(personaId);
  return readPersonaSettings(persona);
}

export async function getPortfolioPersonaSettings(
  persona: OwnerPortfolioPersonaDetail,
): Promise<RealmOwnerPersonaSettings> {
  return getOwnerPersonaSettings(persona.id);
}

export async function updateReviewedPersonaVisibility(
  personaId: string,
  draft: PersonaVisibilityDraft,
  current: RealmPersonaVisibilitySettings,
): Promise<RealmPersonaVisibilityUpdateResult> {
  const built = buildRealmUpdateVisibilityInput(draft, current);
  if (!built.input || current.persona.id !== personaId) {
    return {
      ok: false,
      source: REALM_PERSONA_VISIBILITY_SOURCE,
      lifecycleTruth: false,
      failure: 'invalid-input',
      message: 'invalid-input',
      submitted: null,
      draft,
    };
  }
  try {
    const client = getStudioLocalAppClient().realm.personaCharacter;
    const profile = client.toProfileInput(current.persona.profile);
    const submitted: NimiLocalAppPersonaCharacterReplaceInput = {
      personaCharacterId: personaId,
      baseContentHash: current.persona.contentHash,
      worldId: current.persona.worldId,
      visibility: built.input.visibility,
      origin: current.persona.origin,
      profile,
    };
    const replaced = await client.replace(submitted);
    return {
      ok: true,
      source: REALM_PERSONA_VISIBILITY_SOURCE,
      lifecycleTruth: false,
      submitted: built.input,
      settings: readPersonaVisibility(replaced),
    };
  } catch (error) {
    const reason = personaCharacterFailureReason(error);
    return {
      ok: false,
      source: REALM_PERSONA_VISIBILITY_SOURCE,
      lifecycleTruth: false,
      failure: reason,
      message: reason,
      submitted: built.input,
      draft,
    };
  }
}

export async function proposeReviewedOwnerPersonaSettings(
  personaId: string,
  draft: OwnerPersonaSettingsDraft,
  current: RealmOwnerPersonaSettings,
  runner: StudioTextCandidateRunner = runStudioTextCandidate,
  personaContext?: OwnerPersonaSettingsProposalContext,
): Promise<RuntimeOwnerSettingsProposalResult> {
  if (current.id !== personaId || current.persona.id !== personaId) {
    return {
      ok: false,
      source: SETTINGS_AI_PROPOSAL_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: 'runtime-settings-proposal-payload-invalid',
      message: 'PersonaCharacter settings context identity mismatch.',
      submitted: null,
    };
  }
  const built = buildRuntimeOwnerSettingsProposalPrompt({
    personaId,
    draft,
    current,
    ...(personaContext ? { personaContext } : {}),
  });
  if (!built.ok) {
    return {
      ok: false,
      source: SETTINGS_AI_PROPOSAL_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: 'runtime-settings-proposal-payload-invalid',
      message: built.errors.join('; ') || 'Runtime settings proposal payload invalid.',
      submitted: null,
    };
  }

  try {
    const output = await runner(built.payload);
    try {
      const proposal = normalizeRuntimeOwnerSettingsProposal(output.text, draft);
      return {
        ok: true,
        source: SETTINGS_AI_PROPOSAL_SOURCE,
        candidate: true,
        truthWrite: false,
        proposal,
        submitted: output.submitted,
        runtime: {
          ...(output.traceId ? { traceId: output.traceId } : {}),
          ...(output.finishReason ? { finishReason: output.finishReason } : {}),
        },
      };
    } catch (error) {
      return {
        ok: false,
        source: SETTINGS_AI_PROPOSAL_SOURCE,
        candidate: false,
        truthWrite: false,
        failure: 'runtime-settings-proposal-invalid-output',
        message: error instanceof Error ? error.message : 'Runtime settings proposal output invalid.',
        submitted: output.submitted,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'runtime transport call failed.';
    return {
      ok: false,
      source: SETTINGS_AI_PROPOSAL_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: 'runtime-settings-proposal-failed',
      message: `Nimi App Access ai.text.generateCandidate failed: ${message}`,
      submitted: null,
    };
  }
}

export async function proposeReviewedPortfolioPersonaSettings(
  persona: OwnerPortfolioPersonaDetail,
  draft: OwnerPersonaSettingsDraft,
  current: RealmOwnerPersonaSettings,
  runner?: StudioTextCandidateRunner,
): Promise<RuntimeOwnerSettingsProposalResult> {
  return proposeReviewedOwnerPersonaSettings(
    persona.id,
    draft,
    current,
    runner,
    buildPortfolioSettingsProposalContext(persona),
  );
}
export async function updateReviewedOwnerPersonaSettings(
  personaId: string,
  draft: OwnerPersonaSettingsDraft,
  current: RealmOwnerPersonaSettings,
): Promise<RealmOwnerPersonaSettingsUpdateResult> {
  const built = buildRealmOwnerPersonaSettingsUpdateInput(draft, current);
  if (!built.ok || current.visibility === 'system' || current.id !== personaId || current.persona.id !== personaId) {
    return {
      ok: false,
      source: OWNER_SETTINGS_SAVE_SOURCE,
      truthWrite: false,
      failure: 'invalid-input',
      message: 'invalid-input',
      submitted: null,
      draft,
    };
  }
  let submitted: NimiLocalAppPersonaCharacterReplaceInput | null = null;
  try {
    const client = getStudioLocalAppClient().realm.personaCharacter;
    const profileInput = client.toProfileInput(current.profile);
    const profile = mergeOwnerSettingsProfile(profileInput, built.preview.submitted);
    submitted = buildPersonaCharacterReplaceInput(
      current,
      profile,
      current.visibility,
    );
    const replaced = await client.replace(submitted);
    return {
      ok: true,
      source: OWNER_SETTINGS_SAVE_SOURCE,
      truthWrite: true,
      submitted,
      settings: readPersonaSettings(replaced),
    };
  } catch (error) {
    const reason = personaCharacterFailureReason(error);
    return {
      ok: false,
      source: OWNER_SETTINGS_SAVE_SOURCE,
      truthWrite: false,
      failure: reason,
      message: reason,
      submitted,
      draft,
    };
  }
}

// @nimi-authority: rule.realm-persona-studio.setting.r009
export async function updateReviewedPortfolioPersonaSettings(
  persona: OwnerPortfolioPersonaDetail,
  draft: OwnerPersonaSettingsDraft,
  current: RealmOwnerPersonaSettings,
): Promise<RealmOwnerPersonaSettingsUpdateResult> {
  return updateReviewedOwnerPersonaSettings(persona.id, draft, current);
}
