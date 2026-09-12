import type { LocalPostScheduleCandidate } from './post-draft.js';
import {
  getStudioProtectedJsonStorage,
  isStudioStorageNotFoundError,
  type StudioProtectedJsonStorage,
} from '../../app-shell/studio-storage.js';

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

type LocalScheduleStorage = StudioProtectedJsonStorage;

const SCHEDULE_PREFIX = 'posts/schedules/';

function scheduleKey(personaId: string): string {
  if (!personaId.trim()) throw new Error('Persona id is required for local schedule storage.');
  return `${SCHEDULE_PREFIX}${encodeURIComponent(personaId)}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPersonaCharacterSourceRef(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return value.kind === 'personaCharacter'
    && isNonEmptyString(value.worldId)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.sourceHash);
}

function isLocalPostScheduleCandidate(value: unknown): value is LocalPostScheduleCandidate {
  if (!isRecord(value)) {
    return false;
  }
  const boundary = isRecord(value.boundary) ? value.boundary : null;
  const postCandidate = isRecord(value.postCandidate) ? value.postCandidate : null;
  const personaRef = isRecord(postCandidate?.personaRef) ? postCandidate.personaRef : null;
  const realmCreatePost = isRecord(postCandidate?.realmCreatePost) ? postCandidate.realmCreatePost : null;
  const review = isRecord(postCandidate?.review) ? postCandidate.review : null;

  return value.candidate === true
    && value.source === 'realm-persona-studio.local-single-post-schedule'
    && value.appLocalOnly === true
    && isNonEmptyString(value.localRunAt)
    && boundary?.scope === 'app-local-only'
    && boundary.realmPublish === 'not-created'
    && boundary.realmScheduling === 'not-created'
    && boundary.moderation === 'not-claimed'
    && postCandidate?.candidate === true
    && postCandidate.source === 'realm-persona-studio.local-post-draft'
    && personaRef?.sourceKind === 'personaCharacter'
    && isPersonaCharacterSourceRef(personaRef.sourceRef)
    && isNonEmptyString(personaRef.sourceRefKey)
    && typeof personaRef.handle === 'string'
    && isNonEmptyString(personaRef.displayName)
    && realmCreatePost !== null
    && review?.humanReviewed === true;
}

function resolveStorage(storage?: LocalScheduleStorage | null): LocalScheduleStorage {
  if (storage === null) throw new Error('Local post schedule storage is unavailable.');
  return storage ?? getStudioProtectedJsonStorage();
}

function normalizeRecord(value: unknown, personaId: string): LocalPostScheduleRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const record = value;
  const localKey = typeof record.localKey === 'string' && record.localKey.trim() ? record.localKey : null;
  const savedAt = typeof record.savedAt === 'string' && record.savedAt.trim() ? record.savedAt : null;
  const localRunAt = typeof record.localRunAt === 'string' && record.localRunAt.trim() ? record.localRunAt : null;
  const candidate = isLocalPostScheduleCandidate(record.candidate) ? record.candidate : null;

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
    || candidate.postCandidate.personaRef.sourceRef.id !== personaId
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

// @nimi-authority: rule.realm-persona-studio.asset.r009
export async function loadLocalPostSchedule(personaId: string, storage?: LocalScheduleStorage | null): Promise<LocalPostScheduleRecord | null> {
  try {
    const targetStorage = resolveStorage(storage);
    const document = await targetStorage.readJson(scheduleKey(personaId));
    const record = normalizeRecord(document.value, personaId);
    if (!record) throw new Error('Stored local post schedule is invalid.');
    return record;
  } catch (error) {
    if (isStudioStorageNotFoundError(error)) return null;
    throw error;
  }
}

export async function saveLocalPostSchedule(
  personaId: string,
  candidate: LocalPostScheduleCandidate,
  storage?: LocalScheduleStorage | null,
  now = new Date(),
): Promise<LocalPostScheduleRecord> {
  if (!isLocalPostScheduleCandidate(candidate)) {
    throw new Error('Local post schedule candidate requires typed PersonaCharacter sourceRef evidence.');
  }
  if (candidate.postCandidate.personaRef.sourceRef.id !== personaId) {
    throw new Error('Local post schedule persona identity does not match its PersonaCharacter sourceRef.');
  }

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
  try {
    await targetStorage.writeJson(scheduleKey(personaId), record);
  } catch {
    throw new Error('Local post schedule could not be persisted.');
  }
  return record;
}

export async function clearLocalPostSchedule(personaId: string, storage?: LocalScheduleStorage | null): Promise<void> {
  const targetStorage = resolveStorage(storage);
  await targetStorage.removeJson(scheduleKey(personaId));
}

export function isLocalPostScheduleDue(record: LocalPostScheduleRecord, now = new Date()): boolean {
  const runAt = new Date(record.candidate.localRunAt);
  return !Number.isNaN(runAt.getTime()) && runAt.getTime() <= now.getTime();
}
