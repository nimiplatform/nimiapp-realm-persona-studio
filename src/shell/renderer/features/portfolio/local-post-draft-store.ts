import {
  getStudioProtectedJsonStorage,
  isStudioStorageNotFoundError,
  type StudioProtectedJsonStorage,
} from '@renderer/app-shell/studio-storage.js';
import { createAppUlid, isAppUlid } from '@renderer/app-shell/app-ulid.js';

export const LOCAL_POST_DRAFT_STORAGE_PATH_PREFIX = 'posts/drafts/';

export const LOCAL_POST_VISIBILITIES = ['public', 'friends', 'private'] as const;
export type LocalPostVisibility = typeof LOCAL_POST_VISIBILITIES[number];
export const DEFAULT_LOCAL_POST_VISIBILITY: LocalPostVisibility = 'public';

export const LOCAL_POST_CATEGORIES = ['daily', 'announcement', 'creation', 'question'] as const;
export type LocalPostCategory = typeof LOCAL_POST_CATEGORIES[number];

export const LOCAL_POST_ATTACHMENT_MEDIA_KINDS = ['image', 'video'] as const;
export type LocalPostAttachmentMediaKind = typeof LOCAL_POST_ATTACHMENT_MEDIA_KINDS[number];

/**
 * Metadata-only reference to an owner-picked local media file. Media bytes
 * never enter protected JSON storage: a restored attachment keeps its
 * metadata and fails closed with an explicit source-unavailable state.
 *
 * @nimi-authority: rule.realm-persona-studio.post.r004
 */
export type LocalPostDraftAttachment = {
  id: string;
  mediaKind: LocalPostAttachmentMediaKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * One owner-reviewed local post draft candidate. A persona owns an unbounded
 * list of these; each carries its own stable ULID so the owner can keep
 * several drafts side by side, reopen any of them, and delete them one by one.
 * Only the local schedule stays single-candidate per persona.
 */
export type LocalPostDraftRecord = {
  id: string;
  personaId: string;
  caption: string;
  tagsText: string;
  visibility: LocalPostVisibility;
  category: LocalPostCategory | null;
  attachments: LocalPostDraftAttachment[];
  updatedAt: string;
  source: 'realm-persona-studio.local-post-draft-editor';
  candidateOnly: true;
  publicTruth: false;
};

export type LocalPostDraftStorage = Pick<StudioProtectedJsonStorage, 'readJson' | 'writeJson' | 'removeJson'>;

export type LocalPostDraftLoadResult =
  | { ok: true; records: LocalPostDraftRecord[] }
  | { ok: false; failure: 'local-post-draft-load-failed'; message: string };

export type LocalPostDraftSaveResult =
  | { ok: true; record: LocalPostDraftRecord; records: LocalPostDraftRecord[] }
  | { ok: false; failure: 'local-post-draft-not-persistable'; message: string };

export type LocalPostDraftDeleteResult =
  | { ok: true; records: LocalPostDraftRecord[] }
  | { ok: false; failure: 'local-post-draft-delete-failed'; message: string };

// The protected document contains the whole list, so serialize read/modify/write
// operations for a persona even when a caller remounts during an in-flight save.
const pendingMutations = new Map<string, Promise<unknown>>();

async function mutateDrafts<T>(personaId: string, operation: () => Promise<T>): Promise<T> {
  const pending = pendingMutations.get(personaId) ?? Promise.resolve();
  const next = pending.then(operation, operation);
  pendingMutations.set(personaId, next);
  try {
    return await next;
  } finally {
    if (pendingMutations.get(personaId) === next) pendingMutations.delete(personaId);
  }
}

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

function isLocalPostVisibility(value: unknown): value is LocalPostVisibility {
  return typeof value === 'string'
    && (LOCAL_POST_VISIBILITIES as readonly string[]).includes(value);
}

function isLocalPostCategory(value: unknown): value is LocalPostCategory {
  return typeof value === 'string'
    && (LOCAL_POST_CATEGORIES as readonly string[]).includes(value);
}

export function classifyLocalPostAttachmentMime(mimeType: unknown): LocalPostAttachmentMediaKind | null {
  if (typeof mimeType !== 'string') return null;
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  return null;
}

function isLocalPostDraftAttachment(value: unknown): value is LocalPostDraftAttachment {
  if (!isRecord(value)) return false;
  const mediaKind = classifyLocalPostAttachmentMime(value.mimeType);
  return typeof value.id === 'string'
    && value.id.trim().length > 0
    && mediaKind !== null
    && value.mediaKind === mediaKind
    && typeof value.fileName === 'string'
    && value.fileName.trim().length > 0
    && typeof value.sizeBytes === 'number'
    && Number.isInteger(value.sizeBytes)
    && value.sizeBytes >= 0;
}

function normalizeStoredAttachments(value: unknown): LocalPostDraftAttachment[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isLocalPostDraftAttachment)) return null;
  return value.map((attachment) => ({
    id: attachment.id.trim(),
    mediaKind: attachment.mediaKind,
    fileName: attachment.fileName.trim(),
    mimeType: attachment.mimeType.trim().toLowerCase(),
    sizeBytes: attachment.sizeBytes,
  }));
}

