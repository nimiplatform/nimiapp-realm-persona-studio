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

const STUDIO_TEXT_ROUTE_UNBOUND_REASON_CODES: readonly string[] = [
  'AI_CONFIG_NOT_FOUND',
  'AI_LOCAL_CONFIGURATION_NOT_CONFIGURED',
  'AI_LOCAL_SELECTION_NOT_FOUND',
  'AI_LOCAL_CAPABILITY_MISMATCH',
  'AI_LOADOUT_NOT_FOUND',
  'AI_LOADOUT_DRIVER_UNAVAILABLE',
  'AI_LOADOUT_MODEL_ASSET_NOT_FOUND',
  'AI_LOADOUT_MODEL_ASSET_CONTENT_MISMATCH',
  'AI_LOADOUT_MODEL_CONTRACT_FAILED',
  'AI_LOADOUT_NOT_CONFIGURED',
  'AI_MODEL_NOT_READY',
  'AI_ROUTE_UNSUPPORTED',
];

/**
 * True when the protected text operation rejected the call because no
 * text-generation route is bound yet (owner AI configuration missing), as
 * opposed to a live transport or output failure.
 */
export function isStudioTextRouteUnboundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  const value = typeof record.reasonCode === 'string'
    ? record.reasonCode
    : typeof record.code === 'string'
      ? record.code
      : '';
  return STUDIO_TEXT_ROUTE_UNBOUND_REASON_CODES.includes(value.trim().toUpperCase().replaceAll('-', '_'));
}

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
