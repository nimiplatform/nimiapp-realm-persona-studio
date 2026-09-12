import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  ArrowUp,
  AudioLines,
  Check,
  Clock3,
  Crop,
  Image as ImageIcon,
  Images,
  Link,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import { Button, Checkbox, EmptyState, FieldShell, IconButton, InlineAlert, nimiToast, OverlayShell, StatusBadge, Surface, TextField } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import { failureKindCopyKey } from './failure-copy.js';
import {
  generateReviewedVisualImageCandidate,
  buildRealmSelectAvatarInput,
  PERSONA_AVATAR_SELECTION_AVAILABLE,
  selectReviewedPersonaAvatarUrl,
  synthesizeReviewedVoiceDemo,
  type RealmPersonaAvatarSelectResult,
  type RuntimeVisualImageGenerationResult,
  type RuntimeVoiceDemoSynthesisResult,
} from './portfolio-client.js';
import {
  buildReviewedVoiceDemoCandidatePayload,
  type VisualMediaCandidateInput,
  type VoiceDemoCandidateInput,
} from './media-voice-candidate.js';
import {
  appendLocalCreativeAssetHistory,
  CREATIVE_ASSET_HISTORY_UPDATED_EVENT,
  loadLocalCreativeAssetHistory,
  type CreativeAssetHistoryKind,
  type CreativeAssetHistoryRecord,
} from './creative-asset-history.js';
import { SettingsSectionHead } from './OwnerPortfolio.settings.js';
import { VisualImageEditorWorkspace } from './visual-image-editor.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import { StudioVoiceSelector, useStudioVoicePresets } from './studio-voice-selector.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import type { StudioTranslateOptions } from '../../i18n/studio-i18n.js';

export function createVisualMediaCandidateInput(): VisualMediaCandidateInput {
  return {
    resourceType: 'IMAGE',
    bindingPoint: 'PERSONA_CANDIDATE',
    prompt: '',
    notes: '',
  };
}

export function createVisualImageGenerationDraft(): VisualMediaCandidateInput & { aspectRatio: string } {
  return {
    ...createVisualMediaCandidateInput(),
    aspectRatio: '1:1',
  };
}

export function createVoiceDemoCandidateInput(persona: OwnerPortfolioPersonaDetail): VoiceDemoCandidateInput {
  return {
    scriptText: persona.greeting.value || '',
    presetVoiceId: '',
  };
}

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

const CREATIVE_HISTORY_LABEL_KEYS: Record<CreativeAssetHistoryKind, StudioCopyKey> = {
  'runtime-image-candidate': 'assets.history.runtimeImageCandidate',
  'avatar-package-candidate': 'assets.history.avatarPackageCandidate',
  'identity-resource-upload': 'assets.history.identityResourceUpload',
  'local-image-edit-candidate': 'assets.history.localImageEdit',
  'voice-demo-candidate': 'assets.history.voiceDemoCandidate',
};

function isMediaCapabilityUnavailable(failure: string): boolean {
  return failure === 'runtime-capability-unavailable'
    || failure === 'runtime-route-unbound'
    || failure === 'runtime-transport-unavailable';
}

function translateVisualCandidateFailure(
  result: Extract<RuntimeVisualImageGenerationResult, { ok: false }>,
  t: StudioTranslator,
): string {
  if (result.failure === 'runtime-payload-invalid') return t('assets.error.runtimeImagePayloadInvalid');
  if (result.failure === 'runtime-transport-unavailable') return t('assets.error.runtimeImageTransportUnavailable');
  if (result.failure === 'runtime-route-unbound') return t('assets.error.runtimeImageConfigurationUnavailable');
  if (result.failure === 'runtime-capability-unavailable') {
    return t('assets.error.runtimeMediaCandidateUnavailable');
  }
  if (result.failure === 'runtime-output-malformed' || result.failure === 'runtime-output-missing') {
    return t('assets.error.runtimeImageMissingArtifact');
  }
  return t('assets.error.runtimeImageFailed');
}

