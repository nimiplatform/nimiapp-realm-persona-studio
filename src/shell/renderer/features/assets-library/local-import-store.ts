import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { createAppUlid, isAppUlid } from '@renderer/app-shell/app-ulid.js';
import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';
import { isDisplayableAssetPreviewUrl, type AssetLibraryMediaKind } from './asset-library-data.js';

export type LocalImportedAssetRecord = {
  id: string;
  mediaKind: AssetLibraryMediaKind;
  sourceKind: 'imported';
  title: string;
  previewUrl: string | null;
  createdAt: string;
};

export type LocalImportFile = Pick<File, 'name' | 'type'> & File;

type LocalAssetImportOperation = {
  readonly importFile: (input: {
    readonly id: string;
    readonly mediaKind: AssetLibraryMediaKind;
    readonly sourceKind: 'imported';
    readonly title: string;
    readonly createdAt: string;
    readonly file: LocalImportFile;
  }) => Promise<unknown>;
  readonly list: () => Promise<unknown>;
  readonly remove: (id: string) => Promise<unknown>;
};

type ClientWithOptionalLocalAssets = NimiLocalAppClient & {
  readonly localAssets?: Partial<LocalAssetImportOperation>;
};

export type LocalImportCapabilityStatus =
  | {
    available: true;
    operations: LocalAssetImportOperation;
    evidence: string;
  }
  | {
    available: false;
    reasonCode: 'capability-unavailable';
    reason: string;
    evidence: string;
  };

export type LocalImportFailure =
  | 'unsupported-media-type'
  | 'capability-unavailable'
  | 'local-import-failed'
  | 'local-import-result-invalid';

export type LocalImportResult =
  | {
    ok: true;
    source: 'protected-local-assets';
    record: LocalImportedAssetRecord;
  }
  | {
    ok: false;
    source: 'protected-local-assets';
    failure: LocalImportFailure;
    message: string;
    record: null;
  };

export type LocalImportedAssetLoadResult = {
  records: LocalImportedAssetRecord[];
  unavailableCount: number;
  failure: 'local-import-list-failed' | null;
};

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u;

export const LOCAL_IMPORT_CAPABILITY_EVIDENCE =
  'Kit shell/capabilities/local-assets currently exposes resolveUrl only; the local App client has no protected localAssets import/list/remove operation.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && ISO_DATE_TIME_PATTERN.test(value.trim())
    && !Number.isNaN(Date.parse(value.trim()));
}

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function createLocalAssetId(now = Date.now()): string {
  return createAppUlid(now);
}

export function classifyLocalImportMime(mimeType: unknown): AssetLibraryMediaKind | null {
  if (typeof mimeType !== 'string') return null;
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('audio/')) return 'audio';
  return null;
}

export function detectLocalAssetImportCapability(client: unknown): LocalImportCapabilityStatus {
  const localAssets = isRecord(client) && isRecord((client as ClientWithOptionalLocalAssets).localAssets)
    ? (client as ClientWithOptionalLocalAssets).localAssets
    : null;
  const importFile = localAssets?.importFile;
  const list = localAssets?.list;
  const remove = localAssets?.remove;
  if (typeof importFile === 'function' && typeof list === 'function' && typeof remove === 'function') {
    return {
      available: true,
      operations: {
        importFile: importFile.bind(localAssets),
        list: list.bind(localAssets),
        remove: remove.bind(localAssets),
      },
      evidence: 'Runtime client exposed a protected localAssets importFile/list/remove operation set.',
    };
  }
  return {
    available: false,
    reasonCode: 'capability-unavailable',
    reason: 'The protected local asset import operation is not exposed by the current Desktop standard bridge.',
    evidence: LOCAL_IMPORT_CAPABILITY_EVIDENCE,
  };
}

export function getLocalAssetImportCapability(): LocalImportCapabilityStatus {
  try {
    return detectLocalAssetImportCapability(getStudioLocalAppClient());
  } catch {
    return {
      available: false,
      reasonCode: 'capability-unavailable',
      reason: 'The protected local asset import operation could not be detected.',
      evidence: LOCAL_IMPORT_CAPABILITY_EVIDENCE,
    };
  }
}

