import { describe, expect, it, vi } from 'vitest';
import { generatePersonaDescriptionCandidate } from './persona-description-generator.js';
import type { StudioTextCandidateRunner } from './studio-text-candidate.js';

function fakeTextCandidateRunner(text: string): StudioTextCandidateRunner {
  return async (prompt) => ({
    text,
    finishReason: 'stop',
    traceId: 'trace-description-1',
    submitted: prompt,
  });
}

describe('persona description reroll through the injected text candidate runner', () => {
  it('runs zero-input reroll bound to the active locale', async () => {
    const runner = vi.fn(fakeTextCandidateRunner('  一个经营深夜茶馆的退休侠客，话不多，但记得每位熟客的口味。  '));

    const result = await generatePersonaDescriptionCandidate(
      { locale: 'zh' },
      runner,
    );

    expect(runner).toHaveBeenCalledTimes(1);
    const submitted = runner.mock.calls[0]?.[0];
    expect(submitted).toMatchObject({
      surfaceId: 'realm-persona-studio.persona-description',
      params: { maxTokens: 500, temperature: 1, topP: 1 },
    });
    expect(submitted?.systemText).toContain('Write in Chinese');
    expect(submitted?.systemText).not.toContain('different concept');
    expect(result).toMatchObject({
      ok: true,
      description: '一个经营深夜茶馆的退休侠客，话不多，但记得每位熟客的口味。',
      runtime: {
        traceId: 'trace-description-1',
        finishReason: 'stop',
      },
    });
  });

  it('steers away from the previous idea and treats supplements as hard constraints', async () => {
    const runner = vi.fn(fakeTextCandidateRunner('A retired cartographer who maps dreams.'));

    await generatePersonaDescriptionCandidate(
      {
        previousDescription: 'A cheerful tavern bard.',
        supplements: {
          speechSupplement: 'Speaks in short, precise sentences.',
          boundarySupplement: '',
          visualSupplement: 'Wears ink-stained gloves.',
        },
        locale: 'en',
      },
      runner,
    );

    const submitted = runner.mock.calls[0]?.[0];
    expect(submitted?.systemText).toContain('different concept, tone, and setting');
    expect(submitted?.systemText).toContain('hard constraints');
    expect(submitted?.userText).toContain('A cheerful tavern bard.');
    expect(submitted?.userText).toContain('Speaks in short, precise sentences.');
    expect(submitted?.userText).toContain('Wears ink-stained gloves.');
  });

  it('maps empty or structured candidate text to persona-description-invalid-output', async () => {
    const empty = await generatePersonaDescriptionCandidate(
      { locale: 'en' },
      fakeTextCandidateRunner('   '),
    );
    expect(empty).toMatchObject({
      ok: false,
      failure: 'persona-description-invalid-output',
    });

    const structured = await generatePersonaDescriptionCandidate(
      { locale: 'en' },
      fakeTextCandidateRunner('{"description":"json drift"}'),
    );
    expect(structured).toMatchObject({
      ok: false,
      failure: 'persona-description-invalid-output',
    });
  });

  it('maps runner failures without inventing a description', async () => {
    const runner: StudioTextCandidateRunner = async () => {
      throw new Error('local app surface unavailable');
    };

    const result = await generatePersonaDescriptionCandidate({ locale: 'en' }, runner);

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-description-generate-failed',
      cause: { kind: 'description-generate-failed' },
    });
  });

  it('maps an unbound AI route to the configure-first failure kind', async () => {
    const runner: StudioTextCandidateRunner = async () => {
      throw Object.assign(new Error('AI route is not configured.'), { reasonCode: 'AI_LOCAL_CONFIGURATION_NOT_CONFIGURED' });
    };

    const result = await generatePersonaDescriptionCandidate({ locale: 'en' }, runner);

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-description-generate-failed',
      cause: { kind: 'runtime-route-unbound' },
    });
  });
});
