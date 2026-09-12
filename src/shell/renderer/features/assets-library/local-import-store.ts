import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { createAppUlid, isAppUlid } from '@renderer/app-shell/app-ulid.js';
import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';
import { isStudioStorageNotFoundError, type StudioProtectedJsonStorage } from '@renderer/app-shell/studio-storage.js';
import { bytesToDataUrl } from '../portfolio/studio-media-candidate.js';
import { referenceImageArtifactId } from '../portfolio/reference-image-source.js';
import type { AssetLibraryMediaKind } from './asset-library-data.js';

// @nimi-authority: rule.realm-persona-studio.asset.r015
type Artifacts = NimiLocalAppClient['ai']['artifacts'];
type UploadMime = Parameters<Artifacts['upload']>[0]['mimeType'];
// Keep this set within the installed SDK/Kit contract. Audio admission requires the upstream release.
export const LOCAL_IMPORT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const satisfies readonly UploadMime[];
export const LOCAL_IMPORT_MAX_BYTES = 8 * 1024 * 1024;
export const LOCAL_IMPORT_STORAGE_PATH = 'assets/imported.json';
export const LOCAL_IMPORT_CAPABILITY_EVIDENCE = 'client.ai.artifacts.upload/read and protected client.storage.readJson/writeJson';
export type LocalImportedAssetRecord = {
  id: string;
  mediaKind: AssetLibraryMediaKind;
  sourceKind: 'imported';
  title: string;
  previewUrl: string | null;
  artifactId: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
export type LocalImportFile = File;
type LocalAssetImportOperation = {
  artifacts: Pick<Artifacts, 'upload' | 'read'>;
  storage: Pick<StudioProtectedJsonStorage, 'readJson' | 'writeJson'>;
};
export type LocalImportCapabilityStatus =
  | { available: true; operations: LocalAssetImportOperation; evidence: string }
  | { available: false; reasonCode: 'capability-unavailable'; reason: string; evidence: string };
export type LocalImportFailure = 'unsupported-media-type' | 'file-too-large' | 'capability-unavailable' | 'local-import-failed' | 'local-import-result-invalid';
export type LocalImportResult =
  | { ok: true; source: 'protected-runtime-artifact'; record: LocalImportedAssetRecord }
  | { ok: false; source: 'protected-runtime-artifact'; failure: LocalImportFailure; message: string; record: null };
export type LocalImportedAssetLoadResult = {
  records: LocalImportedAssetRecord[];
  unavailableCount: number;
  failure: 'local-import-list-failed' | null;
};
const unavailable: LocalImportCapabilityStatus = {
  available: false, reasonCode: 'capability-unavailable',
  reason: 'Protected Runtime artifact and local metadata storage operations are unavailable.',
  evidence: LOCAL_IMPORT_CAPABILITY_EVIDENCE,
};
let writeQueue: Promise<void> = Promise.resolve();
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function createLocalAssetId(now = Date.now()): string { return createAppUlid(now); }
export function classifyLocalImportMime(value: unknown): AssetLibraryMediaKind | null {
  return typeof value === 'string' && LOCAL_IMPORT_MIME_TYPES.some((mime) => mime === value.trim().toLowerCase()) ? 'image' : null;
}
export function detectLocalAssetImportCapability(client: unknown): LocalImportCapabilityStatus {
  if (!record(client) || !record(client.ai) || !record(client.ai.artifacts) || !record(client.storage)
    || typeof client.ai.artifacts.upload !== 'function' || typeof client.ai.artifacts.read !== 'function'
    || typeof client.storage.readJson !== 'function' || typeof client.storage.writeJson !== 'function') return unavailable;
  const typed = client as unknown as NimiLocalAppClient;
  return { available: true, operations: { artifacts: typed.ai.artifacts, storage: typed.storage }, evidence: LOCAL_IMPORT_CAPABILITY_EVIDENCE };
}
export function getLocalAssetImportCapability(): LocalImportCapabilityStatus {
  try { return detectLocalAssetImportCapability(getStudioLocalAppClient()); } catch { return unavailable; }
}
export function normalizeLocalImportedAssetRecord(value: unknown): LocalImportedAssetRecord | null {
  if (!record(value) || typeof value.id !== 'string' || !isAppUlid(value.id) || value.sourceKind !== 'imported'
    || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 255
    || typeof value.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/u.test(value.createdAt) || Number.isNaN(Date.parse(value.createdAt))
    || typeof value.sizeBytes !== 'number' || !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes <= 0 || value.sizeBytes > LOCAL_IMPORT_MAX_BYTES) return null;
  const artifactId = referenceImageArtifactId(value.artifactId);
  const mediaKind = classifyLocalImportMime(value.mimeType);
  if (!artifactId || !mediaKind || value.mediaKind !== mediaKind || typeof value.mimeType !== 'string') return null;
  return { id: value.id, mediaKind, sourceKind: 'imported', title: value.title.trim(), artifactId,
    mimeType: value.mimeType, sizeBytes: value.sizeBytes, createdAt: value.createdAt, previewUrl: null };
}
async function readIndex(storage: LocalAssetImportOperation['storage']): Promise<LocalImportedAssetRecord[]> {
  let document;
  try { document = await storage.readJson(LOCAL_IMPORT_STORAGE_PATH); }
  catch (error) { if (isStudioStorageNotFoundError(error)) return []; throw error; }
  if (!Array.isArray(document.value)) throw new Error('Imported asset index is invalid.');
  const values = document.value.map(normalizeLocalImportedAssetRecord);
  if (values.some((value) => !value) || new Set(values.map((value) => value?.id)).size !== values.length) {
    throw new Error('Imported asset index is invalid.');
  }
  return values as LocalImportedAssetRecord[];
}
async function editIndex(operations: LocalAssetImportOperation, edit: (values: LocalImportedAssetRecord[]) => LocalImportedAssetRecord[]): Promise<void> {
  const task = writeQueue.catch(() => undefined).then(async () => {
    const next = edit(await readIndex(operations.storage));
    await operations.storage.writeJson(LOCAL_IMPORT_STORAGE_PATH, next.map(({ previewUrl: _preview, ...metadata }) => metadata));
  });
  writeQueue = task.then(() => undefined, () => undefined);
  await task;
}
function failure(kind: LocalImportFailure, message: string): LocalImportResult {
  return { ok: false, source: 'protected-runtime-artifact', failure: kind, message, record: null };
}
async function readPreview(asset: LocalImportedAssetRecord, artifacts: LocalAssetImportOperation['artifacts']): Promise<string> {
  const read = await artifacts.read(asset.artifactId);
  if (read.mimeType !== asset.mimeType || read.sizeBytes !== asset.sizeBytes || read.bytes.byteLength !== asset.sizeBytes) {
    throw new Error('Runtime artifact does not match imported metadata.');
  }
  return bytesToDataUrl(read.bytes, read.mimeType);
}
export async function importLocalAssetFile(file: LocalImportFile, capability = getLocalAssetImportCapability()): Promise<LocalImportResult> {
  const mimeType = LOCAL_IMPORT_MIME_TYPES.find((mime) => mime === file.type.trim().toLowerCase());
  if (!mimeType || !file.name.trim() || file.name.length > 255 || file.size <= 0) return failure('unsupported-media-type', 'Choose a nonempty PNG, JPEG, WebP or GIF image.');
  if (file.size > LOCAL_IMPORT_MAX_BYTES) return failure('file-too-large', 'Imported files must be at most 8 MiB.');
  if (!capability.available) return failure('capability-unavailable', capability.reason);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) return failure('local-import-result-invalid', 'The selected file changed while being read.');
    const uploaded = await capability.operations.artifacts.upload({ bytes, mimeType });
    const asset = normalizeLocalImportedAssetRecord({
      ...uploaded, id: createLocalAssetId(), sourceKind: 'imported', mediaKind: classifyLocalImportMime(mimeType),
      title: file.name, createdAt: new Date().toISOString(),
    });
    if (!asset || asset.mimeType !== mimeType || asset.sizeBytes !== bytes.byteLength) return failure('local-import-result-invalid', 'Runtime returned invalid artifact metadata.');
    asset.previewUrl = await readPreview(asset, capability.operations.artifacts);
    await editIndex(capability.operations, (values) => [...values, asset]);
    return { ok: true, source: 'protected-runtime-artifact', record: asset };
  } catch (error) {
    return failure('local-import-failed', error instanceof Error ? error.message : 'Protected artifact import failed.');
  }
}
export async function loadLocalImportedAssetRecords(capability = getLocalAssetImportCapability()): Promise<LocalImportedAssetLoadResult> {
  if (!capability.available) return { records: [], unavailableCount: 0, failure: 'local-import-list-failed' };
  try {
    await writeQueue;
    const values = await readIndex(capability.operations.storage);
    let unavailableCount = 0;
    const records = await Promise.all(values.map(async (asset) => {
      try { return { ...asset, previewUrl: await readPreview(asset, capability.operations.artifacts) }; }
      catch { unavailableCount += 1; return asset; }
    }));
    return { records, unavailableCount, failure: null };
  } catch { return { records: [], unavailableCount: 0, failure: 'local-import-list-failed' }; }
}
export async function removeLocalImportedAsset(id: string, capability = getLocalAssetImportCapability()): Promise<
  { ok: true } | { ok: false; failure: 'capability-unavailable' | 'local-import-remove-failed' }
> {
  if (!isAppUlid(id)) return { ok: false, failure: 'local-import-remove-failed' };
  if (!capability.available) return { ok: false, failure: 'capability-unavailable' };
  try {
    await editIndex(capability.operations, (values) => values.filter((asset) => asset.id !== id));
    return { ok: true };
  } catch { return { ok: false, failure: 'local-import-remove-failed' }; }
}
