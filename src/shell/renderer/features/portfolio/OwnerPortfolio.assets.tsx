import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, EmptyState, FieldShell, InlineAlert, nimiToast, SelectField, StatusBadge, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  generateReviewedAvatarPackageCandidate,
  generateReviewedVisualImageCandidate,
  selectReviewedPersonaAvatarUrl,
  synthesizeReviewedVoiceDemo,
  type RealmPersonaAvatarSelectResult,
  type RuntimeVisualImageGenerationResult,
  type RuntimeVoiceDemoSynthesisResult,
} from './portfolio-client.js';
import {
  PERSONA_PUBLICATION_ADMITTED,
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
  loadLocalCreativeAssetHistory,
  type CreativeAssetHistoryKind,
  type CreativeAssetHistoryRecord,
} from './creative-asset-history.js';
import {
  buildIdentityPackFromPersona,
  type IdentityPackBuildResult,
  type IdentityPackCandidate,
} from './identity-pack.js';
import { CandidateFactGrid, TechnicalReviewDetails } from './OwnerPortfolio.shared.js';
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
  'avatar-url-selection-admitted-after-owner-url-review': 'assets.identityPack.publicWrite.avatarUrlSelection',
  'profile-cover-publication-blocked': 'assets.identityPack.publicWrite.profileCoverBlocked',
  'resource-persona-binding-blocked': 'assets.identityPack.publicWrite.resourceBindingBlocked',
  'voice-publication-blocked': 'assets.identityPack.publicWrite.voicePublicationBlocked',
  'post-attachment-candidate-only': 'assets.identityPack.publicWrite.postAttachmentCandidateOnly',
};

const FIXED_ASSET_MESSAGE_KEYS: Record<string, StudioCopyKey> = {
  'Owner-scoped profile cover write path is not admitted.': 'assets.identityPack.blocked.profileCover',
  'Resource-to-Persona Binding publication is not admitted for this app.': 'assets.identityPack.blocked.resourceBinding',
  'Voice sample publication as public profile asset is not admitted.': 'assets.identityPack.blocked.voicePublication',
  'display name source unavailable or empty': 'assets.identityPack.error.displayNameMissing',
  'profile description or greeting required for identity pack': 'assets.identityPack.error.profileVoiceMissing',
  'visual prompt missing for image candidate generation': 'assets.error.visualPromptMissing',
  'visual prompt missing for avatar package candidate generation': 'assets.error.avatarPackagePromptMissing',
  'voice demo script missing for voice candidate generation': 'assets.error.voiceDemoScriptMissing',
  'Reviewed identity Resource upload requires a selected image file.': 'assets.error.identityUploadFileMissing',
  'Avatar URL selection requires a valid http(s) URL.': 'assets.error.avatarUrlInvalid',
  'Realm avatar selection did not confirm success.': 'assets.error.avatarSelectUnconfirmed',
  'Runtime imageGenerate scenario output missing readable artifact.': 'assets.error.runtimeImageMissingArtifact',
  'Runtime speechSynthesize scenario output missing artifact id.': 'assets.error.runtimeVoiceMissingArtifact',
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
  'voice-demo-candidate': 'assets.history.voiceDemoCandidate',
};

