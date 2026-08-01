import type {
  RealmModel,
} from '@nimiplatform/sdk/realm/generated';
import type { Runtime } from '@nimiplatform/sdk/runtime';
import type { ExecuteScenarioResponse, ScenarioArtifact } from '@nimiplatform/sdk/runtime/generated';
import { createStudioRealmClient, type StudioRealmSurface } from '@renderer/data/realm-client.js';
import { createStudioRuntimeClient } from '@renderer/data/runtime-client.js';
import {
  bindStudioImageGeneratePayload,
  bindStudioSpeechSynthesizePayload,
  executeStudioImageGenerate,
  executeStudioSpeechSynthesize,
  isStudioAIRouteBindingFailure,
  normalizeStudioImageGenerateFailureMessage,
} from './studio-ai-runtime.js';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  VISUAL_IMAGE_GENERATION_SOURCE,
  VOICE_DEMO_SYNTHESIS_SOURCE,
  buildReviewedAvatarPackageCandidatePayload,
  buildReviewedAvatarPackageImageGenerationPayload,
  buildReviewedVisualImageCandidatePayload,
  buildReviewedVisualImageGenerationPayload,
  buildReviewedVoiceDemoCandidatePayload,
  buildReviewedVoiceSynthesisPayload,
  type AvatarPackageCandidateInput,
  type ReviewedAvatarPackageCandidatePayload,
  type ReviewedVisualImageCandidatePayload,
  type ReviewedVoiceDemoCandidatePayload,
  type VisualImageGenerationInput,
  type VoiceDemoCandidateInput,
} from './media-voice-candidate.js';
import {
  projectStudioRuntimeArtifacts,
  type StudioRuntimeArtifactProjection,
} from './runtime-artifact-projection.js';

type StudioRealmClient = StudioRealmSurface;

type RealmSelectAvatarInput = { avatarUrl: string };
type RealmSelectAvatarResponse = RealmModel<'PersonaCharacterCoreDto'>;

export const REALM_PERSONA_AVATAR_SELECT_SOURCE = 'Realm WorldCoreController.replaceRealmPersona';

type RuntimeVoiceClient = Runtime;
type RuntimeImageClient = Runtime;

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
      artifacts: StudioRuntimeArtifactProjection[];
      traceId?: string;
      modelResolved?: string;
    };
  }
  | {
    ok: false;
    source: typeof VISUAL_IMAGE_GENERATION_SOURCE;
    failure:
      | 'runtime-payload-invalid'
      | 'runtime-transport-unavailable'
      | 'runtime-route-unbound'
      | 'runtime-generate-failed'
      | 'runtime-output-missing';
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
      artifacts: StudioRuntimeArtifactProjection[];
      traceId?: string;
      modelResolved?: string;
    };
  }
  | {
    ok: false;
    source: typeof VOICE_DEMO_SYNTHESIS_SOURCE;
    failure:
      | 'runtime-payload-invalid'
      | 'runtime-transport-unavailable'
      | 'runtime-route-unbound'
      | 'runtime-synthesize-failed'
      | 'runtime-output-missing';
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

async function normalizeRuntimeVoiceDemoSynthesisOutput(
  runtime: Runtime,
  output: ExecuteScenarioResponse,
  draft: ReviewedVoiceDemoCandidatePayload,
): Promise<RuntimeVoiceDemoSynthesisResult> {
  const scenarioOutput = output.output?.output;
  const artifacts: readonly ScenarioArtifact[] = scenarioOutput?.oneofKind === 'speechSynthesize'
    ? scenarioOutput.speechSynthesize.artifacts
    : [];
  const projectedArtifacts = await projectStudioRuntimeArtifacts(runtime, artifacts);
  const artifactIds = projectedArtifacts
    .map((artifact) => artifact.artifactId)
    .filter((artifactId): artifactId is string => Boolean(artifactId));
  const previewUrls = projectedArtifacts
    .map((artifact) => artifact.previewUrl)
    .filter((previewUrl): previewUrl is string => Boolean(previewUrl));

  if (artifactIds.length === 0) {
    return {
      ok: false,
      source: VOICE_DEMO_SYNTHESIS_SOURCE,
      failure: 'runtime-output-missing',
      message: 'Runtime speechSynthesize scenario output missing artifact id.',
      draft,
    };
  }

  return {
    ok: true,
    source: VOICE_DEMO_SYNTHESIS_SOURCE,
    candidate: true,
    publicTruth: false,
    draft,
    runtime: {
      artifactIds,
      previewUrls,
      artifacts: projectedArtifacts,
      ...(output.traceId ? { traceId: output.traceId } : {}),
      ...(output.modelResolved ? { modelResolved: output.modelResolved } : {}),
    },
  };
}

async function normalizeRuntimeVisualImageGenerationOutput(
  runtime: Runtime,
  output: ExecuteScenarioResponse,
  draft: ReviewedVisualImageCandidatePayload | ReviewedAvatarPackageCandidatePayload,
): Promise<RuntimeVisualImageGenerationResult> {
  const scenarioOutput = output.output?.output;
  const artifacts: readonly ScenarioArtifact[] = scenarioOutput?.oneofKind === 'imageGenerate'
    ? scenarioOutput.imageGenerate.artifacts
    : [];
  const projectedArtifacts = await projectStudioRuntimeArtifacts(runtime, artifacts);
  const artifactIds = projectedArtifacts
    .map((artifact) => artifact.artifactId)
    .filter((artifactId): artifactId is string => Boolean(artifactId));
  const artifactUris = projectedArtifacts
    .map((artifact) => artifact.publicUri)
    .filter((uri): uri is string => Boolean(uri));
  const previewUrls = projectedArtifacts
    .map((artifact) => artifact.previewUrl)
    .filter((previewUrl): previewUrl is string => Boolean(previewUrl));

  if (projectedArtifacts.length === 0) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: 'runtime-output-missing',
      message: 'Runtime imageGenerate scenario output missing readable artifact.',
      draft,
    };
  }

  return {
    ok: true,
    source: VISUAL_IMAGE_GENERATION_SOURCE,
    candidate: true,
    publicTruth: false,
    draft,
    runtime: {
      artifactIds,
      artifactUris,
      previewUrls,
      artifacts: projectedArtifacts,
      ...(output.traceId ? { traceId: output.traceId } : {}),
      ...(output.modelResolved ? { modelResolved: output.modelResolved } : {}),
    },
  };
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

