import { isAppUlid } from '@renderer/app-shell/app-ulid.js';
import { isCreationDraftKey } from '@renderer/features/portfolio/creation-draft-store.js';

export type AssetLibraryMediaKind = 'image' | 'audio';
export type AssetLibrarySourceKind = 'generated' | 'imported';
export type AssetLibraryReviewState = 'candidate-only' | 'owner-selected' | 'owner-reviewed';
export type AssetLibraryTab = 'images' | 'audio' | 'uploads';

export type AssetLibraryDraftProvenance = {
  kind: 'draft';
  draftKey: string;
  archetype?: string;
  traits?: string[];
};

export type AssetLibraryProvenance =
  | { kind: 'persona'; personaId: string; sourceContentHash: string; originDraftKey?: string }
  | AssetLibraryDraftProvenance
  | { kind: 'local-import'; id: string };

export type AssetLibraryEntry = {
  id: string;
  mediaKind: AssetLibraryMediaKind;
  sourceKind: AssetLibrarySourceKind;
  reviewState: AssetLibraryReviewState;
  title: string;
  /** A URL that the renderer can display, or null when the source is unavailable. */
  previewUrl: string | null;
  artifactId?: string;
  provenance: AssetLibraryProvenance;
  createdAt: string;
};

export type AggregateAssetLibraryOptions = {
  creativeHistoryRecords?: readonly unknown[];
  creationDraftRecords?: readonly unknown[];
  /** Records returned by the protected local-assets listing operation. */
  importedRecords?: readonly unknown[];
  /** Invalid records rejected while protected source documents were read. */
  sourceUnavailableCount?: number;
  importedUnavailableCount?: number;
};

export type AssetLibraryData = {
  entries: AssetLibraryEntry[];
  images: AssetLibraryEntry[];
  audio: AssetLibraryEntry[];
  uploads: AssetLibraryEntry[];
  unavailableCount: number;
};

export type AssetLibraryTabState = {
  entries: AssetLibraryEntry[];
  isEmpty: boolean;
  unavailableCount: number;
};

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && ISO_DATE_TIME_PATTERN.test(value.trim())
    && !Number.isNaN(Date.parse(value.trim()));
}

function isMediaKind(value: unknown): value is AssetLibraryMediaKind {
  return value === 'image' || value === 'audio';
}

function isSourceKind(value: unknown): value is AssetLibrarySourceKind {
  return value === 'generated' || value === 'imported';
}

function isReviewState(value: unknown): value is AssetLibraryReviewState {
  return value === 'candidate-only' || value === 'owner-selected' || value === 'owner-reviewed';
}

/**
 * Keep this in lockstep with runtime-artifact-projection's preview contract:
 * public HTTP(S) URIs, inline data URLs, and object URLs are displayable;
 * artifact ids, file paths, and opaque storage references are not.
 */
export function isDisplayableAssetPreviewUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:'
      || url.protocol === 'https:'
      || url.protocol === 'data:'
      || url.protocol === 'blob:';
  } catch {
    return false;
  }
}

function normalizePreviewUrl(value: unknown): string | null {
  return isDisplayableAssetPreviewUrl(value) ? value.trim() : null;
}

function normalizeRequiredText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mediaKindForHistoryKind(value: unknown): AssetLibraryMediaKind | null {
  if (value === 'voice-demo-candidate') return 'audio';
  if (
    value === 'runtime-image-candidate'
    || value === 'avatar-package-candidate'
    || value === 'identity-resource-upload'
    || value === 'local-image-edit-candidate'
  ) {
    return 'image';
  }
  return null;
}

