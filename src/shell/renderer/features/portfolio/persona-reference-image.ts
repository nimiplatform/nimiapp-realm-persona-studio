import type { Runtime } from '@nimiplatform/sdk/runtime';
import type { ExecuteScenarioResponse, ScenarioArtifact } from '@nimiplatform/sdk/runtime/generated';
import { createStudioRuntimeClient } from '@renderer/data/runtime-client.js';
import {
  bindStudioImageGeneratePayload,
  createStudioImageGeneratePayload,
  executeStudioImageGenerate,
  normalizeStudioImageGenerateFailureMessage,
  resolveStudioImageCallParams,
  type StudioImageGeneratePayload,
} from './studio-ai-runtime.js';
import {
  projectStudioRuntimeArtifacts,
  type StudioRuntimeArtifactProjection,
} from './runtime-artifact-projection.js';

export const PERSONA_REFERENCE_IMAGE_SOURCE = 'Runtime ScenarioService.submitScenarioJob image.generate' as const;

type RuntimeImageClient = Runtime;

export type PersonaReferenceImageInput = {
  prompt: string;
  aspectRatio?: string;
};

export type PersonaReferenceImageResult =
  | {
    ok: true;
    source: typeof PERSONA_REFERENCE_IMAGE_SOURCE;
    referenceImageUrl: string;
    previewUrl: string;
    artifactIds: string[];
    artifactUris: string[];
    artifacts: StudioRuntimeArtifactProjection[];
    submitted: StudioImageGeneratePayload;
    runtime: {
      jobId?: string;
      traceId?: string;
      modelResolved?: string;
    };
  }
  | {
    ok: false;
    source: typeof PERSONA_REFERENCE_IMAGE_SOURCE;
    failure:
      | 'persona-reference-image-payload-invalid'
      | 'persona-reference-image-transport-unavailable'
      | 'persona-reference-image-generate-failed'
      | 'persona-reference-image-no-artifact'
      | 'persona-reference-image-public-url-unavailable';
    message: string;
    submitted: StudioImageGeneratePayload | null;
  };

export function buildPersonaReferenceImagePayload(input: PersonaReferenceImageInput): {
  ok: boolean;
  errors: string[];
  payload: StudioImageGeneratePayload | null;
} {
  const prompt = input.prompt.trim();
  const errors: string[] = [];
  if (!prompt) errors.push('reference image prompt empty');
  if (errors.length > 0) {
    return { ok: false, errors, payload: null };
  }
  const callParams = resolveStudioImageCallParams('realm-persona-studio.persona-reference-image', {
    ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
  });
  return {
    ok: true,
    errors: [],
    payload: createStudioImageGeneratePayload({
      surfaceId: 'realm-persona-studio.persona-reference-image',
      params: {
        ...callParams,
      },
      spec: {
        prompt,
        negativePrompt: '',
        n: 1,
        size: callParams.size || '',
        aspectRatio: callParams.aspectRatio ?? '',
        quality: '',
        style: '',
        seed: callParams.seed || '',
        referenceImages: [],
        mask: '',
        responseFormat: callParams.responseFormat || 'url',
      },
    }),
  };
}

function readImageArtifacts(output: ExecuteScenarioResponse): readonly ScenarioArtifact[] {
  const scenarioOutput = output.output?.output;
  return scenarioOutput?.oneofKind === 'imageGenerate'
    ? scenarioOutput.imageGenerate.artifacts
    : [];
}

export async function generatePersonaReferenceImage(
  input: PersonaReferenceImageInput,
  runtime?: RuntimeImageClient | null,
): Promise<PersonaReferenceImageResult> {
  const built = buildPersonaReferenceImagePayload(input);
  if (!built.ok || !built.payload) {
    return {
      ok: false,
      source: PERSONA_REFERENCE_IMAGE_SOURCE,
      failure: 'persona-reference-image-payload-invalid',
      message: built.errors.join('; ') || 'Reference image payload invalid.',
      submitted: null,
    };
  }
  const runtimeClient = runtime === undefined ? await createStudioRuntimeClient() : runtime;
  if (!runtimeClient) {
    return {
      ok: false,
      source: PERSONA_REFERENCE_IMAGE_SOURCE,
      failure: 'persona-reference-image-transport-unavailable',
      message: 'Runtime imageGenerate scenario transport unavailable: Tauri IPC runtime transport is required.',
      submitted: built.payload,
    };
  }
  let submitted = built.payload;
  try {
    const boundPayload = await bindStudioImageGeneratePayload(built.payload, runtimeClient);
    submitted = boundPayload;
    const output = await executeStudioImageGenerate(boundPayload, runtimeClient);
    const artifacts = readImageArtifacts(output);
    const projectedArtifacts = await projectStudioRuntimeArtifacts(runtimeClient, artifacts);
    const artifactIds = projectedArtifacts
      .map((artifact) => artifact.artifactId)
      .filter((artifactId): artifactId is string => Boolean(artifactId));
    const artifactUris = projectedArtifacts
      .map((artifact) => artifact.publicUri)
      .filter((uri): uri is string => Boolean(uri));
    const previewUrl = projectedArtifacts.find((artifact) => artifact.previewUrl)?.previewUrl || artifactUris[0] || '';
    if (projectedArtifacts.length === 0) {
      return {
        ok: false,
        source: PERSONA_REFERENCE_IMAGE_SOURCE,
        failure: 'persona-reference-image-no-artifact',
        message: 'Runtime imageGenerate scenario returned no readable artifact.',
        submitted,
      };
    }
    const referenceImageUrl = artifactUris[0] || '';
    if (!referenceImageUrl) {
      return {
        ok: false,
        source: PERSONA_REFERENCE_IMAGE_SOURCE,
        failure: 'persona-reference-image-public-url-unavailable',
        message: 'Runtime imageGenerate produced a local artifact but no http(s) URL that Realm can store as a public reference image.',
        submitted,
      };
    }
    return {
      ok: true,
      source: PERSONA_REFERENCE_IMAGE_SOURCE,
      referenceImageUrl,
      previewUrl,
      artifactIds,
      artifactUris,
      artifacts: projectedArtifacts,
      submitted,
      runtime: {
        ...(output.traceId ? { traceId: output.traceId } : {}),
        ...(output.modelResolved ? { modelResolved: output.modelResolved } : {}),
      },
    };
  } catch (error) {
    const message = normalizeStudioImageGenerateFailureMessage(error);
    return {
      ok: false,
      source: PERSONA_REFERENCE_IMAGE_SOURCE,
      failure: 'persona-reference-image-generate-failed',
      message: `Runtime imageGenerate scenario failed: ${message}`,
      submitted,
    };
  }
}

/**
 * Build a default image prompt from the current draft. The user can override
 * in the form before triggering generation.
 */
export function defaultReferenceImagePromptFromDraft(input: {
  description: string;
  displayName: string;
  concept: string;
  personaArchetype: string;
}): string {
  const lead = input.description.trim() || input.concept.trim();
  const traits = [input.personaArchetype, input.displayName].filter(Boolean).join(', ');
  const tail = 'character portrait, cinematic lighting, full body, high detail, neutral background';
  return [lead, traits, tail].filter(Boolean).join(' — ');
}
