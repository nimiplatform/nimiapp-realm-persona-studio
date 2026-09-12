import {
  PERSONA_ARCHETYPES,
  PERSONA_TRAITS,
  type CreateRealmPersonaDraftInput,
  type PersonaArchetype,
  type PersonaTrait,
} from './create-persona-draft.js';
import {
  isStudioTextRouteUnboundError,
  runStudioTextCandidate,
  runValidatedStudioTextCandidate,
  StudioTextCandidateValidationError,
  type StudioTextCandidatePrompt,
  type StudioTextCandidateRunner,
} from './studio-text-candidate.js';
import { characterWritingIssues } from './persona-character-authoring.js';
import { parseStrictRuntimeJsonObject } from './strict-runtime-json.js';
import {
  CreateFlowFailureError,
  createFlowFailureFromUnknown,
  isCreateFlowFailureError,
  type CreateFlowFailure,
} from './create-flow-failure.js';
import type { StudioLocale } from '../../i18n/studio-i18n.js';

export const PERSONA_SEED_SOURCE = 'Nimi App Access ai.text.generateCandidate' as const;

export type PersonaSeedPromptSupplements = {
  speechSupplement?: string;
  boundarySupplement?: string;
  visualSupplement?: string;
  ownerWriting?: Partial<Pick<CreateRealmPersonaDraftInput, 'displayName' | 'concept' | 'description' | 'greeting' | 'ruleText' | 'personaArchetype' | 'personaTraits'>>;
};

/**
 * AI seed generation is one feature on a continuum: the less the owner wrote,
 * the more the candidate invents (creative); the more the owner wrote, the
 * more it completes (completion). The mode is derived from owner input volume
 * and is never a separate owner-facing switch.
 */
export type PersonaSeedGenerationMode = 'creative' | 'completion';

export function derivePersonaSeedMode(description: string): PersonaSeedGenerationMode {
  return description.trim() ? 'completion' : 'creative';
}

export type PersonaSeedGenerationOptions = {
  /** Active Studio UI locale. Creative mode writes the persona draft texts in this language. */
  locale: StudioLocale;
};

/**
 * Subset of CreateRealmPersonaDraftInput populated by the candidate. World
 * selection and handle availability stay manual; the generated handle remains
 * an owner-reviewed suggestion. speechStyle and behaviorBoundary are candidate
 * lines gap-filled into the owner supplements only where the owner wrote
 * nothing; owner-written supplements always win.
 *
 * @nimi-authority: rule.realm-persona-studio.create-flow.r014
 */
export type GeneratedPersonaSeed = Pick<
  CreateRealmPersonaDraftInput,
  'handle' | 'displayName' | 'concept' | 'description' | 'ruleText' | 'personaArchetype' | 'personaTraits'
> & {
  greeting: string;
  speechStyle: string;
  behaviorBoundary: string;
};

export type PersonaSeedGenerationResult =
  | {
    ok: true;
    source: typeof PERSONA_SEED_SOURCE;
    seed: GeneratedPersonaSeed;
    rationale: string;
    submitted: StudioTextCandidatePrompt;
    runtime: {
      traceId?: string;
      finishReason?: string;
    };
  }
  | {
    ok: false;
    source: typeof PERSONA_SEED_SOURCE;
    failure:
      | 'persona-seed-generate-failed'
      | 'persona-seed-invalid-output';
    /** Typed failure carrier consumed by the UI; `detail` is log-only. */
    cause: CreateFlowFailure;
    submitted: StudioTextCandidatePrompt | null;
  };

const PERSONA_SEED_OUTPUT_KEYS = [
  'handle',
  'displayName',
  'concept',
  'description',
  'greeting',
  'ruleText',
  'personaArchetype',
  'personaTraits',
  'speechStyle',
  'behaviorBoundary',
  'rationale',
] as const;