function normalizeHistoryRecord(value: unknown): AssetLibraryEntry | null {
  if (!isRecord(value)) return null;
  const id = isAppUlid(value.id) ? value.id.trim() : null;
  const personaId = normalizeRequiredText(value.personaId);
  const sourceContentHash = normalizeRequiredText(value.sourceContentHash);
  const originDraftKey = isCreationDraftKey(value.originDraftKey) ? value.originDraftKey.trim() : undefined;
  const mediaKind = mediaKindForHistoryKind(value.kind);
  const sourceKind = isSourceKind(value.sourceKind) ? value.sourceKind : null;
  const reviewState = isReviewState(value.reviewState) ? value.reviewState : null;
  const title = normalizeRequiredText(value.label);
  const createdAt = isIsoDateTime(value.createdAt) ? value.createdAt.trim() : null;
  const source = normalizeRequiredText(value.source);
  const detail = normalizeRequiredText(value.detail);

  if (
    !id
    || !personaId
    || !sourceContentHash
    || !mediaKind
    || !sourceKind
    || !reviewState
    || !title
    || !createdAt
    || !source
    || !detail
    || value.publicTruth !== false
  ) {
    return null;
  }

  const previewUrl = normalizePreviewUrl(value.previewUrl) ?? normalizePreviewUrl(detail);
  return {
    id,
    mediaKind,
    sourceKind,
    reviewState,
    title,
    previewUrl,
    ...(Array.isArray(value.artifactIds) && typeof value.artifactIds[0] === 'string' ? { artifactId: value.artifactIds[0] } : {}),
    provenance: { kind: 'persona', personaId, sourceContentHash, ...(originDraftKey ? { originDraftKey } : {}) },
    createdAt,
  };
}

function normalizeDraftCandidate(
  value: unknown,
  provenance: AssetLibraryDraftProvenance,
  titleFallback: string | null,
  index: number,
): AssetLibraryEntry | null {
  if (!isRecord(value) || value.draftKey !== provenance.draftKey) return null;
  const url = normalizePreviewUrl(value.url);
  const prompt = normalizeRequiredText(value.prompt);
  const sourceKind = isSourceKind(value.sourceKind) ? value.sourceKind : null;
  const reviewState = value.reviewState === 'candidate-only' || value.reviewState === 'owner-selected'
    ? value.reviewState
    : null;
  const createdAt = isIsoDateTime(value.createdAt) ? value.createdAt.trim() : null;
  const title = titleFallback || prompt;
  if (
    !url
    || !sourceKind
    || (sourceKind === 'generated' && !prompt)
    || !reviewState
    || !createdAt
    || !title
  ) return null;

  return {
    id: `draft:${provenance.draftKey}:${index}`,
    mediaKind: 'image',
    sourceKind,
    reviewState,
    title,
    previewUrl: url,
    ...(typeof value.artifactId === 'string' ? { artifactId: value.artifactId } : {}),
    provenance,
    createdAt,
  };
}

function normalizeImportedRecord(value: unknown): AssetLibraryEntry | null {
  if (!isRecord(value)) return null;
  const id = isAppUlid(value.id) ? value.id.trim() : null;
  const mediaKind = isMediaKind(value.mediaKind) ? value.mediaKind : null;
  const sourceKind = value.sourceKind === 'imported' ? value.sourceKind : null;
  const title = normalizeRequiredText(value.title);
  const createdAt = isIsoDateTime(value.createdAt) ? value.createdAt.trim() : null;
  if (!id || !mediaKind || !sourceKind || !title || !createdAt) return null;

  return {
    id,
    mediaKind,
    sourceKind,
    reviewState: 'candidate-only',
    title,
    previewUrl: normalizePreviewUrl(value.previewUrl),
    ...(typeof value.artifactId === 'string' ? { artifactId: value.artifactId } : {}),
    provenance: { kind: 'local-import', id },
    createdAt,
  };
}

function collectHistoryEntries(records: readonly unknown[] | undefined): { entries: AssetLibraryEntry[]; unavailableCount: number } {
  if (!records) return { entries: [], unavailableCount: 0 };
  const entries: AssetLibraryEntry[] = [];
  let unavailableCount = 0;
  for (const item of records) {
    const normalized = normalizeHistoryRecord(item);
    if (normalized) entries.push(normalized);
    else unavailableCount += 1;
  }
  return { entries, unavailableCount };
}

