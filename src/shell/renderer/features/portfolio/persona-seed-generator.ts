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
  type StudioTextCandidatePrompt,
  type StudioTextCandidateRunner,
} from './studio-text-candidate.js';
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
      maxTokens: 1200,
      temperature: mode === 'creative' ? 0.9 : 0.7,
      topP: 1,
    },
    systemText: [
      introLine,
      'Return ONE JSON object. No prose before or after. No code fences.',
      'Required keys: handle, displayName, concept, description, ruleText, personaArchetype, personaTraits, speechStyle, behaviorBoundary, rationale.',
      '',
      '— Field rules —',
      'handle: short kebab-case latin suggestion (3-20 chars), no leading @, lowercase letters/digits/hyphens only.',
      displayNameRule,
      'concept: 1-2 sentences naming the core creative concept.',
      'description: 1 short public profile description (≤500 chars).',
      'ruleText: optional behavior/boundary lines, one per line; empty string if nothing meaningful.',
      'speechStyle: 1-3 lines describing how the persona speaks (tone, pacing, register), one per line; empty string if nothing meaningful.',
      'behaviorBoundary: 1-3 immutable behavior boundary lines the persona never crosses, one per line; empty string if nothing meaningful.',
      `personaArchetype: EXACTLY ONE of ${PERSONA_ARCHETYPES.join(' | ')}`,
      `personaTraits: array of 1-3 traits from ${PERSONA_TRAITS.join(' | ')}`,
      'rationale: 1-2 sentences explaining the design choice (English).',
      ...creativeNotes,
      '',
      '— Hard prohibitions —',
      'Never include: handle prefix @, provider, model, lifecycle, state, worldId, ownerId, dna (full JSON), avatarUrl, profileCoverUrl, personaRule, personaRules, LocalAgent.',
      'Never include code fences, comments, or trailing text outside the JSON object.',
    ].join('\n'),
    userText: JSON.stringify({
      mode,
      userDescription: ownerPromptParts,
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
  const seed: GeneratedPersonaSeed = {
    handle: normalizeHandleSuggestion(obj.handle),
    displayName: readString(obj.displayName),
    concept: readString(obj.concept),
    description: readString(obj.description),
    ruleText: readString(obj.ruleText),
    personaArchetype: readPersonaArchetype(obj.personaArchetype),
    personaTraits: readPersonaTraits(obj.personaTraits),
    speechStyle: readString(obj.speechStyle),
    behaviorBoundary: readString(obj.behaviorBoundary),
  };
  if (!seed.displayName || !seed.concept) {
    throw new CreateFlowFailureError({ kind: 'seed-required-output-missing', detail: 'LLM output missing required `displayName` or `concept`.' });
  }
  if (!seed.personaArchetype) {
    throw new CreateFlowFailureError({ kind: 'seed-archetype-invalid', detail: 'LLM output personaArchetype missing or outside the supported archetypes.' });
  }
  if (!Array.isArray(obj.personaTraits) || obj.personaTraits.length > 3 || seed.personaTraits.length !== obj.personaTraits.length) {
    throw new CreateFlowFailureError({ kind: 'seed-traits-invalid', detail: 'LLM output personaTraits must contain at most 3 values from the supported trait vocabulary.' });
  }
  const rationale = readString(obj.rationale);
  return { seed, rationale };
}

export async function generatePersonaSeedFromDescription(
  description: string,
  runner: StudioTextCandidateRunner = runStudioTextCandidate,
  supplements: PersonaSeedPromptSupplements = {},
  options: PersonaSeedGenerationOptions,
): Promise<PersonaSeedGenerationResult> {
  const payload = buildPersonaSeedPayload(description, supplements, options);
  try {
    const output = await runner(payload);
    try {
      const parsed = parsePersonaSeedOutput(output.text);
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
      return {
        ok: false,
        source: PERSONA_SEED_SOURCE,
        failure: 'persona-seed-invalid-output',
        cause: isCreateFlowFailureError(error)
          ? error.failure
          : createFlowFailureFromUnknown('seed-output-invalid', error),
        submitted: output.submitted,
      };
    }
  } catch (error) {
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
