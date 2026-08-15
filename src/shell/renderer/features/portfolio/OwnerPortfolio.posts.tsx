import { useEffect, useState } from 'react';
import { Button, Checkbox, EmptyState, FieldShell, InlineAlert, nimiToast, SelectField, StatusBadge, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  PERSONA_PUBLICATION_AVAILABLE,
  PERSONA_PUBLICATION_UNAVAILABLE_MESSAGE,
  REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
  REALM_TEXT_RESOURCE_SOURCE,
  createReviewedPostTextResource,
  listReadyPostAttachmentResources,
  proposeReviewedPostCopy,
  publishReviewedPostDraft,
  uploadReviewedPostMediaResource,
  type DirectMediaResourceType,
  type DirectMediaResourceUploadResult,
  type PostAttachmentResourceOption,
  type RealmPostPublishResult,
  type RealmTextResourceCreateResult,
  type RuntimePostCopyProposalResult,
} from './portfolio-client.js';
import {
  ATTACHMENT_TARGET_TYPES,
  applyRuntimePostCopyProposal,
  buildLocalPostScheduleCandidate,
  validateLocalPostDraft,
  type AttachmentTargetType,
  type CandidatePostPayload,
  type LocalPostDraftInput,
  type LocalPostScheduleCandidate,
  type LocalPostScheduleInput,
} from './post-draft.js';
import {
  clearLocalPostSchedule,
  isLocalPostScheduleDue,
  loadLocalPostSchedule,
  saveLocalPostSchedule,
  type LocalPostScheduleRecord,
} from './local-post-schedule-store.js';
import {
  buildContentVariantsFromPersona,
  type ContentVariant,
  type ContentVariantBuildResult,
} from './content-variant.js';
import { TechnicalReviewDetails } from './OwnerPortfolio.shared.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import type { StudioTranslateOptions } from '../../i18n/studio-i18n.js';

type LocalCreativeAssetCandidate = {
  sequence: number;
  label: string;
  captionSnapshot: string;
  tagsSnapshot: string;
};

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

const CONTENT_VARIANT_TITLE_KEYS: Record<ContentVariant['key'], StudioCopyKey> = {
  announcement: 'posts.variant.announcement',
  'process-note': 'posts.variant.processNote',
  'conversation-starter': 'posts.variant.conversationStarter',
};

const CONTENT_VARIANT_ATTACHMENT_PLAN_KEYS: Record<ContentVariant['attachmentPlan'], StudioCopyKey> = {
  none: 'posts.attachmentPlan.none',
  'optional-ready-resource': 'posts.attachmentPlan.optionalReadyResource',
};

const POST_REVIEW_ITEM_KEYS: Record<string, StudioCopyKey> = {
  'caption reviewed': 'posts.reviewItem.captionReviewed',
  'tags reviewed': 'posts.reviewItem.tagsReviewed',
  'optional READY Resource selected before publish': 'posts.reviewItem.optionalReadyResource',
  'source-backed voice checked': 'posts.reviewItem.sourceBackedVoice',
  'no private state included': 'posts.reviewItem.noPrivateState',
  'human review required': 'posts.reviewItem.humanReviewRequired',
  'question tone reviewed': 'posts.reviewItem.questionToneReviewed',
  'publish result must return Realm post id': 'posts.reviewItem.publishResultPostId',
};

const POST_FIXED_MESSAGE_KEYS: Record<string, StudioCopyKey> = {
  'persona identity source unavailable or empty': 'posts.error.personaIdentityMissing',
  'owner intent, draft caption, profile description, or greeting required': 'posts.error.variantAnchorMissing',
  'caption missing': 'posts.error.captionMissing',
  'candidate not publishable: human review missing': 'posts.error.humanReviewMissing',
  'attachment validation failed: attachment target missing': 'posts.error.attachmentTargetMissing',
  'app-local schedule unavailable: reviewed publishable local post draft required': 'posts.error.scheduleDraftRequired',
  'app-local schedule unavailable: local run date and time required': 'posts.error.scheduleDateTimeRequired',
  'app-local schedule unavailable: local run time must be in the future': 'posts.error.scheduleFutureRequired',
  'post copy intent missing': 'posts.error.postCopyIntentMissing',
  'Reviewed media upload requires a selected file.': 'posts.error.mediaUploadFileMissing',
  'Reviewed media Resource upload requires a matching non-empty image, video, or audio file.': 'posts.error.mediaUploadMatchingFileMissing',
  'Reviewed post text resource requires caption content.': 'posts.error.textResourceCaptionMissing',
  'Realm Create Text Resource returned no resource object.': 'posts.error.textResourceNoObject',
  'Realm Create Text Resource returned no canonical resource id.': 'posts.error.textResourceNoId',
  'Realm Create Post returned no post object.': 'posts.error.createPostNoObject',
  'Realm Create Post returned no canonical post id.': 'posts.error.createPostNoId',
  'Realm direct upload session did not return a PENDING resource id and upload URL.': 'posts.error.directUploadSessionMissing',
  'Realm finalizeResource did not return a READY media Resource.': 'posts.error.finalizeResourceNotReady',
  'Runtime runtime.ai.text.generate runtime transport unavailable: Tauri IPC runtime transport is required.': 'posts.error.postCopyTransportUnavailable',
  [PERSONA_PUBLICATION_UNAVAILABLE_MESSAGE]: 'posts.publicationUnavailable',
};

