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
  type StudioTextCandidateRunner,
} from './studio-text-candidate.js';

/**
 * Owner-triggered AI polish for the local post draft. The Runtime output is
 * candidate material only: it returns to the editor as a reviewable proposal
 * and never rewrites the draft by itself.
 *
 * @nimi-authority: rule.realm-persona-studio.post.r002
 */

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

  let outputText: string;
  try {
    outputText = (await runner(prompt.payload)).text;
  } catch (error) {
    return {
      ok: false,
      failure: isStudioTextRouteUnboundError(error)
        ? 'post-copy-polish-route-unbound'
        : 'post-copy-polish-generate-failed',
    };
  }

  try {
    return { ok: true, proposal: normalizeRuntimePostCopyProposal(outputText, input.draft) };
  } catch {
    return { ok: false, failure: 'post-copy-polish-invalid-output' };
  }
}