function translateFixedAssetMessage(message: string, t: StudioTranslator): string {
  const key = FIXED_ASSET_MESSAGE_KEYS[message];
  return key ? t(key) : message;
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

export function MediaVoiceCandidateWorkspace({ persona, onPersonaWrite }: { persona: OwnerPortfolioPersonaDetail; onPersonaWrite: () => Promise<void> }) {
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
  const visualResourceTypes = MEDIA_CANDIDATE_RESOURCE_TYPES.filter((resourceType): resourceType is VisualCandidateResourceType => resourceType === 'IMAGE');
  const visualBindingPoints = MEDIA_CANDIDATE_BINDING_POINTS.filter((bindingPoint) => bindingPoint !== 'PERSONA_VOICE_SAMPLE');
  const visualPreviewUrl = visualImageResult?.ok ? visualImageResult.runtime.previewUrls[0] || '' : '';
  const avatarPackagePreviewUrl = avatarPackageResult?.ok ? avatarPackageResult.runtime.previewUrls[0] || '' : '';
  const voicePreviewUrl = voiceResult?.ok ? voiceResult.runtime.previewUrls[0] || '' : '';

  useEffect(() => {
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
    setCreativeHistory(loadLocalCreativeAssetHistory(persona.id));
    setAvatarUrlDraft(persona.avatarUrl || '');
    setAvatarReviewed(false);
    setAvatarResult(null);
    setIsSelectingAvatar(false);
    setVoiceDraft(createVoiceDemoCandidateInput(persona));
    setVoiceResult(null);
    setIsSynthesizingVoice(false);
  }, [persona.id]);

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
      const result = await selectReviewedPersonaAvatarUrl(persona.id, avatarUrlDraft);
      setAvatarResult(result);
      if (result.ok) {
        nimiToast.success(t('assets.avatarUrl.saved'));
        await onPersonaWrite();
      } else {
        nimiToast.danger(translateFixedAssetMessage(result.message, t));
      }
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
        setCreativeHistory(appendLocalCreativeAssetHistory(persona.id, {
          kind: 'runtime-image-candidate',
          label: 'Runtime image candidate',
          source: result.source,
          detail: result.runtime.previewUrls[0] || result.runtime.artifactUris[0] || result.runtime.artifactIds[0] || result.runtime.jobId || 'image artifact generated',
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        }));
      } else {
        nimiToast.danger(translateFixedAssetMessage(result.message, t));
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
        setCreativeHistory(appendLocalCreativeAssetHistory(persona.id, {
          kind: 'avatar-package-candidate',
          label: 'Avatar package candidate',
          source: result.source,
          detail: [
            avatarPackage ? avatarPackage.target : avatarPackageDraft.packageTarget,
            result.runtime.previewUrls[0] || result.runtime.artifactUris[0] || result.runtime.artifactIds[0] || result.runtime.jobId || 'avatar package design sheet generated',
          ].filter(Boolean).join(' / '),
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        }));
      } else {
        nimiToast.danger(translateFixedAssetMessage(result.message, t));
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
        setCreativeHistory(appendLocalCreativeAssetHistory(persona.id, {
          kind: 'identity-resource-upload',
          label: 'Identity Resource upload',
          source: result.source,
          detail: result.canonical.id,
          resourceId: result.canonical.id,
        }));
      } else {
        nimiToast.danger(translateFixedAssetMessage(result.message, t));
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
        setCreativeHistory(appendLocalCreativeAssetHistory(persona.id, {
          kind: 'voice-demo-candidate',
          label: 'Voice demo candidate',
          source: result.source,
          detail: result.runtime.previewUrls[0] || result.runtime.artifactIds[0] || result.runtime.jobId || 'voice artifact generated',
          artifactIds: result.runtime.artifactIds,
          ...(result.runtime.traceId ? { traceId: result.runtime.traceId } : {}),
        }));
      } else {
        nimiToast.danger(translateFixedAssetMessage(result.message, t));
      }
    } finally {
      setIsSynthesizingVoice(false);
    }
  }

  return (
    <Surface tone="panel" padding="lg" className="mt-5">
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
                      disabled={!profileMediaChanged || !avatarReviewed || isSelectingAvatar}
                      loading={isSelectingAvatar}
                      onClick={() => void selectAvatarUrl()}
                    >
                      {t('assets.avatarUrl.select')}
                    </Button>
                  </div>
                </div>
              </div>
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
              <TechnicalReviewDetails title={t('assets.imageTechnicalDetails')}>
                <pre className="ras-json-preview m-0 min-h-32 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
                  {visualImagePayload.payload ? JSON.stringify({
                    request: visualImagePayload.payload.runtime.request,
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
                  disabled={!PERSONA_PUBLICATION_ADMITTED || !identityUploadReviewed || !identityUploadFile || isUploadingIdentityResource}
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
            <TechnicalReviewDetails title={t('assets.voiceTechnicalDetails')}>
              <pre className="ras-json-preview m-0 min-h-72 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs">
                {voicePayload.payload ? JSON.stringify({
                  request: voicePayload.payload,
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