function translatePostFixedMessage(message: string, t: StudioTranslator): string {
  const textResourceNotReady = message.match(/^Realm text resource (.+) is not a READY TEXT resource\.$/);
  if (textResourceNotReady) return t('posts.error.textResourceNotReady', { id: textResourceNotReady[1] });
  if (message.startsWith('Runtime runtime.ai.text.generate failed:')) return t('posts.error.postCopyFailed');
  if (message.startsWith('Runtime post copy output invalid')) return t('posts.error.postCopyOutputInvalid');
  const forbiddenField = message.match(/^(?:post payload|app-local schedule) rejected: forbidden (.+) present$/);
  if (forbiddenField) return t('posts.error.forbiddenField', { field: forbiddenField[1] ?? '' });
  const key = POST_FIXED_MESSAGE_KEYS[message];
  return key ? t(key) : t('common.operationFailed');
}

function translatePostFixedMessages(messages: string[], t: StudioTranslator): string {
  return messages.map((message) => translatePostFixedMessage(message, t)).join('; ');
}

function translateContentVariantReviewItem(item: string, t: StudioTranslator): string {
  const key = POST_REVIEW_ITEM_KEYS[item];
  return key ? t(key) : item;
}

export function createEmptyPostDraft(): LocalPostDraftInput {
  return {
    caption: '',
    tagsText: '',
    humanReviewed: false,
    attachmentEnabled: false,
    attachmentTargetType: 'RESOURCE',
    attachmentTargetId: '',
  };
}

export function createEmptyLocalPostScheduleInput(): LocalPostScheduleInput {
  return {
    localDate: '',
    localTime: '',
  };
}