function withSelectedAvatarExternalRef(
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
  personaId: string,
  avatarUrl: string,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmPersonaAvatarSelectResult> {
  const submitted = buildRealmSelectAvatarInput(avatarUrl);
  if (!submitted) {
    return {
      ok: false,
      source: REALM_PERSONA_AVATAR_SELECT_SOURCE,
      publicTruth: false,
      failure: 'avatar-url-invalid',
      message: 'Avatar URL selection requires a valid http(s) URL.',
      submitted: null,
    };
  }

  try {
    const current = await realm.worldCoreControllerGetPersonaCharacter({ path: { personaCharacterId: personaId } });
    const response = await realm.worldCoreControllerReplacePersonaCharacter({
      path: { personaCharacterId: personaId },
      body: {
        baseContentHash: current.contentHash,
        worldId: current.worldId,
        origin: current.origin,
        profile: withSelectedAvatarExternalRef(current.profile, submitted.avatarUrl),
      },
    });
    return normalizeRealmPersonaAvatarSelectResult(response, submitted);
  } catch (error) {
    return {
      ok: false,
      source: REALM_PERSONA_AVATAR_SELECT_SOURCE,
      publicTruth: false,
      failure: 'realm-select-avatar-failed',
      message: error instanceof Error ? error.message : 'Realm avatar selection failed.',
      submitted,
    };
  }
}
export async function synthesizeReviewedVoiceDemo(
  input: VoiceDemoCandidateInput,
  persona: OwnerPortfolioPersonaDetail,
  runtime?: RuntimeVoiceClient | null,
): Promise<RuntimeVoiceDemoSynthesisResult> {
  const draft = buildReviewedVoiceDemoCandidatePayload(input, persona);
  const synthesisPayload = buildReviewedVoiceSynthesisPayload(input);

  if (!draft.payload || !synthesisPayload.payload) {
    return {
      ok: false,
      source: VOICE_DEMO_SYNTHESIS_SOURCE,
      failure: 'runtime-payload-invalid',
      message: synthesisPayload.errors.join('; ') || 'Runtime speechSynthesize scenario payload invalid.',
      draft: draft.payload,
    };
  }

  const runtimeClient = runtime === undefined ? await createStudioRuntimeClient() : runtime;

  if (!runtimeClient) {
    return {
      ok: false,
      source: VOICE_DEMO_SYNTHESIS_SOURCE,
      failure: 'runtime-transport-unavailable',
      message: 'Runtime speechSynthesize scenario transport unavailable: Tauri IPC runtime transport is required.',
      draft: draft.payload,
    };
  }

  try {
    const boundPayload = await bindStudioSpeechSynthesizePayload(synthesisPayload.payload, runtimeClient);
    const boundDraft = {
      ...draft.payload,
      runtime: {
        ...draft.payload.runtime,
        request: boundPayload,
      },
    };
    const output = await executeStudioSpeechSynthesize(boundPayload, runtimeClient);
    return await normalizeRuntimeVoiceDemoSynthesisOutput(runtimeClient, output, boundDraft);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'runtime transport call failed.';
    const routeUnbound = isStudioAIRouteBindingFailure(error);
    return {
      ok: false,
      source: VOICE_DEMO_SYNTHESIS_SOURCE,
      failure: routeUnbound ? 'runtime-route-unbound' : 'runtime-synthesize-failed',
      message: routeUnbound ? message : `Runtime speechSynthesize scenario failed: ${message}`,
      draft: draft.payload,
    };
  }
}
export async function generateReviewedVisualImageCandidate(
  input: VisualImageGenerationInput,
  persona: OwnerPortfolioPersonaDetail,
  runtime?: RuntimeImageClient | null,
): Promise<RuntimeVisualImageGenerationResult> {
  const draft = buildReviewedVisualImageCandidatePayload(input, persona);
  const imagePayload = buildReviewedVisualImageGenerationPayload(input, persona);

  if (!draft.payload || !imagePayload.payload) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: 'runtime-payload-invalid',
      message: imagePayload.errors.join('; ') || 'Runtime imageGenerate scenario payload invalid.',
      draft: draft.payload,
    };
  }

  const runtimeClient = runtime === undefined ? await createStudioRuntimeClient() : runtime;

  if (!runtimeClient) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: 'runtime-transport-unavailable',
      message: 'Runtime imageGenerate scenario transport unavailable: Tauri IPC runtime transport is required.',
      draft: draft.payload,
    };
  }

  try {
    const boundPayload = await bindStudioImageGeneratePayload(imagePayload.payload, runtimeClient);
    const boundDraft = {
      ...draft.payload,
      runtime: {
        ...draft.payload.runtime,
        request: boundPayload,
      },
    };
    const output = await executeStudioImageGenerate(boundPayload, runtimeClient);
    return await normalizeRuntimeVisualImageGenerationOutput(runtimeClient, output, boundDraft);
  } catch (error) {
    const message = normalizeStudioImageGenerateFailureMessage(error);
    const routeUnbound = isStudioAIRouteBindingFailure(error);
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: routeUnbound ? 'runtime-route-unbound' : 'runtime-generate-failed',
      message: routeUnbound ? message : `Runtime imageGenerate scenario failed: ${message}`,
      draft: draft.payload,
    };
  }
}

