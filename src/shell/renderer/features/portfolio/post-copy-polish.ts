import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  buildRuntimePostCopyPrompt,
  normalizeRuntimePostCopyProposal,
  type LocalPostDraftInput,
  type RuntimePostCopyProposal,
} from './post-draft.js';
import {
  isStudioTextRouteUnboundError,
  runStudioTextCandidate,
  runValidatedStudioTextCandidate,
  StudioTextCandidateValidationError,
  type StudioTextCandidateRunner,
} from './studio-text-candidate.js';

/**
 * Owner-triggered AI polish for the local post draft. The Runtime output is
 * candidate material only: it returns to the editor as a reviewable proposal
 * and never rewrites the draft by itself.
 *
 */
// @nimi-authority: rule.realm-persona-studio.post.r002

export type PostCopyPolishFailure =
  | 'post-copy-polish-route-unbound'
  | 'post-copy-polish-generate-failed'
  | 'post-copy-polish-invalid-output';

export type PostCopyPolishResult =
  | { ok: true; proposal: RuntimePostCopyProposal }
  | { ok: false; failure: PostCopyPolishFailure };

export async function requestPostCopyPolish(
  input: {
    persona: OwnerPortfolioPersonaDetail;
    draft: LocalPostDraftInput;
    intent: string;
  },
  runner: StudioTextCandidateRunner = runStudioTextCandidate,
): Promise<PostCopyPolishResult> {
  const prompt = buildRuntimePostCopyPrompt(input);
  if (!prompt.ok) {
    return { ok: false, failure: 'post-copy-polish-invalid-output' };
  }

  try {
    const { value: proposal } = await runValidatedStudioTextCandidate(
      prompt.payload, (text) => normalizeRuntimePostCopyProposal(text, input.draft), runner,
    );
    return { ok: true, proposal };
  } catch (error) {
    if (error instanceof StudioTextCandidateValidationError) {
      return { ok: false, failure: 'post-copy-polish-invalid-output' };
    }
    return {
      ok: false,
      failure: isStudioTextRouteUnboundError(error)
        ? 'post-copy-polish-route-unbound'
        : 'post-copy-polish-generate-failed',
    };
  }

}
