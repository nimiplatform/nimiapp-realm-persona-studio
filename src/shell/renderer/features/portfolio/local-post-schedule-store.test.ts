import { describe, expect, it, vi } from 'vitest';
import {
  clearLocalPostSchedule,
  isLocalPostScheduleDue,
  loadLocalPostSchedule,
  saveLocalPostSchedule,
} from './local-post-schedule-store.js';
import type { LocalPostScheduleCandidate } from './post-draft.js';
import type { StudioProtectedJsonStorage } from '../../app-shell/studio-storage.js';

type ScheduleJson = Awaited<ReturnType<StudioProtectedJsonStorage['readJson']>>['value'];

function createStorage() {
  const values = new Map<string, ScheduleJson>();
  return {
    readJson: vi.fn(async (key: string) => {
      if (!values.has(key)) throw Object.assign(new Error('Missing document'), { code: 'not-found' });
      return { value: values.get(key)!, sizeBytes: 1 };
    }),
    writeJson: vi.fn(async (key: string, value: ScheduleJson) => {
      values.set(key, value);
      return { value, sizeBytes: 1 };
    }),
    removeJson: vi.fn(async (key: string) => ({ removed: values.delete(key) })),
  };
}

const candidate: LocalPostScheduleCandidate = {
  candidate: true,
  source: 'realm-persona-studio.local-single-post-schedule',
  appLocalOnly: true,
  localRunAt: '2026-05-22T09:30',
  boundary: {
    scope: 'app-local-only',
    realmPublish: 'not-created',
    realmScheduling: 'not-created',
    moderation: 'not-claimed',
  },
  postCandidate: {
    candidate: true,
    source: 'realm-persona-studio.local-post-draft',
    personaRef: {
      source: 'Nimi App Access realm.personaCharacter.getOwned',
      sourceKind: 'personaCharacter',
      sourceRef: {
        kind: 'personaCharacter',
        worldId: 'world-oasis',
        id: 'persona-1',
        sourceHash: 'source-hash-persona-1',
      },
      sourceRefKey: 'personaCharacter:world-oasis:persona-1:source-hash-persona-1',
      handle: 'mira',
      displayName: 'Mira',
    },
    realmCreatePost: {
      attachments: [],
      caption: 'Scheduled caption',
    },
    review: {
      humanReviewed: true,
    },
  },
};

describe('local post schedule store', () => {
  it('persists one app-local executable schedule per persona', async () => {
    const storage = createStorage();
    const record = await saveLocalPostSchedule('persona-1', candidate, storage, new Date('2026-05-21T00:00:00'));

    expect(record).toMatchObject({
      localKey: 'persona-1:2026-05-22T09:30',
      personaId: 'persona-1',
      source: 'realm-persona-studio.local-single-post-schedule-store',
      appLocalOnly: true,
      execution: {
        mode: 'foreground-when-due',
        realmPublish: 'pending-owner-app-open',
      },
      candidate,
    });
    expect(await loadLocalPostSchedule('persona-1', storage)).toEqual(record);
    expect(await loadLocalPostSchedule('persona-2', storage)).toBeNull();
  });

  it('computes foreground due state and clears only after storage acknowledges removal', async () => {
    const storage = createStorage();
    const record = await saveLocalPostSchedule('persona-1', candidate, storage, new Date('2026-05-21T00:00:00'));

    expect(isLocalPostScheduleDue(record, new Date('2026-05-22T09:29:00'))).toBe(false);
    expect(isLocalPostScheduleDue(record, new Date('2026-05-22T09:30:00'))).toBe(true);
    await clearLocalPostSchedule('persona-1', storage);
    expect(await loadLocalPostSchedule('persona-1', storage)).toBeNull();
  });

  it('fails closed on old local candidates with string sourceRef', async () => {
    const storage = createStorage();
    const oldCandidate = structuredClone(candidate) as unknown as Record<string, unknown>;
    const postCandidate = oldCandidate.postCandidate as Record<string, unknown>;
    const personaRef = postCandidate.personaRef as Record<string, unknown>;
    personaRef.sourceRef = 'personaCharacter:world-oasis:persona-1:hash-persona-1';
    delete personaRef.sourceRefKey;
    const oldRecord = {
      localKey: 'persona-1:2026-05-22T09:30',
      personaId: 'persona-1',
      savedAt: '2026-05-21T00:00:00.000Z',
      localRunAt: '2026-05-22T09:30',
      source: 'realm-persona-studio.local-single-post-schedule-store',
      appLocalOnly: true,
      candidate: oldCandidate,
    };

    await storage.writeJson('posts/schedules/persona-1.json', oldRecord as ScheduleJson);

    await expect(loadLocalPostSchedule('persona-1', storage)).rejects.toThrow('Stored local post schedule is invalid');
    await expect(saveLocalPostSchedule(
      'persona-1',
      oldCandidate as unknown as LocalPostScheduleCandidate,
      storage,
    )).rejects.toThrow(/typed PersonaCharacter sourceRef/);
  });

  it('rejects a schedule stored under a different persona than its sourceRef', async () => {
    const storage = createStorage();

    await expect(saveLocalPostSchedule('persona-2', candidate, storage)).rejects.toThrow(/persona identity does not match/u);
    expect(storage.writeJson).not.toHaveBeenCalled();
  });

  it('does not report a cleared schedule when storage is unavailable', async () => {
    await expect(clearLocalPostSchedule('persona-1', null)).rejects.toThrow(/storage is unavailable/u);
  });

  it('does not report a saved schedule when local storage is unavailable', async () => {
    await expect(saveLocalPostSchedule('persona-1', candidate, null)).rejects.toThrow(/storage is unavailable/u);
  });

  it('distinguishes an unavailable protected read from an absent schedule', async () => {
    const storage = createStorage();
    storage.readJson.mockRejectedValueOnce(new Error('Access denied'));
    await expect(loadLocalPostSchedule('persona-1', storage)).rejects.toThrow('Access denied');
    await expect(loadLocalPostSchedule('persona-1', storage)).resolves.toBeNull();
  });
});
