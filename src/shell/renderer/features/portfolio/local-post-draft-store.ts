import {
  getStudioProtectedJsonStorage,
  isStudioStorageNotFoundError,
  type StudioProtectedJsonStorage,
} from '@renderer/app-shell/studio-storage.js';

export const LOCAL_POST_DRAFT_STORAGE_PATH_PREFIX = 'posts/drafts/';

export type LocalPostDraftRecord = {
  personaId: string;
  caption: string;
  tagsText: string;
  updatedAt: string;
  source: 'realm-persona-studio.local-post-draft-editor';
  candidateOnly: true;
  publicTruth: false;
};

export type LocalPostDraftStorage = Pick<StudioProtectedJsonStorage, 'readJson' | 'writeJson'>;

export type LocalPostDraftLoadResult =
  | { ok: true; record: LocalPostDraftRecord | null }
  | { ok: false; failure: 'local-post-draft-load-failed'; message: string };

export type LocalPostDraftPersistResult =
  | { ok: true; record: LocalPostDraftRecord }
  | { ok: false; failure: 'local-post-draft-not-persistable'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && !Number.isNaN(Date.parse(value));
}

function resolveStorage(storage?: LocalPostDraftStorage | null): LocalPostDraftStorage | null {
  if (storage !== undefined) return storage;
  try {
    return getStudioProtectedJsonStorage();
  } catch {
    return null;
  }
}

function normalizeStoredDraft(value: unknown, personaId: string): LocalPostDraftRecord | null {
  if (!isRecord(value)) return null;
  if (
    value.personaId !== personaId
    || typeof value.caption !== 'string'
    || typeof value.tagsText !== 'string'
    || !isIsoDateTime(value.updatedAt)
    || value.source !== 'realm-persona-studio.local-post-draft-editor'
    || value.candidateOnly !== true
    || value.publicTruth !== false
  ) {
    return null;
  }

  return {
    personaId,
    caption: value.caption,
    tagsText: value.tagsText,
    updatedAt: value.updatedAt,
    source: 'realm-persona-studio.local-post-draft-editor',
    candidateOnly: true,
    publicTruth: false,
  };
}

export function getLocalPostDraftStoragePath(personaId: string): string {
  return `${LOCAL_POST_DRAFT_STORAGE_PATH_PREFIX}${encodeURIComponent(personaId.trim())}.json`;
}

export async function loadLocalPostDraft(
  personaId: string,
  storage?: LocalPostDraftStorage | null,
): Promise<LocalPostDraftLoadResult> {
  const normalizedPersonaId = personaId.trim();
  if (!normalizedPersonaId) {
    return { ok: false, failure: 'local-post-draft-load-failed', message: 'Persona id is required.' };
  }
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return { ok: false, failure: 'local-post-draft-load-failed', message: 'Protected draft storage is unavailable.' };
  }

  try {
    const document = await targetStorage.readJson(getLocalPostDraftStoragePath(normalizedPersonaId));
    const record = normalizeStoredDraft(document.value, normalizedPersonaId);
    return record
      ? { ok: true, record }
      : { ok: false, failure: 'local-post-draft-load-failed', message: 'Stored post draft is invalid.' };
  } catch (error) {
    if (isStudioStorageNotFoundError(error)) return { ok: true, record: null };
    return { ok: false, failure: 'local-post-draft-load-failed', message: 'Protected draft storage read failed.' };
  }
}

export async function persistLocalPostDraft(
  input: Pick<LocalPostDraftRecord, 'personaId' | 'caption' | 'tagsText'>,
  storage?: LocalPostDraftStorage | null,
  now = new Date(),
): Promise<LocalPostDraftPersistResult> {
  const personaId = input.personaId.trim();
  const caption = input.caption.trim();
  const tagsText = input.tagsText.trim();
  if (!personaId || !caption) {
    return {
      ok: false,
      failure: 'local-post-draft-not-persistable',
      message: 'Persona id and caption are required.',
    };
  }
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return {
      ok: false,
      failure: 'local-post-draft-not-persistable',
      message: 'Protected draft storage is unavailable.',
    };
  }

  const record: LocalPostDraftRecord = {
    personaId,
    caption,
    tagsText,
    updatedAt: now.toISOString(),
    source: 'realm-persona-studio.local-post-draft-editor',
    candidateOnly: true,
    publicTruth: false,
  };

  try {
    await targetStorage.writeJson(getLocalPostDraftStoragePath(personaId), record);
    return { ok: true, record };
  } catch {
    return {
      ok: false,
      failure: 'local-post-draft-not-persistable',
      message: 'Protected draft storage write failed.',
    };
  }
}
