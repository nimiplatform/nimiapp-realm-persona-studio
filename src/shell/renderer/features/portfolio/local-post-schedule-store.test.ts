import { describe, expect, it, vi } from 'vitest';
import {
  clearLocalPostSchedule,
  isLocalPostScheduleDue,
  loadLocalPostSchedule,
  saveLocalPostSchedule,
} from './local-post-schedule-store.js';
import type { LocalPostScheduleCandidate } from './post-draft.js';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
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
      source: 'Realm WorldCoreController.getRealmPersona',
      sourceKind: 'realmPersona',
      sourceRef: {
        kind: 'realmPersona',
        worldId: 'world-oasis',
        sourceId: 'persona-1',
        sourceContentHash: 'hash-persona-1',
      },
      sourceRefKey: 'realmPersona:world-oasis:persona-1:hash-persona-1',
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
  it('persists one app-local executable schedule per persona', () => {
    const storage = createStorage();
    const record = saveLocalPostSchedule('persona-1', candidate, storage, new Date('2026-05-21T00:00:00'));

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
    expect(loadLocalPostSchedule('persona-1', storage)).toEqual(record);
    expect(loadLocalPostSchedule('persona-2', storage)).toBeNull();
  });

  it('computes foreground due state and clears after publish success', () => {
    const storage = createStorage();
    const record = saveLocalPostSchedule('persona-1', candidate, storage, new Date('2026-05-21T00:00:00'));

    expect(isLocalPostScheduleDue(record, new Date('2026-05-22T09:29:00'))).toBe(false);
    expect(isLocalPostScheduleDue(record, new Date('2026-05-22T09:30:00'))).toBe(true);
    clearLocalPostSchedule('persona-1', storage);
    expect(loadLocalPostSchedule('persona-1', storage)).toBeNull();
  });

  it('fails closed on old local candidates with string sourceRef', () => {
    const storage = createStorage();
    const oldCandidate = structuredClone(candidate) as unknown as Record<string, unknown>;
    const postCandidate = oldCandidate.postCandidate as Record<string, unknown>;
    const personaRef = postCandidate.personaRef as Record<string, unknown>;
    personaRef.sourceRef = 'realmPersona:world-oasis:persona-1:hash-persona-1';
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

    storage.setItem('realm-persona-studio.local-post-schedule.persona-1', JSON.stringify(oldRecord));

    expect(loadLocalPostSchedule('persona-1', storage)).toBeNull();
    expect(() => saveLocalPostSchedule(
      'persona-1',
      oldCandidate as unknown as LocalPostScheduleCandidate,
      storage,
    )).toThrow(/typed RealmPersona sourceRef/);
  });
});
