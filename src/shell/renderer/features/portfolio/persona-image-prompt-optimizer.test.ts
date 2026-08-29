import { describe, expect, it, vi } from 'vitest';
import { optimizePersonaImagePrompt } from './persona-image-prompt-optimizer.js';
import type { StudioTextCandidateRunner } from './studio-text-candidate.js';

function fakeTextCandidateRunner(text: string): StudioTextCandidateRunner {
  return async (prompt) => ({
    text,
    finishReason: 'stop',
    traceId: 'trace-image-prompt-1',
    submitted: prompt,
  });
}

const BASE_INPUT = {
  originalDescription: '你好，我是梦琦。我能进入你的梦境，替你修补那些破碎的时光片段。',
  description: '梦琦，一位修补梦境碎片的神秘旅人。',
  displayName: '梦琦·拾光',
  concept: '进入梦境修补遗憾时光的神秘角色',
  personaArchetype: 'MYSTERIOUS',
  locale: 'zh' as const,
};

describe('persona image prompt optimization through the injected text candidate runner', () => {
  it('returns a visual prompt bound to the active locale', async () => {
    const runner = vi.fn(fakeTextCandidateRunner('  银灰色长发的年轻女性，眼神安静而神秘，身着缀有碎光纹样的深色长袍，全身像，电影感打光，柔和冷色调，背景虚化的梦境碎片。  '));

    const result = await optimizePersonaImagePrompt(BASE_INPUT, runner);

    expect(runner).toHaveBeenCalledTimes(1);
    const submitted = runner.mock.calls[0]?.[0];
    expect(submitted).toMatchObject({
      surfaceId: 'realm-persona-studio.persona-image-prompt',
    });
    expect(submitted?.systemText).toContain('Write in Chinese');
    expect(submitted?.systemText).toContain('Never transcribe greetings, dialogue');
    expect(submitted?.userText).toContain('梦琦·拾光');
    expect(submitted?.userText).toContain('MYSTERIOUS');
    expect(result).toMatchObject({
      ok: true,
      prompt: '银灰色长发的年轻女性，眼神安静而神秘，身着缀有碎光纹样的深色长袍，全身像，电影感打光，柔和冷色调，背景虚化的梦境碎片。',
      runtime: {
        traceId: 'trace-image-prompt-1',
        finishReason: 'stop',
      },
    });
  });

  it('treats the current prompt as owner intent and the visual supplement as a hard constraint', async () => {
    const runner = vi.fn(fakeTextCandidateRunner('A refined visual prompt.'));

    await optimizePersonaImagePrompt(
      {
        ...BASE_INPUT,
        locale: 'en',
        currentPrompt: 'watercolor style portrait',
        visualSupplement: 'Always wears a silver pocket watch.',
      },
      runner,
    );

    const submitted = runner.mock.calls[0]?.[0];
    expect(submitted?.systemText).toContain('intent to refine');
    expect(submitted?.systemText).toContain('hard constraint');
    expect(submitted?.userText).toContain('watercolor style portrait');
    expect(submitted?.userText).toContain('Always wears a silver pocket watch.');
  });

  it('maps empty or structured candidate text to persona-image-prompt-invalid-output', async () => {
    const empty = await optimizePersonaImagePrompt(
      BASE_INPUT,
      fakeTextCandidateRunner('   '),
    );
    expect(empty).toMatchObject({
      ok: false,
      failure: 'persona-image-prompt-invalid-output',
      cause: { kind: 'image-prompt-invalid-output' },
    });

    const structured = await optimizePersonaImagePrompt(
      BASE_INPUT,
      fakeTextCandidateRunner('{"prompt":"json drift"}'),
    );
    expect(structured).toMatchObject({
      ok: false,
      failure: 'persona-image-prompt-invalid-output',
    });
  });

  it('maps runner failures without inventing a prompt', async () => {
    const runner: StudioTextCandidateRunner = async () => {
      throw new Error('local app surface unavailable');
    };

    const result = await optimizePersonaImagePrompt(BASE_INPUT, runner);

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-image-prompt-optimize-failed',
      cause: { kind: 'image-prompt-optimize-failed' },
    });
  });
});
