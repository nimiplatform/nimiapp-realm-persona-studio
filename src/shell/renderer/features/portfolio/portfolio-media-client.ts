import type {
  NimiLocalAppPersonaCharacter,
  NimiLocalAppPersonaCharacterFailureReason,
  NimiLocalAppPersonaCharacterProfileInput,
} from '@nimiplatform/sdk/app';
import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';
import {
  personaCharacterFailureReason,
  type OwnerPortfolioPersonaDetail,
} from './portfolio-data.js';
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
import { normalizeDisplaySafeHttpsUrl } from './persona-external-ref.js';

type RealmSelectAvatarInput = { avatarUrl: string };
type RealmSelectAvatarResponse = NimiLocalAppPersonaCharacter;

export const REALM_PERSONA_AVATAR_SELECT_SOURCE = 'Nimi App Access realm.personaCharacter.replace';

export const PERSONA_AVATAR_SELECTION_AVAILABLE = true;

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
    failure: NimiLocalAppPersonaCharacterFailureReason;
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
  return normalizeDisplaySafeHttpsUrl(value.trim());
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
      failure: 'contract-invalid',
      message: 'contract-invalid',
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
  profile: NimiLocalAppPersonaCharacterProfileInput,
  avatarUrl: string,
): NimiLocalAppPersonaCharacterProfileInput {
  const existingRefs = profile.assets.externalRefs ?? [];
  const retainedRefs = existingRefs.filter((entry) => asRecord(entry).kind !== 'avatar');
  return {
    ...profile,
    assets: {
      ...profile.assets,
      externalRefs: [
        ...retainedRefs,
        {
          refId: 'selected-avatar',
          kind: 'avatar',
          uri: avatarUrl,
          purpose: 'profile-avatar',
        },
      ],
    },
  };
}

// @nimi-authority: rule.realm-persona-studio.asset.r004
export async function selectReviewedPersonaAvatarUrl(
  persona: OwnerPortfolioPersonaDetail,
  avatarUrl: string,
): Promise<RealmPersonaAvatarSelectResult> {
  const submitted = buildRealmSelectAvatarInput(avatarUrl);
  if (!submitted) {
    return {
      ok: false,
      source: REALM_PERSONA_AVATAR_SELECT_SOURCE,
      publicTruth: false,
      failure: 'invalid-input',
      message: 'invalid-input',
      submitted: null,
    };
  }
  const current = persona.canonical;
  if (!current || current.id !== persona.id || current.visibility === 'system') {
    return {
      ok: false,
      source: REALM_PERSONA_AVATAR_SELECT_SOURCE,
      publicTruth: false,
      failure: 'contract-invalid',
      message: 'contract-invalid',
      submitted,
    };
  }
  try {
    const client = getStudioLocalAppClient().realm.personaCharacter;
    const profile = withSelectedAvatarExternalRef(client.toProfileInput(current.profile), submitted.avatarUrl);
    if (!current.lorebookDeclaration) throw new Error('Character lorebook declaration is required before replace.');
    const replaced = await client.replace({
      personaCharacterId: current.id,
      baseContentHash: current.contentHash,
      worldId: current.worldId,
      visibility: current.visibility,
      origin: current.origin,
      lorebookDeclaration: current.lorebookDeclaration,
      profile,
    });
    return normalizeRealmPersonaAvatarSelectResult(replaced, submitted);
  } catch (error) {
    const reason = personaCharacterFailureReason(error);
    return {
      ok: false,
      source: REALM_PERSONA_AVATAR_SELECT_SOURCE,
      publicTruth: false,
      failure: reason,
      message: reason,
      submitted,
    };
  }
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
