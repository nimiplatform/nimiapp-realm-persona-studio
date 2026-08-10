import type {
  RealmModel,
} from '@nimiplatform/sdk/realm/generated';
import { requireStudioProtectedOperation } from '@renderer/app-shell/studio-platform.js';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  VISUAL_IMAGE_GENERATION_SOURCE,
  VOICE_DEMO_SYNTHESIS_SOURCE,
  buildReviewedAvatarPackageCandidatePayload,
  buildReviewedVisualImageCandidatePayload,
  buildReviewedVoiceDemoCandidatePayload,
  type AvatarPackageCandidateInput,
  type ReviewedAvatarPackageCandidatePayload,
  type ReviewedVisualImageCandidatePayload,
  type ReviewedVoiceDemoCandidatePayload,
  type VisualImageGenerationInput,
  type VoiceDemoCandidateInput,
} from './media-voice-candidate.js';

type RealmSelectAvatarInput = { avatarUrl: string };
type RealmSelectAvatarResponse = RealmModel<'PersonaCharacterCoreDto'>;

export const REALM_PERSONA_AVATAR_SELECT_SOURCE = 'Realm WorldCoreController.replaceRealmPersona';

/**
 * The Nimi local App surface does not expose media candidate generation yet,
 * so Studio media candidates fail closed with a typed unavailability result
 * instead of a Runtime scenario dispatch.
 */
export const RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE = 'The Nimi local app surface does not provide this candidate generation capability yet.';
export const PERSONA_AVATAR_SELECTION_AVAILABLE = false;

export type StudioMediaCandidateArtifact = {
  artifactId?: string;
  mimeType?: string;
  publicUri?: string;
  previewUrl?: string;
  sizeBytes?: string;
};

export type RealmPersonaAvatarSelectResult =
  | {
    ok: true;
    source: typeof REALM_PERSONA_AVATAR_SELECT_SOURCE;
    publicTruth: true;
    submitted: RealmSelectAvatarInput;
    realm: {
      success: true;
    };
  }
  | {
    ok: false;
    source: typeof REALM_PERSONA_AVATAR_SELECT_SOURCE;
    publicTruth: false;
    failure: 'avatar-url-invalid' | 'realm-select-avatar-failed' | 'realm-select-avatar-rejected';
    message: string;
    submitted: RealmSelectAvatarInput | null;
  };

export type RuntimeVisualImageGenerationResult =
  | {
    ok: true;
    source: typeof VISUAL_IMAGE_GENERATION_SOURCE;
    candidate: true;
    publicTruth: false;
    draft: ReviewedVisualImageCandidatePayload | ReviewedAvatarPackageCandidatePayload;
    runtime: {
      jobId?: string;
      artifactIds: string[];
      artifactUris: string[];
      previewUrls: string[];
      artifacts: StudioMediaCandidateArtifact[];
      traceId?: string;
      modelResolved?: string;
    };
  }
  | {
    ok: false;
    source: typeof VISUAL_IMAGE_GENERATION_SOURCE;
    failure:
      | 'runtime-payload-invalid'
      | 'runtime-media-candidate-unavailable';
    message: string;
    draft: ReviewedVisualImageCandidatePayload | ReviewedAvatarPackageCandidatePayload | null;
  };

export type RuntimeVoiceDemoSynthesisResult =
  | {
    ok: true;
    source: typeof VOICE_DEMO_SYNTHESIS_SOURCE;
    candidate: true;
    publicTruth: false;
    draft: ReviewedVoiceDemoCandidatePayload;
    runtime: {
      jobId?: string;
      artifactIds: string[];
      previewUrls: string[];
      artifacts: StudioMediaCandidateArtifact[];
      traceId?: string;
      modelResolved?: string;
    };
  }
  | {
    ok: false;
    source: typeof VOICE_DEMO_SYNTHESIS_SOURCE;
    failure:
      | 'runtime-payload-invalid'
      | 'runtime-media-candidate-unavailable';
    message: string;
    draft: ReviewedVoiceDemoCandidatePayload | null;
  };

function normalizeAvatarUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function buildRealmSelectAvatarInput(avatarUrl: string): RealmSelectAvatarInput | null {
  const normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl);
  if (!normalizedAvatarUrl) {
    return null;
  }

  return {
    avatarUrl: normalizedAvatarUrl,
  };
}

