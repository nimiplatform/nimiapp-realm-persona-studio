import {
  runStudioTextCandidate,
  type StudioTextCandidatePrompt,
  type StudioTextCandidateRunner,
} from './studio-text-candidate.js';
import {
  CreateFlowFailureError,
  createFlowFailureFromUnknown,
  isCreateFlowFailureError,
  type CreateFlowFailure,
} from './create-flow-failure.js';
import type { StudioLocale } from '../../i18n/studio-i18n.js';

export const PERSONA_IMAGE_PROMPT_OPTIMIZER_SOURCE = 'Nimi App Access ai.text.generateCandidate' as const;

/**
 * Input for the owner-triggered image-prompt optimization. Source material is
 * the creation draft's character fields plus the current owner-editable image
 * prompt; the candidate is written back into that same owner-editable input.
 */
export type PersonaImagePromptOptimizeInput = {
  /** Current owner-editable image prompt. Treated as owner intent to refine when present. */
  currentPrompt?: string;
  originalDescription: string;
  description: string;
  displayName: string;
  concept: string;
  personaArchetype: string;
  /** Owner-written visual supplement. Hard constraint when present. */
  visualSupplement?: string;
  /** Active Studio UI locale. The prompt is written in this language. */
  locale: StudioLocale;
};

export type PersonaImagePromptOptimizeResult =
  | {
    ok: true;
    source: typeof PERSONA_IMAGE_PROMPT_OPTIMIZER_SOURCE;
    prompt: string;
    submitted: StudioTextCandidatePrompt;
    runtime: {
      traceId?: string;
      finishReason?: string;
    };
  }
  | {
    ok: false;
    source: typeof PERSONA_IMAGE_PROMPT_OPTIMIZER_SOURCE;
    failure:
      | 'persona-image-prompt-optimize-failed'
      | 'persona-image-prompt-invalid-output';
    /** Typed failure carrier consumed by the UI; `detail` is log-only. */
    cause: CreateFlowFailure;
    submitted: StudioTextCandidatePrompt | null;
  };

const PERSONA_IMAGE_PROMPT_MAX_CHARS = 800;

function buildImagePromptOptimizePayload(input: PersonaImagePromptOptimizeInput): StudioTextCandidatePrompt {
  const outputLanguage = input.locale === 'zh' ? 'Chinese' : 'English';
  const currentPrompt = input.currentPrompt?.trim() || '';
  const visualSupplement = input.visualSupplement?.trim() || '';

  return {
    surfaceId: 'realm-persona-studio.persona-image-prompt',
    params: {
      maxTokens: 400,
      temperature: 0.7,
      topP: 1,
    },
    systemText: [
      'You rewrite character material into ONE visual prompt for an image-generation model drawing a character reference portrait.',
      `Write in ${outputLanguage}.`,
      'Return plain text only: a single paragraph. No JSON, no lists, no quotes, no code fences, no preamble.',
      'Describe only what an image model can render: physical appearance, age impression, build, hair, clothing, expression, pose or framing, palette, lighting, art style, and background.',
      'Never transcribe greetings, dialogue, inner monologue, personality statements, or behavior rules; translate personality and mood into visible styling cues instead.',
      'Stay faithful to the source character material in the user message; do not invent a different character.',
      ...(currentPrompt
        ? ["The user message contains the owner's current image prompt; treat it as intent to refine and keep its visual choices unless they conflict with the source material."]
        : []),
      ...(visualSupplement
        ? ['The visual supplement in the user message is a hard constraint the prompt must respect.']
        : []),
      'Keep the result under 120 words.',
    ].join('\n'),
    userText: JSON.stringify({
      ...(input.displayName.trim() ? { displayName: input.displayName.trim() } : {}),
      ...(input.personaArchetype.trim() ? { personaArchetype: input.personaArchetype.trim() } : {}),
      ...(input.concept.trim() ? { concept: input.concept.trim() } : {}),
      ...(input.description.trim() ? { description: input.description.trim() } : {}),
      ...(input.originalDescription.trim() ? { originalDescription: input.originalDescription.trim() } : {}),
      ...(currentPrompt ? { currentPrompt } : {}),
      ...(visualSupplement ? { visualSupplement } : {}),
    }),
  };
}

function readImagePromptCandidate(raw: string): string {
  const text = raw.trim();
  if (!text) {
    throw new CreateFlowFailureError({ kind: 'image-prompt-invalid-output', detail: 'LLM output did not return an image prompt.' });
  }
  if (text.startsWith('{') || text.startsWith('[') || text.startsWith('```')) {
    throw new CreateFlowFailureError({ kind: 'image-prompt-invalid-output', detail: 'LLM output returned structured content instead of a plain image prompt.' });
  }
  return text.length > PERSONA_IMAGE_PROMPT_MAX_CHARS ? text.slice(0, PERSONA_IMAGE_PROMPT_MAX_CHARS) : text;
}

/**
 * Optimize the owner-editable reference image prompt into visual, renderable
 * language. The candidate only rewrites the owner-editable input; a failure
 * preserves the owner's current prompt, and submission still waits for an
 * explicit owner generate action.
 *
 * @nimi-authority: rule.realm-persona-studio.create-flow.r011
 */
export async function optimizePersonaImagePrompt(
  input: PersonaImagePromptOptimizeInput,
  runner: StudioTextCandidateRunner = runStudioTextCandidate,
): Promise<PersonaImagePromptOptimizeResult> {
  const payload = buildImagePromptOptimizePayload(input);
  try {
    const output = await runner(payload);
    try {
      const prompt = readImagePromptCandidate(output.text);
      return {
        ok: true,
        source: PERSONA_IMAGE_PROMPT_OPTIMIZER_SOURCE,
        prompt,
        submitted: output.submitted,
        runtime: {
          ...(output.traceId ? { traceId: output.traceId } : {}),
          ...(output.finishReason ? { finishReason: output.finishReason } : {}),
        },
      };
    } catch (error) {
      return {
        ok: false,
        source: PERSONA_IMAGE_PROMPT_OPTIMIZER_SOURCE,
        failure: 'persona-image-prompt-invalid-output',
        cause: isCreateFlowFailureError(error)
          ? error.failure
          : createFlowFailureFromUnknown('image-prompt-invalid-output', error),
        submitted: output.submitted,
      };
    }
  } catch (error) {
    return {
      ok: false,
      source: PERSONA_IMAGE_PROMPT_OPTIMIZER_SOURCE,
      failure: 'persona-image-prompt-optimize-failed',
      cause: createFlowFailureFromUnknown('image-prompt-optimize-failed', error),
      submitted: payload,
    };
  }
}
