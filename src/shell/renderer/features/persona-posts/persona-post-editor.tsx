import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageOff,
  Lock,
  Paperclip,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Button, IconButton, InlineAlert, SelectField, StatusBadge, Tooltip, nimiToast } from '@nimiplatform/kit/ui';
import { PERSONA_PUBLICATION_AVAILABLE } from '@renderer/features/portfolio/portfolio-post-client.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { loadLocalPostSchedule } from '@renderer/features/portfolio/local-post-schedule-store.js';
import {
  classifyLocalPostAttachmentMime,
  deleteLocalPostDraft,
  loadLocalPostDrafts,
  saveLocalPostDraft,
  LOCAL_POST_CATEGORIES,
  type LocalPostCategory,
  type LocalPostDraftAttachment,
  type LocalPostDraftRecord,
} from '@renderer/features/portfolio/local-post-draft-store.js';
import {
  applyRuntimePostCopyProposal,
  type LocalPostDraftInput,
  type RuntimePostCopyProposal,
} from '@renderer/features/portfolio/post-draft.js';
import {
  requestPostCopyPolish,
  type PostCopyPolishFailure,
} from '@renderer/features/portfolio/post-copy-polish.js';
import { createAppUlid } from '@renderer/app-shell/app-ulid.js';
import { settingFieldDisplayValue } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import type { PersonaWorkspaceQueueItem } from '@renderer/features/persona-detail/persona-workspace-visual-data.js';
import { usePersonaVisualPreview } from '@renderer/features/persona-detail/persona-visual-preview-context.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

const UNCATEGORIZED_VALUE = 'none';

const CATEGORY_COPY_KEYS: Record<LocalPostCategory, StudioCopyKey> = {
  daily: 'posts.workspace.category.daily',
  announcement: 'posts.workspace.category.announcement',
  creation: 'posts.workspace.category.creation',
  question: 'posts.workspace.category.question',
};

const POLISH_FAILURE_COPY_KEYS: Record<PostCopyPolishFailure, StudioCopyKey> = {
  'post-copy-polish-route-unbound': 'posts.workspace.aiPolishRouteUnbound',
  'post-copy-polish-generate-failed': 'posts.workspace.aiPolishFailed',
  'post-copy-polish-invalid-output': 'posts.workspace.aiPolishInvalid',
};

/** Attachment kept in the editor: persisted metadata plus a session-only preview URL. */
type EditorAttachment = LocalPostDraftAttachment & { previewUrl: string | null };

function queueStateTone(item: PersonaWorkspaceQueueItem): 'warning' | 'info' | 'neutral' {
  if (item.state === 'needs-review') return 'warning';
  if (item.state === 'local-schedule') return 'neutral';
  return 'info';
}

function queueStateCopyKey(item: PersonaWorkspaceQueueItem): StudioCopyKey {
  if (item.state === 'needs-review') return 'posts.workspace.queueNeedsReview';
  if (item.state === 'local-schedule') return 'posts.workspace.queueLocalPlan';
  return 'posts.workspace.queueLocalDraft';
}

function draftQueueItemId(draftId: string): string {
  return `draft-${draftId}`;
}

function currentDraftInput(caption: string, tagsText: string): LocalPostDraftInput {
  return {
    caption,
    tagsText,
    humanReviewed: false,
    attachmentEnabled: false,
    attachmentTargetType: 'RESOURCE',
    attachmentTargetId: '',
  };
}

function toAttachmentMetadata(attachments: EditorAttachment[]): LocalPostDraftAttachment[] {
  return attachments.map(({ id, mediaKind, fileName, mimeType, sizeBytes }) => ({
    id,
    mediaKind,
    fileName,
    mimeType,
    sizeBytes,
  }));
}

