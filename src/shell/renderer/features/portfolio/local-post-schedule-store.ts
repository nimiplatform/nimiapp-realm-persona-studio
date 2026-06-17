import type { LocalPostScheduleCandidate } from './post-draft.js';

export type LocalPostScheduleRecord = {
  localKey: string;
  personaId: string;
  savedAt: string;
  localRunAt: string;
  source: 'realm-persona-studio.local-single-post-schedule-store';
  appLocalOnly: true;
  execution: {
    mode: 'foreground-when-due';
    realmPublish: 'pending-owner-app-open';
  };
  candidate: LocalPostScheduleCandidate;
};

type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SCHEDULE_PREFIX = 'realm-persona-studio.local-post-schedule.';

function scheduleKey(personaId: string): string {
  return `${SCHEDULE_PREFIX}${personaId}`;
}

function resolveStorage(storage?: LocalStorageLike | null): LocalStorageLike | null {
  if (storage !== undefined) {
    return storage;
  }
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function normalizeRecord(value: unknown, personaId: string): LocalPostScheduleRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const localKey = typeof record.localKey === 'string' && record.localKey.trim() ? record.localKey : null;
  const savedAt = typeof record.savedAt === 'string' && record.savedAt.trim() ? record.savedAt : null;
  const localRunAt = typeof record.localRunAt === 'string' && record.localRunAt.trim() ? record.localRunAt : null;
  const candidate = record.candidate && typeof record.candidate === 'object'
    ? record.candidate as LocalPostScheduleCandidate
    : null;

  if (
    !localKey
    || !savedAt
    || !localRunAt
    || record.personaId !== personaId
    || record.source !== 'realm-persona-studio.local-single-post-schedule-store'
    || record.appLocalOnly !== true
    || !candidate
    || candidate.source !== 'realm-persona-studio.local-single-post-schedule'
    || candidate.appLocalOnly !== true
  ) {
    return null;
  }

  return {
    localKey,
    personaId,
    savedAt,
    localRunAt,
    source: 'realm-persona-studio.local-single-post-schedule-store',
    appLocalOnly: true,
    execution: {
      mode: 'foreground-when-due',
      realmPublish: 'pending-owner-app-open',
    },
    candidate,
  };
}

export function loadLocalPostSchedule(personaId: string, storage?: LocalStorageLike | null): LocalPostScheduleRecord | null {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return null;
  }

  try {
    const raw = targetStorage.getItem(scheduleKey(personaId));
    return raw ? normalizeRecord(JSON.parse(raw), personaId) : null;
  } catch {
    return null;
  }
}

export function saveLocalPostSchedule(
  personaId: string,
  candidate: LocalPostScheduleCandidate,
  storage?: LocalStorageLike | null,
  now = new Date(),
): LocalPostScheduleRecord {
  const record: LocalPostScheduleRecord = {
    localKey: `${personaId}:${candidate.localRunAt}`,
    personaId,
    savedAt: now.toISOString(),
    localRunAt: candidate.localRunAt,
    source: 'realm-persona-studio.local-single-post-schedule-store',
    appLocalOnly: true,
    execution: {
      mode: 'foreground-when-due',
      realmPublish: 'pending-owner-app-open',
    },
    candidate,
  };
  const targetStorage = resolveStorage(storage);
  if (targetStorage) {
    targetStorage.setItem(scheduleKey(personaId), JSON.stringify(record));
  }
  return record;
}

export function clearLocalPostSchedule(personaId: string, storage?: LocalStorageLike | null): void {
  const targetStorage = resolveStorage(storage);
  targetStorage?.removeItem(scheduleKey(personaId));
}

export function isLocalPostScheduleDue(record: LocalPostScheduleRecord, now = new Date()): boolean {
  const runAt = new Date(record.candidate.localRunAt);
  return !Number.isNaN(runAt.getTime()) && runAt.getTime() <= now.getTime();
}
