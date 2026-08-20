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
import {
  runStudioImageCandidate,
  runStudioVoiceCandidate,
  type StudioImageCandidateRunner,
  type StudioMediaCandidateArtifact,
  type StudioMediaCandidateFailure,
  type StudioVoiceCandidateRunner,
} from './studio-media-candidate.js';

type RealmSelectAvatarInput = { avatarUrl: string };
type RealmSelectAvatarResponse = RealmModel<'PersonaCharacterCoreDto'>;

export const REALM_PERSONA_AVATAR_SELECT_SOURCE = 'Realm WorldCoreController.replaceRealmPersona';

export const PERSONA_AVATAR_SELECTION_AVAILABLE = false;

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
    };
  }
  | {
    ok: false;
    source: typeof VISUAL_IMAGE_GENERATION_SOURCE;
    failure:
      | 'runtime-payload-invalid'
      | 'runtime-output-missing'
      | StudioMediaCandidateFailure;
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
    };
  }
  | {
    ok: false;
    source: typeof VOICE_DEMO_SYNTHESIS_SOURCE;
    failure:
      | 'runtime-payload-invalid'
      | 'runtime-output-missing'
      | StudioMediaCandidateFailure;
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
  runner: StudioVoiceCandidateRunner = runStudioVoiceCandidate,
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

  const output = await runner(draft.payload.runtime.input);
  if (!output.ok) {
    return {
      ok: false,
      source: VOICE_DEMO_SYNTHESIS_SOURCE,
      failure: output.failure,
      message: output.message,
      draft: draft.payload,
    };
  }
  const artifactIds = artifactValues(output.artifacts, 'artifactId');
  if (artifactIds.length === 0) {
    return {
      ok: false,
      source: VOICE_DEMO_SYNTHESIS_SOURCE,
      failure: 'runtime-output-missing',
      message: 'Runtime audio.synthesize returned no artifact id.',
      draft: draft.payload,
    };
  }

  return {
    ok: true,
    source: VOICE_DEMO_SYNTHESIS_SOURCE,
    candidate: true,
    publicTruth: false,
    draft: draft.payload,
    runtime: {
      jobId: output.jobId,
      artifactIds,
      previewUrls: artifactValues(output.artifacts, 'previewUrl'),
      artifacts: output.artifacts,
      ...(output.traceId ? { traceId: output.traceId } : {}),
    },
  };
}

export async function generateReviewedVisualImageCandidate(
  input: VisualImageGenerationInput,
  persona: OwnerPortfolioPersonaDetail,
  runner: StudioImageCandidateRunner = runStudioImageCandidate,
): Promise<RuntimeVisualImageGenerationResult> {
  const draft = buildReviewedVisualImageCandidatePayload(input, persona);
  return runReviewedImageCandidate(
    draft,
    'Runtime image.generate scenario payload invalid.',
    runner,
  );
}

export async function generateReviewedAvatarPackageCandidate(
  input: AvatarPackageCandidateInput,
  persona: OwnerPortfolioPersonaDetail,
  runner: StudioImageCandidateRunner = runStudioImageCandidate,
): Promise<RuntimeVisualImageGenerationResult> {
  const draft = buildReviewedAvatarPackageCandidatePayload(input, persona);
  return runReviewedImageCandidate(
    draft,
    'Runtime avatar package image.generate scenario payload invalid.',
    runner,
  );
}

async function runReviewedImageCandidate(
  draft: ReturnType<typeof buildReviewedVisualImageCandidatePayload>
    | ReturnType<typeof buildReviewedAvatarPackageCandidatePayload>,
  invalidMessage: string,
  runner: StudioImageCandidateRunner,
): Promise<RuntimeVisualImageGenerationResult> {
  if (!draft.payload) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: 'runtime-payload-invalid',
      message: draft.errors.join('; ') || invalidMessage,
      draft: null,
    };
  }

  const output = await runner(draft.payload.runtime.input);
  if (!output.ok) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: output.failure,
      message: output.message,
      draft: draft.payload,
    };
  }
  const previewUrls = artifactValues(output.artifacts, 'previewUrl');
  const artifactUris = artifactValues(output.artifacts, 'publicUri');
  if (previewUrls.length === 0 && artifactUris.length === 0) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: 'runtime-output-missing',
      message: 'Runtime image.generate returned no readable artifact.',
      draft: draft.payload,
    };
  }

  return {
    ok: true,
    source: VISUAL_IMAGE_GENERATION_SOURCE,
    candidate: true,
    publicTruth: false,
    draft: draft.payload,
    runtime: {
      jobId: output.jobId,
      artifactIds: artifactValues(output.artifacts, 'artifactId'),
      artifactUris,
      previewUrls,
      artifacts: output.artifacts,
      ...(output.traceId ? { traceId: output.traceId } : {}),
    },
  };
}

function artifactValues(
  artifacts: readonly StudioMediaCandidateArtifact[],
  field: 'artifactId' | 'publicUri' | 'previewUrl',
): string[] {
  return [...new Set(artifacts.flatMap((artifact) => {
    const value = artifact[field];
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  }))];
}