function collectDraftEntries(records: readonly unknown[] | undefined): { entries: AssetLibraryEntry[]; unavailableCount: number } {
  if (!records) return { entries: [], unavailableCount: 0 };
  const entries: AssetLibraryEntry[] = [];
  let unavailableCount = 0;
  for (const value of records) {
    if (!isRecord(value) || !isCreationDraftKey(value.draftKey)) {
      unavailableCount += 1;
      continue;
    }
    const draftKey = value.draftKey.trim();
    const candidates = value.referenceImageCandidates;
    if (!Array.isArray(candidates)) {
      unavailableCount += 1;
      continue;
    }
    const archetype = normalizeRequiredText(value.personaArchetype)?.toUpperCase();
    const traits = Array.isArray(value.personaTraits)
      ? value.personaTraits.flatMap((trait) => normalizeRequiredText(trait)?.toUpperCase() || [])
      : [];
    const provenance: AssetLibraryDraftProvenance = {
      kind: 'draft',
      draftKey,
      ...(archetype ? { archetype } : {}),
      ...(traits.length > 0 ? { traits } : {}),
    };
    const titleFallback = normalizeRequiredText(value.displayName);
    candidates.forEach((candidate, index) => {
      const normalized = normalizeDraftCandidate(candidate, provenance, titleFallback, index);
      if (normalized) entries.push(normalized);
      else unavailableCount += 1;
    });
  }
  return { entries, unavailableCount };
}

function collectImportedEntries(records: readonly unknown[] | undefined): { entries: AssetLibraryEntry[]; unavailableCount: number } {
  if (!records) return { entries: [], unavailableCount: 0 };
  const entries: AssetLibraryEntry[] = [];
  let unavailableCount = 0;
  for (const record of records) {
    const normalized = normalizeImportedRecord(record);
    if (normalized) entries.push(normalized);
    else unavailableCount += 1;
  }
  return { entries, unavailableCount };
}

function sortEntries(entries: AssetLibraryEntry[]): AssetLibraryEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const dateOrder = Date.parse(right.entry.createdAt) - Date.parse(left.entry.createdAt);
      return dateOrder || left.index - right.index;
    })
    .map(({ entry }) => entry);
}

export function filterAssetLibraryEntries(
  entries: readonly AssetLibraryEntry[],
  tab: AssetLibraryTab,
): AssetLibraryEntry[] {
  if (tab === 'images') return entries.filter((entry) => entry.mediaKind === 'image');
  if (tab === 'audio') return entries.filter((entry) => entry.mediaKind === 'audio');
  return entries.filter((entry) => entry.sourceKind === 'imported');
}

export function getAssetLibraryTabState(data: AssetLibraryData, tab: AssetLibraryTab): AssetLibraryTabState {
  const entries = filterAssetLibraryEntries(data.entries, tab);
  return {
    entries,
    isEmpty: entries.length === 0,
    unavailableCount: data.unavailableCount,
  };
}

function positiveInteger(value: number | undefined): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value ?? 0 : 0;
}

export function aggregateAssetLibraryData(options: AggregateAssetLibraryOptions = {}): AssetLibraryData {
  const history = collectHistoryEntries(options.creativeHistoryRecords);
  const drafts = collectDraftEntries(options.creationDraftRecords);
  const imported = collectImportedEntries(options.importedRecords);
  const entries = sortEntries([...history.entries, ...drafts.entries, ...imported.entries]);
  const seen = new Set<string>();
  const deduped = entries.filter((entry) => {
    const provenanceKey = entry.provenance.kind === 'persona'
      ? `${entry.provenance.kind}:${entry.provenance.personaId}:${entry.provenance.sourceContentHash}:${entry.provenance.originDraftKey || ''}`
      : entry.provenance.kind === 'draft'
        ? `${entry.provenance.kind}:${entry.provenance.draftKey}`
        : `${entry.provenance.kind}:${entry.provenance.id}`;
    const key = `${entry.id}:${provenanceKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const unavailableCount = history.unavailableCount
    + drafts.unavailableCount
    + imported.unavailableCount
    + positiveInteger(options.sourceUnavailableCount)
    + positiveInteger(options.importedUnavailableCount);
  return {
    entries: deduped,
    images: filterAssetLibraryEntries(deduped, 'images'),
    audio: filterAssetLibraryEntries(deduped, 'audio'),
    uploads: filterAssetLibraryEntries(deduped, 'uploads'),
    unavailableCount,
  };
}