function buildPersonaSeedPayload(
  description: string,
  supplements: PersonaSeedPromptSupplements = {},
  options: PersonaSeedGenerationOptions,
): StudioTextCandidatePrompt {
  const trimmed = description.trim();
  const mode = derivePersonaSeedMode(trimmed);
  const outputLanguage = options.locale === 'zh' ? 'Chinese' : 'English';
  const ownerPromptParts = [
    trimmed ? `Owner description:\n${trimmed}` : '',
    supplements.speechSupplement?.trim() ? `Speech style supplement:\n${supplements.speechSupplement.trim()}` : '',
    supplements.boundarySupplement?.trim() ? `Behavior boundary supplement:\n${supplements.boundarySupplement.trim()}` : '',
    supplements.visualSupplement?.trim() ? `Visual style supplement:\n${supplements.visualSupplement.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  const introLine = mode === 'creative'
    ? 'You invent an original, complete Realm Persona draft from scratch. The owner provided no description, so be creative, specific, and internally consistent; avoid generic results.'
    : 'You generate an owner-reviewed Realm Persona draft from a one-line user description.';
  const displayNameRule = mode === 'creative'
    ? `displayName: 2-32 chars; write in ${outputLanguage}.`
    : 'displayName: 2-32 chars; match the user\'s described language (Chinese, English, etc).';
  const creativeNotes = mode === 'creative'
    ? [
      `concept, description, ruleText, speechStyle, behaviorBoundary: write in ${outputLanguage}.`,
      'userDescription may be empty; any supplements present inside it are hard constraints the draft must respect.',
    ]
    : [];

  return {
    surfaceId: 'realm-persona-studio.persona-seed',
    params: {
      maxTokens: 2200,
      temperature: mode === 'creative' ? 0.9 : 0.7,
      topP: 1,
    },
    systemText: [
      introLine,
      'Return ONE JSON object. No prose before or after. No code fences.',
      'The output must contain EXACTLY these 11 keys: handle, displayName, concept, description, greeting, ruleText, personaArchetype, personaTraits, speechStyle, behaviorBoundary, rationale. Additional keys are forbidden.',
      'Only personaTraits is an array. Every other value MUST be a JSON string. In particular, ruleText, speechStyle, and behaviorBoundary are strings, NEVER arrays.',
      'Encode multiple principles inside one string using escaped newline characters: "ruleText": "First principle.\\nSecond principle." Use the same string format for speechStyle and behaviorBoundary.',
      'The user message is input context, NOT an output template. Never echo mode, userDescription, ownerWriting, personaArchetypeAllowed, or personaTraitsAllowed into the result.',
      '',
      'Owner-written fields in ownerWriting are hard constraints: preserve them and make every generated field consistent with them, including the owner’s chosen name. Never treat an empty field as a constraint.',
      '— Field rules —',
      'handle: short kebab-case latin suggestion (3-20 chars), no leading @, lowercase letters/digits/hyphens only.',
      displayNameRule,
      'concept: a compact identity statement, at most 240 Unicode characters. Include a specific role, a desire, and an interesting tension or contradiction.',
      'description: a vivid public introduction (80-300 characters) with a concrete habit or lived detail. Do not repeat the concept verbatim or list personality adjectives.',
      'greeting: 1-3 sentences in the character’s own voice, opening a specific small scene and offering an easy way to respond. No generic assistant greeting, no claims of real memories or previous conversations.',
      'ruleText: REQUIRED, 2-4 concrete behavior principles, one per line, each at most 160 Unicode characters. Describe choices in everyday situations and an imperfection; avoid abstract adjective lists.',
      'speechStyle: REQUIRED, 1-3 speaking principles, one per line, each at most 160 Unicode characters. Give distinctive tone, pacing, vocabulary and a short illustrative phrase.',
      'behaviorBoundary: REQUIRED, 1-3 immutable boundaries, one per line, each at most 160 Unicode characters. Be specific to the character; respect owner constraints and user autonomy.',
      `personaArchetype: EXACTLY ONE of ${PERSONA_ARCHETYPES.join(' | ')}`,
      `personaTraits: array of 1-3 traits from ${PERSONA_TRAITS.join(' | ')}`,
      `rationale: one brief, useful sentence in ${outputLanguage} explaining what gives this character individuality.`,
      'Fictional setting and habits describe the character; they are not product access gates. Do not refuse ordinary conversation because of real-world time, weather, location, or unavailable context.',
      'Ensure concept, behavior, speaking, greeting, and boundaries tell the same story. The character is a digital persona, never a generic helpful assistant. Avoid stereotypes and familiar franchise characters.',
      ...creativeNotes,
      '',
      '— Hard prohibitions —',
      'Never include: handle prefix @, provider, model, lifecycle, state, worldId, ownerId, dna (full JSON), avatarUrl, profileCoverUrl, personaRule, personaRules, LocalAgent.',
      'Never include code fences, comments, or trailing text outside the JSON object.',
      `Before answering, verify the top-level keys are exactly: ${PERSONA_SEED_OUTPUT_KEYS.join(', ')}. All values are strings except personaTraits, which is an array of allowed trait strings.`,
    ].join('\n'),
    userText: JSON.stringify({
      mode,
      userDescription: ownerPromptParts,
      ...(supplements.ownerWriting && Object.keys(supplements.ownerWriting).length ? { ownerWriting: supplements.ownerWriting } : {}),
      personaArchetypeAllowed: PERSONA_ARCHETYPES,
      personaTraitsAllowed: PERSONA_TRAITS,
    }),
  };
}

function readString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function readPersonaArchetype(value: unknown): PersonaArchetype | '' {
  const upper = readString(value).toUpperCase();
  return (PERSONA_ARCHETYPES as readonly string[]).includes(upper)
    ? (upper as PersonaArchetype)
    : '';
}

function readPersonaTraits(value: unknown): PersonaTrait[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<PersonaTrait>(PERSONA_TRAITS);
  const seen = new Set<PersonaTrait>();
  const out: PersonaTrait[] = [];
  for (const item of value) {
    const upper = readString(item).toUpperCase() as PersonaTrait;
    if (!known.has(upper) || seen.has(upper)) continue;
    seen.add(upper);
    out.push(upper);
  }
  return out;
}

function normalizeHandleSuggestion(raw: unknown): string {
  return readString(raw)
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function parsePersonaSeedOutput(raw: string): { seed: GeneratedPersonaSeed; rationale: string } {
  const obj = parseStrictRuntimeJsonObject({
    rawText: raw,
    label: 'Runtime persona seed output',
    allowedKeys: PERSONA_SEED_OUTPUT_KEYS,
  });
  const invalidStringFields = PERSONA_SEED_OUTPUT_KEYS.filter((key) => key !== 'personaTraits'
    && obj[key] !== undefined && typeof obj[key] !== 'string');
  if (invalidStringFields.length > 0) {
    throw new CreateFlowFailureError({
      kind: 'seed-output-invalid',
      detail: `Fields ${invalidStringFields.join(', ')} must be JSON strings, not arrays or objects. Encode multiple principles in one string separated by escaped newline characters (\\n).`,
    });
  }
  const seed: GeneratedPersonaSeed = {
    handle: normalizeHandleSuggestion(obj.handle),
    displayName: readString(obj.displayName),
    concept: readString(obj.concept),
    description: readString(obj.description),
    greeting: readString(obj.greeting),
    ruleText: readString(obj.ruleText),
    personaArchetype: readPersonaArchetype(obj.personaArchetype),
    personaTraits: readPersonaTraits(obj.personaTraits),
    speechStyle: readString(obj.speechStyle),
    behaviorBoundary: readString(obj.behaviorBoundary),
  };
  if (!seed.handle || !seed.displayName || !seed.concept || !seed.description || !seed.greeting || !seed.ruleText || !seed.speechStyle || !seed.behaviorBoundary) {
    throw new CreateFlowFailureError({ kind: 'seed-required-output-missing', detail: 'LLM output is missing required character writing.' });
  }
  if (!seed.personaArchetype) {
    throw new CreateFlowFailureError({ kind: 'seed-archetype-invalid', detail: 'LLM output personaArchetype missing or outside the supported archetypes.' });
  }
  if (!Array.isArray(obj.personaTraits) || obj.personaTraits.length > 3 || seed.personaTraits.length !== obj.personaTraits.length) {
    throw new CreateFlowFailureError({ kind: 'seed-traits-invalid', detail: 'LLM output personaTraits must contain at most 3 values from the supported trait vocabulary.' });
  }
  if (characterWritingIssues({ characterIdentity: seed.concept, behaviorText: seed.ruleText, speakingText: seed.speechStyle, boundariesText: seed.behaviorBoundary }).length > 0) {
    throw new CreateFlowFailureError({ kind: 'seed-output-invalid', detail: 'Generated character writing exceeds the admitted declaration bounds.' });
  }
  const rationale = readString(obj.rationale);
  return { seed, rationale };
}

// @nimi-authority: rule.realm-persona-studio.create-flow.r012
export async function generatePersonaSeedFromDescription(
  description: string,
  runner: StudioTextCandidateRunner = runStudioTextCandidate,
  supplements: PersonaSeedPromptSupplements = {},
  options: PersonaSeedGenerationOptions,
): Promise<PersonaSeedGenerationResult> {
  const payload = buildPersonaSeedPayload(description, supplements, options);
  try {
    const { output, value: parsed } = await runValidatedStudioTextCandidate(payload, parsePersonaSeedOutput, runner);
    return {
      ok: true,
      source: PERSONA_SEED_SOURCE,
      seed: parsed.seed,
      rationale: parsed.rationale,
      submitted: output.submitted,
      runtime: {
        ...(output.traceId ? { traceId: output.traceId } : {}),
        ...(output.finishReason ? { finishReason: output.finishReason } : {}),
      },
    };
  } catch (error) {
    if (error instanceof StudioTextCandidateValidationError) {
      return {
        ok: false,
        source: PERSONA_SEED_SOURCE,
        failure: 'persona-seed-invalid-output',
        cause: isCreateFlowFailureError(error.validationError)
          ? error.validationError.failure
          : createFlowFailureFromUnknown('seed-output-invalid', error.validationError),
        submitted: error.output.submitted,
      };
    }
    return {
      ok: false,
      source: PERSONA_SEED_SOURCE,
      failure: 'persona-seed-generate-failed',
      cause: createFlowFailureFromUnknown(
        isStudioTextRouteUnboundError(error) ? 'runtime-route-unbound' : 'seed-generate-failed',
        error,
      ),
      submitted: payload,
    };
  }
}