function normalizeStoredDraft(value: unknown, personaId: string): LocalPostDraftRecord | null {
  if (!isRecord(value)) return null;
  if (
    !isAppUlid(value.id)
    || value.personaId !== personaId
    || typeof value.caption !== 'string'
    || typeof value.tagsText !== 'string'
    || !isIsoDateTime(value.updatedAt)
    || value.source !== 'realm-persona-studio.local-post-draft-editor'
    || value.candidateOnly !== true
    || value.publicTruth !== false
  ) {
    return null;
  }
  if (!isLocalPostVisibility(value.visibility)) {
    return null;
  }
  if (value.category !== null && !isLocalPostCategory(value.category)) {
    return null;
  }
  const attachments = normalizeStoredAttachments(value.attachments);
  if (attachments === null) {
    return null;
  }

  return {
    id: value.id.trim(),
    personaId,
    caption: value.caption,
    tagsText: value.tagsText,
    visibility: value.visibility,
    category: value.category,
    attachments,
    updatedAt: value.updatedAt,
    source: 'realm-persona-studio.local-post-draft-editor',
    candidateOnly: true,
    publicTruth: false,
  };
}

function normalizeStoredDraftList(value: unknown, personaId: string): LocalPostDraftRecord[] | null {
  if (!Array.isArray(value)) return null;
  const records: LocalPostDraftRecord[] = [];
  const seenIds = new Set<string>();
  for (const item of value) {
    const record = normalizeStoredDraft(item, personaId);
    if (!record || seenIds.has(record.id)) return null;
    seenIds.add(record.id);
    records.push(record);
  }
  return records;
}

export function getLocalPostDraftStoragePath(personaId: string): string {
  return `${LOCAL_POST_DRAFT_STORAGE_PATH_PREFIX}${encodeURIComponent(personaId.trim())}.json`;
}

export async function loadLocalPostDrafts(
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
    const records = normalizeStoredDraftList(document.value, normalizedPersonaId);
    return records
      ? { ok: true, records }
      : { ok: false, failure: 'local-post-draft-load-failed', message: 'Stored post drafts are invalid.' };
  } catch (error) {
    if (isStudioStorageNotFoundError(error)) return { ok: true, records: [] };
    return { ok: false, failure: 'local-post-draft-load-failed', message: 'Protected draft storage read failed.' };
  }
}

