import type { StudioImageCandidatePreview } from './media-voice-candidate.js';
import { RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE } from './portfolio-media-client.js';

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
      | 'persona-reference-image-candidate-unavailable';
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

/**
 * Reference image generation stays fail-closed: the Nimi local App surface
 * does not expose image candidate generation yet, so the reviewed draft is
 * preserved and returned with a typed unavailability failure.
 */
export async function generatePersonaReferenceImage(
  input: PersonaReferenceImageInput,
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
  return {
    ok: false,
    source: PERSONA_REFERENCE_IMAGE_SOURCE,
    failure: 'persona-reference-image-candidate-unavailable',
    message: RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE,
    submitted: built.payload,
  };
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
