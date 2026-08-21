import {
  getStudioProtectedJsonStorage,
  isStudioStorageNotFoundError,
  type StudioProtectedJsonStorage,
} from '../../app-shell/studio-storage.js';
import { createAppUlid, isAppUlid } from '../../app-shell/app-ulid.js';
import {
  normalizeCreateRealmPersonaDraft,
  type CreateRealmPersonaDraftInput,
  type NormalizedCreateRealmPersonaDraft,
  type ReferenceImageCandidate,
  isReferenceImageCandidateSlot,
  PERSONA_ARCHETYPES,
  PERSONA_TRAITS,
} from './create-persona-draft.js';
import { normalizeDisplaySafeHttpsUrl } from './persona-external-ref.js';

export const CREATION_DRAFT_STORAGE_PATH_PREFIX = 'creation/drafts/';
export const CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS = 800;
export const CREATION_DRAFT_HISTORY_UPDATED_EVENT = 'rps:creation-draft-history-updated';

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export type CreationDraftPersistResult =
  | { ok: true; record: CreationDraftAutosaveRecord }
  | {
    ok: false;
    failure: 'creation-draft-not-persistable';
    message: string;
  };

export type CreationDraftLoadResult =
  | { ok: true; record: CreationDraftAutosaveRecord | null }
  | {
    ok: false;
    failure: 'creation-draft-load-failed';
    message: string;
  };

export type CreationDraftStorage = Pick<StudioProtectedJsonStorage, 'readJson' | 'writeJson'>;

export type CreationDraftAutosaveRecord = NormalizedCreateRealmPersonaDraft & {
  draftKey: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && ISO_DATE_TIME_PATTERN.test(value.trim())
    && !Number.isNaN(Date.parse(value.trim()));
}

function isValidDraftKey(value: unknown): value is string {
  return isAppUlid(value);
}

function resolveStorage(storage?: CreationDraftStorage | null): CreationDraftStorage | null {
  if (storage !== undefined) return storage;
  try {
    return getStudioProtectedJsonStorage();
  } catch {
    return null;
  }
}

function normalizeCandidate(value: unknown, expectedDraftKey: string): ReferenceImageCandidate | null {
  const normalizedUrl = isRecord(value) ? normalizeDisplaySafeHttpsUrl(value.url) : null;
  if (
    !isRecord(value)
    || value.draftKey !== expectedDraftKey
    || !normalizedUrl
    || typeof value.prompt !== 'string'
    || !isIsoDateTime(value.createdAt)
    || !isReferenceImageCandidateSlot(value.slot)
  ) {
    return null;
  }
  const sourceKind = value.sourceKind === 'generated' || value.sourceKind === 'imported'
    ? value.sourceKind
    : null;
  const reviewState = value.reviewState === 'candidate-only' || value.reviewState === 'owner-selected'
    ? value.reviewState
    : null;
  if (!sourceKind || !reviewState || (sourceKind === 'generated' && !value.prompt.trim())) return null;
  return {
    draftKey: expectedDraftKey,
    slot: value.slot,
    url: normalizedUrl,
    prompt: value.prompt.trim(),
    createdAt: value.createdAt.trim(),
    sourceKind,
    reviewState,
  };
}

function isKnownArchetype(value: unknown): boolean {
  return typeof value === 'string'
    && (value.trim() === '' || (PERSONA_ARCHETYPES as readonly string[]).includes(value.trim().toUpperCase()));
}

function isKnownTrait(value: unknown): boolean {
  return typeof value === 'string' && (PERSONA_TRAITS as readonly string[]).includes(value.trim().toUpperCase());
}

function normalizeStoredDraft(value: unknown, expectedDraftKey: string): CreationDraftAutosaveRecord | null {
  if (!isRecord(value) || value.draftKey !== expectedDraftKey || !isIsoDateTime(value.updatedAt)) return null;

  const requiredStrings = [
    'handle',
    'displayName',
    'concept',
    'description',
    'ruleText',
    'selectedWorldId',
    'visibility',
    'personaArchetype',
    'referenceImageUrl',
    'referenceImagePrompt',
    'originalDescription',
    'speechSupplement',
    'boundarySupplement',
    'visualSupplement',
  ] as const;
  if (requiredStrings.some((key) => typeof value[key] !== 'string')) return null;
  if (!Array.isArray(value.personaTraits) || value.personaTraits.some((trait) => !isKnownTrait(trait))) return null;
  if (!isKnownArchetype(value.personaArchetype)) return null;
  if (!['', 'private', 'unlisted', 'public'].includes(String(value.visibility))) return null;
  const normalizedReferenceImageUrl = value.referenceImageUrl === ''
    ? ''
    : normalizeDisplaySafeHttpsUrl(value.referenceImageUrl);
  if (normalizedReferenceImageUrl === null) return null;
  if (!Array.isArray(value.referenceImageCandidates)) return null;

  const candidates = value.referenceImageCandidates.map((candidate) => normalizeCandidate(candidate, expectedDraftKey));
  if (candidates.some((candidate) => candidate === null)) return null;
  const normalizedCandidates = candidates as ReferenceImageCandidate[];
  if (new Set(normalizedCandidates.map((candidate) => candidate.slot)).size !== normalizedCandidates.length) return null;
  const selectedCandidates = normalizedCandidates.filter((candidate) => candidate.reviewState === 'owner-selected');
  if (selectedCandidates.length > 1) return null;
  if (
    value.referenceImageUrl
    && !selectedCandidates.some((candidate) => candidate.url === normalizedReferenceImageUrl)
  ) {
    return null;
  }

  const normalized = normalizeCreateRealmPersonaDraft({
    handle: value.handle as string,
    displayName: value.displayName as string,
    concept: value.concept as string,
    description: value.description as string,
    ruleText: value.ruleText as string,
    selectedWorldId: value.selectedWorldId as string,
    visibility: value.visibility as CreateRealmPersonaDraftInput['visibility'],
    personaArchetype: value.personaArchetype as CreateRealmPersonaDraftInput['personaArchetype'],
    personaTraits: value.personaTraits as CreateRealmPersonaDraftInput['personaTraits'],
    referenceImageUrl: value.referenceImageUrl as string,
    referenceImagePrompt: value.referenceImagePrompt as string,
    originalDescription: value.originalDescription as string,
    speechSupplement: value.speechSupplement as string,
    boundarySupplement: value.boundarySupplement as string,
    visualSupplement: value.visualSupplement as string,
    referenceImageCandidates: normalizedCandidates,
  });

  if (normalized.personaTraits.length > 3) return null;
  return {
    draftKey: expectedDraftKey,
    updatedAt: value.updatedAt.trim(),
    ...normalized,
  };
}

