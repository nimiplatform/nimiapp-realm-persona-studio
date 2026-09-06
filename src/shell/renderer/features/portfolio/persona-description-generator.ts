import {
  isStudioTextRouteUnboundError,
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
import type { PersonaSeedPromptSupplements } from './persona-seed-generator.js';
import type { StudioLocale } from '../../i18n/studio-i18n.js';

export const PERSONA_DESCRIPTION_SOURCE = 'Nimi App Access ai.text.generateCandidate' as const;

/**
 * Input for the description reroll ("gacha") path. The candidate is only a
 * character description written back into the owner-editable describe input;
 * substantive persona fields stay with the seed completion pipeline.
 */
export type PersonaDescriptionCandidateInput = {
  /** Current describe-input content. When present, the candidate must explore a clearly different idea. */
  previousDescription?: string;
  /** Owner-written prompt supplements. Hard constraints when present. */
  supplements?: PersonaSeedPromptSupplements;
  /** Active Studio UI locale. The description is written in this language. */
  locale: StudioLocale;
};

export type PersonaDescriptionGenerationResult =
  | {
    ok: true;
    source: typeof PERSONA_DESCRIPTION_SOURCE;
    description: string;
    submitted: StudioTextCandidatePrompt;
    runtime: {
      traceId?: string;
      finishReason?: string;
    };
  }
  | {
    ok: false;
    source: typeof PERSONA_DESCRIPTION_SOURCE;
    failure:
      | 'persona-description-generate-failed'
      | 'persona-description-invalid-output';
    /** Typed failure carrier consumed by the UI; `detail` is log-only. */
    cause: CreateFlowFailure;
    submitted: StudioTextCandidatePrompt | null;
  };

const PERSONA_DESCRIPTION_MAX_CHARS = 600;

function buildPersonaDescriptionPayload(input: PersonaDescriptionCandidateInput): StudioTextCandidatePrompt {
  const outputLanguage = input.locale === 'zh' ? 'Chinese' : 'English';
  const previousDescription = input.previousDescription?.trim() || '';
  const supplements = input.supplements ?? {};
  const ownerSupplements = [
    supplements.speechSupplement?.trim() ? `Speech style supplement:\n${supplements.speechSupplement.trim()}` : '',
    supplements.boundarySupplement?.trim() ? `Behavior boundary supplement:\n${supplements.boundarySupplement.trim()}` : '',
    supplements.visualSupplement?.trim() ? `Visual style supplement:\n${supplements.visualSupplement.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  return {
    surfaceId: 'realm-persona-studio.persona-description',
    params: {
      maxTokens: 500,
      temperature: 1,
      topP: 1,
    },
    systemText: [
      'You write ONE original character description for an owner collecting ideas through repeated rerolls.',
      `Write in ${outputLanguage}.`,
      'Return plain text only: 2-4 sentences. No JSON, no lists, no quotes, no code fences, no preamble.',
      'Cover who the character is, their personality or presence, and one concrete hook (occupation, era, ability, or contradiction).',
      'Be specific and evocative; avoid generic helpful-companion results.',
      ...(previousDescription
        ? ['The owner already saw a previous idea (in the user message); explore a clearly different concept, tone, and setting.']
        : []),
      ...(ownerSupplements
        ? ['Supplements in the user message are hard constraints the description must respect.']
        : []),
    ].join('\n'),
    userText: JSON.stringify({
      ...(previousDescription ? { previousDescription } : {}),
      ...(ownerSupplements ? { ownerSupplements } : {}),
    }),
  };
}

function readDescriptionCandidate(raw: string): string {
  const text = raw.trim();
  if (!text) {
    throw new CreateFlowFailureError({ kind: 'description-invalid-output', detail: 'LLM output did not return a description.' });
  }
  if (text.startsWith('{') || text.startsWith('[') || text.startsWith('```')) {
    throw new CreateFlowFailureError({ kind: 'description-invalid-output', detail: 'LLM output returned structured content instead of a plain description.' });
  }
  return text.length > PERSONA_DESCRIPTION_MAX_CHARS ? text.slice(0, PERSONA_DESCRIPTION_MAX_CHARS) : text;
}

/**
 * Generate one candidate character description for the owner reroll flow. The
 * output is idea material only: it never touches substantive persona fields
 * and never advances the creation stage by itself.
 *
 * @nimi-authority: rule.realm-persona-studio.create-flow.r015
 */
export async function generatePersonaDescriptionCandidate(
  input: PersonaDescriptionCandidateInput,
  runner: StudioTextCandidateRunner = runStudioTextCandidate,
): Promise<PersonaDescriptionGenerationResult> {
  const payload = buildPersonaDescriptionPayload(input);
  try {
    const output = await runner(payload);
    try {
      const description = readDescriptionCandidate(output.text);
      return {
        ok: true,
        source: PERSONA_DESCRIPTION_SOURCE,
        description,
        submitted: output.submitted,
        runtime: {
          ...(output.traceId ? { traceId: output.traceId } : {}),
          ...(output.finishReason ? { finishReason: output.finishReason } : {}),
        },
      };
    } catch (error) {
      return {
        ok: false,
        source: PERSONA_DESCRIPTION_SOURCE,
        failure: 'persona-description-invalid-output',
        cause: isCreateFlowFailureError(error)
          ? error.failure
          : createFlowFailureFromUnknown('description-invalid-output', error),
        submitted: output.submitted,
      };
    }
  } catch (error) {
    return {
      ok: false,
      source: PERSONA_DESCRIPTION_SOURCE,
      failure: 'persona-description-generate-failed',
      cause: createFlowFailureFromUnknown(
        isStudioTextRouteUnboundError(error) ? 'runtime-route-unbound' : 'description-generate-failed',
        error,
      ),
      submitted: payload,
    };
  }
}
