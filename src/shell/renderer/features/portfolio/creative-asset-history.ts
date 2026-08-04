import { createAppUlid, isAppUlid } from '../../app-shell/app-ulid.js';
import {
  getStudioProtectedJsonStorage,
  isStudioStorageNotFoundError,
  type StudioProtectedJsonStorage,
} from '../../app-shell/studio-storage.js';

export type CreativeAssetHistoryKind =
  | 'runtime-image-candidate'
  | 'avatar-package-candidate'
  | 'identity-resource-upload'
  | 'voice-demo-candidate';

export type CreativeAssetSourceKind = 'generated' | 'imported';
export type CreativeAssetReviewState = 'candidate-only' | 'owner-reviewed';

export type CreativeAssetHistoryRecord = {
  id: string;
  personaId: string;
  sourceContentHash: string;
  kind: CreativeAssetHistoryKind;
  sourceKind: CreativeAssetSourceKind;
  reviewState: CreativeAssetReviewState;
  label: string;
  createdAt: string;
  source: string;
  publicTruth: false;
  detail: string;
  originDraftKey?: string;
  previewUrl?: string;
  resourceId?: string;
  artifactIds?: string[];
  traceId?: string;
};

export type CreativeAssetHistoryInput = Omit<
  CreativeAssetHistoryRecord,
  'id' | 'personaId' | 'createdAt' | 'publicTruth'
> & {
  id?: string;
  createdAt?: string;
};

export type CreativeAssetHistoryStorage = Pick<StudioProtectedJsonStorage, 'readJson' | 'writeJson'>;

export type CreativeAssetHistoryLoadResult =
  | { ok: true; records: CreativeAssetHistoryRecord[]; unavailableCount: number }
  | {
    ok: false;
    failure: 'creative-asset-history-unavailable';
    message: string;
    records: [];
    unavailableCount: 0;
  };

export type CreativeAssetHistoryPersistResult =
  | { ok: true; records: CreativeAssetHistoryRecord[]; record: CreativeAssetHistoryRecord }
  | {
    ok: false;
    failure: 'creative-asset-history-unavailable' | 'creative-asset-history-record-invalid';
    message: string;
    records: CreativeAssetHistoryRecord[];
    record: null;
  };

export const CREATIVE_ASSET_HISTORY_STORAGE_PATH = 'assets/creative-history.json';
export const CREATIVE_ASSET_HISTORY_UPDATED_EVENT = 'rps:creative-asset-history-updated';
const HISTORY_LIMIT_PER_PERSONA = 20;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

let historyWriteQueue: Promise<void> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveStorage(storage?: CreativeAssetHistoryStorage | null): CreativeAssetHistoryStorage | null {
  if (storage !== undefined) return storage;
  try {
    return getStudioProtectedJsonStorage();
  } catch {
    return null;
  }
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && ISO_DATE_TIME_PATTERN.test(value.trim())
    && !Number.isNaN(Date.parse(value.trim()));
}

function isHistoryKind(value: unknown): value is CreativeAssetHistoryKind {
  return value === 'runtime-image-candidate'
    || value === 'avatar-package-candidate'
    || value === 'identity-resource-upload'
    || value === 'voice-demo-candidate';
}

function isSourceKind(value: unknown): value is CreativeAssetSourceKind {
  return value === 'generated' || value === 'imported';
}

function isReviewState(value: unknown): value is CreativeAssetReviewState {
  return value === 'candidate-only' || value === 'owner-reviewed';
}

function isDisplayablePreviewUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:', 'data:', 'blob:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function normalizeRecord(value: unknown): CreativeAssetHistoryRecord | null {
  if (!isRecord(value)) return null;
  const id = isAppUlid(value.id) ? value.id.trim() : null;
  const personaId = nonEmptyText(value.personaId);
  const sourceContentHash = nonEmptyText(value.sourceContentHash);
  const label = nonEmptyText(value.label);
  const source = nonEmptyText(value.source);
  const detail = nonEmptyText(value.detail);
  const createdAt = isIsoDateTime(value.createdAt) ? value.createdAt.trim() : null;
  if (
    !id
    || !personaId
    || !sourceContentHash
    || !isHistoryKind(value.kind)
    || !isSourceKind(value.sourceKind)
    || !isReviewState(value.reviewState)
    || !label
    || !source
    || !detail
    || !createdAt
    || value.publicTruth !== false
  ) {
    return null;
  }

  const previewUrl = isDisplayablePreviewUrl(value.previewUrl) ? value.previewUrl.trim() : undefined;
  const originDraftKey = isAppUlid(value.originDraftKey) ? value.originDraftKey.trim() : undefined;
  const resourceId = nonEmptyText(value.resourceId) || undefined;
  const traceId = nonEmptyText(value.traceId) || undefined;
  const artifactIds = Array.isArray(value.artifactIds)
    ? value.artifactIds.flatMap((artifactId) => nonEmptyText(artifactId) || [])
    : undefined;

  return {
    id,
    personaId,
    sourceContentHash,
    kind: value.kind,
    sourceKind: value.sourceKind,
    reviewState: value.reviewState,
    label,
    createdAt,
    source,
    publicTruth: false,
    detail,
    ...(originDraftKey ? { originDraftKey } : {}),
    ...(previewUrl ? { previewUrl } : {}),
    ...(resourceId ? { resourceId } : {}),
    ...(artifactIds && artifactIds.length > 0 ? { artifactIds } : {}),
    ...(traceId ? { traceId } : {}),
  };
}