export async function saveLocalPostDraft(
  input: Pick<LocalPostDraftRecord, 'personaId' | 'caption' | 'tagsText' | 'visibility' | 'category' | 'attachments'>
    & { draftId?: string },
  storage?: LocalPostDraftStorage | null,
  now = new Date(),
): Promise<LocalPostDraftSaveResult> {
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
  if (!isLocalPostVisibility(input.visibility)) {
    return {
      ok: false,
      failure: 'local-post-draft-not-persistable',
      message: 'A supported local post visibility is required.',
    };
  }
  if (input.category !== null && !isLocalPostCategory(input.category)) {
    return {
      ok: false,
      failure: 'local-post-draft-not-persistable',
      message: 'A supported local post category is required.',
    };
  }
  if (!Array.isArray(input.attachments) || !input.attachments.every(isLocalPostDraftAttachment)) {
    return {
      ok: false,
      failure: 'local-post-draft-not-persistable',
      message: 'Supported local post attachment metadata is required.',
    };
  }
  const draftId = input.draftId?.trim();
  if (draftId !== undefined && draftId !== '' && !isAppUlid(draftId)) {
    return {
      ok: false,
      failure: 'local-post-draft-not-persistable',
      message: 'A valid local post draft id is required.',
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

  return mutateDrafts<LocalPostDraftSaveResult>(personaId, async () => {
    const loaded = await loadLocalPostDrafts(personaId, targetStorage);
    if (!loaded.ok) {
      return {
        ok: false,
        failure: 'local-post-draft-not-persistable',
        message: loaded.message,
      };
    }

    const record: LocalPostDraftRecord = {
      id: draftId || createAppUlid(now.getTime()),
      personaId,
      caption,
      tagsText,
      visibility: input.visibility,
      category: input.category,
      attachments: input.attachments.map((attachment) => ({
        id: attachment.id.trim(),
        mediaKind: attachment.mediaKind,
        fileName: attachment.fileName.trim(),
        mimeType: attachment.mimeType.trim().toLowerCase(),
        sizeBytes: attachment.sizeBytes,
      })),
      updatedAt: now.toISOString(),
      source: 'realm-persona-studio.local-post-draft-editor',
      candidateOnly: true,
      publicTruth: false,
    };
    const next = [record, ...loaded.records.filter((candidate) => candidate.id !== record.id)];

    try {
      await targetStorage.writeJson(getLocalPostDraftStoragePath(personaId), next);
      return { ok: true, record, records: next };
    } catch {
      return {
        ok: false,
        failure: 'local-post-draft-not-persistable',
        message: 'Protected draft storage write failed.',
      };
    }
  });
}

export async function deleteLocalPostDraft(
  personaId: string,
  draftId: string,
  storage?: LocalPostDraftStorage | null,
): Promise<LocalPostDraftDeleteResult> {
  const normalizedPersonaId = personaId.trim();
  const normalizedDraftId = draftId.trim();
  if (!normalizedPersonaId || !isAppUlid(normalizedDraftId)) {
    return {
      ok: false,
      failure: 'local-post-draft-delete-failed',
      message: 'Persona id and a valid local post draft id are required.',
    };
  }
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return {
      ok: false,
      failure: 'local-post-draft-delete-failed',
      message: 'Protected draft storage is unavailable.',
    };
  }

  return mutateDrafts<LocalPostDraftDeleteResult>(normalizedPersonaId, async () => {
    const loaded = await loadLocalPostDrafts(normalizedPersonaId, targetStorage);
    if (!loaded.ok) {
      return {
        ok: false,
        failure: 'local-post-draft-delete-failed',
        message: loaded.message,
      };
    }

    const next = loaded.records.filter((record) => record.id !== normalizedDraftId);
    if (next.length === loaded.records.length) {
      return { ok: true, records: loaded.records };
    }

    try {
      if (next.length === 0) {
        await targetStorage.removeJson(getLocalPostDraftStoragePath(normalizedPersonaId));
      } else {
        await targetStorage.writeJson(getLocalPostDraftStoragePath(normalizedPersonaId), next);
      }
      return { ok: true, records: next };
    } catch {
      return {
        ok: false,
        failure: 'local-post-draft-delete-failed',
        message: 'Protected draft storage write failed.',
      };
    }
  });
}
