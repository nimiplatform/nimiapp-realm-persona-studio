import {
  PERSONA_ARCHETYPES,
  PERSONA_TRAITS,
  type CreateRealmPersonaDraftInput,
  type PersonaArchetype,
  type PersonaTrait,
} from './create-persona-draft.js';
import {
  runStudioTextCandidate,
  type StudioTextCandidatePrompt,
  type StudioTextCandidateRunner,
} from './studio-text-candidate.js';
import { parseStrictRuntimeJsonObject } from './strict-runtime-json.js';

export const PERSONA_SEED_SOURCE = 'Nimi App Access ai.text.generateCandidate' as const;

export type PersonaSeedPromptSupplements = {
  speechSupplement?: string;
  boundarySupplement?: string;
  visualSupplement?: string;
};

/**
 * Subset of CreateRealmPersonaDraftInput populated by the candidate. World
 * selection and handle availability stay manual; the generated handle remains
 * an owner-reviewed suggestion.
 */
export type GeneratedPersonaSeed = Pick<
  CreateRealmPersonaDraftInput,
  'handle' | 'displayName' | 'concept' | 'description' | 'ruleText' | 'personaArchetype' | 'personaTraits'
>;

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
      | 'persona-seed-description-empty'
      | 'persona-seed-generate-failed'
      | 'persona-seed-invalid-output';
    message: string;
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
  'rationale',
] as const;

function buildPersonaSeedPayload(
  description: string,
  supplements: PersonaSeedPromptSupplements = {},
): {
  ok: boolean;
  errors: string[];
  payload: StudioTextCandidatePrompt | null;
} {
  const trimmed = description.trim();
  const errors: string[] = [];
  if (!trimmed) errors.push('persona description empty');
  if (errors.length > 0) {
    return { ok: false, errors, payload: null };
  }
  const ownerPromptParts = [
    `Owner description:\n${trimmed}`,
    supplements.speechSupplement?.trim() ? `Speech style supplement:\n${supplements.speechSupplement.trim()}` : '',
    supplements.boundarySupplement?.trim() ? `Behavior boundary supplement:\n${supplements.boundarySupplement.trim()}` : '',
    supplements.visualSupplement?.trim() ? `Visual style supplement:\n${supplements.visualSupplement.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  return {
    ok: true,
    errors: [],
    payload: {
      surfaceId: 'realm-persona-studio.persona-seed',
      params: {
        maxTokens: 1200,
        temperature: 0.7,
        topP: 1,
      },
      systemText: [
        'You generate an owner-reviewed Realm Persona draft from a one-line user description.',
        'Return ONE JSON object. No prose before or after. No code fences.',
        'Required keys: handle, displayName, concept, description, ruleText, personaArchetype, personaTraits, rationale.',
        '',
        '— Field rules —',
        'handle: short kebab-case latin suggestion (3-20 chars), no leading @, lowercase letters/digits/hyphens only.',
        'displayName: 2-32 chars; match the user\'s described language (Chinese, English, etc).',
        'concept: 1-2 sentences naming the core creative concept.',
        'description: 1 short public profile description (≤500 chars).',
        'ruleText: optional behavior/boundary lines, one per line; empty string if nothing meaningful.',
        `personaArchetype: EXACTLY ONE of ${PERSONA_ARCHETYPES.join(' | ')}`,
        `personaTraits: array of 1-3 traits from ${PERSONA_TRAITS.join(' | ')}`,
        'rationale: 1-2 sentences explaining the design choice (English).',
        '',
        '— Hard prohibitions —',
        'Never include: handle prefix @, provider, model, lifecycle, state, worldId, ownerId, dna (full JSON), avatarUrl, profileCoverUrl, personaRule, personaRules, LocalAgent.',
        'Never include code fences, comments, or trailing text outside the JSON object.',
      ].join('\n'),
      userText: JSON.stringify({
        userDescription: ownerPromptParts,
        personaArchetypeAllowed: PERSONA_ARCHETYPES,
        personaTraitsAllowed: PERSONA_TRAITS,
      }),
    },
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
  };
  if (!seed.displayName || !seed.concept) {
    throw new Error('LLM output missing required `displayName` or `concept`.');
  }
  if (!seed.personaArchetype) {
    throw new Error('LLM output personaArchetype missing or outside the supported archetypes.');
  }
  if (!Array.isArray(obj.personaTraits) || obj.personaTraits.length > 3 || seed.personaTraits.length !== obj.personaTraits.length) {
    throw new Error('LLM output personaTraits must contain at most 3 values from the supported trait vocabulary.');
  }
  const rationale = readString(obj.rationale);
  return { seed, rationale };
}

export async function generatePersonaSeedFromDescription(
  description: string,
  runner: StudioTextCandidateRunner = runStudioTextCandidate,
  supplements: PersonaSeedPromptSupplements = {},
): Promise<PersonaSeedGenerationResult> {
  const built = buildPersonaSeedPayload(description, supplements);
  if (!built.ok || !built.payload) {
    return {
      ok: false,
      source: PERSONA_SEED_SOURCE,
      failure: 'persona-seed-description-empty',
      message: built.errors.join('; ') || 'Persona seed payload invalid.',
      submitted: null,
    };
  }
  try {
    const output = await runner(built.payload);
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
        message: error instanceof Error ? error.message : 'Persona seed output invalid.',
        submitted: output.submitted,
      };
    }
  } catch (error) {
    return {
      ok: false,
      source: PERSONA_SEED_SOURCE,
      failure: 'persona-seed-generate-failed',
      message: `Nimi text candidate generation failed: ${error instanceof Error ? error.message : 'operation failed.'}`,
      submitted: built.payload,
    };
  }
}