function translateVoiceCandidateFailure(
  result: Extract<RuntimeVoiceDemoSynthesisResult, { ok: false }>,
  t: StudioTranslator,
): string {
  if (result.failure === 'runtime-payload-invalid') return t('assets.error.runtimeVoicePayloadInvalid');
  if (result.failure === 'runtime-transport-unavailable') return t('assets.error.runtimeVoiceTransportUnavailable');
  if (result.failure === 'runtime-route-unbound') return t('assets.error.runtimeVoiceConfigurationUnavailable');
  if (result.failure === 'runtime-capability-unavailable') {
    return t('assets.error.runtimeMediaCandidateUnavailable');
  }
  if (result.failure === 'runtime-output-malformed' || result.failure === 'runtime-output-missing') {
    return t('assets.error.runtimeVoiceMissingArtifact');
  }
  return t('assets.error.runtimeVoiceFailed');
}

function activityIcon(kind: CreativeAssetHistoryKind) {
  if (kind === 'voice-demo-candidate') return <AudioLines size={16} strokeWidth={1.8} />;
  if (kind === 'identity-resource-upload') return <Upload size={16} strokeWidth={1.8} />;
  if (kind === 'avatar-package-candidate') return <WandSparkles size={16} strokeWidth={1.8} />;
  if (kind === 'local-image-edit-candidate') return <Crop size={16} strokeWidth={1.8} />;
  return <ImageIcon size={16} strokeWidth={1.8} />;
}

function formatActivityDate(value: string, locale: 'en' | 'zh'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function useCreativeAssetHistory(personaId: string) {
  const [creativeHistory, setCreativeHistory] = useState<CreativeAssetHistoryRecord[]>([]);
  const [creativeHistoryUnavailable, setCreativeHistoryUnavailable] = useState(false);

  const refreshCreativeHistory = useCallback(async () => {
    const result = await loadLocalCreativeAssetHistory(personaId);
    setCreativeHistory(result.records);
    setCreativeHistoryUnavailable(!result.ok || result.unavailableCount > 0);
  }, [personaId]);

  useEffect(() => {
    void refreshCreativeHistory();
    const handleHistoryUpdate = () => void refreshCreativeHistory();
    window.addEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, handleHistoryUpdate);
    return () => window.removeEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, handleHistoryUpdate);
  }, [refreshCreativeHistory]);

  return { creativeHistory, creativeHistoryUnavailable, refreshCreativeHistory };
}

/**
 * Owner dialog for creating or replacing the persona visual identity, opened
 * from the hero avatar edit affordance. Also hosts the local image editor
 * (crop/effects) so edited candidates stay one click away from the change
 * flow.
 */
export function PersonaVisualIdentityDialog({
  persona,
  open,
  onClose,
  onPersonaWrite,
}: {
  persona: OwnerPortfolioPersonaDetail;
  open: boolean;
  onClose: () => void;
  onPersonaWrite: () => Promise<void>;
}) {
  const { t } = useStudioI18n();
  const { creativeHistory, refreshCreativeHistory } = useCreativeAssetHistory(persona.id);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);

  return (
    <>
      <OverlayShell
        open={open}
        size="M"
        panelStyle={{ width: '650px' }}
        onClose={onClose}
        title={(
          <div className="ras-visual-change__title-row">
            <span>{t('assets.visualChange.title')}</span>
            <IconButton
              tone="ghost"
              size="sm"
              className="ras-visual-change__close"
              aria-label={t('common.close')}
              onClick={onClose}
              icon={<X size={18} strokeWidth={1.8} aria-hidden="true" />}
            />
          </div>
        )}
        description={<span className="ras-visual-change__description">{t('assets.visualChange.description')}</span>}
        panelClassName="ras-visual-change-dialog"
        contentClassName="ras-visual-change-dialog__content"
        footer={persona.avatarUrl ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              tone="ghost"
              size="sm"
              className="mr-auto"
              leadingIcon={<Crop size={15} strokeWidth={1.8} />}
              onClick={() => setImageEditorOpen(true)}
            >
              {t('assets.visualChange.editImage')}
            </Button>
          </div>
        ) : undefined}
        dataTestId="persona-visual-identity-dialog"
      >
        <VisualIdentityChangeEditor
          persona={persona}
          creativeHistory={creativeHistory}
          onHistoryUpdated={refreshCreativeHistory}
          onPersonaWrite={onPersonaWrite}
        />
      </OverlayShell>

      <OverlayShell
        open={imageEditorOpen}
        size="XL"
        onClose={() => setImageEditorOpen(false)}
        title={t('assets.imageEditor.title')}
        description={t('assets.imageEditor.description')}
        panelClassName="flex max-h-[calc(100vh-32px)] flex-col overflow-hidden"
        contentClassName="min-h-0 flex-1 overflow-y-auto"
        footer={(
          <div className="flex justify-end">
            <Button tone="secondary" onClick={() => setImageEditorOpen(false)}>{t('common.close')}</Button>
          </div>
        )}
        dataTestId="persona-visual-image-editor-dialog"
      >
        <VisualImageEditorWorkspace persona={persona} onHistoryUpdated={refreshCreativeHistory} />
      </OverlayShell>
    </>
  );
}