export function PersonaPostEditor({
  persona,
}: {
  persona: OwnerPortfolioPersonaDetail;
}) {
  const { t } = useStudioI18n();
  const visualData = usePersonaVisualPreview()?.visualData[persona.id];
  const [caption, setCaption] = useState(visualData?.initialPostCaption ?? '');
  const [tagsText, setTagsText] = useState(visualData?.initialPostTags ?? '');
  const [category, setCategory] = useState<LocalPostCategory | null>(null);
  const [attachments, setAttachments] = useState<EditorAttachment[]>([]);
  const [loading, setLoading] = useState(!visualData);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<LocalPostDraftRecord[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [activeQueueItem, setActiveQueueItem] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [polishProposal, setPolishProposal] = useState<RuntimePostCopyProposal | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<EditorAttachment[]>([]);
  const editorRevisionRef = useRef(0);
  const mountedRef = useRef(true);
  const mutationPending = saving || deletingDraftId !== null;
  attachmentsRef.current = attachments;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      editorRevisionRef.current += 1;
    };
  }, []);

  const personaName = settingFieldDisplayValue(persona.displayName, persona.id, t);
  const personaHandle = persona.handle.value
    ? `@${persona.handle.value}`
    : settingFieldDisplayValue(persona.handle, t('shared.handleNotSet'), t);

  // Session preview URLs are revoked when the persona switches or the editor unmounts.
  useEffect(() => () => {
    for (const attachment of attachmentsRef.current) {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    }
  }, [persona.id]);

  useEffect(() => {
    setCaption(visualData?.initialPostCaption ?? '');
    setTagsText(visualData?.initialPostTags ?? '');
    setCategory(null);
    setAttachments([]);
    setDrafts([]);
    setEditingDraftId(null);
    setDeletingDraftId(null);
    setActiveQueueItem(null);
    setPolishing(false);
    setPolishProposal(null);
    if (visualData) {
      setLoading(false);
      setStorageUnavailable(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadLocalPostDrafts(persona.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setStorageUnavailable(true);
        return;
      }
      setStorageUnavailable(false);
      setDrafts(result.records);
    });
    return () => {
      cancelled = true;
    };
  }, [persona.id, visualData]);

  const localSchedule = useMemo(
    () => visualData ? null : loadLocalPostSchedule(persona.id),
    [persona.id, visualData],
  );
  const queueItems = useMemo<PersonaWorkspaceQueueItem[]>(() => {
    if (visualData) return visualData.postQueue;
    const items: PersonaWorkspaceQueueItem[] = drafts.map((record) => ({
      id: draftQueueItemId(record.id),
      title: record.caption.split('\n')[0]?.slice(0, 56) || t('posts.workspace.untitledDraft'),
      body: record.caption,
      tagsText: record.tagsText,
      state: 'local-draft',
      editedLabel: new Date(record.updatedAt).toLocaleString(),
      ...(record.category ? { categoryLabel: t(CATEGORY_COPY_KEYS[record.category]) } : {}),
      draftId: record.id,
      ...(record.attachments.length > 0 ? { attachmentCount: record.attachments.length } : {}),
    }));
    if (localSchedule) {
      const scheduledPost = localSchedule.candidate.postCandidate.realmCreatePost;
      const scheduledCaption = scheduledPost.caption ?? '';
      items.push({
        id: localSchedule.localKey,
        title: scheduledCaption.split('\n')[0]?.slice(0, 56) || t('posts.workspace.untitledDraft'),
        body: scheduledCaption,
        tagsText: (scheduledPost.tags ?? []).map((tag) => `#${tag}`).join(' '),
        state: 'local-schedule',
        editedLabel: `${new Date(localSchedule.localRunAt).toLocaleString()} · ${t('common.localOnly')}`,
      });
    }
    return items;
  }, [drafts, localSchedule, t, visualData]);

  function revokeEditorPreviewUrls() {
    for (const attachment of attachmentsRef.current) {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    }
  }

  function addAttachmentFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: EditorAttachment[] = [];
    let rejected = false;
    for (const file of Array.from(files)) {
      const mediaKind = classifyLocalPostAttachmentMime(file.type);
      if (!mediaKind) {
        rejected = true;
        continue;
      }
      next.push({
        id: createAppUlid(),
        mediaKind,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (rejected) {
      nimiToast.danger(t('posts.workspace.attachmentUnsupported'));
    }
    if (next.length > 0) {
      setAttachments((current) => [...current, ...next]);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
  }

  function editDraft(record: LocalPostDraftRecord) {
    if (editingDraftId === record.id) return;
    editorRevisionRef.current += 1;
    revokeEditorPreviewUrls();
    setCaption(record.caption);
    setTagsText(record.tagsText);
    setCategory(record.category);
    setAttachments(record.attachments.map((attachment) => ({ ...attachment, previewUrl: null })));
    setEditingDraftId(record.id);
    setActiveQueueItem(draftQueueItemId(record.id));
    setPolishProposal(null);
  }

  function startNewDraft() {
    editorRevisionRef.current += 1;
    revokeEditorPreviewUrls();
    setCaption(visualData?.initialPostCaption ?? '');
    setTagsText(visualData?.initialPostTags ?? '');
    setCategory(null);
    setAttachments([]);
    setEditingDraftId(null);
    setActiveQueueItem(null);
    setPolishProposal(null);
  }

  function handleQueueItemClick(item: PersonaWorkspaceQueueItem) {
    if (mutationPending) return;
    if (item.draftId) {
      const record = drafts.find((candidate) => candidate.id === item.draftId);
      if (record) {
        editDraft(record);
        return;
      }
    }
    setActiveQueueItem(activeQueueItem === item.id ? null : item.id);
  }

  async function runAiPolish() {
    if (polishing || mutationPending) return;
    if (!caption.trim()) {
      nimiToast.danger(t('posts.workspace.aiPolishEmpty'));
      return;
    }
    setPolishing(true);
    const revision = editorRevisionRef.current;
    try {
      const result = await requestPostCopyPolish({
        persona,
        draft: currentDraftInput(caption, tagsText),
        intent: t('posts.workspace.aiPolishIntent'),
      });
      if (!mountedRef.current || revision !== editorRevisionRef.current) return;
      if (!result.ok) {
        nimiToast.danger(t(POLISH_FAILURE_COPY_KEYS[result.failure]));
        return;
      }
      setPolishProposal(result.proposal);
    } finally {
      setPolishing(false);
    }
  }

  function applyPolishProposal() {
    if (!polishProposal) return;
    const next = applyRuntimePostCopyProposal(currentDraftInput(caption, tagsText), polishProposal);
    setCaption(next.caption);
    setTagsText(next.tagsText);
    setPolishProposal(null);
    nimiToast.success(t('posts.workspace.aiProposalApplied'));
  }

  async function saveDraft() {
    if (mutationPending) return;
    const normalizedCaption = caption.trim();
    if (!normalizedCaption) {
      nimiToast.danger(t('posts.workspace.captionRequired'));
      return;
    }
    setSaving(true);
    try {
      if (visualData?.developmentFixture) {
        const record: LocalPostDraftRecord = {
          id: editingDraftId ?? createAppUlid(),
          personaId: persona.id,
          caption: normalizedCaption,
          tagsText: tagsText.trim(),
          visibility: 'private',
          category,
          attachments: toAttachmentMetadata(attachments),
          updatedAt: new Date().toISOString(),
          source: 'realm-persona-studio.local-post-draft-editor',
          candidateOnly: true,
          publicTruth: false,
        };
        setDrafts((current) => [record, ...current.filter((candidate) => candidate.id !== record.id)]);
        setEditingDraftId(record.id);
        setActiveQueueItem(draftQueueItemId(record.id));
        nimiToast.info(t('posts.workspace.fixturePreviewSaved'));
        return;
      }

      const result = await saveLocalPostDraft({
        ...(editingDraftId ? { draftId: editingDraftId } : {}),
        personaId: persona.id,
        caption,
        tagsText,
        visibility: 'private',
        category,
        attachments: toAttachmentMetadata(attachments),
      });
      if (!mountedRef.current) return;
      if (!result.ok) {
        setStorageUnavailable(true);
        nimiToast.danger(t('posts.workspace.saveFailed'));
        return;
      }
      setDrafts(result.records);
      setStorageUnavailable(false);
      setEditingDraftId(result.record.id);
      setActiveQueueItem(draftQueueItemId(result.record.id));
      nimiToast.success(t('posts.workspace.savedLocally'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft(draftId: string) {
    if (mutationPending) return;
    setDeletingDraftId(draftId);
    try {
      const result = await deleteLocalPostDraft(persona.id, draftId);
      if (!mountedRef.current) return;
      if (!result.ok) {
        nimiToast.danger(t('posts.workspace.deleteFailed'));
        return;
      }
      setDrafts(result.records);
      setStorageUnavailable(false);
      if (editingDraftId === draftId) {
        startNewDraft();
      }
      nimiToast.success(t('posts.workspace.deletedLocally'));
    } finally {
      setDeletingDraftId(null);
    }
  }

  return (
    <div className="ras-post-workspace">
      <section className="ras-post-editor-panel">
        <header className="ras-post-editor-panel__heading">
          <h2>{t('posts.workspace.writeFor', {
            persona: personaName,
          })}</h2>
          {editingDraftId ? (
            <div className="ras-post-editor-panel__draft-state">
              <StatusBadge tone="info">{t('posts.workspace.editingDraft')}</StatusBadge>
              <Button tone="secondary" size="sm" disabled={mutationPending} onClick={startNewDraft}>
                {t('posts.workspace.newDraft')}
              </Button>
            </div>
          ) : null}
        </header>

        {visualData?.developmentFixture ? (
          <InlineAlert tone="info">{t('posts.workspace.fixtureNotice')}</InlineAlert>
        ) : null}
        {storageUnavailable ? (
          <InlineAlert tone="warning">{t('posts.workspace.storageUnavailable')}</InlineAlert>
        ) : null}

        <div className="ras-post-editor">
          <div className="ras-post-editor__tools">
            <Tooltip content={t('posts.workspace.attachMedia')}>
              <span className="inline-flex">
                <IconButton
                  size="sm"
                  disabled={loading || mutationPending}
                  icon={<Paperclip size={15} />}
                  aria-label={t('posts.workspace.addAttachment')}
                  onClick={() => fileInputRef.current?.click()}
                />
              </span>
            </Tooltip>
            <Tooltip content={t(polishing ? 'posts.workspace.aiPolishing' : 'posts.workspace.aiPolish')}>
              <span className="inline-flex">
                <IconButton
                  size="sm"
                  disabled={loading || polishing || mutationPending}
                  icon={<Sparkles size={15} />}
                  aria-label={t('posts.workspace.aiAssist')}
                  onClick={() => void runAiPolish()}
                />
              </span>
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(event) => {
                addAttachmentFiles(event.currentTarget.files);
                event.currentTarget.value = '';
              }}
            />
          </div>
          <textarea
            value={caption}
            disabled={loading}
            readOnly={mutationPending}
            aria-label={t('posts.workspace.caption')}
            placeholder={t('posts.workspace.captionPlaceholder')}
            onChange={(event) => {
              editorRevisionRef.current += 1;
              setCaption(event.currentTarget.value);
              setPolishProposal(null);
            }}
          />
          {attachments.length > 0 ? (
            <ul className="ras-post-editor__attachments" aria-label={t('posts.workspace.attachmentsLabel')}>
              {attachments.map((attachment) => (
                <li key={attachment.id} className="ras-post-editor__attachment">
                  {attachment.previewUrl ? (
                    attachment.mediaKind === 'image' ? (
                      <img className="ras-post-editor__attachment-preview" src={attachment.previewUrl} alt="" />
                    ) : (
                      <video className="ras-post-editor__attachment-preview" src={attachment.previewUrl} muted playsInline />
                    )
                  ) : (
                    <span
                      className="ras-post-editor__attachment-preview ras-post-editor__attachment-preview--missing"
                      title={t('posts.workspace.attachmentSourceMissing')}
                    >
                      <ImageOff size={15} />
                    </span>
                  )}
                  <span className="ras-post-editor__attachment-meta">
                    <span className="ras-post-editor__attachment-name">{attachment.fileName}</span>
                    {!attachment.previewUrl ? (
                      <span className="ras-post-editor__attachment-missing">
                        {t('posts.workspace.attachmentSourceMissing')}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="ras-post-editor__attachment-remove"
                    aria-label={t('posts.workspace.removeAttachment')}
                    disabled={mutationPending}
                    onClick={() => removeAttachment(attachment.id)}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <footer className="ras-post-editor__footer">
            <div className="ras-post-editor__options">
              <Tooltip content={t('posts.workspace.permissionAuto')}>
                <span className="ras-post-editor__permission">
                  <Lock size={13} strokeWidth={2} />
                  {t('posts.workspace.visibility.private')}
                </span>
              </Tooltip>
              <div className="ras-post-editor__select">
                <SelectField
                  aria-label={t('posts.workspace.categoryLabel')}
                  disabled={loading || mutationPending}
                  value={category ?? UNCATEGORIZED_VALUE}
                  options={[
                    { value: UNCATEGORIZED_VALUE, label: t('posts.workspace.category.none') },
                    ...LOCAL_POST_CATEGORIES.map((value) => ({
                      value,
                      label: t(CATEGORY_COPY_KEYS[value]),
                    })),
                  ]}
                  onValueChange={(value) => {
                    setCategory(value === UNCATEGORIZED_VALUE ? null : value as LocalPostCategory);
                  }}
                />
              </div>
            </div>
            <div className="ras-post-editor__actions">
              <span className="ras-post-editor__count">
                {caption.length} {t('posts.workspace.characters')}
              </span>
              <Button
                tone="secondary"
                loading={saving}
                disabled={loading || mutationPending || !caption.trim()}
                onClick={() => void saveDraft()}
              >
                {t('posts.workspace.saveAndPreview')}
              </Button>
              {/* @nimi-authority: rule.realm-persona-studio.post.r009 — publication stays visibly disabled until an exact post operation is admitted. */}
              <Button
                tone="primary"
                disabled={!PERSONA_PUBLICATION_AVAILABLE || loading || !caption.trim()}
              >
                {t('posts.publish')}
              </Button>
            </div>
          </footer>
        </div>

        {polishProposal ? (
          <section className="ras-post-ai-proposal" aria-label={t('posts.workspace.aiProposalTitle')}>
            <div>
              <strong>{t('posts.workspace.aiProposalTitle')}</strong>
              <StatusBadge tone="warning">{t('common.localOnly')}</StatusBadge>
            </div>
            {polishProposal.draftPatch.caption ? <p>{polishProposal.draftPatch.caption}</p> : null}
            {polishProposal.draftPatch.tagsText ? <span>{polishProposal.draftPatch.tagsText}</span> : null}
            <span>{t('posts.workspace.aiProposalRationale')}: {polishProposal.rationale}</span>
            <footer>
              <Button tone="secondary" onClick={() => setPolishProposal(null)}>
                {t('posts.workspace.aiProposalDiscard')}
              </Button>
              <Button tone="primary" disabled={mutationPending} onClick={applyPolishProposal}>
                {t('posts.workspace.aiProposalApply')}
              </Button>
            </footer>
          </section>
        ) : null}

        <InlineAlert tone="warning">{t('posts.publicationUnavailable')}</InlineAlert>

        <section className="ras-post-feed" aria-label={t('posts.workspace.queueTitle')}>
          <header className="ras-post-feed__header">
            <h3>{t('posts.workspace.queueTitle')}</h3>
            <span>{t('posts.workspace.queueCount', { count: queueItems.length })} · {t('posts.workspace.queueBoundary')}</span>
          </header>
          {queueItems.length === 0 ? (
            <div className="ras-post-feed__empty">{t('posts.workspace.queueEmpty')}</div>
          ) : (
            queueItems.map((item) => {
              const isActive = activeQueueItem === item.id;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className="ras-post-card"
                  data-active={isActive}
                  aria-pressed={isActive}
                  aria-disabled={mutationPending}
                  onClick={() => handleQueueItemClick(item)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleQueueItemClick(item);
                    }
                  }}
                >
                  <span className="ras-post-card__header">
                    <span className="ras-post-card__avatar">
                      {persona.avatarUrl ? <img src={persona.avatarUrl} alt="" /> : <UserRound size={18} strokeWidth={1.8} />}
                    </span>
                    <span className="ras-post-card__identity">
                      <strong>{personaName}</strong>
                      <small>{personaHandle} · {item.editedLabel}</small>
                    </span>
                    <span className="ras-post-card__permission">
                      <Lock size={12} strokeWidth={2} />
                      {t('posts.workspace.visibility.private')}
                    </span>
                    {item.draftId ? (
                      <span className="ras-post-card__actions">
                        <IconButton
                          size="sm"
                          tone="ghost"
                          disabled={mutationPending}
                          icon={<Trash2 size={14} strokeWidth={1.8} />}
                          aria-label={t('posts.workspace.deleteDraft')}
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteDraft(item.draftId as string);
                          }}
                        />
                      </span>
                    ) : null}
                  </span>
                  <span className="ras-post-card__body">{item.body || item.title}</span>
                  {item.tagsText ? <span className="ras-post-card__tags">{item.tagsText}</span> : null}
                  <span className="ras-post-card__footer">
                    <StatusBadge tone={queueStateTone(item)}>{t(queueStateCopyKey(item))}</StatusBadge>
                    {item.categoryLabel ? (
                      <span className="ras-post-card__category">{item.categoryLabel}</span>
                    ) : null}
                    {item.attachmentCount ? (
                      <span className="ras-post-card__attachments">
                        <Paperclip size={11} strokeWidth={2} />
                        {t('posts.workspace.attachmentsCount', { count: item.attachmentCount })}
                      </span>
                    ) : null}
                    {isActive && item.draftId ? (
                      <span className="ras-post-card__editing">{t('posts.workspace.editingDraft')}</span>
                    ) : null}
                  </span>
                </div>
              );
            })
          )}
        </section>
      </section>
    </div>
  );
}