export function normalizeRealmPersonaAvatarSelectResult(
  response: RealmSelectAvatarResponse,
  submitted: RealmSelectAvatarInput,
): RealmPersonaAvatarSelectResult {
  const core = response && typeof response === 'object' && response.profile && typeof response.profile === 'object'
    ? response.profile as unknown as Record<string, unknown>
    : {};
  if (!coreHasExternalRef(core, 'avatar', submitted.avatarUrl)) {
    return {
      ok: false,
      source: REALM_PERSONA_AVATAR_SELECT_SOURCE,
      publicTruth: false,
      failure: 'realm-select-avatar-rejected',
      message: 'RealmPersona replacement did not persist the reviewed avatar external ref.',
      submitted,
    };
  }

  return {
    ok: true,
    source: REALM_PERSONA_AVATAR_SELECT_SOURCE,
    publicTruth: true,
    submitted,
    realm: {
      success: true,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function coreHasExternalRef(core: Record<string, unknown>, kind: string, uri: string): boolean {
  const assets = asRecord(core.assets);
  const refs = Array.isArray(assets.externalRefs) ? assets.externalRefs : [];
  return refs.some((entry) => {
    const record = asRecord(entry);
    return record.kind === kind && record.uri === uri;
  });
}

export function withSelectedAvatarExternalRef(
  profile: RealmModel<'PersonaCharacterCoreDto'>['profile'],
  avatarUrl: string,
): RealmModel<'CharacterProfileCoreInputDto'> {
  const assets = asRecord(profile.assets);
  const existingRefs = Array.isArray(assets.externalRefs) ? assets.externalRefs : [];
  const retainedRefs = existingRefs.filter((entry) => asRecord(entry).kind !== 'avatar');
  return {
    assets: {
      ...assets,
      resourceRefs: Array.isArray(assets.resourceRefs) ? assets.resourceRefs : [],
      externalRefs: [
        ...retainedRefs,
        {
          refId: 'selected-avatar',
          kind: 'avatar',
          uri: avatarUrl,
          purpose: 'profile-avatar',
        },
      ],
      intents: Array.isArray(assets.intents) ? assets.intents : [],
    },
    authoring: asRecord(profile.authoring),
    ...(profile.capabilities ? { capabilities: asRecord(profile.capabilities) } : {}),
    identity: asRecord(profile.identity),
    interactionProfile: asRecord(profile.interactionProfile),
    ...(profile.knowledge ? { knowledge: asRecord(profile.knowledge) } : {}),
    narrative: asRecord(profile.narrative),
    presentation: asRecord(profile.presentation),
    ...(profile.psychology ? { psychology: asRecord(profile.psychology) } : {}),
    ...(profile.relationships
      ? { relationships: profile.relationships.map((relationship) => asRecord(relationship)) }
      : {}),
    profileSchemaVersion: profile.profileSchemaVersion,
  };
}

export async function selectReviewedPersonaAvatarUrl(
  _personaId: string,
  _avatarUrl: string,
): Promise<RealmPersonaAvatarSelectResult> {
  requireStudioProtectedOperation('Reviewed Realm Persona avatar selection');
}

export async function synthesizeReviewedVoiceDemo(
  input: VoiceDemoCandidateInput,
  persona: OwnerPortfolioPersonaDetail,
): Promise<RuntimeVoiceDemoSynthesisResult> {
  const draft = buildReviewedVoiceDemoCandidatePayload(input, persona);

  if (!draft.payload) {
    return {
      ok: false,
      source: VOICE_DEMO_SYNTHESIS_SOURCE,
      failure: 'runtime-payload-invalid',
      message: draft.errors.join('; ') || 'Runtime speechSynthesize scenario payload invalid.',
      draft: null,
    };
  }

  return {
    ok: false,
    source: VOICE_DEMO_SYNTHESIS_SOURCE,
    failure: 'runtime-media-candidate-unavailable',
    message: RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE,
    draft: draft.payload,
  };
}

export async function generateReviewedVisualImageCandidate(
  input: VisualImageGenerationInput,
  persona: OwnerPortfolioPersonaDetail,
): Promise<RuntimeVisualImageGenerationResult> {
  const draft = buildReviewedVisualImageCandidatePayload(input, persona);

  if (!draft.payload) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: 'runtime-payload-invalid',
      message: draft.errors.join('; ') || 'Runtime imageGenerate scenario payload invalid.',
      draft: null,
    };
  }

  return {
    ok: false,
    source: VISUAL_IMAGE_GENERATION_SOURCE,
    failure: 'runtime-media-candidate-unavailable',
    message: RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE,
    draft: draft.payload,
  };
}

export async function generateReviewedAvatarPackageCandidate(
  input: AvatarPackageCandidateInput,
  persona: OwnerPortfolioPersonaDetail,
): Promise<RuntimeVisualImageGenerationResult> {
  const draft = buildReviewedAvatarPackageCandidatePayload(input, persona);

  if (!draft.payload) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: 'runtime-payload-invalid',
      message: draft.errors.join('; ') || 'Runtime avatar package imageGenerate scenario payload invalid.',
      draft: null,
    };
  }

  return {
    ok: false,
    source: VISUAL_IMAGE_GENERATION_SOURCE,
    failure: 'runtime-media-candidate-unavailable',
    message: RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE,
    draft: draft.payload,
  };
}
