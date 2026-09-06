import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronRight,
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
import { Button, Checkbox, EmptyState, FieldShell, IconButton, InlineAlert, nimiToast, OverlayShell, SelectField, StatusBadge, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import { failureKindCopyKey } from './failure-copy.js';
import {
  generateReviewedAvatarPackageCandidate,
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
  PERSONA_PUBLICATION_AVAILABLE,
  REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
  uploadReviewedIdentityMediaResource,
  type DirectMediaResourceUploadResult,
} from './portfolio-client.js';
import {
  AVATAR_PACKAGE_TARGETS,
  MEDIA_CANDIDATE_BINDING_POINTS,
  MEDIA_CANDIDATE_RESOURCE_TYPES,
  buildReviewedAvatarPackageCandidatePayload,
  buildReviewedVisualImageCandidatePayload,
  buildReviewedVoiceDemoCandidatePayload,
  type AvatarPackageTarget,
  type MediaCandidateBindingPoint,
  type VisualCandidateResourceType,
  type VisualMediaCandidateInput,
  type VoiceDemoCandidateInput,
} from './media-voice-candidate.js';
import {
  appendLocalCreativeAssetHistory,
  CREATIVE_ASSET_HISTORY_UPDATED_EVENT,
  loadLocalCreativeAssetHistory,
  type CreativeAssetHistoryInput,
  type CreativeAssetHistoryKind,
  type CreativeAssetHistoryRecord,
} from './creative-asset-history.js';
import {
  buildIdentityPackFromPersona,
  type IdentityPackBuildResult,
  type IdentityPackCandidate,
} from './identity-pack.js';
import { CandidateFactGrid, TechnicalReviewDetails } from './OwnerPortfolio.shared.js';
import { SettingsSectionHead } from './OwnerPortfolio.settings.js';
import { VisualImageEditorWorkspace } from './visual-image-editor.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
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

export function createAvatarPackageCandidateDraft(): VisualMediaCandidateInput & {
  aspectRatio: string;
  packageTarget: AvatarPackageTarget;
  motionNotes: string;
  interactionNotes: string;
} {
  return {
    ...createVisualMediaCandidateInput(),
    bindingPoint: 'PERSONA_AVATAR',
    aspectRatio: '1:1',
    packageTarget: 'LIVE2D',
    motionNotes: '',
    interactionNotes: '',
  };
}

export function createVoiceDemoCandidateInput(persona: OwnerPortfolioPersonaDetail): VoiceDemoCandidateInput {
  return {
    scriptText: persona.greeting.value || '',
  };
}

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

const IDENTITY_PACK_CANDIDATE_TITLE_KEYS: Record<IdentityPackCandidate['key'], StudioCopyKey> = {
  avatar: 'assets.identityPack.candidate.avatar',
  'profile-cover': 'assets.identityPack.candidate.profileCover',
  'portrait-reference': 'assets.identityPack.candidate.portraitReference',
  'post-image-style': 'assets.identityPack.candidate.postImageStyle',
  'voice-demo': 'assets.identityPack.candidate.voiceDemo',
};

const IDENTITY_PACK_PUBLIC_WRITE_KEYS: Record<IdentityPackCandidate['publicWrite'], StudioCopyKey> = {
  'avatar-url-selection-unavailable': 'assets.identityPack.publicWrite.avatarUrlSelection',
  'profile-cover-publication-unavailable': 'assets.identityPack.publicWrite.profileCoverBlocked',
  'resource-persona-binding-unavailable': 'assets.identityPack.publicWrite.resourceBindingBlocked',
  'voice-publication-unavailable': 'assets.identityPack.publicWrite.voicePublicationBlocked',
  'post-attachment-candidate-only': 'assets.identityPack.publicWrite.postAttachmentCandidateOnly',
};

const FIXED_ASSET_MESSAGE_KEYS: Record<string, StudioCopyKey> = {
  'Nimi App Access does not provide Persona avatar selection yet.': 'assets.avatarUrl.unavailable',
  'Nimi App Access does not provide owner-scoped profile cover publication yet.': 'assets.identityPack.blocked.profileCover',
  'Nimi App Access does not provide Resource-to-Persona binding publication yet.': 'assets.identityPack.blocked.resourceBinding',
  'Nimi App Access does not provide voice sample publication yet.': 'assets.identityPack.blocked.voicePublication',
  'display name source unavailable or empty': 'assets.identityPack.error.displayNameMissing',
  'profile description or greeting required for identity pack': 'assets.identityPack.error.profileVoiceMissing',
  'visual prompt missing for image candidate generation': 'assets.error.visualPromptMissing',
  'visual prompt missing for avatar package candidate generation': 'assets.error.avatarPackagePromptMissing',
  'voice demo script missing for voice candidate generation': 'assets.error.voiceDemoScriptMissing',
  'Reviewed identity Resource upload requires a selected image file.': 'assets.error.identityUploadFileMissing',
  'Runtime image.generate returned no readable artifact.': 'assets.error.runtimeImageMissingArtifact',
  'Runtime audio.synthesize returned no artifact id.': 'assets.error.runtimeVoiceMissingArtifact',
  'image artifact generated': 'assets.history.detail.imageArtifactGenerated',
  'avatar package design sheet generated': 'assets.history.detail.avatarPackageGenerated',
  'voice artifact generated': 'assets.history.detail.voiceArtifactGenerated',
};

const IDENTITY_PACK_SOURCE_FIELD_KEYS: Record<string, StudioCopyKey> = {
  displayName: 'assets.identityPack.sourceField.displayName',
  handle: 'assets.identityPack.sourceField.handle',
  bio: 'assets.identityPack.sourceField.bio',
  greeting: 'assets.identityPack.sourceField.greeting',
  world: 'assets.identityPack.sourceField.world',
  avatarUrl: 'assets.identityPack.sourceField.avatarUrl',
};

const CREATIVE_HISTORY_LABEL_KEYS: Record<CreativeAssetHistoryKind, StudioCopyKey> = {
  'runtime-image-candidate': 'assets.history.runtimeImageCandidate',
  'avatar-package-candidate': 'assets.history.avatarPackageCandidate',
  'identity-resource-upload': 'assets.history.identityResourceUpload',
  'local-image-edit-candidate': 'assets.history.localImageEdit',
  'voice-demo-candidate': 'assets.history.voiceDemoCandidate',
};

const PERSONA_FAILURE_REASONS = new Set([
  'capability-unavailable', 'invalid-input', 'session-invalid', 'access-denied',
  'owner-authority-missing', 'not-found', 'content-conflict', 'realm-unavailable',
  'rate-limited', 'upstream-failed', 'contract-invalid', 'request-too-large', 'response-too-large',
]);

function translateFixedAssetMessage(message: string, t: StudioTranslator): string {
  if (PERSONA_FAILURE_REASONS.has(message)) return t('persona.failure.sanitized', { reason: t(failureKindCopyKey(message)) });
  const key = FIXED_ASSET_MESSAGE_KEYS[message];
  return key ? t(key) : t('common.operationFailed');
}

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
  if (result.failure === 'runtime-capability-unavailable' || result.failure === 'runtime-route-unbound') {
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
  if (result.failure === 'runtime-capability-unavailable' || result.failure === 'runtime-route-unbound') {
    return t('assets.error.runtimeMediaCandidateUnavailable');
  }
  if (result.failure === 'runtime-output-malformed' || result.failure === 'runtime-output-missing') {
    return t('assets.error.runtimeVoiceMissingArtifact');
  }
  return t('assets.error.runtimeVoiceFailed');
}

function translateFixedAssetMessages(messages: string[], t: StudioTranslator): string {
  return messages.map((message) => translateFixedAssetMessage(message, t)).join('; ');
}

function translateIdentityPackCandidateTitle(candidate: IdentityPackCandidate, t: StudioTranslator): string {
  return t(IDENTITY_PACK_CANDIDATE_TITLE_KEYS[candidate.key]);
}

function translateIdentityPackPublicWrite(candidate: IdentityPackCandidate, t: StudioTranslator): string {
  return t(IDENTITY_PACK_PUBLIC_WRITE_KEYS[candidate.publicWrite]);
}

function translateIdentityPackSourceFields(fields: string[], t: StudioTranslator): string {
  return fields
    .map((field) => {
      const key = IDENTITY_PACK_SOURCE_FIELD_KEYS[field];
      return key ? t(key) : field;
    })
    .join(', ');
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
        footer={(
          <div className="flex flex-wrap items-center justify-end gap-3">
            {persona.avatarUrl ? (
              <Button
                tone="ghost"
                size="sm"
                className="mr-auto"
                leadingIcon={<Crop size={15} strokeWidth={1.8} />}
                onClick={() => setImageEditorOpen(true)}
              >
                {t('assets.visualChange.editImage')}
              </Button>
            ) : null}
            <Button tone="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          </div>
        )}
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
 * hero avatar voice affordance. Keeps the advanced asset candidate dialog one
 * click away from the dialog footer; both render through portals, so the
 * workspace frame stays a pure layout owner.
 */
export function PersonaVoiceEditorDialog({
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
  const [advancedEditorOpen, setAdvancedEditorOpen] = useState(false);
  const { creativeHistory, refreshCreativeHistory } = useCreativeAssetHistory(persona.id);

  return (
    <>
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
          <div className="flex items-center justify-between gap-3">
            <Button
              tone="ghost"
              size="sm"
              trailingIcon={<ChevronRight size={15} strokeWidth={1.8} />}
              onClick={() => setAdvancedEditorOpen(true)}
            >
              {t('assets.overview.openEditor')}
            </Button>
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

      <OverlayShell
        open={advancedEditorOpen}
        size="XL"
        onClose={() => setAdvancedEditorOpen(false)}
        title={t('assets.overview.modal.title')}
        description={t('assets.overview.modal.description')}
        panelClassName="flex max-h-[calc(100vh-32px)] flex-col overflow-hidden"
        contentClassName="min-h-0 flex-1 overflow-y-auto"
        footer={(
          <div className="flex justify-end">
            <Button tone="secondary" onClick={() => setAdvancedEditorOpen(false)}>{t('common.close')}</Button>
          </div>
        )}
        dataTestId="persona-advanced-asset-editor-dialog"
      >
        <AdvancedAssetCandidateWorkspace persona={persona} onPersonaWrite={onPersonaWrite} />
      </OverlayShell>
    </>
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
        await appendLocalCreativeAssetHistory(persona.id, {
          sourceContentHash: persona.contentHash,
          kind: 'runtime-image-candidate',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
          label: 'Runtime image candidate',
          source: result.source,
          ...(previewUrl ? { previewUrl } : {}),
          detail: previewUrl || result.runtime.artifactUris[0] || result.runtime.artifactIds[0] || result.runtime.jobId || 'image artifact generated',
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        });
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
        className="ras-visual-change__file-input"
        type="file"
        accept="image/*"
        aria-label={t('assets.visualChange.uploadAriaLabel')}
        onChange={handleUploadChange}
      />

      <div className="ras-visual-change__methods ras-visual-change__methods--four" role="group" aria-label={t('assets.visualChange.methodsAriaLabel')}>
        <VisualIdentityMethodButton
          active={mode === 'upload'}
          tone="blue"
          icon={<Upload size={32} strokeWidth={1.7} />}
          title={t('assets.visualChange.upload')}
          description={t('assets.visualChange.uploadDescription')}
          onClick={() => selectMode('upload')}
        />
        <VisualIdentityMethodButton
          active={mode === 'assets'}
          tone="violet"
          icon={<Images size={32} strokeWidth={1.7} />}
          title={t('assets.visualChange.assets')}
          description={t('assets.visualChange.assetsDescription')}
          onClick={() => selectMode('assets')}
        />
        <VisualIdentityMethodButton
          active={mode === 'ai'}
          tone="amber"
          icon={<Sparkles size={34} strokeWidth={1.7} />}
          title={t('assets.visualChange.ai')}
          description={t('assets.visualChange.aiDescription')}
          onClick={() => selectMode('ai')}
        />
        <VisualIdentityMethodButton
          active={mode === 'url'}
          tone="teal"
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
  tone,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  tone: 'blue' | 'violet' | 'amber' | 'teal';
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
      data-tone={tone}
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
    if (!voicePayload.changed || isSynthesizing) return;
    setIsSynthesizing(true);
    setSynthesisResult(null);
    try {
      const result = await synthesizeReviewedVoiceDemo(voiceDraft, persona);
      setSynthesisResult(result);
      if (result.ok) {
        const previewUrl = result.runtime.previewUrls[0];
        await appendLocalCreativeAssetHistory(persona.id, {
          sourceContentHash: persona.contentHash,
          kind: 'voice-demo-candidate',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
          label: 'Voice demo candidate',
          source: result.source,
          ...(previewUrl ? { previewUrl } : {}),
          detail: previewUrl || result.runtime.artifactIds[0] || result.runtime.jobId || 'voice artifact generated',
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        });
        await onHistoryUpdated();
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
        className="ras-visual-change__file-input"
        type="file"
        accept="audio/*"
        aria-label={t('assets.voiceChange.uploadAriaLabel')}
        onChange={handleUploadChange}
      />

      <div className="ras-visual-change__methods" role="group" aria-label={t('assets.voiceChange.methodsAriaLabel')}>
        <VisualIdentityMethodButton
          active={mode === 'upload'}
          tone="blue"
          icon={<Upload size={32} strokeWidth={1.7} />}
          title={t('assets.voiceChange.upload')}
          description={t('assets.voiceChange.uploadDescription')}
          onClick={() => selectMode('upload')}
        />
        <VisualIdentityMethodButton
          active={mode === 'candidates'}
          tone="violet"
          icon={<AudioLines size={32} strokeWidth={1.7} />}
          title={t('assets.voiceChange.candidates')}
          description={t('assets.voiceChange.candidatesDescription')}
          onClick={() => selectMode('candidates')}
        />
        <VisualIdentityMethodButton
          active={mode === 'ai'}
          tone="amber"
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
          <label htmlFor="voice-demo-script">{t('assets.voiceChange.scriptLabel')}</label>
          <div className="ras-visual-change__composer">
            <textarea
              id="voice-demo-script"
              rows={3}
              maxLength={2000}
              value={voiceDraft.scriptText}
              placeholder={t('assets.voiceChange.scriptPlaceholder')}
              onChange={(event) => {
                setVoiceDraft({ scriptText: event.currentTarget.value });
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
                disabled={!voicePayload.changed || isSynthesizing}
                aria-busy={isSynthesizing || undefined}
                onClick={() => void synthesizeVoiceDemo()}
                icon={isSynthesizing
                  ? <RefreshCw size={15} strokeWidth={2} className="ras-visual-change__spin" aria-hidden="true" />
                  : <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />}
              />
            </div>
          </div>
          <InlineAlert tone={voicePayload.changed ? 'info' : 'warning'}>
            {voicePayload.changed ? t('assets.voiceNotice') : t('assets.error.voiceDemoScriptMissing')}
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

function AdvancedAssetCandidateWorkspace({ persona, onPersonaWrite }: { persona: OwnerPortfolioPersonaDetail; onPersonaWrite: () => Promise<void> }) {
  const { t } = useStudioI18n();
  const [identityPack, setIdentityPack] = useState<IdentityPackBuildResult | null>(null);
  const [visualImageDraft, setVisualImageDraft] = useState(() => createVisualImageGenerationDraft());
  const [visualImageResult, setVisualImageResult] = useState<RuntimeVisualImageGenerationResult | null>(null);
  const [isGeneratingVisualImage, setIsGeneratingVisualImage] = useState(false);
  const [avatarPackageDraft, setAvatarPackageDraft] = useState(() => createAvatarPackageCandidateDraft());
  const [avatarPackageResult, setAvatarPackageResult] = useState<RuntimeVisualImageGenerationResult | null>(null);
  const [isGeneratingAvatarPackage, setIsGeneratingAvatarPackage] = useState(false);
  const [identityUploadReviewed, setIdentityUploadReviewed] = useState(false);
  const [identityUploadFile, setIdentityUploadFile] = useState<File | null>(null);
  const [identityUploadResult, setIdentityUploadResult] = useState<DirectMediaResourceUploadResult | null>(null);
  const [isUploadingIdentityResource, setIsUploadingIdentityResource] = useState(false);
  const [creativeHistory, setCreativeHistory] = useState<CreativeAssetHistoryRecord[]>([]);
  const [creativeHistoryUnavailable, setCreativeHistoryUnavailable] = useState(false);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState(() => persona.avatarUrl || '');
  const [avatarReviewed, setAvatarReviewed] = useState(false);
  const [avatarResult, setAvatarResult] = useState<RealmPersonaAvatarSelectResult | null>(null);
  const [isSelectingAvatar, setIsSelectingAvatar] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDemoCandidateInput>(() => createVoiceDemoCandidateInput(persona));
  const [voiceResult, setVoiceResult] = useState<RuntimeVoiceDemoSynthesisResult | null>(null);
  const [isSynthesizingVoice, setIsSynthesizingVoice] = useState(false);
  const visualImagePayload = useMemo(() => buildReviewedVisualImageCandidatePayload(visualImageDraft, persona), [persona, visualImageDraft]);
  const avatarPackagePayload = useMemo(() => buildReviewedAvatarPackageCandidatePayload(avatarPackageDraft, persona), [persona, avatarPackageDraft]);
  const voicePayload = useMemo(() => buildReviewedVoiceDemoCandidatePayload(voiceDraft, persona), [persona, voiceDraft]);
  const avatarUrlChanged = avatarUrlDraft.trim() !== (persona.avatarUrl || '');
  const profileMediaChanged = avatarUrlChanged;
  const avatarUrlWritable = buildRealmSelectAvatarInput(avatarUrlDraft) !== null;
  const visualResourceTypes = MEDIA_CANDIDATE_RESOURCE_TYPES.filter((resourceType): resourceType is VisualCandidateResourceType => resourceType === 'IMAGE');
  const visualBindingPoints = MEDIA_CANDIDATE_BINDING_POINTS.filter((bindingPoint) => bindingPoint !== 'PERSONA_VOICE_SAMPLE');
  const visualPreviewUrl = visualImageResult?.ok ? visualImageResult.runtime.previewUrls[0] || '' : '';
  const avatarPackagePreviewUrl = avatarPackageResult?.ok ? avatarPackageResult.runtime.previewUrls[0] || '' : '';
  const voicePreviewUrl = voiceResult?.ok ? voiceResult.runtime.previewUrls[0] || '' : '';

  useEffect(() => {
    let cancelled = false;
    setIdentityPack(null);
    setVisualImageDraft(createVisualImageGenerationDraft());
    setVisualImageResult(null);
    setIsGeneratingVisualImage(false);
    setAvatarPackageDraft(createAvatarPackageCandidateDraft());
    setAvatarPackageResult(null);
    setIsGeneratingAvatarPackage(false);
    setIdentityUploadReviewed(false);
    setIdentityUploadFile(null);
    setIdentityUploadResult(null);
    setIsUploadingIdentityResource(false);
    setCreativeHistory([]);
    setCreativeHistoryUnavailable(false);
    void loadLocalCreativeAssetHistory(persona.id).then((result) => {
      if (cancelled) return;
      setCreativeHistory(result.records);
      setCreativeHistoryUnavailable(!result.ok || result.unavailableCount > 0);
    });
    setAvatarUrlDraft(persona.avatarUrl || '');
    setAvatarReviewed(false);
    setAvatarResult(null);
    setIsSelectingAvatar(false);
    setVoiceDraft(createVoiceDemoCandidateInput(persona));
    setVoiceResult(null);
    setIsSynthesizingVoice(false);
    return () => {
      cancelled = true;
    };
  }, [persona.id]);

  async function persistCreativeHistoryCandidate(input: CreativeAssetHistoryInput) {
    const persisted = await appendLocalCreativeAssetHistory(persona.id, input);
    setCreativeHistory(persisted.records);
    if (!persisted.ok) {
      setCreativeHistoryUnavailable(true);
      nimiToast.danger(t('assets.history.persistFailed'));
    }
  }

  function buildIdentityPack() {
    setIdentityPack(buildIdentityPackFromPersona(persona));
  }

  function useIdentityCandidate(candidate: IdentityPackCandidate) {
    const candidateTitle = translateIdentityPackCandidateTitle(candidate, t);
    const publicWrite = translateIdentityPackPublicWrite(candidate, t);
    if (candidate.key === 'voice-demo') {
      updateVoiceDraft({ scriptText: candidate.prompt });
      return;
    }
    updateVisualImageDraft({
      prompt: candidate.prompt,
      notes: t('assets.identityPack.notesFromPack', { title: candidateTitle, publicWrite }),
      bindingPoint: candidate.key === 'avatar'
        ? 'PERSONA_AVATAR'
        : candidate.key === 'portrait-reference'
          ? 'PERSONA_PORTRAIT'
          : 'PERSONA_CANDIDATE',
      aspectRatio: candidate.key === 'profile-cover' || candidate.key === 'post-image-style' ? '16:9' : '1:1',
    });
  }

  function updateVisualImageDraft(patch: Partial<typeof visualImageDraft>) {
    setVisualImageDraft((current) => ({ ...current, ...patch }));
    setVisualImageResult(null);
  }

  function updateAvatarPackageDraft(patch: Partial<typeof avatarPackageDraft>) {
    setAvatarPackageDraft((current) => ({ ...current, ...patch }));
    setAvatarPackageResult(null);
  }

  function updateAvatarUrlDraft(value: string) {
    setAvatarUrlDraft(value);
    setAvatarReviewed(false);
    setAvatarResult(null);
  }

  function updateVoiceDraft(patch: Partial<VoiceDemoCandidateInput>) {
    setVoiceDraft((current) => ({ ...current, ...patch }));
    setVoiceResult(null);
  }

  async function selectAvatarUrl() {
    setIsSelectingAvatar(true);
    setAvatarResult(null);
    try {
      const result = await selectReviewedPersonaAvatarUrl(persona, avatarUrlDraft);
      setAvatarResult(result);
      if (result.ok) {
        nimiToast.success(t('assets.avatarUrl.saved'));
        await onPersonaWrite();
      } else {
        nimiToast.danger(translateFixedAssetMessage(result.message, t));
      }
    } catch {
      nimiToast.info(t('assets.avatarUrl.unavailable'));
    } finally {
      setIsSelectingAvatar(false);
    }
  }

  async function generateVisualImageCandidate() {
    setIsGeneratingVisualImage(true);
    setVisualImageResult(null);
    try {
      const result = await generateReviewedVisualImageCandidate(visualImageDraft, persona);
      setVisualImageResult(result);
      if (result.ok) {
        nimiToast.success(t('assets.imageGenerated'));
        await persistCreativeHistoryCandidate({
          sourceContentHash: persona.contentHash,
          kind: 'runtime-image-candidate',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
          label: 'Runtime image candidate',
          source: result.source,
          ...(result.runtime.previewUrls[0] ? { previewUrl: result.runtime.previewUrls[0] } : {}),
          detail: result.runtime.previewUrls[0] || result.runtime.artifactUris[0] || result.runtime.artifactIds[0] || result.runtime.jobId || 'image artifact generated',
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        });
      } else {
        if (isMediaCapabilityUnavailable(result.failure)) {
          nimiToast.info(translateVisualCandidateFailure(result, t));
        } else {
          nimiToast.danger(translateVisualCandidateFailure(result, t));
        }
      }
    } finally {
      setIsGeneratingVisualImage(false);
    }
  }

  async function generateAvatarPackageCandidate() {
    setIsGeneratingAvatarPackage(true);
    setAvatarPackageResult(null);
    try {
      const result = await generateReviewedAvatarPackageCandidate(avatarPackageDraft, persona);
      setAvatarPackageResult(result);
      if (result.ok) {
        nimiToast.success(t('assets.avatarPackageGenerated'));
        const avatarPackage = result.draft.source === 'realm-persona-studio.reviewed-avatar-package-candidate'
          ? result.draft.avatarPackage
          : null;
        await persistCreativeHistoryCandidate({
          sourceContentHash: persona.contentHash,
          kind: 'avatar-package-candidate',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
          label: 'Avatar package candidate',
          source: result.source,
          ...(result.runtime.previewUrls[0] ? { previewUrl: result.runtime.previewUrls[0] } : {}),
          detail: [
            avatarPackage ? avatarPackage.target : avatarPackageDraft.packageTarget,
            result.runtime.previewUrls[0] || result.runtime.artifactUris[0] || result.runtime.artifactIds[0] || result.runtime.jobId || 'avatar package design sheet generated',
          ].filter(Boolean).join(' / '),
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        });
      } else {
        if (isMediaCapabilityUnavailable(result.failure)) {
          nimiToast.info(translateVisualCandidateFailure(result, t));
        } else {
          nimiToast.danger(translateVisualCandidateFailure(result, t));
        }
      }
    } finally {
      setIsGeneratingAvatarPackage(false);
    }
  }

  async function uploadIdentityResource() {
    if (!identityUploadFile) {
      const result: DirectMediaResourceUploadResult = {
        ok: false,
        source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
        attachmentTruth: false,
        publicTruth: false,
        failure: 'media-upload-file-invalid',
        message: 'Reviewed identity Resource upload requires a selected image file.',
        submitted: null,
      };
      setIdentityUploadResult(result);
      nimiToast.danger(translateFixedAssetMessage(result.message, t));
      return;
    }

    setIsUploadingIdentityResource(true);
    setIdentityUploadResult(null);
    try {
      const result = await uploadReviewedIdentityMediaResource({
        resourceType: 'IMAGE',
        file: identityUploadFile,
        persona,
        tags: ['realm-persona-studio', 'identity-candidate'],
      });
      setIdentityUploadResult(result);
      if (result.ok) {
        nimiToast.success(t('assets.identityUploaded', { id: result.canonical.id }));
        await persistCreativeHistoryCandidate({
          sourceContentHash: persona.contentHash,
          kind: 'identity-resource-upload',
          sourceKind: 'imported',
          reviewState: 'owner-reviewed',
          label: 'Identity Resource upload',
          source: result.source,
          detail: result.canonical.id,
          resourceId: result.canonical.id,
        });
      } else {
        if (result.failure === 'persona-media-publication-unavailable') {
          nimiToast.info(translateFixedAssetMessage(result.message, t));
        } else {
          nimiToast.danger(translateFixedAssetMessage(result.message, t));
        }
      }
    } finally {
      setIsUploadingIdentityResource(false);
    }
  }

  async function synthesizeVoiceDemo() {
    setIsSynthesizingVoice(true);
    setVoiceResult(null);
    try {
      const result = await synthesizeReviewedVoiceDemo(voiceDraft, persona);
      setVoiceResult(result);
      if (result.ok) {
        nimiToast.info(t('assets.voiceGenerated'));
        await persistCreativeHistoryCandidate({
          sourceContentHash: persona.contentHash,
          kind: 'voice-demo-candidate',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
          label: 'Voice demo candidate',
          source: result.source,
          ...(result.runtime.previewUrls[0] ? { previewUrl: result.runtime.previewUrls[0] } : {}),
          detail: result.runtime.previewUrls[0] || result.runtime.artifactIds[0] || result.runtime.jobId || 'voice artifact generated',
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        });
      } else {
        if (isMediaCapabilityUnavailable(result.failure)) {
          nimiToast.info(translateVoiceCandidateFailure(result, t));
        } else {
          nimiToast.danger(translateVoiceCandidateFailure(result, t));
        }
      }
    } finally {
      setIsSynthesizingVoice(false);
    }
  }

  return (
    <Surface tone="panel" padding="lg" className="ras-asset-editor">
      <div className="grid gap-4">
        <Surface tone="card" padding="md">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-xl font-semibold">{t('assets.identityPack.title')}</h3>
                <StatusBadge tone="info">{t('common.sourceBacked')}</StatusBadge>
                <StatusBadge tone="warning">{t('common.candidateOnly')}</StatusBadge>
              </div>
              <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                {t('assets.identityPack.description')}
              </p>
            </div>
            <Button tone="secondary" onClick={buildIdentityPack}>
              {t('assets.identityPack.build')}
            </Button>
          </div>
          {identityPack && !identityPack.changed ? (
            <InlineAlert tone="warning" className="mt-3">
              {translateFixedAssetMessages(identityPack.errors, t)}
            </InlineAlert>
          ) : null}
          {identityPack?.changed ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {identityPack.candidates.map((candidate) => {
                const candidateTitle = translateIdentityPackCandidateTitle(candidate, t);
                const sourceFields = translateIdentityPackSourceFields(candidate.sourceFields, t);
                return (
                  <Surface key={candidate.key} tone="panel" padding="md">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{candidateTitle}</div>
                      <StatusBadge tone={candidate.blockedReason ? 'warning' : 'neutral'}>
                        {candidate.blockedReason ? t('assets.identityPack.blockedPublicWrite') : t('common.candidate')}
                      </StatusBadge>
                    </div>
                    <p className="ras-break-anywhere m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                      {candidate.prompt}
                    </p>
                    {candidate.blockedReason ? (
                      <InlineAlert tone="warning" className="mt-3">
                        {translateFixedAssetMessage(candidate.blockedReason, t)}
                      </InlineAlert>
                    ) : null}
                    <CandidateFactGrid
                      facts={[{
                        label: t('assets.identityPack.publicWrite'),
                        value: translateIdentityPackPublicWrite(candidate, t),
                      }, {
                        label: t('assets.identityPack.sourceFields'),
                        value: sourceFields || t('common.sourceUnavailable'),
                      }]}
                    />
                    <div className="mt-3">
                      <Button tone="secondary" size="sm" onClick={() => useIdentityCandidate(candidate)}>
                        {t('assets.identityPack.useCandidate')}
                      </Button>
                    </div>
                  </Surface>
                );
              })}
            </div>
          ) : null}
        </Surface>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h3 className="m-0 text-xl font-semibold">{t('assets.visual.title')}</h3>
            <StatusBadge tone="warning">{t('assets.localPreview')}</StatusBadge>
            <StatusBadge tone="neutral">{t('assets.notPublished')}</StatusBadge>
          </div>
          <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {t('assets.visual.description')}
          </p>
          <div className="mt-4 grid gap-4">
            <Surface tone="card" padding="md">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {t('assets.avatarUrl.title')}
                  </div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('assets.avatarUrl.description')}
                  </div>
                </div>
                <StatusBadge tone="info">{t('common.realmSave')}</StatusBadge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[80px_1fr]">
                <div className="h-20 w-20 overflow-hidden rounded-[var(--nimi-radius-md)] bg-[var(--nimi-surface-active)]">
                  {avatarUrlDraft.trim() ? <img src={avatarUrlDraft.trim()} alt="" className="h-full w-full object-cover" /> : null}
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
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={!PERSONA_AVATAR_SELECTION_AVAILABLE || !avatarUrlWritable || !profileMediaChanged || !avatarReviewed || isSelectingAvatar}
                      loading={isSelectingAvatar}
                      onClick={() => void selectAvatarUrl()}
                    >
                      {t('assets.avatarUrl.select')}
                    </Button>
                  </div>
                </div>
              </div>
              {!PERSONA_AVATAR_SELECTION_AVAILABLE ? (
                <InlineAlert tone="warning" className="mt-3">
                  {t('assets.avatarUrl.unavailable')}
                </InlineAlert>
              ) : null}
              {avatarResult ? (
                <TechnicalReviewDetails title={t('assets.avatarUrl.response')}>
                  <pre className="ras-json-preview m-0 min-h-24 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
                    {JSON.stringify(avatarResult, null, 2)}
                  </pre>
                </TechnicalReviewDetails>
              ) : null}
            </Surface>
            <div className="grid gap-3 md:grid-cols-[160px_1fr]">
              <FieldShell label={t('assets.assetType.label')} message={t('assets.assetType.message')}>
                <SelectField
                  value={visualImageDraft.resourceType}
                  options={visualResourceTypes.map((resourceType) => ({ value: resourceType, label: resourceType }))}
                  onValueChange={(value) => updateVisualImageDraft({ resourceType: value as VisualCandidateResourceType })}
                />
              </FieldShell>
              <FieldShell label={t('assets.profileSlot.label')} message={t('assets.profileSlot.message')}>
                <SelectField
                  value={visualImageDraft.bindingPoint}
                  options={visualBindingPoints.map((bindingPoint) => ({ value: bindingPoint, label: bindingPoint }))}
                  onValueChange={(value) => updateVisualImageDraft({ bindingPoint: value as MediaCandidateBindingPoint })}
                />
              </FieldShell>
            </div>
            <FieldShell label={t('assets.visualPrompt.label')} message={t('assets.visualPrompt.message')}>
              <TextareaField
                value={visualImageDraft.prompt}
                placeholder={t('assets.visualPrompt.placeholder')}
                onChange={(event) => updateVisualImageDraft({ prompt: event.currentTarget.value })}
              />
            </FieldShell>
            <FieldShell label={t('assets.notes.label')} message={t('assets.notes.message')}>
              <TextareaField
                value={visualImageDraft.notes}
                placeholder={t('assets.notes.placeholder')}
                onChange={(event) => updateVisualImageDraft({ notes: event.currentTarget.value })}
              />
            </FieldShell>
            <Surface tone="card" padding="md">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{t('assets.runtimeImage.title')}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('assets.runtimeImage.description')}
                  </div>
                </div>
                <StatusBadge tone="info">{t('common.aiCandidate')}</StatusBadge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[150px_1fr]">
                <FieldShell label={t('assets.aspectRatio')}>
                  <SelectField
                    value={visualImageDraft.aspectRatio}
                    options={[
                      { value: '1:1', label: '1:1' },
                      { value: '4:5', label: '4:5' },
                      { value: '16:9', label: '16:9' },
                    ]}
                    onValueChange={(value) => updateVisualImageDraft({ aspectRatio: value })}
                  />
                </FieldShell>
                <CandidateFactGrid
                    facts={[{
                    label: t('assets.modelSource'),
                    value: t('assets.imageModelSource'),
                  }]}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  disabled={!visualImagePayload.changed || isGeneratingVisualImage}
                  loading={isGeneratingVisualImage}
                  onClick={() => void generateVisualImageCandidate()}
                >
                  {t('assets.generateImage')}
                </Button>
              </div>
              <InlineAlert tone={visualImagePayload.changed ? 'info' : 'warning'} className="mt-3">
                {visualImagePayload.changed ? t('assets.visualNotice') : translateFixedAssetMessages(visualImagePayload.errors, t)}
              </InlineAlert>
              {visualImageResult?.ok ? (
                <div className="mt-3 grid gap-3">
                  {visualPreviewUrl ? (
                    <Surface tone="panel" padding="md">
                      <div className="mb-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{t('create.preview')}</div>
                      <div className="overflow-hidden rounded-[var(--nimi-radius-panel)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)]">
                        <img src={visualPreviewUrl} alt={t('assets.generatedVisualAlt')} className="block h-auto max-h-80 w-full object-contain" />
                      </div>
                    </Surface>
                  ) : null}
                  <CandidateFactGrid
                    facts={[{
                      label: t('assets.candidateOutput'),
                      value: visualImageResult.runtime.artifacts.length > 0
                        ? t('assets.generatedArtifacts', {
                          count: visualImageResult.runtime.artifacts.length,
                          plural: visualImageResult.runtime.artifacts.length === 1 ? '' : 's',
                        })
                        : t('assets.runtimeOutputRecorded'),
                    }, {
                      label: t('assets.publicState'),
                      value: t('assets.candidateOnlyValue'),
                    }]}
                  />
                </div>
              ) : null}
              {visualImageResult && !visualImageResult.ok ? (
                <InlineAlert tone="danger" className="mt-3">
                  {translateVisualCandidateFailure(visualImageResult, t)}
                </InlineAlert>
              ) : null}
              <TechnicalReviewDetails title={t('assets.imageTechnicalDetails')}>
                <pre className="ras-json-preview m-0 min-h-32 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
                  {visualImagePayload.payload ? JSON.stringify({
                    input: visualImagePayload.payload.runtime.input,
                    result: visualImageResult,
                  }, null, 2) : visualImagePayload.errors.join('; ')}
                </pre>
              </TechnicalReviewDetails>
            </Surface>
            <Surface tone="card" padding="md">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{t('assets.avatarPackage.title')}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('assets.avatarPackage.description')}
                  </div>
                </div>
                <StatusBadge tone="warning">{t('common.candidateOnly')}</StatusBadge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[150px_1fr]">
                <FieldShell label={t('assets.target')}>
                  <SelectField
                    value={avatarPackageDraft.packageTarget}
                    options={AVATAR_PACKAGE_TARGETS.map((target) => ({ value: target, label: target }))}
                    onValueChange={(value) => updateAvatarPackageDraft({ packageTarget: value as AvatarPackageTarget })}
                  />
                </FieldShell>
                <FieldShell label={t('assets.aspectRatio')}>
                  <SelectField
                    value={avatarPackageDraft.aspectRatio}
                    options={[
                      { value: '1:1', label: '1:1' },
                      { value: '4:5', label: '4:5' },
                      { value: '16:9', label: '16:9' },
                    ]}
                    onValueChange={(value) => updateAvatarPackageDraft({ aspectRatio: value })}
                  />
                </FieldShell>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <FieldShell label={t('assets.motionNotes.label')} message={t('assets.motionNotes.message')}>
                  <TextareaField
                    value={avatarPackageDraft.motionNotes}
                    placeholder={t('assets.motionNotes.placeholder')}
                    onChange={(event) => updateAvatarPackageDraft({ motionNotes: event.currentTarget.value })}
                  />
                </FieldShell>
                <FieldShell label={t('assets.interactionNotes.label')} message={t('assets.interactionNotes.message')}>
                  <TextareaField
                    value={avatarPackageDraft.interactionNotes}
                    placeholder={t('assets.interactionNotes.placeholder')}
                    onChange={(event) => updateAvatarPackageDraft({ interactionNotes: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  disabled={!avatarPackagePayload.changed || isGeneratingAvatarPackage}
                  loading={isGeneratingAvatarPackage}
                  onClick={() => void generateAvatarPackageCandidate()}
                >
                  {t('assets.generateAvatarPackage')}
                </Button>
              </div>
              <InlineAlert tone={avatarPackagePayload.changed ? 'info' : 'warning'} className="mt-3">
                {avatarPackagePayload.changed ? t('assets.avatarPackageNotice') : translateFixedAssetMessages(avatarPackagePayload.errors, t)}
              </InlineAlert>
              {avatarPackageResult?.ok ? (
                <div className="mt-3 grid gap-3">
                  {avatarPackagePreviewUrl ? (
                    <Surface tone="panel" padding="md">
                      <div className="mb-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{t('assets.designSheetPreview')}</div>
                      <div className="overflow-hidden rounded-[var(--nimi-radius-panel)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)]">
                        <img src={avatarPackagePreviewUrl} alt={t('assets.generatedAvatarPackageAlt')} className="block h-auto max-h-80 w-full object-contain" />
                      </div>
                    </Surface>
                  ) : null}
                  <CandidateFactGrid
                    facts={[{
                      label: t('assets.packageTarget'),
                      value: avatarPackageResult.draft.source === 'realm-persona-studio.reviewed-avatar-package-candidate'
                        ? avatarPackageResult.draft.avatarPackage.target
                        : avatarPackageDraft.packageTarget,
                    }, {
                      label: t('assets.generatedOutput'),
                      value: t('assets.designSheetAndBrief'),
                    }, {
                      label: t('assets.publicState'),
                      value: t('assets.candidateOnlyValue'),
                    }]}
                  />
                </div>
              ) : null}
              {avatarPackageResult && !avatarPackageResult.ok ? (
                <InlineAlert tone="danger" className="mt-3">
                  {translateVisualCandidateFailure(avatarPackageResult, t)}
                </InlineAlert>
              ) : null}
              <TechnicalReviewDetails title={t('assets.avatarPackageTechnicalDetails')}>
                <pre className="ras-json-preview m-0 min-h-32 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
                  {avatarPackagePayload.payload ? JSON.stringify({
                    candidate: avatarPackagePayload.payload,
                    result: avatarPackageResult,
                  }, null, 2) : avatarPackagePayload.errors.join('; ')}
                </pre>
              </TechnicalReviewDetails>
            </Surface>
            <Surface tone="card" padding="md">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{t('assets.uploadIdentity.title')}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('assets.uploadIdentity.description')}
                  </div>
                </div>
                <StatusBadge tone="info">{t('assets.resourceUpload')}</StatusBadge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                <FieldShell
                  label={t('assets.identityImage')}
                  message={identityUploadReviewed ? t('common.ownerReviewedMediaOnly') : t('common.humanReviewRequiredBeforeUpload')}
                  messageTone={identityUploadReviewed ? 'neutral' : 'danger'}
                >
                  <TextField
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      setIdentityUploadFile(event.currentTarget.files?.[0] ?? null);
                      setIdentityUploadResult(null);
                    }}
                  />
                </FieldShell>
                <div className="flex items-end">
                  <Checkbox
                    checked={identityUploadReviewed}
                    onChange={(event) => setIdentityUploadReviewed(event.currentTarget.checked)}
                    label={t('common.humanReviewComplete')}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  disabled={!PERSONA_PUBLICATION_AVAILABLE || !identityUploadReviewed || !identityUploadFile || isUploadingIdentityResource}
                  loading={isUploadingIdentityResource}
                  onClick={() => void uploadIdentityResource()}
                >
                  {t('assets.uploadIdentity.button')}
                </Button>
              </div>
              <InlineAlert tone="warning" className="mt-3">
                {t('assets.publicationUnavailable')}
              </InlineAlert>
              {identityUploadResult ? (
                <TechnicalReviewDetails title={t('assets.identityUploadResponse')}>
                  <pre className="ras-json-preview m-0 min-h-24 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
                    {JSON.stringify(identityUploadResult, null, 2)}
                  </pre>
                </TechnicalReviewDetails>
              ) : null}
            </Surface>
            <Surface tone="card" padding="md">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t('assets.publicPublishingDisabled.title')}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('assets.publicPublishingDisabled.description')}
                  </div>
                </div>
                <StatusBadge tone="warning">{t('common.localOnly')}</StatusBadge>
              </div>
              <InlineAlert tone="warning" className="mt-3">
                {t('assets.publicPublishingDisabled.alert')}
              </InlineAlert>
            </Surface>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h3 className="m-0 text-xl font-semibold">{t('assets.voice.title')}</h3>
            <StatusBadge tone="info">{t('assets.aiAssisted')}</StatusBadge>
            <StatusBadge tone="neutral">{t('assets.sampleOnly')}</StatusBadge>
            <StatusBadge tone="warning">{t('assets.notPublished')}</StatusBadge>
          </div>
          <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {t('assets.voice.description')}
          </p>
          <div className="mt-4 grid gap-4">
            <Surface tone="card" padding="md">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{t('assets.sampleType')}</div>
                  <div className="mt-1 font-medium">{t('assets.audio')}</div>
                </div>
                <div>
                  <div className="text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{t('assets.reviewState')}</div>
                  <div className="mt-1 font-medium">{t('assets.localSample')}</div>
                </div>
              </div>
            </Surface>
            <FieldShell label={t('assets.demoScript.label')} message={t('assets.demoScript.message')}>
              <TextareaField
                value={voiceDraft.scriptText}
                placeholder={t('assets.demoScript.placeholder')}
                onChange={(event) => updateVoiceDraft({ scriptText: event.currentTarget.value })}
              />
            </FieldShell>
            <CandidateFactGrid
              facts={[{
                label: t('assets.modelSource'),
                value: t('assets.audioModelSource'),
              }]}
            />
            <InlineAlert tone={voicePayload.changed ? 'info' : 'warning'}>
              {voicePayload.changed ? t('assets.voiceNotice') : translateFixedAssetMessages(voicePayload.errors, t)}
            </InlineAlert>
            <div className="flex flex-wrap gap-3">
              <Button disabled={!voicePayload.changed || isSynthesizingVoice} loading={isSynthesizingVoice} onClick={() => void synthesizeVoiceDemo()}>
                {t('assets.synthesizeVoice')}
              </Button>
            </div>
            {voiceResult?.ok ? (
              <div className="grid gap-3">
                {voicePreviewUrl ? (
                  <div>
                    <div className="mb-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{t('assets.playback')}</div>
                    <audio src={voicePreviewUrl} controls className="w-full" />
                  </div>
                ) : null}
                <CandidateFactGrid
                  facts={[{
                    label: t('assets.candidateOutput'),
                    value: voiceResult.runtime.artifacts.length > 0
                      ? t('assets.generatedArtifacts', {
                        count: voiceResult.runtime.artifacts.length,
                        plural: voiceResult.runtime.artifacts.length === 1 ? '' : 's',
                      })
                      : t('assets.runtimeOutputRecorded'),
                  }, {
                    label: t('assets.reviewState'),
                    value: t('assets.localReview'),
                  }, {
                    label: t('assets.trace'),
                    value: voiceResult.runtime.traceId ? t('assets.traceCaptured') : t('assets.traceMissing'),
                  }]}
                />
              </div>
            ) : null}
            {voiceResult && !voiceResult.ok ? (
              <InlineAlert tone="danger">
                {translateVoiceCandidateFailure(voiceResult, t)}
              </InlineAlert>
            ) : null}
            <TechnicalReviewDetails title={t('assets.voiceTechnicalDetails')}>
              <pre className="ras-json-preview m-0 min-h-72 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs">
                {voicePayload.payload ? JSON.stringify({
                  input: voicePayload.payload,
                  result: voiceResult,
                }, null, 2) : voicePayload.errors.join('; ')}
              </pre>
            </TechnicalReviewDetails>
          </div>
        </div>
      </div>
        </div>
      <Surface tone="card" padding="md" className="mt-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">{t('assets.history.title')}</div>
            <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
              {t('assets.history.description')}
            </div>
          </div>
          <StatusBadge tone="warning">{t('common.appLocal')}</StatusBadge>
        </div>
        {creativeHistoryUnavailable ? <InlineAlert tone="warning" className="mt-3">{t('assets.history.unavailable')}</InlineAlert> : null}
        {creativeHistory.length === 0 ? (
          <EmptyState title={t('assets.history.emptyTitle')} description={t('assets.history.emptyDescription')} />
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {creativeHistory.map((record) => (
              <Surface key={record.id} tone="panel" padding="md">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{t(CREATIVE_HISTORY_LABEL_KEYS[record.kind])}</div>
                  <StatusBadge tone="warning">{t('common.localOnly')}</StatusBadge>
                </div>
                <div className="ras-break-anywhere mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-secondary)]">
                  {translateFixedAssetMessage(record.detail, t)}
                </div>
                <div className="ras-break-anywhere mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                  {record.source}
                </div>
              </Surface>
            ))}
          </div>
        )}
      </Surface>
    </Surface>
  );
}
