import {
  createNimiLocalAppRuntimeScenarioJobClient,
  type NimiLocalAppClient,
} from '@nimiplatform/sdk/app';
import {
  runRuntimeImageGenerate,
  runRuntimeSpeechSynthesize,
  type RuntimeImageGenerateResult,
  type RuntimeSpeechSynthesizeResult,
} from '@nimiplatform/kit/features/generation/runtime';
import { STUDIO_RUNTIME_APP_ID, getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';
import type {
  StudioImageCandidatePreview,
  StudioVoiceCandidatePreview,
} from './media-voice-candidate.js';

// @nimi-authority: rule.realm-persona-studio.runtime-ai.r001
// @nimi-authority: rule.realm-persona-studio.runtime-ai.r007
// @nimi-authority: rule.realm-persona-studio.runtime-ai.r010

export type StudioMediaCandidateArtifact = {
  artifactId?: string;
  mimeType?: string;
  publicUri?: string;
  previewUrl?: string;
  sizeBytes?: string;
};

export type StudioMediaCandidateFailure =
  | 'runtime-payload-invalid'
  | 'runtime-capability-unavailable'
  | 'runtime-route-unbound'
  | 'runtime-transport-unavailable'
  | 'runtime-output-malformed'
  | 'runtime-call-failed';

export type StudioMediaCandidateExecutionResult =
  | {
      ok: true;
      jobId: string;
      artifacts: StudioMediaCandidateArtifact[];
      traceId?: string;
    }
  | {
      ok: false;
      failure: StudioMediaCandidateFailure;
      message: string;
    };

export type StudioImageCandidateRunner = (
  input: StudioImageCandidatePreview,
) => Promise<StudioMediaCandidateExecutionResult>;

export type StudioVoiceCandidateRunner = (
  input: StudioVoiceCandidatePreview,
) => Promise<StudioMediaCandidateExecutionResult>;

type StudioAIConsumptionClient = Pick<NimiLocalAppClient, 'ai'>;
type ScenarioJobClientFactory = typeof createNimiLocalAppRuntimeScenarioJobClient;
type ImageGenerate = typeof runRuntimeImageGenerate;
type SpeechSynthesize = typeof runRuntimeSpeechSynthesize;

export type StudioMediaCandidateRunnerDependencies = {
  client: StudioAIConsumptionClient;
  createScenarioJobClient?: ScenarioJobClientFactory;
  imageGenerate?: ImageGenerate;
  speechSynthesize?: SpeechSynthesize;
};

export function createStudioMediaCandidateRunners(
  dependencies: StudioMediaCandidateRunnerDependencies,
): {
  image: StudioImageCandidateRunner;
  voice: StudioVoiceCandidateRunner;
} {
  const scenarioJobs = (dependencies.createScenarioJobClient ?? createNimiLocalAppRuntimeScenarioJobClient)(
    dependencies.client.ai,
  );
  const imageGenerate = dependencies.imageGenerate ?? runRuntimeImageGenerate;
  const speechSynthesize = dependencies.speechSynthesize ?? runRuntimeSpeechSynthesize;

  return Object.freeze({
    image: async (input) => {
      const result = await imageGenerate({
        runtime: { ai: scenarioJobs },
        appId: STUDIO_RUNTIME_APP_ID,
        prompt: input.prompt,
        ...(input.count !== undefined ? { count: input.count } : {}),
        ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
        scenarioId: input.surfaceId,
        surfaceId: input.surfaceId,
      });
      return projectImageResult(result, dependencies.client);
    },
    voice: async (input) => {
      const result = await speechSynthesize({
        runtime: { ai: scenarioJobs },
        appId: STUDIO_RUNTIME_APP_ID,
        text: input.text,
        scenarioId: input.surfaceId,
        surfaceId: input.surfaceId,
      });
      return projectSpeechResult(result, dependencies.client);
    },
  });
}

export async function runStudioImageCandidate(
  input: StudioImageCandidatePreview,
): Promise<StudioMediaCandidateExecutionResult> {
  return createStudioMediaCandidateRunners({ client: getStudioLocalAppClient() }).image(input);
}

export async function runStudioVoiceCandidate(
  input: StudioVoiceCandidatePreview,
): Promise<StudioMediaCandidateExecutionResult> {
  return createStudioMediaCandidateRunners({ client: getStudioLocalAppClient() }).voice(input);
}

async function projectImageResult(
  result: RuntimeImageGenerateResult,
  client: StudioAIConsumptionClient,
): Promise<StudioMediaCandidateExecutionResult> {
  if (!result.ok) return projectFailure(result);
  try {
    const artifacts = await Promise.all(result.output.artifacts.map((artifact) => (
      projectArtifact(artifact, client, 'image/')
    )));
    if (artifacts.length === 0 || artifacts.every((artifact) => !artifact.previewUrl && !artifact.publicUri)) {
      return {
        ok: false,
        failure: 'runtime-output-malformed',
        message: 'Runtime image.generate returned no readable artifact.',
      };
    }
    return {
      ok: true,
      jobId: result.output.jobId,
      artifacts,
      ...(result.trace?.traceId ? { traceId: result.trace.traceId } : {}),
    };
  } catch (error) {
    return projectThrownFailure(error);
  }
}

async function projectSpeechResult(
  result: RuntimeSpeechSynthesizeResult,
  client: StudioAIConsumptionClient,
): Promise<StudioMediaCandidateExecutionResult> {
  if (!result.ok) return projectFailure(result);
  try {
    const artifacts = await Promise.all(result.output.artifacts.map((artifact) => (
      projectArtifact(artifact, client, 'audio/')
    )));
    if (artifacts.length === 0 || artifacts.every((artifact) => !artifact.artifactId)) {
      return {
        ok: false,
        failure: 'runtime-output-malformed',
        message: 'Runtime audio.synthesize returned no readable artifact.',
      };
    }
    return {
      ok: true,
      jobId: result.output.jobId,
      artifacts,
      ...(result.trace?.traceId ? { traceId: result.trace.traceId } : {}),
    };
  } catch (error) {
    return projectThrownFailure(error);
  }
}

async function projectArtifact(
  artifact: {
    readonly artifactId?: string;
    readonly mimeType: string;
    readonly uri?: string;
    readonly previewUrl?: string;
    readonly sizeBytes?: number;
  },
  client: StudioAIConsumptionClient,
  expectedMimePrefix: 'image/' | 'audio/',
): Promise<StudioMediaCandidateArtifact> {
  const artifactId = artifact.artifactId?.trim() || '';
  const publicUri = normalizeHttpUrl(artifact.uri);
  let mimeType = artifact.mimeType.trim();
  let previewUrl = normalizePreviewUrl(artifact.previewUrl);
  let sizeBytes = artifact.sizeBytes;

  if (!previewUrl && artifactId) {
    const read = await client.ai.artifacts.read(artifactId);
    mimeType = read.mimeType.trim();
    sizeBytes = read.sizeBytes;
    if (!mimeType.startsWith(expectedMimePrefix) || read.bytes.byteLength === 0) {
      throw Object.assign(new Error(`Runtime artifact ${artifactId} is not a readable ${expectedMimePrefix} candidate.`), {
        reasonCode: 'SDK_LOCAL_APP_PROJECTION_INVALID',
      });
    }
    previewUrl = bytesToDataUrl(read.bytes, mimeType);
  }

  if (mimeType && !mimeType.startsWith(expectedMimePrefix)) {
    throw Object.assign(new Error(`Runtime artifact MIME type must start with ${expectedMimePrefix}.`), {
      reasonCode: 'SDK_LOCAL_APP_PROJECTION_INVALID',
    });
  }

  return {
    ...(artifactId ? { artifactId } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(publicUri ? { publicUri } : {}),
    ...(previewUrl ? { previewUrl } : {}),
    ...(sizeBytes !== undefined && sizeBytes >= 0 ? { sizeBytes: String(sizeBytes) } : {}),
  };
}

function projectFailure(
  result: Extract<RuntimeImageGenerateResult | RuntimeSpeechSynthesizeResult, { ok: false }>,
): StudioMediaCandidateExecutionResult {
  return {
    ok: false,
    failure: classifyFailure(result.error, result.reason),
    message: result.message,
  };
}

function projectThrownFailure(error: unknown): StudioMediaCandidateExecutionResult {
  return {
    ok: false,
    failure: classifyFailure(error),
    message: error instanceof Error ? error.message : 'Runtime media candidate projection failed.',
  };
}

function classifyFailure(error: unknown, runnerReason = ''): StudioMediaCandidateFailure {
  const reasonCode = errorReasonCode(error);
  if (runnerReason === 'input-invalid' || [
    'AI_INPUT_INVALID',
    'AI_MEDIA_OPTION_UNSUPPORTED',
    'AI_MEDIA_SPEC_INVALID',
    'SDK_AI_INPUT_INVALID',
  ].includes(reasonCode)) {
    return 'runtime-payload-invalid';
  }
  if ([
    'AI_CONFIG_NOT_FOUND',
    'AI_LOCAL_CONFIGURATION_NOT_CONFIGURED',
    'AI_LOCAL_SELECTION_NOT_FOUND',
    'AI_LOCAL_CAPABILITY_MISMATCH',
    'AI_LOADOUT_NOT_FOUND',
    'AI_LOADOUT_DRIVER_UNAVAILABLE',
    'AI_LOADOUT_MODEL_ASSET_NOT_FOUND',
    'AI_LOADOUT_MODEL_ASSET_CONTENT_MISMATCH',
    'AI_LOADOUT_MODEL_CONTRACT_FAILED',
    'AI_LOADOUT_NOT_CONFIGURED',
    'AI_MODEL_NOT_READY',
    'AI_ROUTE_UNSUPPORTED',
  ].includes(reasonCode)) {
    return 'runtime-route-unbound';
  }
  if ([
    'AUTH_CONTEXT_MISSING',
    'PRINCIPAL_UNAUTHORIZED',
    'SESSION_EXPIRED',
    'APP_TOKEN_EXPIRED',
    'APP_TOKEN_REVOKED',
    'LOCAL_APP_OPERATION_UNAVAILABLE',
    'LOCAL_APP_OWNER_UNAVAILABLE',
    'LOCAL_APP_SNAPSHOT_UNAVAILABLE',
  ].includes(reasonCode) || runnerReason === 'principal-unauthorized') {
    return 'runtime-capability-unavailable';
  }
  if ([
    'RENDERER_STANDARD_SHELL_HOST_UNAVAILABLE',
    'SDK_LOCAL_APP_BRIDGE_UNAVAILABLE',
    'SDK_RUNTIME_METHOD_UNAVAILABLE',
    'RUNTIME_SERVICE_UNAVAILABLE',
  ].includes(reasonCode) || runnerReason === 'sdk-method-unavailable') {
    return 'runtime-transport-unavailable';
  }
  if (reasonCode === 'RENDERER_STANDARD_SHELL_RESULT_INVALID'
    || reasonCode === 'SDK_RUNTIME_RESPONSE_DECODE_FAILED'
    || reasonCode === 'SDK_LOCAL_APP_PROJECTION_INVALID') {
    return 'runtime-output-malformed';
  }
  return 'runtime-call-failed';
}

function errorReasonCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const record = error as Record<string, unknown>;
  const value = typeof record.reasonCode === 'string'
    ? record.reasonCode
    : typeof record.code === 'string'
      ? record.code
      : '';
  return value.trim().toUpperCase().replaceAll('-', '_');
}

function normalizeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizePreviewUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:', 'data:', 'blob:'].includes(url.protocol) ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}
