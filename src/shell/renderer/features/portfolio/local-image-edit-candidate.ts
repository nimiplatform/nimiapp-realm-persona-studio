import { getLocalAssetImportCapability, LOCAL_IMPORT_MAX_BYTES, type LocalImportCapabilityStatus } from '../assets-library/local-import-store.js';
import { appendLocalCreativeAssetHistory } from './creative-asset-history.js';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import { referenceImageArtifactId } from './reference-image-source.js';
import { bytesToDataUrl } from './studio-media-candidate.js';

export type LocalImageEditSaveResult =
  | { ok: true }
  | { ok: false; failure: 'file-too-large' | 'capability-unavailable' | 'artifact-unavailable' | 'history-unavailable' };

// @nimi-authority: rule.realm-persona-studio.asset.r014
// @nimi-authority: rule.realm-persona-studio.asset.r015
export async function saveLocalImageEditCandidate(
  persona: Pick<OwnerPortfolioPersonaDetail, 'id' | 'contentHash'>,
  bytes: Uint8Array,
  detail: string,
  capability: LocalImportCapabilityStatus = getLocalAssetImportCapability(),
): Promise<LocalImageEditSaveResult> {
  if (bytes.byteLength > LOCAL_IMPORT_MAX_BYTES) return { ok: false, failure: 'file-too-large' };
  if (!capability.available) return { ok: false, failure: 'capability-unavailable' };
  if (!bytes.byteLength || !persona.id.trim() || !persona.contentHash.trim() || !detail.trim()) {
    return { ok: false, failure: 'artifact-unavailable' };
  }
  const { artifacts, storage } = capability.operations;
  try {
    const uploaded = await artifacts.upload({ bytes, mimeType: 'image/jpeg' });
    const artifactId = referenceImageArtifactId(uploaded.artifactId);
    if (!artifactId || uploaded.mimeType !== 'image/jpeg' || uploaded.sizeBytes !== bytes.byteLength) {
      return { ok: false, failure: 'artifact-unavailable' };
    }
    const read = await artifacts.read(artifactId);
    if (read.mimeType !== uploaded.mimeType || read.sizeBytes !== uploaded.sizeBytes || read.bytes.byteLength !== uploaded.sizeBytes) {
      return { ok: false, failure: 'artifact-unavailable' };
    }
    const saved = await appendLocalCreativeAssetHistory(persona.id, {
      sourceContentHash: persona.contentHash,
      kind: 'local-image-edit-candidate',
      sourceKind: 'imported',
      reviewState: 'owner-reviewed',
      label: 'assets.history.localImageEdit',
      source: 'realm-persona-studio.local-image-edit',
      artifactIds: [artifactId],
      previewUrl: bytesToDataUrl(read.bytes, read.mimeType),
      detail,
    }, storage);
    return saved.ok ? { ok: true } : { ok: false, failure: 'history-unavailable' };
  } catch {
    return { ok: false, failure: 'artifact-unavailable' };
  }
}
