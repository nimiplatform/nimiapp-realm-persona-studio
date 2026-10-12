import { expect, it, vi } from 'vitest';
import { parseStrictRuntimeJsonObject } from './strict-runtime-json.js';
import { runStudioTextCandidate, runValidatedStudioTextCandidate, StudioTextCandidateValidationError, type StudioTextCandidatePrompt, type StudioTextCandidateRunner } from './studio-text-candidate.js';

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));
vi.mock('@renderer/app-shell/studio-platform.js', () => ({ getStudioLocalAppClient: () => ({ ai: { text: { generateCandidate: generateMock } } }) }));

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
  expect(runner.mock.calls[1]![0].params).toEqual(prompt.params);
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
it('sends no guessed generation controls for an unset candidate request', async () => {
  generateMock.mockResolvedValue({ text: 'Complete candidate', finishReason: 'stop', traceId: 'trace-1' });
  await runStudioTextCandidate({ ...prompt, params: {} });
  expect(Object.keys(generateMock.mock.calls.at(-1)![0])).toEqual(['messages']);
});
it('preserves explicitly selected controls including zero values', async () => {
  generateMock.mockResolvedValue({ text: 'Complete candidate', finishReason: 'stop', traceId: 'trace-1' });
  await runStudioTextCandidate({ ...prompt, params: { temperature: 0, topP: 0.8, maxTokens: 1200 } });
  expect(generateMock.mock.calls.at(-1)![0]).toMatchObject({ temperature: 0, topP: 0.8, maxTokens: 1200 });
});
