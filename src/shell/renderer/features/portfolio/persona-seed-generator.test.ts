import { describe, expect, it, vi } from 'vitest';
import {
  generatePersonaSeedFromDescription,
  parsePersonaSeedOutput,
} from './persona-seed-generator.js';
import type { StudioTextCandidateRunner } from './studio-text-candidate.js';

const validSeed = {
  handle: 'mira-prime',
  displayName: 'Mira Prime',
  concept: 'Operational guide for artifact reviews.',
  description: 'Mira helps owners shape and review public persona behavior.',
  ruleText: 'Keep output practical.',
  personaArchetype: 'INTELLECTUAL',
  personaTraits: ['WISE', 'DIRECT'],
  rationale: 'Matches the owner brief.',
};

function fakeTextCandidateRunner(text: string): StudioTextCandidateRunner {
  return async (prompt) => ({
    text,
    finishReason: 'stop',
    traceId: 'trace-seed-1',
    submitted: prompt,
  });
}

describe('persona seed Runtime output parser', () => {
  it('parses a strict single JSON object into owner-reviewed draft fields', () => {
    expect(parsePersonaSeedOutput(JSON.stringify(validSeed))).toMatchObject({
      seed: {
        handle: 'mira-prime',
        displayName: 'Mira Prime',
        personaArchetype: 'INTELLECTUAL',
        personaTraits: ['WISE', 'DIRECT'],
      },
      rationale: 'Matches the owner brief.',
    });
  });

  it('rejects wrapper text, code fences, unknown fields, and invalid traits', () => {
    expect(() => parsePersonaSeedOutput(`Here is a draft:\n${JSON.stringify(validSeed)}`))
      .toThrow('single JSON object');
    expect(() => parsePersonaSeedOutput(`\`\`\`json\n${JSON.stringify(validSeed)}\n\`\`\``))
      .toThrow('single JSON object');
    expect(() => parsePersonaSeedOutput(JSON.stringify({
      ...validSeed,
      model: 'forbidden',
    }))).toThrow('unknown field model');
    expect(() => parsePersonaSeedOutput(JSON.stringify({
      ...validSeed,
      personaTraits: ['WISE', 'UNKNOWN'],
    }))).toThrow('supported trait vocabulary');
  });
});

describe('persona seed generation through the injected text candidate runner', () => {
  it('submits the owner-reviewed prompt and supplements to the injected runner in completion mode', async () => {
    const runner = vi.fn(fakeTextCandidateRunner(JSON.stringify(validSeed)));

    const result = await generatePersonaSeedFromDescription(
      'A calm artifact review guide.',
      runner,
      {
        speechSupplement: 'Speak in calm, direct sentences.',
        boundarySupplement: 'Do not claim private memory.',
        visualSupplement: 'Use a cool night palette.',
      },
      { locale: 'en' },
    );

    expect(runner).toHaveBeenCalledTimes(1);
    const submitted = runner.mock.calls[0]?.[0];
    expect(submitted).toMatchObject({
      surfaceId: 'realm-persona-studio.persona-seed',
      params: { maxTokens: 1200, temperature: 0.7, topP: 1 },
    });
    expect(submitted?.systemText).toContain('owner-reviewed Realm Persona draft');
    expect(submitted?.userText).toContain('"mode":"completion"');
    expect(submitted?.userText).toContain('A calm artifact review guide.');
    expect(submitted?.userText).toContain('Speak in calm, direct sentences.');
    expect(submitted?.userText).toContain('Do not claim private memory.');
    expect(submitted?.userText).toContain('Use a cool night palette.');
    expect(result).toMatchObject({
      ok: true,
      seed: {
        handle: 'mira-prime',
        displayName: 'Mira Prime',
        personaArchetype: 'INTELLECTUAL',
      },
      rationale: 'Matches the owner brief.',
      runtime: {
        traceId: 'trace-seed-1',
        finishReason: 'stop',
      },
    });
  });

  it('runs zero-input generation in creative mode with locale-bound output language', async () => {
    const runner = vi.fn(fakeTextCandidateRunner(JSON.stringify({
      ...validSeed,
      displayName: '安静守夜人',
      speechStyle: '话很少，语速慢。',
      behaviorBoundary: '绝不泄露守夜路线。',
    })));

    const result = await generatePersonaSeedFromDescription('   ', runner, {}, { locale: 'zh' });

    expect(runner).toHaveBeenCalledTimes(1);
    const submitted = runner.mock.calls[0]?.[0];
    expect(submitted).toMatchObject({
      surfaceId: 'realm-persona-studio.persona-seed',
      params: { maxTokens: 1200, temperature: 0.9, topP: 1 },
    });
    expect(submitted?.systemText).toContain('invent an original, complete Realm Persona draft from scratch');
    expect(submitted?.systemText).toContain('write in Chinese');
    expect(submitted?.userText).toContain('"mode":"creative"');
    expect(result).toMatchObject({
      ok: true,
      seed: {
        displayName: '安静守夜人',
        speechStyle: '话很少，语速慢。',
        behaviorBoundary: '绝不泄露守夜路线。',
      },
    });
  });

  it('treats supplements without a description as creative-mode hard constraints', async () => {
    const runner = vi.fn(fakeTextCandidateRunner(JSON.stringify(validSeed)));

    await generatePersonaSeedFromDescription(
      '',
      runner,
      { speechSupplement: 'Speak in calm, direct sentences.' },
      { locale: 'en' },
    );

    const submitted = runner.mock.calls[0]?.[0];
    expect(submitted?.userText).toContain('"mode":"creative"');
    expect(submitted?.userText).toContain('Speak in calm, direct sentences.');
    expect(submitted?.systemText).toContain('hard constraints');
  });

  it('maps runner failures without inventing a seed', async () => {
    const runner: StudioTextCandidateRunner = async () => {
      throw new Error('local app surface unavailable');
    };

    const result = await generatePersonaSeedFromDescription('A calm artifact review guide.', runner, {}, { locale: 'en' });

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-seed-generate-failed',
      cause: { kind: 'seed-generate-failed' },
    });
  });

  it('maps an unbound AI route to the configure-first failure kind', async () => {
    const runner: StudioTextCandidateRunner = async () => {
      throw Object.assign(new Error('AI route is not configured.'), { reasonCode: 'AI_CONFIG_NOT_FOUND' });
    };

    const result = await generatePersonaSeedFromDescription('A calm artifact review guide.', runner, {}, { locale: 'en' });

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-seed-generate-failed',
      cause: { kind: 'runtime-route-unbound' },
    });
  });

  it('maps unparseable candidate text to persona-seed-invalid-output', async () => {
    const result = await generatePersonaSeedFromDescription(
      'A calm artifact review guide.',
      fakeTextCandidateRunner('not json at all'),
      {},
      { locale: 'en' },
    );

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-seed-invalid-output',
    });
  });
});
