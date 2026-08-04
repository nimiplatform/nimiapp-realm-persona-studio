import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import {
  getStudioProtectedJsonStorage,
  isStudioStorageNotFoundError,
  type StudioProtectedJsonStorage,
} from '../../app-shell/studio-storage.js';
import { isAppUlid } from '../../app-shell/app-ulid.js';

export const CREATION_DRAFT_HISTORY_STORAGE_PATH = 'creation/history.json';
export const CREATION_DRAFT_HISTORY_LIMIT = 50;

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const DAY_KEYS = ['today', 'yesterday', 'earlier'] as const;

export type CreationDraftHistoryStorage = Pick<
  StudioProtectedJsonStorage,
  'readJson' | 'writeJson' | 'removeJson'
>;

export type CreationDraftHistoryEntry = {
  draftKey: string;
  displayName: string;
  worldName?: string;
  archetype?: string;
  updatedAt: string;
};

export type CreationDraftHistoryLoadResult =
  | { ok: true; entries: CreationDraftHistoryEntry[]; unavailableCount: number }
  | {
    ok: false;
    failure: 'creation-draft-history-unavailable';
    message: string;
    entries: [];
    unavailableCount: 0;
  };

export type CreationDraftHistoryPersistResult =
  | { ok: true; entries: CreationDraftHistoryEntry[] }
  | {
    ok: false;
    failure: 'creation-draft-history-unavailable';
    message: string;
    entries: CreationDraftHistoryEntry[];
  };

export type CreationDraftHistoryGroupId = (typeof DAY_KEYS)[number];

export type CreationDraftHistoryGroup = {
  id: CreationDraftHistoryGroupId;
  labelKey: Extract<StudioCopyKey, `shell.sidebar.history.${string}`>;
  entries: CreationDraftHistoryEntry[];
};

function resolveStorage(storage?: CreationDraftHistoryStorage | null): CreationDraftHistoryStorage | null {
  if (storage !== undefined) return storage;
  try {
    return getStudioProtectedJsonStorage();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isUlid(value: unknown): value is string {
  return isAppUlid(value);
}

function isIsoDateTime(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const normalized = value.trim();
  return ISO_DATE_TIME_PATTERN.test(normalized) && !Number.isNaN(Date.parse(normalized));
}

function normalizeOptionalString(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return isNonEmptyString(value) ? value.trim() : null;
}

function normalizeEntry(value: unknown): CreationDraftHistoryEntry | null {
  if (!isRecord(value)) return null;

  const draftKey = isUlid(value.draftKey) ? value.draftKey.trim() : null;
  const displayName = isNonEmptyString(value.displayName) ? value.displayName.trim() : null;
  const updatedAt = isIsoDateTime(value.updatedAt) ? value.updatedAt.trim() : null;
  const worldName = normalizeOptionalString(value.worldName);
  const archetype = normalizeOptionalString(value.archetype);

  if (!draftKey || !displayName || !updatedAt || worldName === null || archetype === null) return null;

  return {
    draftKey,
    displayName,
    ...(worldName ? { worldName } : {}),
    ...(archetype ? { archetype } : {}),
    updatedAt,
  };
}

function normalizeEntries(value: unknown): { entries: CreationDraftHistoryEntry[]; unavailableCount: number } | null {
  if (!Array.isArray(value)) return null;
  const entries: CreationDraftHistoryEntry[] = [];
  let unavailableCount = 0;
  for (const item of value.slice(0, CREATION_DRAFT_HISTORY_LIMIT)) {
    const normalized = normalizeEntry(item);
    if (normalized) entries.push(normalized);
    else unavailableCount += 1;
  }
  return { entries, unavailableCount };
}

export async function loadCreationDraftHistory(
  storage?: CreationDraftHistoryStorage | null,
): Promise<CreationDraftHistoryLoadResult> {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return {
      ok: false,
      failure: 'creation-draft-history-unavailable',
      message: 'Creation draft history protected storage is unavailable.',
      entries: [],
      unavailableCount: 0,
    };
  }

  try {
    const document = await targetStorage.readJson(CREATION_DRAFT_HISTORY_STORAGE_PATH);
    const normalized = normalizeEntries(document.value);
    return normalized
      ? { ok: true, ...normalized }
      : {
        ok: false,
        failure: 'creation-draft-history-unavailable',
        message: 'Creation draft history document is invalid.',
        entries: [],
        unavailableCount: 0,
      };
  } catch (error) {
    if (isStudioStorageNotFoundError(error)) return { ok: true, entries: [], unavailableCount: 0 };
    return {
      ok: false,
      failure: 'creation-draft-history-unavailable',
      message: 'Creation draft history protected storage read failed.',
      entries: [],
      unavailableCount: 0,
    };
  }
}

export async function upsertCreationDraftHistoryEntry(
  entry: CreationDraftHistoryEntry,
  storage?: CreationDraftHistoryStorage | null,
): Promise<CreationDraftHistoryPersistResult> {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return {
      ok: false,
      failure: 'creation-draft-history-unavailable',
      message: 'Creation draft history protected storage is unavailable.',
      entries: [],
    };
  }
  const loaded = await loadCreationDraftHistory(targetStorage);
  if (!loaded.ok) return loaded;
  const normalized = normalizeEntry(entry);
  if (!normalized) {
    return {
      ok: false,
      failure: 'creation-draft-history-unavailable',
      message: 'Creation draft history entry is invalid.',
      entries: loaded.entries,
    };
  }

  const next = [
    normalized,
    ...loaded.entries.filter((candidate) => candidate.draftKey !== normalized.draftKey),
  ].slice(0, CREATION_DRAFT_HISTORY_LIMIT);
  try {
    await targetStorage.writeJson(CREATION_DRAFT_HISTORY_STORAGE_PATH, next);
    return { ok: true, entries: next };
  } catch {
    return {
      ok: false,
      failure: 'creation-draft-history-unavailable',
      message: 'Creation draft history protected storage write failed.',
      entries: loaded.entries,
    };
  }
}

