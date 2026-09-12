import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { nimiToast } from '@nimiplatform/kit/ui';
import {
  adoptImportedReferenceImageCandidate,
  normalizeCreateRealmPersonaDraft,
  type CreateRealmPersonaDraftInput,
  type NormalizedCreateRealmPersonaDraft,
  type ReferenceImageCandidate,
} from '../create-persona-draft.js';
import {
  generatePersonaReferenceImage,
  initialReferenceImagePromptFromDraft,
} from '../persona-reference-image.js';
import { optimizePersonaImagePrompt } from '../persona-image-prompt-optimizer.js';
import type { StudioLocale } from '../../../i18n/studio-i18n.js';
import {
  CREATION_DRAFT_HISTORY_UPDATED_EVENT,
  loadCreationDraft,
} from '../creation-draft-store.js';
import { loadCreationDraftHistory } from '../creation-draft-history.js';
import {
  CREATIVE_ASSET_HISTORY_UPDATED_EVENT,
  loadAllLocalCreativeAssetHistory,
} from '../creative-asset-history.js';
import {
  aggregateAssetLibraryData,
  isDisplayableAssetPreviewUrl,
  type AssetLibraryEntry,
} from '../../assets-library/asset-library-data.js';
import {
  importLocalAssetFile,
  loadLocalImportedAssetRecords,
  type LocalImportCapabilityStatus,
} from '../../assets-library/local-import-store.js';
import type { ReferenceImageSourceMode } from '../reference-image-source-chooser.js';
import { logCreateFlowFailure, translateCreateFlowFailure } from './create-flow-copy.js';
import { referenceImageCandidatePreviewUrl } from '../reference-image-source.js';
import type {
  CreateRealmPersonaDraftPatchInput,
  CreateStage,
  ReferenceAssetsState,
  ReferenceImageGenerationTarget,
  StudioTranslator,
} from './types.js';

type ReferenceImageActions = {
  updateDraft: (patch: CreateRealmPersonaDraftPatchInput) => void;
  setReferenceImageSourceMode: (mode: ReferenceImageSourceMode | null) => void;
  setReferenceSourceFailure: (message: string | null) => void;
  setReferenceAssetsLoading: () => void;
  setReferenceAssets: (assets: Omit<ReferenceAssetsState, 'loadState'> & { failed: boolean }) => void;
};

type ExistingReferenceAssetLoadResult = {
  entries: AssetLibraryEntry[];
  unavailableCount: number;
  sourceUnavailable: boolean;
};

async function loadExistingReferenceAssets(
  currentDraftKey: string,
  capability: LocalImportCapabilityStatus,
): Promise<ExistingReferenceAssetLoadResult> {
  const [imported, creative, history] = await Promise.all([
    loadLocalImportedAssetRecords(capability),
    loadAllLocalCreativeAssetHistory(),
    loadCreationDraftHistory(),
  ]);
  const draftRecords = history.ok
    ? (await Promise.all(history.entries.map((entry) => loadCreationDraft(entry.draftKey))))
      .flatMap((loaded) => loaded.ok && loaded.record ? [loaded.record] : [])
    : [];
  const unavailableCount = imported.unavailableCount
    + creative.unavailableCount
    + (history.ok ? history.unavailableCount : 0)
    + (history.ok ? history.entries.length - draftRecords.length : 0);
  const data = aggregateAssetLibraryData({
    creativeHistoryRecords: creative.records,
    creationDraftRecords: draftRecords,
    importedRecords: imported.records,
    sourceUnavailableCount: unavailableCount,
  });
  const seenUrls = new Set<string>();
  const entries = data.images.filter((entry) => {
    if (
      !isDisplayableAssetPreviewUrl(entry.previewUrl)
      || (entry.provenance.kind === 'draft' && entry.provenance.draftKey === currentDraftKey)
      || seenUrls.has(entry.previewUrl)
    ) return false;
    seenUrls.add(entry.previewUrl);
    return true;
  });
  return {
    entries,
    unavailableCount: data.unavailableCount,
    sourceUnavailable: Boolean(imported.failure || !creative.ok || !history.ok),
  };
}