export async function loadAllLocalCreativeAssetHistory(
  storage?: CreativeAssetHistoryStorage | null,
): Promise<CreativeAssetHistoryLoadResult> {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return {
      ok: false,
      failure: 'creative-asset-history-unavailable',
      message: 'Creative asset history protected storage is unavailable.',
      records: [],
      unavailableCount: 0,
    };
  }

  try {
    const document = await targetStorage.readJson(CREATIVE_ASSET_HISTORY_STORAGE_PATH);
    if (!Array.isArray(document.value)) {
      return {
        ok: false,
        failure: 'creative-asset-history-unavailable',
        message: 'Creative asset history document is invalid.',
        records: [],
        unavailableCount: 0,
      };
    }
    const records: CreativeAssetHistoryRecord[] = [];
    let unavailableCount = 0;
    for (const item of document.value) {
      const normalized = normalizeRecord(item);
      if (normalized) records.push(normalized);
      else unavailableCount += 1;
    }
    return { ok: true, records, unavailableCount };
  } catch (error) {
    if (isStudioStorageNotFoundError(error)) return { ok: true, records: [], unavailableCount: 0 };
    return {
      ok: false,
      failure: 'creative-asset-history-unavailable',
      message: 'Creative asset history protected storage read failed.',
      records: [],
      unavailableCount: 0,
    };
  }
}

export async function loadLocalCreativeAssetHistory(
  personaId: string,
  storage?: CreativeAssetHistoryStorage | null,
): Promise<CreativeAssetHistoryLoadResult> {
  const normalizedPersonaId = nonEmptyText(personaId);
  if (!normalizedPersonaId) {
    return {
      ok: false,
      failure: 'creative-asset-history-unavailable',
      message: 'Creative asset history persona id is invalid.',
      records: [],
      unavailableCount: 0,
    };
  }
  const loaded = await loadAllLocalCreativeAssetHistory(storage);
  return loaded.ok
    ? { ...loaded, records: loaded.records.filter((record) => record.personaId === normalizedPersonaId) }
    : loaded;
}

function dispatchCreativeAssetHistoryUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CREATIVE_ASSET_HISTORY_UPDATED_EVENT));
}

async function appendCreativeAssetHistoryOnce(
  personaId: string,
  input: CreativeAssetHistoryInput,
  storage?: CreativeAssetHistoryStorage | null,
): Promise<CreativeAssetHistoryPersistResult> {
  const targetStorage = resolveStorage(storage);
  const normalizedPersonaId = nonEmptyText(personaId);
  if (!targetStorage || !normalizedPersonaId) {
    return {
      ok: false,
      failure: 'creative-asset-history-unavailable',
      message: 'Creative asset history protected storage is unavailable.',
      records: [],
      record: null,
    };
  }
  const loaded = await loadAllLocalCreativeAssetHistory(targetStorage);
  if (!loaded.ok) return { ...loaded, record: null };

  const candidate = normalizeRecord({
    ...input,
    id: input.id || createAppUlid(),
    personaId: normalizedPersonaId,
    createdAt: input.createdAt || new Date().toISOString(),
    publicTruth: false,
  });
  if (!candidate) {
    return {
      ok: false,
      failure: 'creative-asset-history-record-invalid',
      message: 'Creative asset history candidate provenance is incomplete.',
      records: loaded.records,
      record: null,
    };
  }

  let samePersonaCount = 0;
  const next = [candidate, ...loaded.records.filter((record) => record.id !== candidate.id)]
    .filter((record) => {
      if (record.personaId !== normalizedPersonaId) return true;
      samePersonaCount += 1;
      return samePersonaCount <= HISTORY_LIMIT_PER_PERSONA;
    });
  try {
    await targetStorage.writeJson(CREATIVE_ASSET_HISTORY_STORAGE_PATH, next);
    dispatchCreativeAssetHistoryUpdated();
    return {
      ok: true,
      records: next.filter((record) => record.personaId === normalizedPersonaId),
      record: candidate,
    };
  } catch {
    return {
      ok: false,
      failure: 'creative-asset-history-unavailable',
      message: 'Creative asset history protected storage write failed.',
      records: loaded.records.filter((record) => record.personaId === normalizedPersonaId),
      record: null,
    };
  }
}

export function appendLocalCreativeAssetHistory(
  personaId: string,
  input: CreativeAssetHistoryInput,
  storage?: CreativeAssetHistoryStorage | null,
): Promise<CreativeAssetHistoryPersistResult> {
  const operation = historyWriteQueue.then(() => appendCreativeAssetHistoryOnce(personaId, input, storage));
  historyWriteQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
