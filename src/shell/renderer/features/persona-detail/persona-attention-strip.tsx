import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ArrowUpRight, FileText, Images } from 'lucide-react';
import { loadLocalPostDrafts, type LocalPostDraftRecord } from '@renderer/features/portfolio/local-post-draft-store.js';
import { loadLocalPostSchedule } from '@renderer/features/portfolio/local-post-schedule-store.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { useLocalCreativeAssetHistory } from '@renderer/features/portfolio/use-local-creative-asset-history.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import { usePersonaVisualPreview } from './persona-visual-preview-context.js';

type AttentionCell = {
  key: 'candidates' | 'draft' | 'plan';
  icon: typeof Images;
  label: string;
  value: string;
  muted: boolean;
  path: string;
};

/**
 * Compact cross-workspace summary band shown at the top of the persona
 * settings page: pending identity candidates, the latest local Post draft,
 * and the foreground-only local schedule. Each cell is a shortcut into the
 * owning workspace tab; unavailable sources render an explicit muted state.
 * When every source is available and empty there is nothing to attend to, so
 * the strip hides itself instead of padding the page with empty cells.
 */
export function PersonaAttentionStrip({
  persona,
}: {
  persona: OwnerPortfolioPersonaDetail;
}) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const visualData = usePersonaVisualPreview()?.visualData[persona.id];
  const creativeHistoryState = useLocalCreativeAssetHistory(persona.id);
  const [localDraft, setLocalDraft] = useState<LocalPostDraftRecord | null>(null);
  const [localDraftUnavailable, setLocalDraftUnavailable] = useState(false);

  useEffect(() => {
    if (visualData) {
      setLocalDraft(null);
      setLocalDraftUnavailable(false);
      return;
    }
    let cancelled = false;
    void loadLocalPostDrafts(persona.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setLocalDraft(result.records[0] ?? null);
        setLocalDraftUnavailable(false);
      } else {
        setLocalDraft(null);
        setLocalDraftUnavailable(true);
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

  const candidateCount = visualData?.candidates?.length ?? creativeHistoryState.records.length;
  const candidatesUnavailable = !visualData && creativeHistoryState.unavailable;
  const recentDraftTitle = visualData?.recentDraft?.title ?? (localDraft
    ? localDraft.caption.split('\n')[0]?.slice(0, 60) || t('posts.workspace.untitledDraft')
    : null);
  const localPlanRunLabel = visualData?.localPlan?.runLabel ?? (localSchedule
    ? `${new Date(localSchedule.localRunAt).toLocaleString()} · ${t('common.localOnly')}`
    : null);

  const cells: AttentionCell[] = [
    {
      key: 'candidates',
      icon: Images,
      label: t('persona.workspace.pendingCandidates'),
      value: candidatesUnavailable
        ? t('common.sourceUnavailable')
        : candidateCount > 0
          ? String(candidateCount)
          : t('persona.workspace.noCandidates'),
      muted: candidatesUnavailable || candidateCount === 0,
      path: `/portfolio/${persona.id}/settings`,
    },
    {
      key: 'draft',
      icon: FileText,
      label: t('persona.workspace.recentDraft'),
      value: localDraftUnavailable
        ? t('common.sourceUnavailable')
        : recentDraftTitle ?? t('persona.workspace.noRecentDraft'),
      muted: localDraftUnavailable || !recentDraftTitle,
      path: `/portfolio/${persona.id}/posts`,
    },
    {
      key: 'plan',
      icon: CalendarDays,
      label: t('persona.workspace.localPlan'),
      value: localPlanRunLabel ?? t('persona.workspace.noLocalPlan'),
      muted: !localPlanRunLabel,
      path: `/portfolio/${persona.id}/posts/schedule`,
    },
  ];

  const anyUnavailable = candidatesUnavailable || localDraftUnavailable;
  const hasContent = cells.some((cell) => !cell.muted);
  if (!anyUnavailable && !hasContent) {
    return null;
  }

  return (
    <div className="ras-attention-strip" role="list">
      {cells.map((cell) => (
        <button
          key={cell.key}
          type="button"
          role="listitem"
          className="ras-attention-strip__cell"
          data-cell={cell.key}
          onClick={() => navigate(cell.path)}
        >
          <span className="ras-attention-strip__icon-tile" aria-hidden="true">
            <cell.icon size={17} strokeWidth={1.8} />
          </span>
          <span className="ras-attention-strip__copy">
            <span className="ras-attention-strip__label">{cell.label}</span>
            <span className={cell.muted
              ? 'ras-attention-strip__value ras-attention-strip__value--muted'
              : 'ras-attention-strip__value'}
            >
              {cell.value}
            </span>
          </span>
          <ArrowUpRight size={15} className="ras-attention-strip__chevron" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
