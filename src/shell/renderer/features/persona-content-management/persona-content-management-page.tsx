import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, CalendarClock, FileText, Image, Mic2 } from 'lucide-react';
import { Button, EmptyState, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell, WorkspaceIntro } from '@renderer/features/persona-detail/persona-shell.js';
import { buildDraftBoxEntries, type DraftBoxEntry } from '@renderer/features/portfolio/draft-box.js';
import { loadLocalCreativeAssetHistory } from '@renderer/features/portfolio/creative-asset-history.js';
import { loadLocalPostSchedule } from '@renderer/features/portfolio/local-post-schedule-store.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';

const ENTRY_STATUS_KEYS: Record<DraftBoxEntry['status'], StudioCopyKey> = {
  'needs-review': 'draftBox.status.needsReview',
  'saved-locally': 'draftBox.status.savedLocally',
  'ready-when-due': 'draftBox.status.readyWhenDue',
};

const ENTRY_BOUNDARY_KEYS: Record<DraftBoxEntry['truthBoundary'], StudioCopyKey> = {
  'candidate-only': 'draftBox.boundary.candidateOnly',
  'local-only': 'draftBox.boundary.localOnly',
};

const ENTRY_DESTINATION_KEYS: Record<DraftBoxEntry['destination'], StudioCopyKey> = {
  identity: 'draftBox.destination.identity',
  voice: 'draftBox.destination.voice',
  content: 'draftBox.destination.content',
  schedule: 'draftBox.destination.schedule',
};

function entryIcon(kind: DraftBoxEntry['kind']) {
  if (kind === 'voice-demo') return <Mic2 size={18} strokeWidth={1.8} />;
  if (kind === 'scheduled-post') return <CalendarClock size={18} strokeWidth={1.8} />;
  if (kind === 'identity-image' || kind === 'avatar-package' || kind === 'identity-upload') {
    return <Image size={18} strokeWidth={1.8} />;
  }
  return <FileText size={18} strokeWidth={1.8} />;
}

function statusTone(status: DraftBoxEntry['status']): 'info' | 'warning' | 'success' {
  if (status === 'ready-when-due') return 'info';
  if (status === 'saved-locally') return 'success';
  return 'warning';
}

function DraftBoxEntryCard({ entry }: { entry: DraftBoxEntry }) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  return (
    <Surface tone="card" padding="md">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--nimi-radius-field)] bg-[var(--nimi-surface-panel)] text-[var(--nimi-text-secondary)]">
          {entryIcon(entry.kind)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{entry.title}</h3>
            <StatusBadge tone={statusTone(entry.status)}>{t(ENTRY_STATUS_KEYS[entry.status])}</StatusBadge>
            <StatusBadge tone="neutral">{t(ENTRY_BOUNDARY_KEYS[entry.truthBoundary])}</StatusBadge>
          </div>
          <p className="ras-break-anywhere m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-primary)]">
            {entry.detail}
          </p>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-[length:var(--nimi-type-body-xs-size)] text-[var(--nimi-text-muted)]">
            <span>{t(ENTRY_DESTINATION_KEYS[entry.destination])}</span>
            <span>{entry.createdAt}</span>
          </div>
        </div>
        <Button tone="secondary" size="sm" onClick={() => navigate(entry.actionPath)}>
          {t('draftBox.open')}
        </Button>
      </div>
    </Surface>
  );
}

function ContentManagementBody({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const draftBoxEntries = useMemo(() => buildDraftBoxEntries({
    personaId: persona.id,
    creativeHistory: loadLocalCreativeAssetHistory(persona.id),
    localSchedule: loadLocalPostSchedule(persona.id),
  }), [persona.id]);
  const localOnlyCount = draftBoxEntries.filter((entry) => entry.truthBoundary === 'local-only').length;
  const candidateCount = draftBoxEntries.filter((entry) => entry.truthBoundary === 'candidate-only').length;
  const dueCount = draftBoxEntries.filter((entry) => entry.status === 'ready-when-due').length;

  return (
    <>
      <WorkspaceIntro
        title={t('contentManagement.title')}
        badges={
          <>
            <StatusBadge tone="info">{t('contentManagement.badge')}</StatusBadge>
            <StatusBadge tone="warning">{t('contentManagement.localBadge')}</StatusBadge>
          </>
        }
        description={t('contentManagement.description')}
        actions={
          <>
            <Button tone="secondary" onClick={() => navigate(`/portfolio/${persona.id}/posts`)}>
              {t('contentManagement.compose')}
            </Button>
            <Button tone="ghost" onClick={() => navigate(`/portfolio/${persona.id}/posts/schedule`)}>
              {t('contentManagement.schedule')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Archive size={18} strokeWidth={1.8} />
                  <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('draftBox.title')}</h2>
                </div>
                <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                  {t('draftBox.description')}
                </p>
              </div>
              <StatusBadge tone={draftBoxEntries.length > 0 ? 'info' : 'neutral'}>
                {t('draftBox.count', { count: draftBoxEntries.length })}
              </StatusBadge>
            </div>
            <div className="mt-4 grid gap-3">
              {draftBoxEntries.length === 0 ? (
                <EmptyState title={t('draftBox.emptyTitle')} description={t('draftBox.emptyDescription')} />
              ) : draftBoxEntries.map((entry) => (
                <DraftBoxEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </Surface>

          <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
            <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('contentManagement.ledger.title')}</h2>
            <p className="m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
              {t('contentManagement.ledger.description')}
            </p>
            <InlineAlert tone="info" className="mt-3">
              {t('contentManagement.ledger.boundary')}
            </InlineAlert>
          </Surface>
        </div>

        <div className="grid gap-4 content-start">
          <Surface tone="card" padding="md">
            <h3 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('contentManagement.summary.title')}</h3>
            <dl className="m-0 mt-3 grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{t('contentManagement.summary.candidates')}</dt>
                <dd className="m-0 font-semibold">{candidateCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{t('contentManagement.summary.localOnly')}</dt>
                <dd className="m-0 font-semibold">{localOnlyCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{t('contentManagement.summary.due')}</dt>
                <dd className="m-0 font-semibold">{dueCount}</dd>
              </div>
            </dl>
          </Surface>
          <Surface tone="card" padding="md">
            <h3 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('contentManagement.boundary.title')}</h3>
            <p className="m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
              {t('contentManagement.boundary.description')}
            </p>
          </Surface>
        </div>
      </div>
    </>
  );
}

export function PersonaContentManagementPage() {
  const { t } = useStudioI18n();
  const { personaId } = useParams<{ personaId: string }>();

  if (!personaId) {
    return (
      <Surface tone="panel" material="glass-regular" padding="lg">
        <InlineAlert tone="danger">{t('common.personaIdMissing')}</InlineAlert>
      </Surface>
    );
  }

  return (
    <PersonaShell personaId={personaId} current="posts">
      {(persona) => <ContentManagementBody persona={persona} />}
    </PersonaShell>
  );
}
