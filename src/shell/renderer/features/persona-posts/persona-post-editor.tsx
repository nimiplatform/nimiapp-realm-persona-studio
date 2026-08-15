import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Paperclip,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button, InlineAlert, StatusBadge, Tooltip, nimiToast } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { loadLocalPostSchedule } from '@renderer/features/portfolio/local-post-schedule-store.js';
import {
  loadLocalPostDraft,
  persistLocalPostDraft,
  type LocalPostDraftRecord,
} from '@renderer/features/portfolio/local-post-draft-store.js';
import { settingFieldDisplayValue } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import type { PersonaWorkspaceQueueItem, PersonaWorkspaceVisualData } from '@renderer/features/persona-detail/persona-workspace-visual-data.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

function queueStateTone(item: PersonaWorkspaceQueueItem): 'warning' | 'info' | 'neutral' {
  if (item.state === 'needs-review') return 'warning';
  if (item.state === 'local-schedule') return 'neutral';
  return 'info';
}

export function PersonaPostEditor({
  persona,
  visualData,
}: {
  persona: OwnerPortfolioPersonaDetail;
  visualData?: PersonaWorkspaceVisualData;
}) {
  const { t } = useStudioI18n();
  const [caption, setCaption] = useState(visualData?.initialPostCaption ?? '');
  const [tagsText, setTagsText] = useState(visualData?.initialPostTags ?? '');
  const [loading, setLoading] = useState(!visualData);
  const [saving, setSaving] = useState(false);
  const [savedRecord, setSavedRecord] = useState<LocalPostDraftRecord | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeQueueItem, setActiveQueueItem] = useState<string | null>(null);

  useEffect(() => {
    setCaption(visualData?.initialPostCaption ?? '');
    setTagsText(visualData?.initialPostTags ?? '');
    setSavedRecord(null);
    setPreviewOpen(false);
    setActiveQueueItem(null);
    if (visualData) {
      setLoading(false);
      setStorageUnavailable(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadLocalPostDraft(persona.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setStorageUnavailable(true);
        return;
      }
      setStorageUnavailable(false);
      if (result.record) {
        setCaption(result.record.caption);
        setTagsText(result.record.tagsText);
        setSavedRecord(result.record);
      }
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
    const items: PersonaWorkspaceQueueItem[] = [];
    if (savedRecord) {
      items.push({
        id: `saved-${persona.id}`,
        title: savedRecord.caption.split('\n')[0]?.slice(0, 56) || t('posts.workspace.untitledDraft'),
        state: 'local-draft',
        editedLabel: new Date(savedRecord.updatedAt).toLocaleString(),
      });
    }
    if (localSchedule) {
      items.push({
        id: localSchedule.localKey,
        title: localSchedule.candidate.postCandidate.realmCreatePost.caption?.slice(0, 56)
          || t('posts.workspace.untitledDraft'),
        state: 'local-schedule',
        editedLabel: `${new Date(localSchedule.localRunAt).toLocaleString()} · ${t('common.localOnly')}`,
      });
    }
    return items;
  }, [localSchedule, persona.id, savedRecord, t, visualData]);

  const traits = visualData?.traits
    ?? persona.voice?.description.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
    ?? [];

  async function saveDraftAndPreview() {
    const normalizedCaption = caption.trim();
    if (!normalizedCaption) {
      nimiToast.danger(t('posts.workspace.captionRequired'));
      return;
    }
    setSaving(true);
    try {
      if (visualData?.developmentFixture) {
        setSavedRecord({
          personaId: persona.id,
          caption: normalizedCaption,
          tagsText: tagsText.trim(),
          updatedAt: new Date().toISOString(),
          source: 'realm-persona-studio.local-post-draft-editor',
          candidateOnly: true,
          publicTruth: false,
        });
        setPreviewOpen(true);
        nimiToast.info(t('posts.workspace.fixturePreviewSaved'));
        return;
      }

      const result = await persistLocalPostDraft({ personaId: persona.id, caption, tagsText });
      if (!result.ok) {
        setStorageUnavailable(true);
        nimiToast.danger(t('posts.workspace.saveFailed'));
        return;
      }
      setSavedRecord(result.record);
      setStorageUnavailable(false);
      setPreviewOpen(true);
      nimiToast.success(t('posts.workspace.savedLocally'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ras-post-workspace">
      <section className="ras-post-editor-panel">
        <header className="ras-post-editor-panel__heading">
          <div>
            <h2>{t('posts.workspace.writeFor', {
              persona: settingFieldDisplayValue(persona.displayName, persona.id, t),
            })}</h2>
          </div>
          <StatusBadge tone="info">{t('common.candidateOnly')}</StatusBadge>
        </header>

        {visualData?.developmentFixture ? (
          <InlineAlert tone="info">{t('posts.workspace.fixtureNotice')}</InlineAlert>
        ) : null}
        {storageUnavailable ? (
          <InlineAlert tone="warning">{t('posts.workspace.storageUnavailable')}</InlineAlert>
        ) : null}

        <div className="ras-post-editor">
          <div className="ras-post-editor__toolbar">
            <strong>{caption.length} {t('posts.workspace.characters')}</strong>
          </div>
          <textarea
            value={caption}
            disabled={loading}
            aria-label={t('posts.workspace.caption')}
            placeholder={t('posts.workspace.captionPlaceholder')}
            onChange={(event) => {
              setCaption(event.currentTarget.value);
              setPreviewOpen(false);
            }}
          />
          <input
            value={tagsText}
            disabled={loading}
            aria-label={t('posts.workspace.tags')}
            placeholder={t('posts.workspace.tagsPlaceholder')}
            onChange={(event) => {
              setTagsText(event.currentTarget.value);
              setPreviewOpen(false);
            }}
          />
          <footer className="ras-post-editor__footer">
            <Tooltip content={t('posts.workspace.attachmentUnavailable')}>
              <span className="inline-flex">
                <Button tone="secondary" disabled leadingIcon={<Paperclip size={16} />}>
                  {t('posts.workspace.addAttachment')}
                </Button>
              </span>
            </Tooltip>
            <div>
              <Tooltip content={t('posts.workspace.aiUnavailable')}>
                <span className="inline-flex">
                  <Button tone="secondary" disabled leadingIcon={<Sparkles size={16} />}>
                    {t('posts.workspace.aiAssist')}
                  </Button>
                </span>
              </Tooltip>
              <Button
                tone="primary"
                loading={saving}
                disabled={loading || !caption.trim()}
                onClick={() => void saveDraftAndPreview()}
              >
                {t('posts.workspace.saveAndPreview')}
              </Button>
            </div>
          </footer>
        </div>

        {previewOpen ? (
          <section className="ras-post-preview" aria-label={t('posts.workspace.previewTitle')}>
            <div>
              <strong>{t('posts.workspace.previewTitle')}</strong>
              <StatusBadge tone="warning">{t('common.localOnly')}</StatusBadge>
            </div>
            <p>{caption}</p>
            {tagsText ? <span>{tagsText}</span> : null}
          </section>
        ) : null}

        <section className="ras-content-queue">
          <header>
            <h3>{t('posts.workspace.queueTitle')}</h3>
            <span>{t('posts.workspace.queueBoundary')}</span>
          </header>
          {queueItems.length === 0 ? (
            <div className="ras-content-queue__empty">{t('posts.workspace.queueEmpty')}</div>
          ) : (
            <div className="ras-content-queue__rows">
              {queueItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-active={activeQueueItem === item.id}
                  onClick={() => setActiveQueueItem(item.id)}
                >
                  <span className="ras-content-queue__icon">
                    {item.state === 'local-schedule' ? <CalendarDays size={16} /> : <Search size={16} />}
                  </span>
                  <span className="ras-content-queue__title">{item.title}</span>
                  <StatusBadge tone={queueStateTone(item)}>
                    {t(item.state === 'needs-review'
                      ? 'posts.workspace.queueNeedsReview'
                      : item.state === 'local-schedule'
                        ? 'posts.workspace.queueLocalPlan'
                        : 'posts.workspace.queueLocalDraft')}
                  </StatusBadge>
                  <span className="ras-content-queue__edited">{item.editedLabel}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </section>
      </section>

      <aside className="ras-post-expression">
        <div>
          <h2>{t('posts.workspace.expressionReference')}</h2>
          <p>{t('posts.workspace.expressionDescription')}</p>
        </div>
        <div className="ras-post-expression__traits">
          {traits.length > 0 ? traits.slice(0, 3).map((trait) => (
            <div key={trait}>
              <span>{trait}</span>
              <p>{t('posts.workspace.traitOwnerReviewed')}</p>
            </div>
          )) : (
            <InlineAlert tone="warning">{t('common.sourceUnavailable')}</InlineAlert>
          )}
        </div>
      </aside>
    </div>
  );
}