export async function generateReviewedAvatarPackageCandidate(
  input: AvatarPackageCandidateInput,
  persona: OwnerPortfolioPersonaDetail,
  runtime?: RuntimeImageClient | null,
): Promise<RuntimeVisualImageGenerationResult> {
  const draft = buildReviewedAvatarPackageCandidatePayload(input, persona);
  const imagePayload = buildReviewedAvatarPackageImageGenerationPayload(input, persona);

  if (!draft.payload || !imagePayload.payload) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: 'runtime-payload-invalid',
      message: imagePayload.errors.join('; ') || 'Runtime avatar package imageGenerate scenario payload invalid.',
      draft: draft.payload,
    };
  }

  const runtimeClient = runtime === undefined ? await createStudioRuntimeClient() : runtime;

  if (!runtimeClient) {
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: 'runtime-transport-unavailable',
      message: 'Runtime avatar package imageGenerate scenario transport unavailable: Tauri IPC runtime transport is required.',
      draft: draft.payload,
    };
  }

  try {
    const boundPayload = await bindStudioImageGeneratePayload(imagePayload.payload, runtimeClient);
    const boundDraft = {
      ...draft.payload,
      runtime: {
        ...draft.payload.runtime,
        request: boundPayload,
      },
    };
    const output = await executeStudioImageGenerate(boundPayload, runtimeClient);
    return await normalizeRuntimeVisualImageGenerationOutput(runtimeClient, output, boundDraft);
  } catch (error) {
    const message = normalizeStudioImageGenerateFailureMessage(error);
    const routeUnbound = isStudioAIRouteBindingFailure(error);
    return {
      ok: false,
      source: VISUAL_IMAGE_GENERATION_SOURCE,
      failure: routeUnbound ? 'runtime-route-unbound' : 'runtime-generate-failed',
      message: routeUnbound ? message : `Runtime avatar package imageGenerate scenario failed: ${message}`,
      draft: draft.payload,
    };
  }
}