export async function removeCreationDraftHistoryEntry(
  draftKey: string,
  storage?: CreationDraftHistoryStorage | null,
): Promise<CreationDraftHistoryPersistResult> {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return {
      ok: false,
      failure: 'creation-draft-history-unavailable',
      message: 'Creation draft history protected storage is unavailable.',
      entries: [],
    };
  }
  const loaded = await loadCreationDraftHistory(targetStorage);
  if (!loaded.ok) return loaded;
  if (!isUlid(draftKey)) {
    return {
      ok: false,
      failure: 'creation-draft-history-unavailable',
      message: 'Creation draft history key is invalid.',
      entries: loaded.entries,
    };
  }

  const next = loaded.entries.filter((entry) => entry.draftKey !== draftKey.trim());
  if (next.length === loaded.entries.length) return { ok: true, entries: next };

  try {
    if (next.length === 0) await targetStorage.removeJson(CREATION_DRAFT_HISTORY_STORAGE_PATH);
    else await targetStorage.writeJson(CREATION_DRAFT_HISTORY_STORAGE_PATH, next);
    return { ok: true, entries: next };
  } catch {
    return {
      ok: false,
      failure: 'creation-draft-history-unavailable',
      message: 'Creation draft history protected storage write failed.',
      entries: loaded.entries,
    };
  }
}

function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function recencyGroupId(updatedAt: string, now: Date): CreationDraftHistoryGroupId {
  const updatedDate = new Date(updatedAt);
  if (Number.isNaN(updatedDate.getTime())) return 'earlier';

  if (localDateKey(updatedDate) === localDateKey(now)) return 'today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return localDateKey(updatedDate) === localDateKey(yesterday) ? 'yesterday' : 'earlier';
}

function updatedAtDescending(left: CreationDraftHistoryEntry, right: CreationDraftHistoryEntry): number {
  const leftTime = Date.parse(left.updatedAt);
  const rightTime = Date.parse(right.updatedAt);
  if (leftTime === rightTime) return 0;
  return rightTime - leftTime;
}

export function groupCreationDraftHistoryByRecency(
  entries: readonly CreationDraftHistoryEntry[],
  now = new Date(),
): CreationDraftHistoryGroup[] {
  const grouped: Record<CreationDraftHistoryGroupId, CreationDraftHistoryEntry[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  for (const entry of entries) {
    const normalized = normalizeEntry(entry);
    if (normalized) grouped[recencyGroupId(normalized.updatedAt, now)].push(normalized);
  }

  const labelKeys: Record<CreationDraftHistoryGroupId, CreationDraftHistoryGroup['labelKey']> = {
    today: 'shell.sidebar.history.today',
    yesterday: 'shell.sidebar.history.yesterday',
    earlier: 'shell.sidebar.history.earlier',
  };

  return DAY_KEYS.map((id) => ({
    id,
    labelKey: labelKeys[id],
    entries: grouped[id].sort(updatedAtDescending),
  }));
}