export function normalizeLocalImportedAssetRecord(value: unknown): LocalImportedAssetRecord | null {
  if (!isRecord(value)) return null;
  const id = normalizeText(value.id);
  const mediaKind = classifyLocalImportMime(value.mimeType) ?? (value.mediaKind === 'image' || value.mediaKind === 'audio' ? value.mediaKind : null);
  const title = normalizeText(value.title);
  const createdAt = isIsoDateTime(value.createdAt) ? value.createdAt.trim() : null;
  if (!id || !isAppUlid(id) || !mediaKind || value.sourceKind !== 'imported' || !title || !createdAt) return null;
  const previewUrl = isDisplayableAssetPreviewUrl(value.previewUrl) ? value.previewUrl.trim() : null;
  return {
    id,
    mediaKind,
    sourceKind: 'imported',
    title,
    previewUrl,
    createdAt,
  };
}

function localImportFailure(failure: LocalImportFailure, message: string): LocalImportResult {
  return {
    ok: false,
    source: 'protected-local-assets',
    failure,
    message,
    record: null,
  };
}

export async function importLocalAssetFile(
  file: LocalImportFile,
  capability: LocalImportCapabilityStatus = getLocalAssetImportCapability(),
): Promise<LocalImportResult> {
  const mediaKind = classifyLocalImportMime(file?.type);
  const title = normalizeText(file?.name);
  if (!mediaKind || !title) {
    return localImportFailure(
      'unsupported-media-type',
      'Only image/* and audio/* files can become local imported asset candidates.',
    );
  }
  if (!capability.available) {
    return localImportFailure('capability-unavailable', capability.reason);
  }

  const id = createLocalAssetId();
  const createdAt = new Date().toISOString();
  try {
    const response = await capability.operations.importFile({
      id,
      mediaKind,
      sourceKind: 'imported',
      title,
      createdAt,
      file,
    });
    const record = normalizeLocalImportedAssetRecord(response);
    if (!record) {
      return localImportFailure(
        'local-import-result-invalid',
        'The protected local asset operation did not return a usable imported asset record.',
      );
    }
    return {
      ok: true,
      source: 'protected-local-assets',
      record,
    };
  } catch (error) {
    return localImportFailure(
      'local-import-failed',
      error instanceof Error ? error.message : 'The protected local asset import failed.',
    );
  }
}

function readListPayload(value: unknown): readonly unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  if (Array.isArray(value.assets)) return value.assets;
  if (Array.isArray(value.records)) return value.records;
  return null;
}

export async function loadLocalImportedAssetRecords(
  capability: LocalImportCapabilityStatus = getLocalAssetImportCapability(),
): Promise<LocalImportedAssetLoadResult> {
  if (!capability.available) {
    return { records: [], unavailableCount: 0, failure: null };
  }
  try {
    const payload = readListPayload(await capability.operations.list());
    if (!payload) return { records: [], unavailableCount: 1, failure: 'local-import-list-failed' };
    const records: LocalImportedAssetRecord[] = [];
    let unavailableCount = 0;
    for (const item of payload) {
      const record = normalizeLocalImportedAssetRecord(item);
      if (record) records.push(record);
      else unavailableCount += 1;
    }
    return { records, unavailableCount, failure: null };
  } catch {
    return { records: [], unavailableCount: 1, failure: 'local-import-list-failed' };
  }
}

export async function removeLocalImportedAsset(
  id: string,
  capability: LocalImportCapabilityStatus = getLocalAssetImportCapability(),
): Promise<{ ok: true } | { ok: false; failure: 'capability-unavailable' | 'local-import-remove-failed' }> {
  if (!isAppUlid(id)) return { ok: false, failure: 'local-import-remove-failed' };
  if (!capability.available) return { ok: false, failure: 'capability-unavailable' };
  try {
    const result = await capability.operations.remove(id.trim());
    return isRecord(result) && result.removed === true
      ? { ok: true }
      : { ok: false, failure: 'local-import-remove-failed' };
  } catch {
    return { ok: false, failure: 'local-import-remove-failed' };
  }
}
