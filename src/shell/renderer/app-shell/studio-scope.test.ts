import { expect, it, vi } from 'vitest';
import { getStudioClient } from './studio-platform.js';
import { getStudioProtectedJsonStorage } from './studio-storage.js';
import type { StudioScope } from './studio-scope.js';
import { runStudioTextCandidate } from '../features/portfolio/studio-text-candidate.js';
import { deferred } from '../../../test/studio-scope.js';

function scoped(client: unknown) {
  const controller = new AbortController();
  return { controller, scope: { client, signal: controller.signal, viewKey: 'unit' } as StudioScope };
}
it('a closed scope rejects late JSON results and queued writes without changing clients', async () => {
  const read = deferred<{ value: unknown; sizeBytes: number }>();
  const writeA = vi.fn(), writeB = vi.fn(async () => ({ value: {}, sizeBytes: 2 }));
  const a = scoped({ storage: { readJson: () => read.promise, writeJson: writeA } });
  const b = scoped({ storage: { writeJson: writeB } });
  const ownerA = getStudioProtectedJsonStorage(a.scope), ownerB = getStudioProtectedJsonStorage(b.scope);
  const pending = ownerA.readJson('draft.json'); a.controller.abort(); read.resolve({ value: { private: 'A' }, sizeBytes: 15 });
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await expect(ownerA.writeJson('draft.json', {})).rejects.toMatchObject({ name: 'AbortError' });
  await ownerB.writeJson('draft.json', { current: 'B' });
  expect(writeA).not.toHaveBeenCalled(); expect(writeB).toHaveBeenCalledWith('draft.json', { current: 'B' });
  expect(() => getStudioClient(a.scope)).toThrow();
});
it('a late AI candidate cannot be returned after the App connection ends', async () => {
  const result = deferred<unknown>();
  const a = scoped({ ai: { text: { generateCandidate: () => result.promise } } });
  const pending = runStudioTextCandidate(a.scope, { surfaceId: 'unit', systemText: 'fixture', userText: 'fixture', params: {} });
  a.controller.abort(); result.resolve({ text: 'Late private candidate', finishReason: 'stop', traceId: 'fixture' });
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
