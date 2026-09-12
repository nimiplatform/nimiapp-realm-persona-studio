// @nimi-authority: rule.realm-persona-studio.post.r009
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  Button,
  Checkbox,
  FieldShell,
  InlineAlert,
  nimiToast,
  StatusBadge,
  Surface,
  TextareaField,
  TextField,
} from '@nimiplatform/kit/ui';
import {
  clearLocalPostSchedule,
  isLocalPostScheduleDue,
  saveLocalPostSchedule,
  type LocalPostScheduleRecord,
} from '@renderer/features/portfolio/local-post-schedule-store.js';
import {
  buildLocalPostScheduleCandidate,
  validateLocalPostDraft,
  type LocalPostDraftInput,
} from '@renderer/features/portfolio/post-draft.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { usePersonaVisualPreview } from '@renderer/features/persona-detail/persona-visual-preview-context.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';

const SCHEDULE_ERROR_COPY_KEYS: Record<string, StudioCopyKey> = {
  'caption missing': 'posts.error.captionMissing',
  'candidate not publishable: human review missing': 'posts.error.humanReviewMissing',
  'post candidate rejected: PersonaCharacter sourceHash unavailable': 'posts.error.personaIdentityMissing',
  'app-local schedule unavailable: reviewed publishable local post draft required': 'posts.error.scheduleDraftRequired',
  'app-local schedule unavailable: local run date and time required': 'posts.error.scheduleDateTimeRequired',
  'app-local schedule unavailable: local run time must be in the future': 'posts.error.scheduleFutureRequired',
};

function translateScheduleError(message: string, t: ReturnType<typeof useStudioI18n>['t']): string {
  const forbiddenField = message.match(/^(?:post payload|app-local schedule) rejected: forbidden (.+) present$/);
  if (forbiddenField) return t('posts.error.forbiddenField', { field: forbiddenField[1] ?? '' });
  const key = SCHEDULE_ERROR_COPY_KEYS[message];
  return key ? t(key) : t('common.operationFailed');
}

function scheduleTagsText(record: LocalPostScheduleRecord): string {
  return (record.candidate.postCandidate.realmCreatePost.tags ?? []).map((tag) => `#${tag}`).join(' ');
}

/**
 * Single app-local post schedule for one persona. Reads and writes the same
 * local schedule store the posts editor surfaces in its queue: one reviewed
 * caption plus a future local date/time, foreground-only, never a Realm queue.
 */
