import {
  Button,
  EmptyState,
  FieldShell,
  IconButton,
  InlineAlert,
  OverlayShell,
  StatusBadge,
  Surface,
  TextareaField,
} from '@nimiplatform/kit/ui';
import { ImageIcon, RefreshCw, Scan, Sparkles, Wand2, X } from 'lucide-react';
import type {
  NormalizedCreateRealmPersonaDraft,
} from '../create-persona-draft.js';
import {
  ReferenceImageSourceChooser,
} from '../reference-image-source-chooser.js';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';
import { LOCAL_IMPORT_MIME_TYPES } from '../../assets-library/local-import-store.js';
import type { UseReferenceImageResult } from './use-reference-image.js';
import type { ReferenceAssetsState } from './types.js';

export function ReferenceImageCard({
  draft,
  normalizedDraft,
  error,
  referenceAssets,
  referenceSourceFailure,
  referenceImageSourceMode,
  referenceImageEditorOpen,
  referenceImageLoadFailed,
  referenceImage,
  onEditorOpenChange,
  onReferenceImagePromptChange,
}: {
  draft: { referenceImagePrompt: string };
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  error: string | null;
  referenceAssets: ReferenceAssetsState;
  referenceSourceFailure: string | null;
  referenceImageSourceMode: 'assets' | 'ai' | null;
  referenceImageEditorOpen: boolean;
  referenceImageLoadFailed: boolean;
  referenceImage: UseReferenceImageResult;
  onEditorOpenChange: (open: boolean) => void;
  onReferenceImagePromptChange: (value: string) => void;
}) {
  const { t } = useStudioI18n();
  const {
    previewReferenceCandidate,
    selectedReferenceCandidate,
    candidateCount,
    referenceImagePromptChanged,
    isGeneratingReferenceImage,
    referenceImageGenerationTarget,
    referenceImageFailure,
    localImportAvailable,
    referenceCandidateLoadFailures,
    isImportingReferenceImage,
    isOptimizingImagePrompt,
    referenceImageFileInputRef,
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
  } = referenceImage;
  const imagePrompt = normalizedDraft.referenceImagePrompt;
  const regenerationCandidate = selectedReferenceCandidate || (!previewReferenceCandidate?.url
    ? normalizedDraft.referenceImageCandidates.find((candidate) => !candidate.url || referenceCandidateLoadFailures.has(candidate.url))
    : null);

  return (
    <Surface
      tone="card"
      material="glass-thick"
      padding="none"
      tabIndex={-1}
      aria-invalid={Boolean(error) || undefined}
      data-create-field="referenceImage"
      className={`ras-create-reference-card ${error ? 'ras-create-reference-card--error' : ''}`}
    >
      <h4 className="ras-create-reference-card__title">{t('create.referenceTitle')}</h4>
      <button
        type="button"
        className="ras-create-reference-card__preview"
        data-create-field-control
        aria-expanded={referenceImageEditorOpen}
        aria-label={`${t('create.referenceTitle')}: ${previewReferenceCandidate ? t('create.referenceAttached') : t('create.reference.emptyTitle')}. ${t('create.reference.sourceTitle')}`}
        onClick={() => onEditorOpenChange(true)}
      >
        <Scan className="ras-create-reference-card__corner" data-corner="top-left" strokeWidth={1.15} aria-hidden="true" />
        <Scan className="ras-create-reference-card__corner" data-corner="top-right" strokeWidth={1.15} aria-hidden="true" />
        <Scan className="ras-create-reference-card__corner" data-corner="bottom-left" strokeWidth={1.15} aria-hidden="true" />
        <Scan className="ras-create-reference-card__corner" data-corner="bottom-right" strokeWidth={1.15} aria-hidden="true" />
        {previewReferenceCandidate?.url && !referenceImageLoadFailed && !referenceCandidateLoadFailures.has(previewReferenceCandidate.url) ? (
          <img
            src={previewReferenceCandidate.url}
            alt={t('create.referenceAlt')}
            className="ras-create-reference-card__image"
            onError={() => markReferenceImageUnavailable(previewReferenceCandidate.url)}
          />
        ) : (
          <span className="ras-create-reference-card__empty">
            <span className="ras-create-reference-card__empty-icon" aria-hidden="true">
              <ImageIcon size={21} strokeWidth={1.8} />
            </span>
            <span className="ras-create-reference-card__empty-title">{t('create.reference.emptyTitle')}</span>
            <span className="ras-create-reference-card__empty-description">{t('create.reference.emptyDescription')}</span>
          </span>
        )}
      </button>

      <OverlayShell
        open={referenceImageEditorOpen}
        size="M"
        onClose={() => onEditorOpenChange(false)}
        title={(
          <div className="ras-visual-change__title-row">
            <span>{t('create.referenceTitle')}</span>
            <IconButton
              tone="ghost"
              size="sm"
              className="ras-visual-change__close"
              aria-label={t('common.close')}
              onClick={() => onEditorOpenChange(false)}
              icon={<X size={18} strokeWidth={1.8} aria-hidden="true" />}
            />
          </div>
        )}
        description={<span className="ras-visual-change__description">{t('create.reference.sourceTitle')}</span>}
        panelClassName="ras-visual-change-dialog"
        contentClassName="ras-visual-change-dialog__content"
        footer={(
          <div className="flex justify-end">
            <Button tone="secondary" onClick={() => onEditorOpenChange(false)}>{t('common.cancel')}</Button>
          </div>
        )}
        dataTestId="create-reference-image-dialog"
      >
        <div className="ras-visual-change">
          <input
            ref={referenceImageFileInputRef}
            type="file"
            accept={LOCAL_IMPORT_MIME_TYPES.join(',')}
            hidden
            aria-label={t('assets.visualChange.uploadAriaLabel')}
            onChange={(event) => void handleReferenceImageUpload(event)}
          />

          <ReferenceImageSourceChooser
            value={referenceImageSourceMode}
            attached={Boolean(normalizedDraft.referenceImageUrl)}
            uploadDisabled={!localImportAvailable || isImportingReferenceImage}
            onUploadRequest={requestReferenceImageUpload}
            onValueChange={selectReferenceImageSourceMode}
          />

          {referenceImageSourceMode === 'assets' ? (
            <div className="grid gap-2" data-testid="create-reference-assets">
              {referenceAssets.loadState === 'loading' || referenceAssets.loadState === 'idle' ? (
                <EmptyState title={t('create.reference.assetsLoading')} description={t('create.reference.assetsLoadingDescription')} />
              ) : referenceAssets.entries.length === 0 ? (
                <EmptyState
                  title={t(referenceAssets.loadState === 'failed'
                    ? 'create.reference.assetsUnavailable'
                    : 'assets.visualChange.assetsEmptyTitle')}
                  description={t(referenceAssets.loadState === 'failed'
                    ? 'create.reference.assetsUnavailableDescription'
                    : 'create.reference.assetsEmptyDescription')}
                />
              ) : (
                <div className="ras-create-visual-source__assets">
                  {referenceAssets.entries.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className="ras-create-visual-source__asset"
                      aria-label={t('create.reference.useAsset', { title: asset.title })}
                      onClick={() => asset.previewUrl ? adoptReferenceImageUrl(asset.previewUrl, { artifactId: asset.artifactId, sourceKind: asset.sourceKind }) : undefined}
                    >
                      <img src={asset.previewUrl || ''} alt={asset.title} />
                      <span>{asset.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {referenceAssets.sourceUnavailable || referenceAssets.unavailableCount > 0 ? (
                <InlineAlert tone="warning">{t('create.reference.assetsPartial')}</InlineAlert>
              ) : null}
            </div>
          ) : null}

          {referenceImageSourceMode === 'ai' ? (
            <div className="grid gap-3" data-testid="create-reference-ai">
              <div className={`ras-create-prompt-field${isOptimizingImagePrompt ? ' ras-create-prompt-field--optimizing' : ''}`}>
                <FieldShell label={t('create.imagePromptLabel')} message={t('create.imagePromptMessage')}>
                  <TextareaField
                    rows={3}
                    value={draft.referenceImagePrompt}
                    placeholder={t('create.imagePromptPlaceholder')}
                    disabled={isOptimizingImagePrompt}
                    onChange={(event) => onReferenceImagePromptChange(event.currentTarget.value)}
                  />
                </FieldShell>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                {referenceImagePromptChanged ? (
                  <StatusBadge tone="warning">{t('create.imagePromptChanged')}</StatusBadge>
                ) : <span />}
                <span className="flex items-center gap-1">
                  <Button
                    tone="ghost"
                    size="sm"
                    loading={isOptimizingImagePrompt}
                    disabled={isGeneratingReferenceImage}
                    onClick={() => void optimizeReferenceImagePrompt()}
                    leadingIcon={isOptimizingImagePrompt ? undefined : <Wand2 size={14} aria-hidden="true" />}
                  >
                    {isOptimizingImagePrompt ? t('create.imagePromptOptimizing') : t('create.imagePromptOptimize')}
                  </Button>
                  <Button tone="ghost" size="sm" onClick={resetReferenceImagePrompt}>
                    {t('create.imagePromptReset')}
                  </Button>
                </span>
              </div>
            </div>
          ) : null}

          {referenceImageSourceMode === 'ai' ? candidateCount === 0 ? (
            <Button
              tone="primary"
              fullWidth
              disabled={!imagePrompt}
              loading={referenceImageGenerationTarget?.mode === 'fill' && referenceImageGenerationTarget.slot === 0}
              onClick={() => void runReferenceImageGeneration({ mode: 'fill', slot: 0 })}
              leadingIcon={<Sparkles size={15} aria-hidden="true" />}
            >
              {t('create.generateReference')}
            </Button>
          ) : (
            <>
              {previewReferenceCandidate && !selectedReferenceCandidate ? (
                <Button
                  tone="primary"
                  fullWidth
                  disabled={!previewReferenceCandidate.url || referenceCandidateLoadFailures.has(previewReferenceCandidate.url) || isGeneratingReferenceImage}
                  onClick={() => selectReferenceImageCandidate(previewReferenceCandidate.url)}
                >
                  {t('create.reference.selectCandidate')}
                </Button>
              ) : null}
              <Button
                tone="secondary"
                fullWidth
                disabled={!regenerationCandidate || !imagePrompt}
                loading={referenceImageGenerationTarget?.mode === 'replace'}
                onClick={() => regenerationCandidate
                  ? void runReferenceImageGeneration({ mode: 'replace', slot: regenerationCandidate.slot })
                  : undefined}
                leadingIcon={<RefreshCw size={15} aria-hidden="true" />}
              >
                {t(selectedReferenceCandidate ? 'create.reference.regenerateSelected' : 'create.generateReference')}
              </Button>
              <p className="m-0 text-xs text-[var(--nimi-text-muted)]">
                {selectedReferenceCandidate
                  ? t('create.reference.regenerateSelectedHelp')
                  : regenerationCandidate
                  ? t('create.reference.sourceUrlUnavailable')
                  : t('create.reference.selectToRegenerate')}
              </p>
            </>
          ) : null}
          {!localImportAvailable ? <InlineAlert tone="info">{t('create.reference.uploadUnavailable')}</InlineAlert> : null}
          {referenceImageFailure ? <InlineAlert tone="danger">{referenceImageFailure}</InlineAlert> : null}
          {referenceSourceFailure ? <InlineAlert tone="danger">{referenceSourceFailure}</InlineAlert> : null}
          {selectedReferenceCandidate && (!selectedReferenceCandidate.url || referenceCandidateLoadFailures.has(selectedReferenceCandidate.url))
            ? <InlineAlert tone="warning">{t('create.reference.sourceUrlUnavailable')}</InlineAlert> : null}
          {selectedReferenceCandidate ? <Button tone="ghost" size="sm" onClick={clearReferenceImage}>{t('create.clearReference')}</Button> : null}
        </div>
      </OverlayShell>
      {error ? <p className="ras-create-reference-card__error">{error}</p> : null}
      {referenceImageFailure ? <div className="ras-create-reference-card__failure"><InlineAlert tone="danger">{referenceImageFailure}</InlineAlert></div> : null}
    </Surface>
  );
}
