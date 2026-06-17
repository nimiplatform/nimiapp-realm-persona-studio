import { createStudioRuntimeClient } from '@renderer/data/runtime-client.js';
import {
  DNA_PRIMARY_ARCHETYPES,
  DNA_SECONDARY_TRAITS,
  type CreateRealmPersonaDraftInput,
  type DnaPrimaryArchetype,
  type DnaSecondaryTrait,
} from './create-persona-draft.js';
import {
  buildStudioTextRequestParameters,
  buildStudioRuntimeMetadata,
  resolveStudioTextCallParams,
  runStudioTextGenerate,
  studioTextMessage,
  type StudioRuntimeAIClient,
  type StudioTextGenerationOutput,
  type StudioTextGeneratePayload,
} from './studio-ai-runtime.js';
import { parseStrictRuntimeJsonObject } from './strict-runtime-json.js';

export const PERSONA_SEED_SOURCE = 'Runtime runtime.ai.text.generate' as const;

/**
 * Subset of CreateRealmPersonaDraftInput populated by the LLM. World selection
 * and the post-create handle availability check stay manual — the LLM only
 * provides a handle SUGGESTION, the user must still verify it via the existing
 * `personaControllerCheckHandle` flow.
 */
export type GeneratedPersonaSeed = Pick<
  CreateRealmPersonaDraftInput,
  'handle' | 'displayName' | 'concept' | 'description' | 'ruleText' | 'dnaPrimary' | 'dnaSecondary'
>;

export type PersonaSeedGenerationResult =
  | {
    ok: true;
    source: typeof PERSONA_SEED_SOURCE;
    seed: GeneratedPersonaSeed;
    rationale: string;
    submitted: StudioTextGeneratePayload;
    runtime: {
      traceId?: string;
      modelResolved?: string;
      finishReason?: string;
    };
  }
  | {
    ok: false;
    source: typeof PERSONA_SEED_SOURCE;
    failure:
      | 'persona-seed-description-empty'
      | 'persona-seed-transport-unavailable'
      | 'persona-seed-generate-failed'
      | 'persona-seed-invalid-output';
    message: string;
      submitted: StudioTextGeneratePayload | null;
  };

const PERSONA_SEED_OUTPUT_KEYS = [
  'handle',
  'displayName',
  'concept',
  'description',
  'ruleText',
  'dnaPrimary',
  'dnaSecondary',
  'rationale',
] as const;

function buildPersonaSeedPayload(description: string): {
  ok: boolean;
  errors: string[];
  payload: StudioTextGeneratePayload | null;
} {
  const trimmed = description.trim();
  const errors: string[] = [];
  if (!trimmed) errors.push('persona description empty');
  if (errors.length > 0) {
    return { ok: false, errors, payload: null };
  }
  const callParams = resolveStudioTextCallParams('realm-persona-studio.persona-seed', {
    maxTokens: 1200,
    temperature: 0.7,
  });
  return {
    ok: true,
    errors: [],
    payload: {
      surfaceId: 'realm-persona-studio.persona-seed',
      params: callParams,
      request: {
        model: { modelId: callParams.model },
        messages: [
          studioTextMessage('system', [
            'You generate an owner-reviewed Realm Persona draft from a one-line user description.',
            'Return ONE JSON object. No prose before or after. No code fences.',
            'Required keys: handle, displayName, concept, description, ruleText, dnaPrimary, dnaSecondary, rationale.',
            '',
            '— Field rules —',
            'handle: short kebab-case latin suggestion (3-20 chars), no leading @, lowercase letters/digits/hyphens only.',
            'displayName: 2-32 chars; match the user\'s described language (Chinese, English, etc).',
            'concept: 1-2 sentences naming the core creative concept.',
            'description: 1 short public profile description (≤500 chars).',
            'ruleText: optional behavior/boundary lines, one per line; empty string if nothing meaningful.',
            `dnaPrimary: EXACTLY ONE of ${DNA_PRIMARY_ARCHETYPES.join(' | ')}`,
            `dnaSecondary: array of 1-3 traits from ${DNA_SECONDARY_TRAITS.join(' | ')}`,
            'rationale: 1-2 sentences explaining the design choice (English).',
            '',
            '— Hard prohibitions —',
            'Never include: handle prefix @, provider, model, lifecycle, state, worldId, ownerId, dna (full JSON), avatarUrl, profileCoverUrl, personaRule, personaRules, LocalAgent.',
            'Never include code fences, comments, or trailing text outside the JSON object.',
          ].join('\n')),
          studioTextMessage('user', JSON.stringify({
            userDescription: trimmed,
            dnaPrimaryAllowed: DNA_PRIMARY_ARCHETYPES,
            dnaSecondaryAllowed: DNA_SECONDARY_TRAITS,
          })),
        ],
        parameters: buildStudioTextRequestParameters(
          callParams,
          buildStudioRuntimeMetadata('realm-persona-studio.persona-seed'),
        ),
      },
    },
  };
}