export function PersonaSchedulePanel({
  persona,
  schedule,
  onScheduleChange,
  disabled = false,
}: {
  persona: OwnerPortfolioPersonaDetail;
  schedule: LocalPostScheduleRecord | null;
  onScheduleChange: (next: LocalPostScheduleRecord | null) => void;
  disabled?: boolean;
}) {
  const { t } = useStudioI18n();
  const developmentFixture = Boolean(usePersonaVisualPreview()?.visualData[persona.id]?.developmentFixture);
  const [caption, setCaption] = useState(() => schedule?.candidate.postCandidate.realmCreatePost.caption ?? '');
  const [tagsText, setTagsText] = useState(() => (schedule ? scheduleTagsText(schedule) : ''));
  const [localDate, setLocalDate] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [humanReviewed, setHumanReviewed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [persistFailed, setPersistFailed] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCaption(schedule?.candidate.postCandidate.realmCreatePost.caption ?? '');
    setTagsText(schedule ? scheduleTagsText(schedule) : '');
    setLocalDate('');
    setLocalTime('');
    setHumanReviewed(false);
    setErrors([]);
    setPersistFailed(false);
    setClearFailed(false);
  }, [schedule]);

  const draftInput = useMemo<LocalPostDraftInput>(() => ({
    caption,
    tagsText,
    humanReviewed,
    attachmentEnabled: false,
    attachmentTargetType: 'RESOURCE',
    attachmentTargetId: '',
  }), [caption, tagsText, humanReviewed]);

  async function saveSchedule() {
    if (disabled || pending) return;
    setPersistFailed(false);
    const result = buildLocalPostScheduleCandidate(
      validateLocalPostDraft(draftInput, persona),
      { localDate, localTime },
    );
    if (!result.scheduleable) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (developmentFixture) {
      onScheduleChange({
        localKey: `${persona.id}:${result.candidate.localRunAt}`,
        personaId: persona.id,
        savedAt: new Date().toISOString(),
        localRunAt: result.candidate.localRunAt,
        source: 'realm-persona-studio.local-single-post-schedule-store',
        appLocalOnly: true,
        execution: {
          mode: 'foreground-when-due',
          realmPublish: 'pending-owner-app-open',
        },
        candidate: result.candidate,
      });
      nimiToast.info(t('posts.workspace.fixturePreviewSaved'));
      return;
    }
    setPending(true);
    try {
      const saved = await saveLocalPostSchedule(persona.id, result.candidate);
      onScheduleChange(saved);
      nimiToast.success(t('posts.schedule.savedFor', { time: saved.localRunAt }));
    } catch {
      setPersistFailed(true);
    } finally {
      setPending(false);
    }
  }

  async function clearSchedule() {
    if (disabled || pending) return;
    setClearFailed(false);
    setPending(true);
    try {
      if (!developmentFixture) await clearLocalPostSchedule(persona.id);
      onScheduleChange(null);
      nimiToast.success(t('posts.schedule.cleared'));
    } catch {
      setClearFailed(true);
    } finally {
      setPending(false);
    }
  }

  const scheduleDue = schedule ? isLocalPostScheduleDue(schedule) : false;
  const today = new Date();
  const minimumDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const savedCaption = schedule?.candidate.postCandidate.realmCreatePost.caption ?? '';

  return (
    <Surface tone="card" padding="lg" className="ras-radius-xl" aria-label={t('posts.schedule.panelTitle')}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarClock size={18} strokeWidth={1.8} aria-hidden="true" />
            <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('posts.schedule.panelTitle')}</h2>
            <StatusBadge tone="warning">{t('common.appLocal')}</StatusBadge>
          </div>
          <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {t('posts.schedule.panelDescription')}
          </p>
        </div>
      </div>

      {schedule ? (
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3 rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3">
          <div className="min-w-0 flex-1">
            <p className="ras-break-anywhere m-0 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-primary)]">
              {savedCaption || t('posts.workspace.untitledDraft')}
            </p>
            <p className="m-0 mt-1 text-[length:var(--nimi-type-body-xs-size)] text-[var(--nimi-text-muted)]">
              {new Date(schedule.localRunAt).toLocaleString()}
            </p>
          </div>
          <StatusBadge tone={scheduleDue ? 'warning' : 'info'}>
            {scheduleDue ? t('posts.schedule.dueBadge') : t('posts.schedule.savedBadge')}
          </StatusBadge>
          <Button tone="secondary" size="sm" disabled={disabled || pending} onClick={clearSchedule}>
            {t('posts.schedule.clear')}
          </Button>
        </div>
      ) : null}

      <fieldset disabled={disabled || pending} className="mt-4 grid min-w-0 gap-4">
        <FieldShell label={t('posts.schedule.captionLabel')}>
          <TextareaField
            value={caption}
            rows={4}
            aria-label={t('posts.schedule.captionLabel')}
            placeholder={t('posts.workspace.captionPlaceholder')}
            onChange={(event) => {
              setCaption(event.currentTarget.value);
              setHumanReviewed(false);
              setErrors([]);
            }}
          />
        </FieldShell>
        <FieldShell label={t('posts.workspace.tags')}>
          <TextField
            value={tagsText}
            placeholder={t('posts.workspace.tagsPlaceholder')}
            onChange={(event) => {
              setTagsText(event.currentTarget.value);
              setHumanReviewed(false);
              setErrors([]);
            }}
          />
        </FieldShell>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell label={t('posts.schedule.localDate')}>
            <TextField
              type="date"
              min={minimumDate}
              aria-label={t('posts.schedule.localDate')}
              value={localDate}
              onChange={(event) => {
                setLocalDate(event.currentTarget.value);
                setErrors([]);
              }}
            />
          </FieldShell>
          <FieldShell label={t('posts.schedule.localTime')}>
            <TextField
              type="time"
              aria-label={t('posts.schedule.localTime')}
              value={localTime}
              onChange={(event) => {
                setLocalTime(event.currentTarget.value);
                setErrors([]);
              }}
            />
          </FieldShell>
        </div>
        <Checkbox
          checked={humanReviewed}
          label={t('posts.schedule.reviewedLabel')}
          onChange={(event) => {
            setHumanReviewed(event.currentTarget.checked);
            setErrors([]);
          }}
        />
        {errors.length > 0 ? (
          <InlineAlert tone="warning">
            {errors.map((message) => translateScheduleError(message, t)).join('; ')}
          </InlineAlert>
        ) : null}
        {clearFailed ? (
          <InlineAlert tone="danger">{t('posts.schedule.clearFailed')}</InlineAlert>
        ) : null}
        {persistFailed ? (
          <InlineAlert tone="danger">{t('posts.schedule.persistFailed')}</InlineAlert>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button tone="primary" loading={pending} onClick={saveSchedule}>
            {t('posts.schedule.save')}
          </Button>
          {schedule ? (
            <Button tone="ghost" onClick={clearSchedule}>
              {t('posts.schedule.clear')}
            </Button>
          ) : null}
        </div>
        <InlineAlert tone="info">{t('posts.schedule.boundaryNote')}</InlineAlert>
      </fieldset>
    </Surface>
  );
}
