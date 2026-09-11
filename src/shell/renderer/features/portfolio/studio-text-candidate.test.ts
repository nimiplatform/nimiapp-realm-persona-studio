import { expect, it, vi } from 'vitest';
import { parseStrictRuntimeJsonObject } from './strict-runtime-json.js';
import { runValidatedStudioTextCandidate, StudioTextCandidateValidationError, type StudioTextCandidatePrompt, type StudioTextCandidateRunner } from './studio-text-candidate.js';

const prompt: StudioTextCandidatePrompt = { surfaceId: 'persona-seed', systemText: 'Return name and rationale only.', userText: 'A rain-night bookseller.', params: { maxTokens: 1000, temperature: 0.7, topP: 1 } };
const validate = (rawText: string) => parseStrictRuntimeJsonObject({ rawText, allowedKeys: ['name', 'rationale'], label: 'Character' });
function runnerFor(...answers: string[]) {
  let i = 0;
  return vi.fn<StudioTextCandidateRunner>(async (submitted) => ({ text: answers[Math.min(i++, answers.length - 1)]!, submitted, finishReason: 'stop', traceId: `test-trace-${i}` }));
}
it('asks AI to correct a malformed response once and validates the new answer before returning it', async () => {
  const runner = runnerFor('{"name":"闻灯","ratione":"Typo"}', '{"name":"闻灯","rationale":"A guarded bookseller."}');
  const result = await runValidatedStudioTextCandidate(prompt, validate, runner);
  expect(result.value).toEqual({ name: '闻灯', rationale: 'A guarded bookseller.' });
  expect(runner).toHaveBeenCalledTimes(2);
  expect(runner.mock.calls[1]![0].userText).toContain('unknown field ratione');
  expect(result.output.submitted).toEqual(runner.mock.calls[1]![0]);
});
it('fails closed when the second response is still invalid, without stripping fields or looping again', async () => {
  const runner = runnerFor('{"name":"闻灯","unexpected":true}');
  await expect(runValidatedStudioTextCandidate(prompt, validate, runner)).rejects.toBeInstanceOf(StudioTextCandidateValidationError);
  expect(runner).toHaveBeenCalledTimes(2);
});
it('does not retry a failed transport', async () => {
  const runner = vi.fn<StudioTextCandidateRunner>().mockRejectedValue(new Error('route unavailable'));
  await expect(runValidatedStudioTextCandidate(prompt, validate, runner)).rejects.toThrow('route unavailable');
  expect(runner).toHaveBeenCalledTimes(1);
});