export function CreativePostWorkspace({ persona, mode }: { persona: OwnerPortfolioPersonaDetail; mode: 'posts' | 'schedule' }) {
  const { t } = useStudioI18n();
  const [draft, setDraft] = useState<LocalPostDraftInput>(() => createEmptyPostDraft());
  const [contentVariantIntent, setContentVariantIntent] = useState('');
  const [contentVariants, setContentVariants] = useState<ContentVariantBuildResult | null>(null);
  const [postCopyIntent, setPostCopyIntent] = useState('');
  const [postCopyResult, setPostCopyResult] = useState<RuntimePostCopyProposalResult | null>(null);
  const [isProposingPostCopy, setIsProposingPostCopy] = useState(false);
  const [payloadPreview, setPayloadPreview] = useState<CandidatePostPayload | null>(null);
  const [publishResult, setPublishResult] = useState<RealmPostPublishResult | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [textResourceResult, setTextResourceResult] = useState<RealmTextResourceCreateResult | null>(null);
  const [isCreatingTextResource, setIsCreatingTextResource] = useState(false);
  const [resourceOptions, setResourceOptions] = useState<PostAttachmentResourceOption[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [mediaResourceType, setMediaResourceType] = useState<DirectMediaResourceType>('IMAGE');
  const [mediaUploadFile, setMediaUploadFile] = useState<File | null>(null);
  const [mediaUploadResult, setMediaUploadResult] = useState<DirectMediaResourceUploadResult | null>(null);
  const [isUploadingMediaResource, setIsUploadingMediaResource] = useState(false);
  const [scheduleInput, setScheduleInput] = useState<LocalPostScheduleInput>(() => createEmptyLocalPostScheduleInput());
  const [schedulePreview, setSchedulePreview] = useState<LocalPostScheduleCandidate | null>(null);
  const [savedSchedule, setSavedSchedule] = useState<LocalPostScheduleRecord | null>(null);
  const [isPublishingSchedule, setIsPublishingSchedule] = useState(false);
  const [scheduleErrors, setScheduleErrors] = useState<string[]>([]);
  const [assetCandidates, setAssetCandidates] = useState<LocalCreativeAssetCandidate[]>([]);
  const validation = validateLocalPostDraft(draft, persona);
  const postTextResourceDraft = validateLocalPostDraft({ ...draft, attachmentEnabled: false, attachmentTargetId: '' }, persona);
  const isScheduleWorkspace = mode === 'schedule';
  const publishCapabilityUnavailable = publishResult?.ok === false
    && publishResult.failure === 'persona-post-publication-unavailable';

  useEffect(() => {
    setDraft(createEmptyPostDraft());
    setContentVariantIntent('');
    setContentVariants(null);
    setPostCopyIntent('');
    setPostCopyResult(null);
    setIsProposingPostCopy(false);
    setPayloadPreview(null);
    setPublishResult(null);
    setIsPublishing(false);
    setTextResourceResult(null);
    setIsCreatingTextResource(false);
    setResourceOptions([]);
    setIsLoadingResources(false);
    setMediaResourceType('IMAGE');
    setMediaUploadFile(null);
    setMediaUploadResult(null);
    setIsUploadingMediaResource(false);
    setScheduleInput(createEmptyLocalPostScheduleInput());
    setSchedulePreview(null);
    setSavedSchedule(loadLocalPostSchedule(persona.id));
    setIsPublishingSchedule(false);
    setScheduleErrors([]);
    setAssetCandidates([]);
  }, [persona.id]);

  function updateDraft(patch: Partial<LocalPostDraftInput>) {
    setDraft((current) => ({ ...current, ...patch }));
    setContentVariants(null);
    setPayloadPreview(null);
    setPublishResult(null);
    setTextResourceResult(null);
    setPostCopyResult(null);
    setMediaUploadResult(null);
    setSchedulePreview(null);
    setScheduleErrors([]);
  }

  function buildContentVariantBoard() {
    setContentVariants(buildContentVariantsFromPersona(persona, draft, contentVariantIntent));
  }

  function useContentVariant(variant: ContentVariant) {
    updateDraft({
      caption: variant.caption,
      tagsText: variant.tagsText,
      humanReviewed: false,
      attachmentEnabled: variant.attachmentPlan === 'optional-ready-resource' ? draft.attachmentEnabled : false,
    });
    setPostCopyResult(null);
  }

  function updateScheduleInput(patch: Partial<LocalPostScheduleInput>) {
    setScheduleInput((current) => ({ ...current, ...patch }));
    setSchedulePreview(null);
    setScheduleErrors([]);
  }

  async function proposePostCopy() {
    setIsProposingPostCopy(true);
    setPostCopyResult(null);
    try {
      const result = await proposeReviewedPostCopy(persona, draft, postCopyIntent);
      setPostCopyResult(result);
    } finally {
      setIsProposingPostCopy(false);
    }
  }

  function applyPostCopyProposal() {
    if (!postCopyResult?.ok) {
      return;
    }
    setDraft((current) => applyRuntimePostCopyProposal(current, postCopyResult.proposal));
    setPayloadPreview(null);
    setPublishResult(null);
    setSchedulePreview(null);
  }

  function saveScheduleCandidate() {
    if (!schedulePreview) {
      return;
    }
    const saved = saveLocalPostSchedule(persona.id, schedulePreview);
    setSavedSchedule(saved);
    if (isLocalPostScheduleDue(saved)) {
      nimiToast.info(t('posts.schedule.due'));
    } else {
      nimiToast.success(t('posts.schedule.savedFor', { time: saved.localRunAt }));
    }
  }

  async function publishSavedSchedule() {
    if (!savedSchedule || !isLocalPostScheduleDue(savedSchedule)) {
      return;
    }
    setIsPublishingSchedule(true);
    try {
      const result = await publishReviewedPostDraft(savedSchedule.candidate.postCandidate);
      if (result.ok) {
        nimiToast.success(t('posts.schedule.published'));
        clearLocalPostSchedule(persona.id);
        setSavedSchedule(null);
      } else {
        nimiToast.info(translatePostFixedMessage(result.message, t));
      }
    } finally {
      setIsPublishingSchedule(false);
    }
  }

  function addLocalAssetCandidate() {
    setAssetCandidates((current) => [
      {
        sequence: current.length + 1,
        label: t('posts.localAssetCandidateLabel', { sequence: current.length + 1 }),
        captionSnapshot: draft.caption.trim() || t('posts.captionNotDrafted'),
        tagsSnapshot: draft.tagsText.trim() || t('posts.tagsNotDrafted'),
      },
      ...current,
    ]);
  }

  async function createTextResourceAttachment() {
    if (!postTextResourceDraft.publishable) {
      const result: RealmTextResourceCreateResult = {
        ok: false,
        source: REALM_TEXT_RESOURCE_SOURCE,
        attachmentTruth: false,
        failure: 'post-text-resource-payload-invalid',
        message: postTextResourceDraft.errors.join('; ') || 'Reviewed post text resource requires caption content.',
        submitted: null,
      };
      setTextResourceResult(result);
      nimiToast.danger(translatePostFixedMessage(result.message, t));
      return;
    }

    setPayloadPreview(postTextResourceDraft.payload);
    setTextResourceResult(null);
    setIsCreatingTextResource(true);
    try {
      const result = await createReviewedPostTextResource(postTextResourceDraft.payload);
      setTextResourceResult(result);
      if (result.ok) {
        nimiToast.success(t('posts.textAttachment.created', { id: result.canonical.id }));
        setDraft((current) => ({
          ...current,
          attachmentEnabled: true,
          attachmentTargetType: 'RESOURCE',
          attachmentTargetId: result.canonical.id,
        }));
        setPayloadPreview(null);
        setPublishResult(null);
        setSchedulePreview(null);
        setScheduleErrors([]);
      } else {
        if (result.failure === 'persona-text-resource-publication-unavailable') {
          nimiToast.info(translatePostFixedMessage(result.message, t));
        } else {
          nimiToast.danger(translatePostFixedMessage(result.message, t));
        }
      }
    } finally {
      setIsCreatingTextResource(false);
    }
  }

  async function loadReadyResources() {
    setIsLoadingResources(true);
    try {
      const resources = await listReadyPostAttachmentResources();
      setResourceOptions(resources);
      if (resources.length > 0) {
        nimiToast.success(t('posts.attachment.loaded', {
          count: resources.length,
          plural: resources.length === 1 ? '' : 's',
        }));
      } else {
        nimiToast.info(t('posts.attachment.noneReturned'));
      }
    } catch {
      setResourceOptions([]);
      nimiToast.info(t('posts.publicationUnavailable'));
    } finally {
      setIsLoadingResources(false);
    }
  }

  function selectReadyResource(resourceId: string) {
    const resource = resourceOptions.find((option) => option.id === resourceId);
    if (!resource) {
      return;
    }
    updateDraft({
      attachmentEnabled: true,
      attachmentTargetType: 'RESOURCE',
      attachmentTargetId: resource.id,
    });
    nimiToast.info(t('posts.attachment.selected', { type: resource.resourceType.toLowerCase(), id: resource.id }));
  }

  async function uploadMediaResourceAttachment() {
    if (!mediaUploadFile) {
      const result: DirectMediaResourceUploadResult = {
        ok: false,
        source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
        attachmentTruth: false,
        publicTruth: false,
        failure: 'media-upload-file-invalid',
        message: 'Reviewed media upload requires a selected file.',
        submitted: null,
      };
      setMediaUploadResult(result);
      nimiToast.danger(translatePostFixedMessage(result.message, t));
      return;
    }
    setMediaUploadResult(null);
    setIsUploadingMediaResource(true);
    try {
      const result = await uploadReviewedPostMediaResource({
        resourceType: mediaResourceType,
        file: mediaUploadFile,
        persona,
      });
      setMediaUploadResult(result);
      if (result.ok) {
        nimiToast.success(t('posts.upload.attached', { id: result.canonical.id }));
        setDraft((current) => ({
          ...current,
          attachmentEnabled: true,
          attachmentTargetType: 'RESOURCE',
          attachmentTargetId: result.canonical.id,
        }));
        setPayloadPreview(null);
        setPublishResult(null);
        setSchedulePreview(null);
        setScheduleErrors([]);
      } else {
        if (result.failure === 'persona-media-publication-unavailable') {
          nimiToast.info(translatePostFixedMessage(result.message, t));
        } else {
          nimiToast.danger(translatePostFixedMessage(result.message, t));
        }
      }
    } finally {
      setIsUploadingMediaResource(false);
    }
  }

  return (
    <Surface tone="panel" padding="lg" className="mt-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h3 className="m-0 text-xl font-semibold">
              {isScheduleWorkspace ? t('posts.title.localScheduleCandidate') : t('posts.title.creativePostCandidate')}
            </h3>
            <StatusBadge tone={isScheduleWorkspace ? 'warning' : 'info'}>
              {isScheduleWorkspace ? t('posts.badge.localSchedule') : t('posts.badge.localDraft')}
            </StatusBadge>
            <StatusBadge tone={validation.publishable ? 'success' : 'neutral'}>
              {validation.publishable ? t('posts.readyToPublish') : t('posts.notReady')}
            </StatusBadge>
          </div>
          <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {isScheduleWorkspace
              ? t('posts.scheduleDescription')
              : t('posts.personaIntegrated', { persona: persona.handle.value ? `@${persona.handle.value}` : persona.displayName.value || persona.id })}
          </p>

          <div className="mt-4 grid gap-4">
            {!isScheduleWorkspace ? <Surface tone="card" padding="md">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{t('posts.contentVariants.title')}</div>
                    <StatusBadge tone="info">{t('common.reviewBoard')}</StatusBadge>
                    <StatusBadge tone="warning">{t('common.candidateOnly')}</StatusBadge>
                  </div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('posts.contentVariants.description')}
                  </div>
                </div>
                <Button tone="secondary" onClick={buildContentVariantBoard}>
                  {t('posts.contentVariants.build')}
                </Button>
              </div>
              <FieldShell label={t('posts.ownerIntent.label')} message={t('posts.ownerIntent.message')}>
                <TextareaField
                  value={contentVariantIntent}
                  placeholder={t('posts.ownerIntent.placeholder')}
                  onChange={(event) => {
                    setContentVariantIntent(event.currentTarget.value);
                    setContentVariants(null);
                  }}
                />
              </FieldShell>
              {contentVariants && !contentVariants.changed ? (
                <InlineAlert tone="warning" className="mt-3">
                  {translatePostFixedMessages(contentVariants.errors, t)}
                </InlineAlert>
              ) : null}
              {contentVariants?.changed ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {contentVariants.variants.map((variant) => (
                    <Surface key={variant.key} tone="panel" padding="md">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">{t(CONTENT_VARIANT_TITLE_KEYS[variant.key])}</div>
                        <StatusBadge tone="neutral">{t(CONTENT_VARIANT_ATTACHMENT_PLAN_KEYS[variant.attachmentPlan])}</StatusBadge>
                      </div>
                      <p className="ras-break-anywhere m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-primary)]">
                        {variant.caption}
                      </p>
                      <div className="ras-break-anywhere mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                        {t('posts.tagsPrefix')} {variant.tagsText || t('common.none')}
                      </div>
                      <div className="ras-break-anywhere mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                        {t('posts.imagePromptPrefix')} {variant.imagePrompt}
                      </div>
                      <ul className="m-0 mt-3 grid list-none gap-1 p-0 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-secondary)]">
                        {variant.reviewChecklist.map((item) => <li key={item}>{translateContentVariantReviewItem(item, t)}</li>)}
                      </ul>
                      <div className="mt-3">
                        <Button tone="secondary" size="sm" onClick={() => useContentVariant(variant)}>
                          {t('posts.useVariant')}
                        </Button>
                      </div>
                    </Surface>
                  ))}
                </div>
              ) : null}
            </Surface> : null}
            {!isScheduleWorkspace ? <Surface tone="card" padding="md">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{t('posts.runtimeCopy.title')}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('posts.runtimeCopy.description')}
                  </div>
                </div>
                <StatusBadge tone="info">{t('common.aiCandidate')}</StatusBadge>
              </div>
              <FieldShell label={t('posts.copyIntent.label')} message={t('posts.copyIntent.message')}>
                <TextareaField
                  value={postCopyIntent}
                  placeholder={t('posts.copyIntent.placeholder')}
                  onChange={(event) => {
                    setPostCopyIntent(event.currentTarget.value);
                    setPostCopyResult(null);
                  }}
                />
              </FieldShell>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  tone="secondary"
                  disabled={!postCopyIntent.trim() || isProposingPostCopy}
                  loading={isProposingPostCopy}
                  onClick={() => void proposePostCopy()}
                >
                  {t('posts.askRuntime')}
                </Button>
              </div>
              {postCopyResult ? (
                <Surface tone="panel" padding="md" className="mt-3">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{t('posts.copyProposal.title')}</div>
                      <div className="ras-break-anywhere mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                        {postCopyResult.ok ? postCopyResult.proposal.rationale : translatePostFixedMessage(postCopyResult.message, t)}
                      </div>
                    </div>
                    <StatusBadge tone={postCopyResult.ok ? 'info' : 'danger'}>
                      {postCopyResult.ok ? t('common.candidate') : t('common.sourceUnavailable')}
                    </StatusBadge>
                  </div>
                  {postCopyResult.ok ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {postCopyResult.proposal.changedPostKeys.map((key) => (
                          <StatusBadge key={key} tone="neutral">{key}</StatusBadge>
                        ))}
                      </div>
                      <InlineAlert tone="info" className="mt-3">
                        {t('posts.copyProposal.boundary')}
                      </InlineAlert>
                      <div className="mt-3">
                        <Button onClick={applyPostCopyProposal}>{t('posts.copyProposal.apply')}</Button>
                      </div>
                    </>
                  ) : (
                    <InlineAlert tone="danger" className="mt-3">
                      {t('posts.copyProposal.unavailableDetail')}
                    </InlineAlert>
                  )}
                </Surface>
              ) : null}
            </Surface> : null}
            <FieldShell label={t('posts.caption.label')} message={t('posts.caption.message')}>
              <TextareaField
                value={draft.caption}
                placeholder={t('posts.caption.placeholder')}
                onChange={(event) => updateDraft({ caption: event.currentTarget.value })}
              />
            </FieldShell>
            <FieldShell label={t('posts.tags.label')} message={t('posts.tags.message')}>
              <TextField
                value={draft.tagsText}
                placeholder={t('posts.tags.placeholder')}
                onChange={(event) => updateDraft({ tagsText: event.currentTarget.value })}
              />
            </FieldShell>
            {!isScheduleWorkspace ? <Surface tone="card" padding="md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{t('posts.attachment.title')}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('posts.attachment.description')}
                  </div>
                </div>
                <Checkbox
                  checked={draft.attachmentEnabled}
                  onChange={(event) => updateDraft({ attachmentEnabled: event.currentTarget.checked })}
                  label={t('posts.attachment.attachTarget')}
                />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                <FieldShell label={t('posts.attachment.type')}>
                  <SelectField
                    disabled={!draft.attachmentEnabled}
                    value={draft.attachmentTargetType}
                    options={ATTACHMENT_TARGET_TYPES.map((targetType) => ({ value: targetType, label: targetType }))}
                    onValueChange={(value) => updateDraft({ attachmentTargetType: value as AttachmentTargetType })}
                  />
                </FieldShell>
                <FieldShell
                  label={t('posts.attachment.id')}
                  message={draft.attachmentEnabled && !draft.attachmentTargetId.trim() ? t('posts.attachment.idMessage') : undefined}
                  messageTone="danger"
                >
                  <TextField
                    disabled={!draft.attachmentEnabled}
                    value={draft.attachmentTargetId}
                    placeholder={t('posts.attachment.id')}
                    tone={draft.attachmentEnabled && !draft.attachmentTargetId.trim() ? 'danger' : 'default'}
                    onChange={(event) => updateDraft({ attachmentTargetId: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr]">
                <div className="flex items-end">
                  <Button disabled={isLoadingResources} loading={isLoadingResources} onClick={() => void loadReadyResources()}>
                    {t('posts.attachment.loadReadyMedia')}
                  </Button>
                </div>
                <FieldShell label={t('posts.attachment.readyPicker')} message={t('posts.attachment.readyPickerMessage')}>
                  <SelectField
                    disabled={resourceOptions.length === 0}
                    value={draft.attachmentTargetType === 'RESOURCE' ? draft.attachmentTargetId : ''}
                    options={[
                      {
                        value: '',
                        label: resourceOptions.length === 0
                          ? t('posts.attachment.noReadyMedia')
                          : t('posts.attachment.selectReadyMedia'),
                      },
                      ...resourceOptions.map((resource) => ({
                        value: resource.id,
                        label: `${resource.resourceType} · ${resource.label}`,
                      })),
                    ]}
                    onValueChange={selectReadyResource}
                  />
                </FieldShell>
              </div>
            </Surface> : null}
            {!isScheduleWorkspace ? <Surface tone="card" padding="md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{t('posts.upload.title')}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('posts.upload.description')}
                  </div>
                </div>
                <StatusBadge tone="info">{t('posts.upload.badge')}</StatusBadge>
              </div>
              <InlineAlert tone="warning" className="mt-3">
                {t('posts.publicationUnavailable')}
              </InlineAlert>
              <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                <FieldShell label={t('posts.upload.mediaType')}>
                  <SelectField
                    value={mediaResourceType}
                    options={[
                      { value: 'IMAGE', label: t('posts.upload.image') },
                      { value: 'VIDEO', label: t('posts.upload.video') },
                      { value: 'AUDIO', label: t('posts.upload.audio') },
                    ]}
                    onValueChange={(value) => {
                      setMediaResourceType(value as DirectMediaResourceType);
                      setMediaUploadFile(null);
                      setMediaUploadResult(null);
                    }}
                  />
                </FieldShell>
                <FieldShell
                  label={t('posts.upload.file')}
                  message={draft.humanReviewed ? t('common.ownerReviewedMediaOnly') : t('common.humanReviewRequiredBeforeUpload')}
                  messageTone={draft.humanReviewed ? 'neutral' : 'danger'}
                >
                  <TextField
                    type="file"
                    accept={mediaResourceType === 'IMAGE' ? 'image/*' : mediaResourceType === 'VIDEO' ? 'video/*' : 'audio/*'}
                    onChange={(event) => {
                      setMediaUploadFile(event.currentTarget.files?.[0] ?? null);
                      setMediaUploadResult(null);
                    }}
                  />
                </FieldShell>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  disabled={!PERSONA_PUBLICATION_AVAILABLE || !draft.humanReviewed || !mediaUploadFile || isUploadingMediaResource}
                  loading={isUploadingMediaResource}
                  onClick={() => void uploadMediaResourceAttachment()}
                >
                  {t('posts.upload.button')}
                </Button>
              </div>
              {mediaUploadResult ? (
                <TechnicalReviewDetails title={t('posts.upload.response')}>
                  <pre className="ras-json-preview m-0 min-h-24 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
                    {JSON.stringify(mediaUploadResult, null, 2)}
                  </pre>
                </TechnicalReviewDetails>
              ) : null}
            </Surface> : null}
            {!isScheduleWorkspace ? <Surface tone="card" padding="md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{t('posts.textAttachment.title')}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('posts.textAttachment.description')}
                  </div>
                </div>
                <StatusBadge tone="info">{t('posts.textAttachment.badge')}</StatusBadge>
              </div>
              <InlineAlert tone="warning" className="mt-3">
                {t('posts.publicationUnavailable')}
              </InlineAlert>
              {postTextResourceDraft.publishable ? null : (
                <InlineAlert tone="warning">
                  {translatePostFixedMessages(postTextResourceDraft.errors, t)}
                </InlineAlert>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  disabled={!PERSONA_PUBLICATION_AVAILABLE || !postTextResourceDraft.publishable || isCreatingTextResource}
                  loading={isCreatingTextResource}
                  onClick={() => void createTextResourceAttachment()}
                >
                  {t('posts.textAttachment.button')}
                </Button>
              </div>
              {textResourceResult ? (
                <TechnicalReviewDetails title={t('posts.textAttachment.response')}>
                  <pre className="ras-json-preview m-0 min-h-24 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
                    {JSON.stringify(textResourceResult, null, 2)}
                  </pre>
                </TechnicalReviewDetails>
              ) : null}
            </Surface> : null}
            <Checkbox
              checked={draft.humanReviewed}
              onChange={(event) => updateDraft({ humanReviewed: event.currentTarget.checked })}
              label={t('common.humanReviewComplete')}
            />
            {!validation.publishable ? (
              <InlineAlert tone="warning">
                {translatePostFixedMessages(validation.errors, t)}
              </InlineAlert>
            ) : null}
            {!isScheduleWorkspace ? <div className="flex flex-wrap gap-3">
              <Button onClick={addLocalAssetCandidate}>{t('posts.addLocalAssetCandidate')}</Button>
              <Button
                disabled={!validation.publishable}
                onClick={() => {
                  if (validation.publishable) {
                    setPayloadPreview(validation.payload);
                  }
                }}
              >
                {t('posts.previewReviewedPost')}
              </Button>
              <Button
                disabled={!PERSONA_PUBLICATION_AVAILABLE || !validation.publishable || isPublishing}
                onClick={async () => {
                  if (!validation.publishable) {
                    return;
                  }
                  setPayloadPreview(validation.payload);
                  setPublishResult(null);
                  setIsPublishing(true);
                  try {
                    const result = await publishReviewedPostDraft(validation.payload);
                    setPublishResult(result);
                    if (!result.ok) {
                      if (result.failure === 'persona-post-publication-unavailable') {
                        nimiToast.info(translatePostFixedMessage(result.message, t));
                      } else {
                        nimiToast.danger(translatePostFixedMessage(result.message, t));
                      }
                    }
                  } finally {
                    setIsPublishing(false);
                  }
                }}
              >
                {isPublishing ? t('posts.publishing') : t('posts.publish')}
              </Button>
            </div> : null}
            {!isScheduleWorkspace ? (
              <InlineAlert tone="warning">
                {t('posts.publicationUnavailable')}
              </InlineAlert>
            ) : null}
            {!isScheduleWorkspace ? (
              <TechnicalReviewDetails title={t('posts.reviewedPayload')}>
                <pre className="ras-json-preview m-0 min-h-32 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs">
                  {payloadPreview ? JSON.stringify(payloadPreview, null, 2) : t('posts.noReviewedPreview')}
                </pre>
              </TechnicalReviewDetails>
            ) : null}
            {!isScheduleWorkspace && publishResult ? (
              <Surface tone="card" padding="md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t('posts.publishResult.title')}</div>
                    <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                      {publishResult.ok
                        ? t('posts.publishResult.returned')
                        : publishCapabilityUnavailable
                          ? t('posts.publishResult.unavailable')
                          : t('posts.publishResult.failed')}
                    </div>
                  </div>
                  <StatusBadge tone={publishResult.ok ? 'success' : publishCapabilityUnavailable ? 'info' : 'danger'}>
                    {publishResult.ok
                      ? t('posts.publishResult.published')
                      : publishCapabilityUnavailable
                        ? t('posts.publishResult.unavailableBadge')
                        : t('posts.publishResult.failedBadge')}
                  </StatusBadge>
                </div>
                {publishResult.ok ? (
                  <dl className="mt-3 grid gap-2 text-[length:var(--nimi-type-body-sm-size)]">
                    {Object.entries(publishResult.canonical).map(([key, value]) => (
                      <div key={key} className="grid gap-1 sm:grid-cols-[150px_1fr]">
                        <dt className="font-medium text-[var(--nimi-text-muted)]">{key}</dt>
                        <dd className="ras-break-anywhere m-0 text-[var(--nimi-text-primary)]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </Surface>
            ) : null}
            {isScheduleWorkspace ? <Surface tone="card" padding="md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{t('posts.schedule.title')}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t('posts.schedule.description')}
                  </div>
                </div>
                <StatusBadge tone="warning">{t('common.localOnly')}</StatusBadge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <FieldShell label={t('posts.schedule.localDate')}>
                  <TextField
                    type="date"
                    value={scheduleInput.localDate}
                    disabled={!validation.publishable}
                    onChange={(event) => updateScheduleInput({ localDate: event.currentTarget.value })}
                  />
                </FieldShell>
                <FieldShell label={t('posts.schedule.localTime')}>
                  <TextField
                    type="time"
                    value={scheduleInput.localTime}
                    disabled={!validation.publishable}
                    onChange={(event) => updateScheduleInput({ localTime: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              {!validation.publishable ? (
                <InlineAlert tone="warning">
                  {t('posts.schedule.unavailable')}
                </InlineAlert>
              ) : null}
              {scheduleErrors.length > 0 ? (
                <InlineAlert tone="warning">
                  {translatePostFixedMessages(scheduleErrors, t)}
                </InlineAlert>
              ) : null}
              <div className="mt-3">
                <Button
                  disabled={!validation.publishable}
                  onClick={() => {
                    const result = buildLocalPostScheduleCandidate(validation, scheduleInput);
                    if (result.scheduleable) {
                      setSchedulePreview(result.candidate);
                      setScheduleErrors([]);
                    } else {
                      setSchedulePreview(null);
                      setScheduleErrors(result.errors);
                    }
                  }}
                >
                  {t('posts.schedule.preview')}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button disabled={!schedulePreview} onClick={saveScheduleCandidate}>
                  {t('posts.schedule.save')}
                </Button>
                <Button
                  disabled={!PERSONA_PUBLICATION_AVAILABLE || !savedSchedule || !isLocalPostScheduleDue(savedSchedule) || isPublishingSchedule}
                  loading={isPublishingSchedule}
                  onClick={() => void publishSavedSchedule()}
                >
                  {t('posts.schedule.publishDue')}
                </Button>
              </div>
              <InlineAlert tone="warning" className="mt-3">
                {t('posts.publicationUnavailable')}
              </InlineAlert>
              <TechnicalReviewDetails title={t('posts.schedule.payload')}>
                <pre className="ras-json-preview m-0 min-h-28 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
                  {schedulePreview ? JSON.stringify(schedulePreview, null, 2) : savedSchedule ? JSON.stringify(savedSchedule, null, 2) : t('posts.schedule.noPreview')}
                </pre>
              </TechnicalReviewDetails>
            </Surface> : null}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="m-0 text-base font-semibold">
              {isScheduleWorkspace ? t('posts.side.scheduleStatus') : t('posts.side.localPreviewHistory')}
            </h4>
            <StatusBadge tone="neutral">
              {isScheduleWorkspace ? t('posts.side.singleCandidate') : t('common.candidateOnly')}
            </StatusBadge>
          </div>
          {isScheduleWorkspace ? (
            <Surface tone="card" padding="md">
              <div className="font-medium">{t('posts.side.noQueueTitle')}</div>
              <p className="m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                {t('posts.side.noQueueDescription')}
              </p>
            </Surface>
          ) : assetCandidates.length === 0 ? (
            <EmptyState title={t('posts.side.noLocalCandidatesTitle')} description={t('posts.side.noLocalCandidatesDescription')} />
          ) : (
            <div className="grid gap-3">
              {assetCandidates.map((candidate) => (
                <Surface key={candidate.sequence} tone="card" padding="md">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{t('posts.localAssetCandidateLabel', { sequence: candidate.sequence })}</div>
                    <StatusBadge tone="warning">{t('common.localOnly')}</StatusBadge>
                  </div>
                  <div className="ras-break-anywhere mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-secondary)]">
                    {candidate.captionSnapshot}
                  </div>
                  <div className="ras-break-anywhere mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {candidate.tagsSnapshot}
                  </div>
                </Surface>
              ))}
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}