function persistFailure(message: string): CreationDraftPersistResult {
  return {
    ok: false,
    failure: 'creation-draft-not-persistable',
    message,
  };
}

export function isCreationDraftKey(value: unknown): value is string {
  return isValidDraftKey(value);
}

export function getCreationDraftStoragePath(draftKey: string): string {
  return `${CREATION_DRAFT_STORAGE_PATH_PREFIX}${draftKey.trim()}.json`;
}

export function createCreationDraftKey(now = Date.now()): string {
  return createAppUlid(now);
}

export async function loadCreationDraft(
  draftKey: string,
  storage?: CreationDraftStorage | null,
): Promise<CreationDraftLoadResult> {
  if (!isValidDraftKey(draftKey)) {
    return { ok: false, failure: 'creation-draft-load-failed', message: 'Draft key must be a valid ULID.' };
  }
  const normalizedDraftKey = draftKey.trim();
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return { ok: false, failure: 'creation-draft-load-failed', message: 'Draft storage is unavailable.' };
  }

  try {
    const document = await targetStorage.readJson(getCreationDraftStoragePath(normalizedDraftKey));
    const record = normalizeStoredDraft(document.value, normalizedDraftKey);
    return record
      ? { ok: true, record }
      : { ok: false, failure: 'creation-draft-load-failed', message: 'Stored draft is invalid.' };
  } catch (error) {
    if (isStudioStorageNotFoundError(error)) return { ok: true, record: null };
    return { ok: false, failure: 'creation-draft-load-failed', message: 'Draft storage read failed.' };
  }
}

export async function persistCreationDraft(
  draftKey: string,
  draft: CreateRealmPersonaDraftInput,
  storage?: CreationDraftStorage | null,
  now = new Date(),
): Promise<CreationDraftPersistResult> {
  if (!isValidDraftKey(draftKey)) {
    return persistFailure('Draft key must be a valid ULID.');
  }

  let normalized: NormalizedCreateRealmPersonaDraft;
  try {
    normalized = normalizeCreateRealmPersonaDraft(draft);
  } catch {
    return persistFailure('Draft fields could not be normalized.');
  }

  if (!Array.isArray(draft.personaTraits)) {
    return persistFailure('Draft fields could not be normalized.');
  }
  if (normalized.personaTraits.length > 3) {
    return persistFailure('Draft contains more than 3 persona traits.');
  }
  if (draft.personaTraits.some((trait) => !isKnownTrait(trait))) {
    return persistFailure('Draft contains a persona trait outside the closed value set.');
  }
  if (!Array.isArray(draft.referenceImageCandidates)) {
    return persistFailure('Draft contains an invalid reference image candidate.');
  }
  const candidates = draft.referenceImageCandidates.map((candidate) => normalizeCandidate(candidate, draftKey.trim()));
  if (candidates.some((candidate) => candidate === null)) {
    return persistFailure('Draft contains an invalid reference image candidate.');
  }
  if (new Set(candidates.map((candidate) => candidate?.slot)).size !== candidates.length) {
    return persistFailure('Draft contains more than one reference image candidate in the same slot.');
  }
  const selectedCandidates = candidates.filter((candidate) => candidate?.reviewState === 'owner-selected');
  if (selectedCandidates.length > 1) {
    return persistFailure('Draft contains more than one owner-selected reference image candidate.');
  }
  if (normalized.referenceImageUrl && !selectedCandidates.some((candidate) => candidate?.url === normalized.referenceImageUrl)) {
    return persistFailure('Draft reference image is not an owner-selected candidate.');
  }

  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return persistFailure('Draft storage is unavailable.');
  }

  const record: CreationDraftAutosaveRecord = {
    draftKey: draftKey.trim(),
    updatedAt: now.toISOString(),
    ...normalized,
    referenceImageCandidates: candidates as ReferenceImageCandidate[],
  };
  try {
    await targetStorage.writeJson(getCreationDraftStoragePath(draftKey), record);
    return { ok: true, record };
  } catch {
    return persistFailure('Draft could not be persisted through protected storage.');
  }
}

export function dispatchCreationDraftHistoryUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CREATION_DRAFT_HISTORY_UPDATED_EVENT));
}