/**
 * Reference-image operations for the review-stage Persona image card: AI
 * candidate generation (one at a time), owner selection, local upload/import,
 * and the reusable-asset browser. All candidates stay local draft state until
 * the owner explicitly selects one.
 */
export function useReferenceImage({
  draftKey,
  draft,
  normalizedDraft,
  stage,
  localImportCapability,
  locale,
  t,
  actions,
}: {
  draftKey: string;
  draft: CreateRealmPersonaDraftInput;
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  stage: CreateStage;
  localImportCapability: LocalImportCapabilityStatus;
  locale: StudioLocale;
  t: StudioTranslator;
  actions: ReferenceImageActions;
}) {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [referenceImageGenerationTarget, setReferenceImageGenerationTarget] = useState<ReferenceImageGenerationTarget | null>(null);
  const [referenceImageFailure, setReferenceImageFailure] = useState<string | null>(null);
  const [referenceCandidateLoadFailures, setReferenceCandidateLoadFailures] = useState<Set<string>>(() => new Set());
  const [isImportingReferenceImage, setIsImportingReferenceImage] = useState(false);
  const [isOptimizingImagePrompt, setIsOptimizingImagePrompt] = useState(false);
  const referenceImageFileInputRef = useRef<HTMLInputElement>(null);

  const refreshReferenceAssets = useCallback(async () => {
    actions.setReferenceAssetsLoading();
    const result = await loadExistingReferenceAssets(draftKey, localImportCapability);
    actions.setReferenceAssets({
      entries: result.entries,
      unavailableCount: result.unavailableCount,
      sourceUnavailable: result.sourceUnavailable,
      failed: result.sourceUnavailable,
    });
  }, [actions, draftKey, localImportCapability]);

  useEffect(() => {
    if (stage !== 'review') return undefined;
    const refresh = () => void refreshReferenceAssets();
    void refreshReferenceAssets();
    window.addEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, refresh);
    window.addEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, refresh);
      window.removeEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, refresh);
    };
  }, [refreshReferenceAssets, stage]);

  async function runReferenceImageGeneration(target: ReferenceImageGenerationTarget) {
    if (referenceImageGenerationTarget) return;
    const currentDraft = normalizeCreateRealmPersonaDraft(draft);
    const occupiedTarget = currentDraft.referenceImageCandidates.find((candidate) => candidate.slot === target.slot);
    if (target.mode === 'fill' && occupiedTarget) return;
    if (
      target.mode === 'replace'
      && (!occupiedTarget || (occupiedTarget.reviewState !== 'owner-selected'
        && occupiedTarget.url && !referenceCandidateLoadFailures.has(occupiedTarget.url)))
    ) {
      return;
    }

    setReferenceImageGenerationTarget(target);
    setReferenceImageFailure(null);
    const prompt = currentDraft.referenceImagePrompt;
    try {
      const result = await generatePersonaReferenceImage({ prompt, count: 1 });
      if (!result.ok) {
        logCreateFlowFailure('create-flow.reference-image', result.cause);
        const message = translateCreateFlowFailure(result.cause, t);
        setReferenceImageFailure(message);
        const toastMessage = t('create.referenceFailed', { message });
        if (
          result.failure === 'runtime-capability-unavailable'
          || result.failure === 'runtime-route-unbound'
          || result.failure === 'runtime-transport-unavailable'
        ) {
          nimiToast.info(toastMessage);
        } else {
          nimiToast.danger(toastMessage);
        }
        return;
      }
      const createdAt = new Date().toISOString();
      // @nimi-authority: rule.realm-persona-studio.asset.r014
      const url = result.referenceImageUrl;
      if (!url) {
        const message = t('create.reference.capabilityUnavailable');
        setReferenceImageFailure(message);
        nimiToast.info(message);
        return;
      }
      const candidate: ReferenceImageCandidate = {
        draftKey,
        slot: target.slot,
        url,
        ...(result.artifactIds[0] ? { artifactId: result.artifactIds[0] } : {}),
        prompt,
        createdAt,
        sourceKind: 'generated',
        reviewState: 'candidate-only',
      };
      setReferenceCandidateLoadFailures((current) => {
        const next = new Set(current);
        if (occupiedTarget) next.delete(occupiedTarget.url);
        next.delete(url);
        return next;
      });
      actions.updateDraft((latest) => {
        const normalizedLatest = normalizeCreateRealmPersonaDraft(latest);
        const replaced = normalizedLatest.referenceImageCandidates.find((item) => item.slot === target.slot);
        const nextCandidates = normalizedLatest.referenceImageCandidates
          .filter((item) => item.slot !== target.slot)
          .concat(candidate)
          .sort((left, right) => left.slot - right.slot);
        return {
          referenceImageCandidates: nextCandidates,
          referenceImageUrl: replaced?.url === normalizedLatest.referenceImageUrl
            ? ''
            : normalizedLatest.referenceImageUrl,
        };
      });
      setReferenceImageFailure(null);
    } finally {
      setReferenceImageGenerationTarget(null);
    }
  }

  function clearReferenceImage() {
    actions.updateDraft({
      referenceImageUrl: '',
      referenceImageCandidates: normalizedDraft.referenceImageCandidates.map((candidate) => ({
        ...candidate,
        reviewState: 'candidate-only',
      })),
    });
    setReferenceImageFailure(null);
  }

  function resetReferenceImagePrompt() {
    actions.updateDraft({ referenceImagePrompt: initialReferenceImagePromptFromDraft(draft) });
  }

  /**
   * Owner-triggered AI prompt optimization. On success the candidate rewrites
   * the owner-editable prompt input; on failure the owner's text is preserved.
   */
  async function optimizeReferenceImagePrompt() {
    if (isOptimizingImagePrompt || referenceImageGenerationTarget) return;
    setIsOptimizingImagePrompt(true);
    setReferenceImageFailure(null);
    try {
      const result = await optimizePersonaImagePrompt({
        currentPrompt: draft.referenceImagePrompt,
        originalDescription: draft.originalDescription,
        description: draft.description,
        displayName: draft.displayName,
        concept: draft.concept,
        personaArchetype: draft.personaArchetype,
        visualSupplement: draft.visualSupplement,
        locale,
      });
      if (result.ok) {
        actions.updateDraft({ referenceImagePrompt: result.prompt });
        nimiToast.success(t('create.imagePromptOptimized'));
      } else {
        logCreateFlowFailure('create-flow.image-prompt-optimize', result.cause);
        nimiToast.danger(t('create.imagePromptOptimizeFailed', { message: translateCreateFlowFailure(result.cause, t) }));
      }
    } finally {
      setIsOptimizingImagePrompt(false);
    }
  }

  function selectReferenceImageCandidate(url: string) {
    if (referenceCandidateLoadFailures.has(url)) {
      return;
    }
    actions.updateDraft({
      referenceImageUrl: url,
      referenceImageCandidates: normalizedDraft.referenceImageCandidates.map((candidate) => ({
        ...candidate,
        reviewState: candidate.url === url ? 'owner-selected' : 'candidate-only',
      })),
    });
  }

  function markReferenceImageUnavailable(url: string) {
    setReferenceCandidateLoadFailures((current) => new Set(current).add(url));
  }

  function adoptReferenceImageUrl(url: string, source: { artifactId?: string; sourceKind: 'generated' | 'imported' } = { sourceKind: 'imported' }) {
    const result = adoptImportedReferenceImageCandidate(draftRef.current, draftKey, url, new Date().toISOString(), source);
    if (!result.ok) {
      actions.setReferenceSourceFailure(t(result.failure === 'candidate-slots-full'
        ? 'create.reference.sourceSlotsFull'
        : 'create.reference.sourceUrlUnavailable'));
      return;
    }
    actions.updateDraft({
      referenceImageUrl: result.referenceImageUrl,
      referenceImageCandidates: result.referenceImageCandidates,
    });
    setReferenceCandidateLoadFailures((current) => {
      const next = new Set(current);
      next.delete(result.referenceImageUrl);
      return next;
    });
    actions.setReferenceSourceFailure(null);
    nimiToast.success(t('create.reference.sourceSelected'));
  }

  function selectReferenceImageSourceMode(mode: ReferenceImageSourceMode) {
    actions.setReferenceImageSourceMode(mode);
  }

  function requestReferenceImageUpload() {
    if (isImportingReferenceImage) return;
    if (!localImportCapability.available) {
      actions.setReferenceSourceFailure(t('create.reference.uploadUnavailable'));
      return;
    }
    actions.setReferenceImageSourceMode(null);
    referenceImageFileInputRef.current?.click();
  }

  async function handleReferenceImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.toLocaleLowerCase().startsWith('image/')) {
      actions.setReferenceSourceFailure(t('assets.visualChange.uploadInvalid'));
      return;
    }
    setIsImportingReferenceImage(true);
    actions.setReferenceSourceFailure(null);
    try {
      const result = await importLocalAssetFile(file, localImportCapability);
      if (!result.ok) {
        actions.setReferenceSourceFailure(t(result.failure === 'capability-unavailable'
          ? 'create.reference.uploadUnavailable'
          : result.failure === 'file-too-large'
          ? 'assetsLibrary.upload.fileTooLarge'
          : result.failure === 'unsupported-media-type'
          ? 'assetsLibrary.upload.fileRejected'
          : 'create.reference.uploadFailed'));
        return;
      }
      await refreshReferenceAssets();
      const previewUrl = referenceImageCandidatePreviewUrl(result.record.previewUrl, result.record.artifactId);
      if (!previewUrl) {
        actions.setReferenceSourceFailure(t('create.reference.uploadLocalOnly'));
        return;
      }
      adoptReferenceImageUrl(previewUrl, { artifactId: result.record.artifactId, sourceKind: 'imported' });
    } finally {
      setIsImportingReferenceImage(false);
    }
  }

  const candidateCount = normalizedDraft.referenceImageCandidates.length;
  const selectedReferenceCandidate = normalizedDraft.referenceImageCandidates.find(
    (candidate) => candidate.reviewState === 'owner-selected',
  ) || null;
  const previewReferenceCandidate = selectedReferenceCandidate
    || normalizedDraft.referenceImageCandidates.find(
      (candidate) => !referenceCandidateLoadFailures.has(candidate.url),
    )
    || null;
  const isGeneratingReferenceImage = referenceImageGenerationTarget !== null;
  const referenceImagePromptChanged = Boolean(
    previewReferenceCandidate
    && previewReferenceCandidate.sourceKind === 'generated'
    && normalizedDraft.referenceImagePrompt !== previewReferenceCandidate.prompt,
  );

  return {
    localImportAvailable: localImportCapability.available,
    referenceImageGenerationTarget,
    referenceImageFailure,
    referenceCandidateLoadFailures,
    isImportingReferenceImage,
    isOptimizingImagePrompt,
    referenceImageFileInputRef,
    candidateCount,
    selectedReferenceCandidate,
    previewReferenceCandidate,
    isGeneratingReferenceImage,
    referenceImagePromptChanged,
    runReferenceImageGeneration,
    clearReferenceImage,
    resetReferenceImagePrompt,
    optimizeReferenceImagePrompt,
    selectReferenceImageCandidate,
    markReferenceImageUnavailable,
    adoptReferenceImageUrl,
    selectReferenceImageSourceMode,
    requestReferenceImageUpload,
    handleReferenceImageUpload,
  };
}

export type UseReferenceImageResult = ReturnType<typeof useReferenceImage>;
