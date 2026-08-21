import type { StudioImageCandidatePreview } from './media-voice-candidate.js';
import {
  runStudioImageCandidate,
  type StudioImageCandidateRunner,
  type StudioMediaCandidateFailure,
} from './studio-media-candidate.js';
import { normalizeDisplaySafeHttpsUrl } from './persona-external-ref.js';

export const PERSONA_REFERENCE_IMAGE_SOURCE = 'Runtime ScenarioService.submitScenarioJob image.generate' as const;

export type PersonaReferenceImageInput = {
  prompt: string;
  aspectRatio?: string;
  /** Selected variant count; callers must render the actual returned URL count. */
  count?: number;
};

export type PersonaReferenceImageResult =
  | {
    ok: true;
    source: typeof PERSONA_REFERENCE_IMAGE_SOURCE;
    referenceImageUrl: string;
    previewUrl: string;
    artifactIds: string[];
    artifactUris: string[];
    submitted: StudioImageCandidatePreview;
    runtime: {
      traceId?: string;
    };
  }
  | {
    ok: false;
    source: typeof PERSONA_REFERENCE_IMAGE_SOURCE;
    failure:
      | 'persona-reference-image-payload-invalid'
      | 'persona-reference-image-public-uri-unavailable'
      | StudioMediaCandidateFailure;
    message: string;
    submitted: StudioImageCandidatePreview | null;
  };

export function buildPersonaReferenceImagePayload(input: PersonaReferenceImageInput): {
  ok: boolean;
  errors: string[];
  payload: StudioImageCandidatePreview | null;
} {
  const prompt = input.prompt.trim();
  const count = input.count ?? 1;
  const errors: string[] = [];
  if (!prompt) errors.push('reference image prompt empty');
  if (count !== 1) errors.push('reference image generation count must be 1');
  if (errors.length > 0) {
    return { ok: false, errors, payload: null };
  }
  const aspectRatio = input.aspectRatio?.trim() || '1:1';
  return {
    ok: true,
    errors: [],
    payload: {
      surfaceId: 'realm-persona-studio.persona-reference-image',
      capability: 'image.generate',
      prompt,
      aspectRatio,
      count: 1,
    },
  };
}

export async function generatePersonaReferenceImage(
  input: PersonaReferenceImageInput,
  runner: StudioImageCandidateRunner = runStudioImageCandidate,
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

  const result = await runner(built.payload);
  if (!result.ok) {
    return {
      ok: false,
      source: PERSONA_REFERENCE_IMAGE_SOURCE,
      failure: result.failure,
      message: result.message,
      submitted: built.payload,
    };
  }
  const artifactIds = artifactValues(result.artifacts, 'artifactId');
  const artifactUris = artifactValues(result.artifacts, 'publicUri');
  const referenceImageUrl = artifactUris
    .map((uri) => normalizeDisplaySafeHttpsUrl(uri))
    .find((uri): uri is string => Boolean(uri));
  if (!referenceImageUrl) {
    return {
      ok: false,
      source: PERSONA_REFERENCE_IMAGE_SOURCE,
      failure: 'persona-reference-image-public-uri-unavailable',
      message: 'Runtime image.generate produced a local candidate but no display-safe HTTPS URI that Realm can store as a public reference image.',
      submitted: built.payload,
    };
  }

  return {
    ok: true,
    source: PERSONA_REFERENCE_IMAGE_SOURCE,
    referenceImageUrl,
    previewUrl: artifactValues(result.artifacts, 'previewUrl')[0] || referenceImageUrl,
    artifactIds,
    artifactUris,
    submitted: built.payload,
    runtime: {
      ...(result.traceId ? { traceId: result.traceId } : {}),
    },
  };
}

function artifactValues(
  artifacts: readonly { artifactId?: string; publicUri?: string; previewUrl?: string }[],
  field: 'artifactId' | 'publicUri' | 'previewUrl',
): string[] {
  return [...new Set(artifacts.flatMap((artifact) => {
    const value = artifact[field];
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  }))];
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

export function initialReferenceImagePromptFromDraft(input: {
  originalDescription: string;
  description: string;
  displayName: string;
  concept: string;
  personaArchetype: string;
}): string {
  const ownerDescription = input.originalDescription.trim();
  return ownerDescription || defaultReferenceImagePromptFromDraft(input);
}
