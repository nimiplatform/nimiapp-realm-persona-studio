import { describe, expect, it } from 'vitest';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import type { LocalPostDraftInput } from './post-draft.js';
import { requestPostCopyPolish } from './post-copy-polish.js';
import type { StudioTextCandidateRunner } from './studio-text-candidate.js';

const persona = {
  id: 'persona-1',
  contentHash: 'hash-persona-1',
  sourceHash: 'source-hash-persona-1',
  contentRevision: 1,
  homeWorldId: 'world-oasis',
  displayName: { value: 'Mira' },
  handle: { value: 'mira' },
  bio: { value: '' },
  greeting: { value: '' },
  source: 'Nimi App Access realm.personaCharacter.getOwned',
} as unknown as OwnerPortfolioPersonaDetail;

const draft: LocalPostDraftInput = {
  caption: 'rough first pass',
  tagsText: 'draft',
  humanReviewed: false,
  attachmentEnabled: false,
  attachmentTargetType: 'RESOURCE',
  attachmentTargetId: '',
};

function runnerReturning(text: string): StudioTextCandidateRunner {
  return async (prompt) => ({
    text,
    finishReason: 'stop',
    traceId: 'trace-1',
    submitted: prompt,
  });
}

function runnerThrowing(error: unknown): StudioTextCandidateRunner {
  return async () => {
    throw error;
  };
}

describe('post copy polish candidate', () => {
  it('returns a reviewable proposal built from owner-visible draft state', async () => {
    const result = await requestPostCopyPolish(
      { persona, draft, intent: 'Polish the copy.' },
      runnerReturning(JSON.stringify({
        caption: 'A polished first pass.',
        tagsText: 'draft, polished',
        rationale: 'Smoothed the rough edges.',
      })),
    );

    expect(result).toEqual({
      ok: true,
      proposal: expect.objectContaining({
        candidate: true,
        truthWrite: false,
        draftPatch: { caption: 'A polished first pass.', tagsText: 'draft, polished' },
        changedPostKeys: ['caption', 'tagsText'],
      }),
    });
  });

  it('fails closed with route-unbound when no text generation route is configured', async () => {
    const result = await requestPostCopyPolish(
      { persona, draft, intent: 'Polish the copy.' },
      runnerThrowing(Object.assign(new Error('no route'), { reasonCode: 'AI_CONFIG_NOT_FOUND' })),
    );

    expect(result).toEqual({ ok: false, failure: 'post-copy-polish-route-unbound' });
  });

  it('fails closed with generate-failed on other runner errors', async () => {
    const result = await requestPostCopyPolish(
      { persona, draft, intent: 'Polish the copy.' },
      runnerThrowing(new Error('transport exploded')),
    );

    expect(result).toEqual({ ok: false, failure: 'post-copy-polish-generate-failed' });
  });

  it('fails closed with invalid-output on prose, unchanged copy, or forbidden fields', async () => {
    expect(await requestPostCopyPolish(
      { persona, draft, intent: 'Polish the copy.' },
      runnerReturning('Here is your polished post, hope you like it!'),
    )).toEqual({ ok: false, failure: 'post-copy-polish-invalid-output' });

    expect(await requestPostCopyPolish(
      { persona, draft, intent: 'Polish the copy.' },
      runnerReturning(JSON.stringify({ caption: draft.caption, rationale: 'No changes needed.' })),
    )).toEqual({ ok: false, failure: 'post-copy-polish-invalid-output' });

    expect(await requestPostCopyPolish(
      { persona, draft, intent: 'Polish the copy.' },
      runnerReturning(JSON.stringify({ caption: 'Sneaky.', publishSuccess: true })),
    )).toEqual({ ok: false, failure: 'post-copy-polish-invalid-output' });
  });
});