function readString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function readDnaPrimary(value: unknown): DnaPrimaryArchetype | '' {
  const upper = readString(value).toUpperCase();
  return (DNA_PRIMARY_ARCHETYPES as readonly string[]).includes(upper)
    ? (upper as DnaPrimaryArchetype)
    : '';
}

function readDnaSecondary(value: unknown): DnaSecondaryTrait[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<DnaSecondaryTrait>(DNA_SECONDARY_TRAITS);
  const seen = new Set<DnaSecondaryTrait>();
  const out: DnaSecondaryTrait[] = [];
  for (const item of value) {
    const upper = readString(item).toUpperCase() as DnaSecondaryTrait;
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
    dnaPrimary: readDnaPrimary(obj.dnaPrimary),
    dnaSecondary: readDnaSecondary(obj.dnaSecondary),
  };
  if (!seed.displayName || !seed.concept) {
    throw new Error('LLM output missing required `displayName` or `concept`.');
  }
  if (!seed.dnaPrimary) {
    throw new Error('LLM output dnaPrimary missing or not one of the 6 admitted archetypes.');
  }
  const rationale = readString(obj.rationale);
  return { seed, rationale };
}

export async function generatePersonaSeedFromDescription(
  description: string,
  runtime?: StudioRuntimeAIClient | null,
): Promise<PersonaSeedGenerationResult> {
  const built = buildPersonaSeedPayload(description);
  if (!built.ok || !built.payload) {
    return {
      ok: false,
      source: PERSONA_SEED_SOURCE,
      failure: 'persona-seed-description-empty',
      message: built.errors.join('; ') || 'Persona seed payload invalid.',
      submitted: null,
    };
  }
  const runtimeClient = runtime === undefined ? await createStudioRuntimeClient() : runtime;
  if (!runtimeClient) {
    return {
      ok: false,
      source: PERSONA_SEED_SOURCE,
      failure: 'persona-seed-transport-unavailable',
      message: 'Runtime runtime.ai.text.generate runtime transport unavailable: Tauri IPC runtime transport is required.',
      submitted: built.payload,
    };
  }
  try {
    const output: StudioTextGenerationOutput = await runStudioTextGenerate(built.payload, runtimeClient);
    try {
      const parsed = parsePersonaSeedOutput(output.text);
      return {
        ok: true,
        source: PERSONA_SEED_SOURCE,
        seed: parsed.seed,
        rationale: parsed.rationale,
        submitted: output.submitted,
        runtime: {
          ...(output.trace?.traceId ? { traceId: output.trace.traceId } : {}),
          ...(output.trace?.modelResolved ? { modelResolved: output.trace.modelResolved } : {}),
          ...(output.finishReason ? { finishReason: String(output.finishReason) } : {}),
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
      message: `Runtime runtime.ai.text.generate failed: ${error instanceof Error ? error.message : 'runtime transport call failed.'}`,
      submitted: null,
    };
  }
}
