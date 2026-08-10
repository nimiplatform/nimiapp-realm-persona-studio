import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';

/**
 * Studio text candidate runner on the Nimi App Access contract. Studio submits
 * an owner-reviewed system/user prompt pair plus bounded params; the local App
 * surface owns route and implementation selection.
 */

export type StudioTextCandidateParams = {
  maxTokens: number;
  temperature: number;
  topP: number;
};

export type StudioTextCandidatePrompt = {
  surfaceId: string;
  systemText: string;
  userText: string;
  params: StudioTextCandidateParams;
};

export type StudioTextCandidateOutput = {
  text: string;
  finishReason: 'stop' | 'length' | 'content-filter';
  traceId: string;
  submitted: StudioTextCandidatePrompt;
};

export type StudioTextCandidateRunner = (
  prompt: StudioTextCandidatePrompt,
) => Promise<StudioTextCandidateOutput>;

export async function runStudioTextCandidate(
  prompt: StudioTextCandidatePrompt,
): Promise<StudioTextCandidateOutput> {
  const output = await getStudioLocalAppClient().ai.text.generateCandidate({
    messages: [
      { role: 'system', text: prompt.systemText },
      { role: 'user', text: prompt.userText },
    ],
    temperature: prompt.params.temperature,
    topP: prompt.params.topP,
    maxTokens: prompt.params.maxTokens,
  });
  return {
    text: output.text,
    finishReason: output.finishReason,
    traceId: output.traceId,
    submitted: prompt,
  };
}