/**
 * Owner dialog for creating or replacing the persona voice, opened from the
 * hero avatar voice affordance or the identity workspace. Renders through a
 * portal, so the workspace frame stays a pure layout owner.
 */
export function PersonaVoiceEditorDialog({
  persona,
  open,
  onClose,
}: {
  persona: OwnerPortfolioPersonaDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useStudioI18n();
  const { creativeHistory, refreshCreativeHistory } = useCreativeAssetHistory(persona.id);

  return (
    <OverlayShell
      open={open}
      size="M"
      panelStyle={{ width: '650px' }}
      onClose={onClose}
      title={(
        <div className="ras-visual-change__title-row">
          <span>{t('assets.voiceChange.title')}</span>
          <IconButton
            tone="ghost"
            size="sm"
            className="ras-visual-change__close"
            aria-label={t('common.close')}
            onClick={onClose}
            icon={<X size={18} strokeWidth={1.8} aria-hidden="true" />}
          />
        </div>
      )}
      description={<span className="ras-visual-change__description">{t('assets.voiceChange.description')}</span>}
      panelClassName="ras-visual-change-dialog"
      contentClassName="ras-visual-change-dialog__content"
      footer={(
        <div className="flex justify-end">
          <Button tone="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        </div>
      )}
      dataTestId="persona-voice-editor-dialog"
    >
      <VoiceChangeEditor
        persona={persona}
        creativeHistory={creativeHistory}
        onHistoryUpdated={refreshCreativeHistory}
      />
    </OverlayShell>
  );
}

/**
 * Recent creative asset activity feed for the persona profile page. Reads the
 * local owner-reviewed history and renders the latest three records (or the
 * source-backed empty/unavailable states).
 */
export function CreativeAssetActivityFeed({ personaId }: { personaId: string }) {
  const { locale, t } = useStudioI18n();
  const { creativeHistory, creativeHistoryUnavailable } = useCreativeAssetHistory(personaId);

  return (
    <section className="ras-asset-activity" aria-label={t('assets.overview.activity.title')}>
      <SettingsSectionHead
        icon={<Clock3 size={18} strokeWidth={1.8} />}
        title={t('assets.overview.activity.title')}
      />
      {creativeHistoryUnavailable ? (
        <InlineAlert tone="warning">{t('assets.history.unavailable')}</InlineAlert>
      ) : creativeHistory.length === 0 ? (
        <EmptyState
          title={t('assets.overview.activity.emptyTitle')}
          description={t('assets.overview.activity.emptyDescription')}
        />
      ) : (
        <ul className="ras-asset-activity__list">
          {creativeHistory.slice(0, 3).map((record) => (
            <li key={record.id}>
              <span className="ras-asset-activity__icon" data-kind={record.kind} aria-hidden="true">
                {activityIcon(record.kind)}
              </span>
              <span className="ras-asset-activity__label">{t(CREATIVE_HISTORY_LABEL_KEYS[record.kind])}</span>
              <time dateTime={record.createdAt}>{formatActivityDate(record.createdAt, locale)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type VisualIdentityMode = 'upload' | 'assets' | 'ai' | 'url';

type ExistingVisualAsset = {
  id: string;
  label: string;
  previewUrl: string;
};

function VisualIdentityChangeEditor({
  persona,
  creativeHistory,
  onHistoryUpdated,
  onPersonaWrite,
}: {
  persona: OwnerPortfolioPersonaDetail;
  creativeHistory: CreativeAssetHistoryRecord[];
  onHistoryUpdated: () => Promise<void>;
  onPersonaWrite: () => Promise<void>;
}) {
  const { t } = useStudioI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<VisualIdentityMode | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generationResult, setGenerationResult] = useState<RuntimeVisualImageGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState(() => persona.avatarUrl || '');
  const [avatarReviewed, setAvatarReviewed] = useState(false);
  const [avatarResult, setAvatarResult] = useState<RealmPersonaAvatarSelectResult | null>(null);
  const [isSelectingAvatar, setIsSelectingAvatar] = useState(false);

  const existingAssets = useMemo<ExistingVisualAsset[]>(() => {
    const assets: ExistingVisualAsset[] = [];
    const seenUrls = new Set<string>();
    if (persona.avatarUrl) {
      seenUrls.add(persona.avatarUrl);
      assets.push({
        id: 'current-visual-identity',
        label: t('assets.visualChange.currentAsset'),
        previewUrl: persona.avatarUrl,
      });
    }
    for (const record of creativeHistory) {
      if (
        record.kind === 'voice-demo-candidate'
        || record.reviewState !== 'owner-reviewed'
        || !record.previewUrl
        || seenUrls.has(record.previewUrl)
      ) continue;
      seenUrls.add(record.previewUrl);
      assets.push({ id: record.id, label: t(CREATIVE_HISTORY_LABEL_KEYS[record.kind]), previewUrl: record.previewUrl });
    }
    return assets;
  }, [creativeHistory, persona.avatarUrl, t]);

  useEffect(() => () => {
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
  }, [uploadedPreviewUrl]);

  useEffect(() => {
    setAvatarUrlDraft(persona.avatarUrl || '');
    setAvatarReviewed(false);
    setAvatarResult(null);
    setIsSelectingAvatar(false);
  }, [persona.avatarUrl, persona.id]);

  const avatarUrlChanged = avatarUrlDraft.trim() !== (persona.avatarUrl || '');
  const avatarUrlWritable = buildRealmSelectAvatarInput(avatarUrlDraft) !== null;

  function selectMode(nextMode: VisualIdentityMode) {
    setMode(nextMode);
    if (nextMode === 'upload') {
      window.setTimeout(() => fileInputRef.current?.click(), 0);
    }
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.toLowerCase().startsWith('image/')) {
      nimiToast.danger(t('assets.visualChange.uploadInvalid'));
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    setUploadedPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextPreviewUrl;
    });
    setUploadedFile(file);
    setSelectedAssetId(null);
    setGenerationResult(null);
  }

  async function generateImageCandidate() {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt || isGenerating) return;
    setIsGenerating(true);
    setGenerationResult(null);
    try {
      const result = await generateReviewedVisualImageCandidate({
        ...createVisualImageGenerationDraft(),
        prompt: normalizedPrompt,
      }, persona);
      setGenerationResult(result);
      if (result.ok) {
        const previewUrl = result.runtime.previewUrls[0];
        const persisted = await appendLocalCreativeAssetHistory(persona.id, {
          sourceContentHash: persona.contentHash,
          kind: 'runtime-image-candidate',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
          label: 'assets.history.runtimeImageCandidate',
          source: result.source,
          ...(previewUrl ? { previewUrl } : {}),
          detail: result.runtime.artifactIds.join(', ') || result.runtime.artifactUris.join(', '),
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        });
        if (!persisted.ok) nimiToast.danger(t('assets.history.persistFailed'));
        await onHistoryUpdated();
        nimiToast.success(t('assets.imageGenerated'));
      } else if (isMediaCapabilityUnavailable(result.failure)) {
        nimiToast.info(translateVisualCandidateFailure(result, t));
      } else {
        nimiToast.danger(translateVisualCandidateFailure(result, t));
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function updateAvatarUrlDraft(value: string) {
    setAvatarUrlDraft(value);
    setAvatarReviewed(false);
    setAvatarResult(null);
  }

  async function selectAvatarUrl() {
    if (!PERSONA_AVATAR_SELECTION_AVAILABLE || !avatarUrlWritable || !avatarUrlChanged || !avatarReviewed || isSelectingAvatar) return;
    setIsSelectingAvatar(true);
    setAvatarResult(null);
    try {
      const result = await selectReviewedPersonaAvatarUrl(persona, avatarUrlDraft);
      setAvatarResult(result);
      if (result.ok) {
        nimiToast.success(t('assets.avatarUrl.saved'));
        await onPersonaWrite();
      } else {
        nimiToast.danger(t('persona.failure.sanitized', { reason: t(failureKindCopyKey(result.failure)) }));
      }
    } catch {
      nimiToast.info(t('assets.avatarUrl.unavailable'));
    } finally {
      setIsSelectingAvatar(false);
    }
  }

  const generatedPreviewUrl = generationResult?.ok ? generationResult.runtime.previewUrls[0] || null : null;

  return (
    <div className="ras-visual-change">
      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept="image/*"
        aria-label={t('assets.visualChange.uploadAriaLabel')}
        onChange={handleUploadChange}
      />

      <div className="ras-visual-change__methods ras-visual-change__methods--four" role="group" aria-label={t('assets.visualChange.methodsAriaLabel')}>
        <VisualIdentityMethodButton
          active={mode === 'upload'}
          icon={<Upload size={32} strokeWidth={1.7} />}
          title={t('assets.visualChange.upload')}
          description={t('assets.visualChange.uploadDescription')}
          onClick={() => selectMode('upload')}
        />
        <VisualIdentityMethodButton
          active={mode === 'assets'}
          icon={<Images size={32} strokeWidth={1.7} />}
          title={t('assets.visualChange.assets')}
          description={t('assets.visualChange.assetsDescription')}
          onClick={() => selectMode('assets')}
        />
        <VisualIdentityMethodButton
          active={mode === 'ai'}
          icon={<Sparkles size={34} strokeWidth={1.7} />}
          title={t('assets.visualChange.ai')}
          description={t('assets.visualChange.aiDescription')}
          onClick={() => selectMode('ai')}
        />
        <VisualIdentityMethodButton
          active={mode === 'url'}
          icon={<Link size={32} strokeWidth={1.7} />}
          title={t('assets.visualChange.url')}
          description={t('assets.visualChange.urlDescription')}
          onClick={() => selectMode('url')}
        />
      </div>

      {mode === 'upload' && uploadedPreviewUrl && uploadedFile ? (
        <div className="ras-visual-change__selection" data-testid="visual-upload-selection">
          <img src={uploadedPreviewUrl} alt="" />
          <div>
            <strong>{uploadedFile.name}</strong>
            <span>{t('assets.visualChange.localCandidate')}</span>
          </div>
          <StatusBadge tone="info">{t('common.candidate')}</StatusBadge>
        </div>
      ) : null}

      {mode === 'assets' ? (
        <div className="ras-visual-change__assets" data-testid="visual-existing-assets">
          {existingAssets.length > 0 ? existingAssets.map((asset) => {
            const selected = selectedAssetId === asset.id;
            return (
              <button
                key={asset.id}
                type="button"
                className="ras-visual-change__asset"
                data-selected={selected}
                aria-pressed={selected}
                onClick={() => setSelectedAssetId(asset.id)}
              >
                <img src={asset.previewUrl} alt={asset.label} />
                <span>{asset.label}</span>
                {selected ? <i aria-hidden="true"><Check size={14} strokeWidth={2.2} /></i> : null}
              </button>
            );
          }) : (
            <EmptyState
              icon={<ImageIcon size={22} strokeWidth={1.7} />}
              title={t('assets.visualChange.assetsEmptyTitle')}
              description={t('assets.visualChange.assetsEmptyDescription')}
            />
          )}
        </div>
      ) : null}

      {mode === 'ai' ? (
        <div className="ras-visual-change__ai" data-testid="visual-ai-composer">
          <label htmlFor="visual-identity-prompt">{t('assets.visualChange.promptLabel')}</label>
          <div className="ras-visual-change__composer">
            <textarea
              id="visual-identity-prompt"
              rows={2}
              maxLength={2000}
              value={prompt}
              placeholder={t('assets.visualChange.promptPlaceholder')}
              onChange={(event) => {
                setPrompt(event.currentTarget.value);
                setGenerationResult(null);
              }}
            />
            <div className="ras-visual-change__composer-actions">
              <span className="ras-visual-change__intent-chip">
                <SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden="true" />
                {t('assets.visualChange.imageGenerate')}
              </span>
              <IconButton
                type="button"
                className="ras-visual-change__generate"
                tone="primary"
                size="sm"
                aria-label={t('assets.visualChange.generate')}
                disabled={!prompt.trim() || isGenerating}
                aria-busy={isGenerating || undefined}
                onClick={() => void generateImageCandidate()}
                icon={isGenerating
                  ? <RefreshCw size={15} strokeWidth={2} className="ras-visual-change__spin" aria-hidden="true" />
                  : <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />}
              />
            </div>
          </div>
          {generationResult && !generationResult.ok ? (
            <InlineAlert tone="danger">
              {translateVisualCandidateFailure(generationResult, t)}
            </InlineAlert>
          ) : null}
          {generatedPreviewUrl ? (
            <div className="ras-visual-change__generated">
              <img src={generatedPreviewUrl} alt={t('assets.generatedVisualAlt')} />
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'url' ? (
        <Surface tone="panel" padding="md" className="ras-visual-change__url-card" data-testid="reviewed-avatar-url-editor">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">{t('assets.avatarUrl.title')}</div>
            <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
              {t('assets.avatarUrl.description')}
            </div>
          </div>
          <StatusBadge tone="info">{t('common.realmSave')}</StatusBadge>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[80px_1fr]">
          <div className="ras-visual-change__url-preview h-20 w-20 overflow-hidden rounded-[var(--nimi-radius-md)]">
            {avatarUrlWritable ? (
              <img src={avatarUrlDraft.trim()} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={24} strokeWidth={1.6} aria-hidden="true" />
            )}
          </div>
          <div className="grid gap-3">
            <FieldShell label={t('assets.avatarUrl.label')} message={t('assets.avatarUrl.message')}>
              <TextField
                value={avatarUrlDraft}
                placeholder="https://..."
                onChange={(event) => updateAvatarUrlDraft(event.currentTarget.value)}
              />
            </FieldShell>
            <Checkbox
              checked={avatarReviewed}
              onChange={(event) => setAvatarReviewed(event.currentTarget.checked)}
              label={t('common.humanReviewComplete')}
            />
            <div className="flex justify-end">
              <Button
                disabled={!PERSONA_AVATAR_SELECTION_AVAILABLE || !avatarUrlWritable || !avatarUrlChanged || !avatarReviewed || isSelectingAvatar}
                loading={isSelectingAvatar}
                onClick={() => void selectAvatarUrl()}
              >
                {t('assets.avatarUrl.select')}
              </Button>
            </div>
          </div>
        </div>
        {!PERSONA_AVATAR_SELECTION_AVAILABLE ? (
          <InlineAlert tone="warning" className="mt-3">{t('assets.avatarUrl.unavailable')}</InlineAlert>
        ) : null}
        {avatarResult && !avatarResult.ok ? (
          <InlineAlert tone="danger" className="mt-3">
            {t('persona.failure.sanitized', { reason: t(failureKindCopyKey(avatarResult.failure)) })}
          </InlineAlert>
        ) : null}
      </Surface>
      ) : null}
    </div>
  );
}

function VisualIdentityMethodButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ras-visual-change__method"
      data-active={active}
      aria-pressed={active}
      onClick={onClick}
    >
      {active ? <span className="ras-visual-change__method-check" aria-hidden="true"><Check size={13} strokeWidth={2.4} /></span> : null}
      <span className="ras-visual-change__method-icon" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

type VoiceChangeMode = 'upload' | 'candidates' | 'ai';

function VoiceChangeEditor({
  persona,
  creativeHistory,
  onHistoryUpdated,
}: {
  persona: OwnerPortfolioPersonaDetail;
  creativeHistory: CreativeAssetHistoryRecord[];
  onHistoryUpdated: () => Promise<void>;
}) {
  const { locale, t } = useStudioI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<VoiceChangeMode | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDemoCandidateInput>(() => createVoiceDemoCandidateInput(persona));
  const voices = useStudioVoicePresets();
  const voiceReady = !voices.loading && !voices.unavailable && voices.voices.some((voice) => voice.voiceId === voiceDraft.presetVoiceId);
  const [synthesisResult, setSynthesisResult] = useState<RuntimeVoiceDemoSynthesisResult | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const voiceCandidates = useMemo(() => {
    const seenUrls = new Set<string>();
    const candidates: CreativeAssetHistoryRecord[] = [];
    for (const record of creativeHistory) {
      if (record.kind !== 'voice-demo-candidate' || !record.previewUrl || seenUrls.has(record.previewUrl)) continue;
      seenUrls.add(record.previewUrl);
      candidates.push(record);
    }
    return candidates;
  }, [creativeHistory]);
  const selectedCandidate = voiceCandidates.find((record) => record.id === selectedCandidateId) ?? null;
  const voicePayload = useMemo(() => buildReviewedVoiceDemoCandidatePayload(voiceDraft, persona), [persona, voiceDraft]);
  const synthesizedPreviewUrl = synthesisResult?.ok ? synthesisResult.runtime.previewUrls[0] || '' : '';

  useEffect(() => () => {
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
  }, [uploadedPreviewUrl]);

  function selectMode(nextMode: VoiceChangeMode) {
    setMode(nextMode);
    if (nextMode === 'upload') {
      window.setTimeout(() => fileInputRef.current?.click(), 0);
    }
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.toLowerCase().startsWith('audio/')) {
      nimiToast.danger(t('assets.voiceChange.uploadInvalid'));
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    setUploadedPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextPreviewUrl;
    });
    setUploadedFile(file);
    setSelectedCandidateId(null);
    setSynthesisResult(null);
  }

  async function synthesizeVoiceDemo() {
    if (!voicePayload.changed || !voiceReady || isSynthesizing) return;
    setIsSynthesizing(true);
    setSynthesisResult(null);
    try {
      const result = await synthesizeReviewedVoiceDemo(voiceDraft, persona);
      setSynthesisResult(result);
      if (result.ok) {
        const previewUrl = result.runtime.previewUrls[0];
        const persisted = await appendLocalCreativeAssetHistory(persona.id, {
          sourceContentHash: persona.contentHash,
          kind: 'voice-demo-candidate',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
          label: 'assets.history.voiceDemoCandidate',
          source: result.source,
          ...(previewUrl ? { previewUrl } : {}),
          detail: result.runtime.artifactIds.join(', '),
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        });
        await onHistoryUpdated();
        if (!persisted.ok) nimiToast.danger(t('assets.history.persistFailed'));
        nimiToast.success(t('assets.voiceGenerated'));
      } else if (isMediaCapabilityUnavailable(result.failure)) {
        nimiToast.info(translateVoiceCandidateFailure(result, t));
      } else {
        nimiToast.danger(translateVoiceCandidateFailure(result, t));
      }
    } finally {
      setIsSynthesizing(false);
    }
  }

  return (
    <div className="ras-visual-change ras-voice-change">
      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept="audio/*"
        aria-label={t('assets.voiceChange.uploadAriaLabel')}
        onChange={handleUploadChange}
      />

      <div className="ras-visual-change__methods" role="group" aria-label={t('assets.voiceChange.methodsAriaLabel')}>
        <VisualIdentityMethodButton
          active={mode === 'upload'}
          icon={<Upload size={32} strokeWidth={1.7} />}
          title={t('assets.voiceChange.upload')}
          description={t('assets.voiceChange.uploadDescription')}
          onClick={() => selectMode('upload')}
        />
        <VisualIdentityMethodButton
          active={mode === 'candidates'}
          icon={<AudioLines size={32} strokeWidth={1.7} />}
          title={t('assets.voiceChange.candidates')}
          description={t('assets.voiceChange.candidatesDescription')}
          onClick={() => selectMode('candidates')}
        />
        <VisualIdentityMethodButton
          active={mode === 'ai'}
          icon={<Sparkles size={34} strokeWidth={1.7} />}
          title={t('assets.voiceChange.ai')}
          description={t('assets.voiceChange.aiDescription')}
          onClick={() => selectMode('ai')}
        />
      </div>

      {mode === 'upload' && uploadedPreviewUrl && uploadedFile ? (
        <div className="ras-voice-change__selection" data-testid="voice-upload-selection">
          <span className="ras-voice-change__selection-icon" aria-hidden="true">
            <AudioLines size={22} strokeWidth={1.8} />
          </span>
          <div className="ras-voice-change__selection-copy">
            <strong>{uploadedFile.name}</strong>
            <span>{t('assets.voiceChange.localCandidate')}</span>
          </div>
          <StatusBadge tone="info">{t('common.candidate')}</StatusBadge>
          <audio
            className="ras-voice-change__player"
            src={uploadedPreviewUrl}
            controls
            preload="auto"
            aria-label={t('assets.playback')}
          />
        </div>
      ) : null}

      {mode === 'candidates' ? (
        <div className="ras-voice-change__candidates" data-testid="voice-existing-candidates">
          {voiceCandidates.length > 0 ? voiceCandidates.map((record) => {
            const selected = selectedCandidateId === record.id;
            return (
              <button
                key={record.id}
                type="button"
                className="ras-voice-change__candidate"
                data-selected={selected}
                aria-pressed={selected}
                onClick={() => setSelectedCandidateId(record.id)}
              >
                <span className="ras-voice-change__candidate-icon" aria-hidden="true">
                  <AudioLines size={18} strokeWidth={1.8} />
                </span>
                <span className="ras-voice-change__candidate-copy">
                  <strong>{t(CREATIVE_HISTORY_LABEL_KEYS[record.kind])}</strong>
                  <span>{formatActivityDate(record.createdAt, locale)}</span>
                </span>
                {selected ? <i aria-hidden="true"><Check size={14} strokeWidth={2.2} /></i> : null}
              </button>
            );
          }) : (
            <EmptyState
              icon={<AudioLines size={22} strokeWidth={1.7} />}
              title={t('assets.voiceChange.candidatesEmptyTitle')}
              description={t('assets.voiceChange.candidatesEmptyDescription')}
            />
          )}
          {selectedCandidate?.previewUrl ? (
            <audio
              className="ras-voice-change__player"
              src={selectedCandidate.previewUrl}
              controls
              preload="auto"
              aria-label={t('assets.playback')}
            />
          ) : null}
        </div>
      ) : null}

      {mode === 'ai' ? (
        <div className="ras-visual-change__ai" data-testid="voice-ai-composer">
          <StudioVoiceSelector catalogue={voices} value={voiceDraft.presetVoiceId} disabled={isSynthesizing}
            onChange={(presetVoiceId) => { setVoiceDraft((current) => ({ ...current, presetVoiceId })); setSynthesisResult(null); }} />
          <label htmlFor="voice-demo-script">{t('assets.voiceChange.scriptLabel')}</label>
          <div className="ras-visual-change__composer">
            <textarea
              id="voice-demo-script"
              rows={3}
              maxLength={2000}
              readOnly={isSynthesizing}
              value={voiceDraft.scriptText}
              placeholder={t('assets.voiceChange.scriptPlaceholder')}
              onChange={(event) => {
                setVoiceDraft((current) => ({ ...current, scriptText: event.currentTarget.value }));
                setSynthesisResult(null);
              }}
            />
            <div className="ras-visual-change__composer-actions">
              <span className="ras-visual-change__intent-chip">
                <AudioLines size={15} strokeWidth={1.8} aria-hidden="true" />
                {t('assets.voiceChange.synthesize')}
              </span>
              <IconButton
                type="button"
                className="ras-visual-change__generate"
                tone="primary"
                size="sm"
                aria-label={t('assets.voiceChange.generate')}
                disabled={!voicePayload.changed || !voiceReady || isSynthesizing}
                aria-busy={isSynthesizing || undefined}
                onClick={() => void synthesizeVoiceDemo()}
                icon={isSynthesizing
                  ? <RefreshCw size={15} strokeWidth={2} className="ras-visual-change__spin" aria-hidden="true" />
                  : <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />}
              />
            </div>
          </div>
          <InlineAlert tone={voicePayload.changed ? 'info' : 'warning'}>
            {voicePayload.changed ? t('assets.voiceNotice') : t(voiceDraft.scriptText.trim() ? 'voiceConfig.preset.choose' : 'assets.error.voiceDemoScriptMissing')}
          </InlineAlert>
          {synthesisResult && !synthesisResult.ok ? (
            <InlineAlert tone="danger">
              {translateVoiceCandidateFailure(synthesisResult, t)}
            </InlineAlert>
          ) : null}
          {synthesizedPreviewUrl ? (
            <div className="ras-voice-change__generated" data-testid="voice-generated-preview">
              <div className="ras-voice-change__generated-label">{t('assets.playback')}</div>
              <audio
                className="ras-voice-change__player"
                src={synthesizedPreviewUrl}
                controls
                preload="auto"
                aria-label={t('assets.playback')}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
