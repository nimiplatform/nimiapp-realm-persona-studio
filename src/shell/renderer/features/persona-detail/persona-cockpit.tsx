import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AudioLines,
  CalendarDays,
  ChevronRight,
  FileText,
  UserRound,
} from 'lucide-react';
import { Button, InlineAlert, StatusBadge } from '@nimiplatform/kit/ui';
import type { CreativeAssetHistoryRecord } from '@renderer/features/portfolio/creative-asset-history.js';
import { loadLocalPostDraft, type LocalPostDraftRecord } from '@renderer/features/portfolio/local-post-draft-store.js';
import { loadLocalPostSchedule } from '@renderer/features/portfolio/local-post-schedule-store.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { settingFieldDisplayValue } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useLocalCreativeAssetHistory } from '@renderer/features/portfolio/use-local-creative-asset-history.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { PersonaWorkspaceCandidate, PersonaWorkspaceVisualData } from './persona-workspace-visual-data.js';

function mapHistoryCandidate(record: CreativeAssetHistoryRecord): PersonaWorkspaceCandidate {
  const voiceCandidate = record.kind === 'voice-demo-candidate';
  return {
    id: record.id,
    kind: voiceCandidate ? 'voice' : record.kind === 'avatar-package-candidate' ? 'avatar' : 'cover',
    label: record.label,
    status: record.reviewState,
    ...(!voiceCandidate && record.previewUrl ? { imageUrl: record.previewUrl } : {}),
    ...(voiceCandidate ? {
      fileName: record.label,
      sourceKind: record.sourceKind,
      ...(record.previewUrl ? { previewUrl: record.previewUrl } : {}),
    } : {}),
  };
}

export function PersonaCockpit({
  persona,
  visualData,
}: {
  persona: OwnerPortfolioPersonaDetail;
  visualData?: PersonaWorkspaceVisualData;
}) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
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
    void loadLocalPostDraft(persona.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setLocalDraft(result.record);
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
  const candidates = visualData?.candidates
    ?? creativeHistoryState.records.slice(0, 3).map(mapHistoryCandidate);
  const traits = visualData?.traits
    ?? persona.voice?.description.split(/[、,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 3)
    ?? [];
  const recentDraft = visualData?.recentDraft ?? (localDraft ? {
    title: localDraft.caption.split('\n')[0]?.slice(0, 60) || t('posts.workspace.untitledDraft'),
    savedLabel: new Date(localDraft.updatedAt).toLocaleString(),
    imageUrl: persona.profileCoverUrl.status === 'available' ? persona.profileCoverUrl.value : undefined,
  } : null);
  const localPlan = visualData?.localPlan ?? (localSchedule ? {
    title: localSchedule.candidate.postCandidate.realmCreatePost.caption?.slice(0, 60)
      || t('posts.workspace.untitledDraft'),
    runLabel: `${new Date(localSchedule.localRunAt).toLocaleString()} · ${t('common.localOnly')}`,
  } : null);

  return (
    <div className="ras-persona-overview">
      {creativeHistoryState.unavailable ? (
        <InlineAlert tone="warning">{t('assets.history.unavailable')}</InlineAlert>
      ) : null}

      <div className="ras-persona-overview__summary-grid">
        <section className="ras-persona-overview__profile">
          <header>
            <UserRound size={18} />
            <h2>{t('persona.workspace.publicIdentity')}</h2>
          </header>
          <p className="ras-persona-overview__bio">
            {settingFieldDisplayValue(persona.bio, t('common.sourceUnavailable'), t)}
          </p>
          <p className="ras-persona-overview__greeting">
            {settingFieldDisplayValue(persona.greeting, t('common.sourceUnavailable'), t)}
          </p>
          <div className="ras-persona-overview__positioning">
            <strong>{t('persona.workspace.positioning')}</strong>
            <div>
              {traits.length > 0 ? traits.map((trait) => <span key={trait}>{trait}</span>) : (
                <span>{t('common.sourceUnavailable')}</span>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="ras-persona-candidates">
        <header>
          <div>
            <h2>{t('persona.workspace.pendingCandidates')}</h2>
            <p>{t('persona.workspace.pendingCandidatesDescription')}</p>
          </div>
          <Button tone="ghost" onClick={() => navigate(`/portfolio/${persona.id}/assets`)}>
            {t('persona.workspace.openAssets')}
          </Button>
        </header>
        {candidates.length === 0 ? (
          <div className="ras-persona-candidates__empty">{t('persona.workspace.noCandidates')}</div>
        ) : (
          <div className="ras-persona-candidates__grid">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                data-kind={candidate.kind}
                onClick={() => navigate(candidate.kind === 'voice'
                  ? `/portfolio/${persona.id}/assets/voice`
                  : `/portfolio/${persona.id}/assets`)}
              >
                {candidate.kind === 'voice' ? (
                  <div className="ras-persona-candidates__voice">
                    <AudioLines size={48} strokeWidth={1.45} />
                    <span>{candidate.fileName ?? candidate.label}</span>
                  </div>
                ) : candidate.imageUrl ? (
                  <img src={candidate.imageUrl} alt={candidate.label} />
                ) : (
                  <div className="ras-persona-candidates__unavailable">{t('common.sourceUnavailable')}</div>
                )}
                <span className="ras-persona-candidates__label">{candidate.label}</span>
                <StatusBadge tone={candidate.status === 'owner-reviewed' ? 'success' : 'warning'}>
                  {t(candidate.status === 'owner-reviewed'
                    ? 'persona.workspace.candidateReviewed'
                    : 'persona.workspace.candidateNeedsReview')}
                </StatusBadge>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="ras-persona-overview__activity-grid">
        <section>
          <header><FileText size={18} /><h2>{t('persona.workspace.recentDraft')}</h2></header>
          {localDraftUnavailable ? <InlineAlert tone="warning">{t('posts.workspace.storageUnavailable')}</InlineAlert> : recentDraft ? (
            <button type="button" onClick={() => navigate(`/portfolio/${persona.id}/posts`)}>
              {recentDraft.imageUrl ? <img src={recentDraft.imageUrl} alt="" /> : <FileText size={20} />}
              <span><strong>{recentDraft.title}</strong><small>{recentDraft.savedLabel}</small></span>
              <StatusBadge tone="info">{t('posts.workspace.localDraft')}</StatusBadge>
              <ChevronRight size={16} />
            </button>
          ) : (
            <div className="ras-persona-overview__empty-row">{t('persona.workspace.noRecentDraft')}</div>
          )}
        </section>
        <section>
          <header><CalendarDays size={18} /><h2>{t('persona.workspace.localPlan')}</h2></header>
          {localPlan ? (
            <button type="button" onClick={() => navigate(`/portfolio/${persona.id}/posts/schedule`)}>
              <CalendarDays size={20} />
              <span><strong>{localPlan.runLabel}</strong><small>{localPlan.title}</small></span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <div className="ras-persona-overview__empty-row">{t('persona.workspace.noLocalPlan')}</div>
          )}
        </section>
      </div>
    </div>
  );
}
