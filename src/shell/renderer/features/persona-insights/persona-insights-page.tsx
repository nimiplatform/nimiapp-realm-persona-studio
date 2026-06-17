import { useParams } from 'react-router-dom';
import { InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell, WorkspaceIntro } from '@renderer/features/persona-detail/persona-shell.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import {
  settingFieldStatusLabel,
} from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

function InsightsBody({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const friendCountMetric = persona.friendCount;
  const friendCountAvailable = friendCountMetric.status === 'available';
  const friendCount = friendCountMetric.status === 'available' ? friendCountMetric.value : null;

  return (
    <>
      <WorkspaceIntro
        title={t('persona.insights.title')}
        badges={
          <>
            <StatusBadge tone={friendCountAvailable ? 'success' : 'warning'}>
              {friendCountAvailable ? t('persona.insights.badgeAvailable', { count: friendCount ?? 0 }) : t('shared.friendCount.unavailable')}
            </StatusBadge>
          </>
        }
        description={t('persona.insights.description')}
      />

      <div className="ras-insights-grid">
        <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t('persona.insights.friendCountTitle')}</h3>
            <StatusBadge tone={friendCountAvailable ? 'success' : 'warning'}>
              {friendCountAvailable ? t('persona.insights.sourceAvailable') : t('persona.insights.sourceUnavailable')}
            </StatusBadge>
          </div>
          {friendCountAvailable ? (
            <div style={{ marginTop: 16, fontSize: 48, fontWeight: 700, color: 'var(--nimi-text-primary)' }}>{friendCount}</div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <InlineAlert tone="warning">
                {t('persona.insights.unavailableDetail')}
              </InlineAlert>
            </div>
          )}
          <p className="ras-text-muted ras-text-size-sm" style={{ margin: '12px 0 0', lineHeight: 1.55 }}>
            {t('persona.insights.friendCountDescription')}
          </p>
        </Surface>

        <Surface tone="panel" material="glass-regular" padding="lg" className="ras-insights-grid__span ras-radius-xl">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t('persona.insights.sourceAvailabilityTitle')}</h3>
            <StatusBadge tone="neutral">{t('persona.insights.realmReads')}</StatusBadge>
          </div>
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {([
              ['displayName', persona.displayName],
              ['handle', persona.handle],
              ['bio', persona.bio],
              ['greeting', persona.greeting],
              ['profileCoverUrl', persona.profileCoverUrl],
              ['world', persona.world],
              ['state', persona.state],
              ['ownership', persona.ownership],
            ] as const).map(([field, setting]) => (
              <li key={field}>
                <StatusBadge
                  tone={setting.status === 'available' ? 'success' : setting.status === 'available-empty' ? 'neutral' : 'warning'}
                  shape="dot"
                >
                  {field}: {settingFieldStatusLabel(setting, t)}
                </StatusBadge>
              </li>
            ))}
          </ul>
          <p className="ras-text-muted ras-text-size-sm" style={{ margin: '12px 0 0' }}>
            {t('persona.insights.sourceAvailabilityDescription')}
          </p>
        </Surface>

        <Surface tone="panel" material="glass-regular" padding="lg" className="ras-insights-grid__span ras-radius-xl">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t('persona.insights.deferredTitle')}</h3>
            <StatusBadge tone="neutral">{t('persona.insights.specDeferred')}</StatusBadge>
          </div>
          <p className="ras-text-muted ras-text-size-sm" style={{ margin: '8px 0 0' }}>
            {t('persona.insights.deferredDescription')}
          </p>
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge tone="neutral" shape="dot">{t('persona.insights.deferredBadge')}</StatusBadge>
              {t('persona.insights.profileViewMetrics')}
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge tone="neutral" shape="dot">{t('persona.insights.deferredBadge')}</StatusBadge>
              {t('persona.insights.friendCountTrend')}
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge tone="neutral" shape="dot">{t('persona.insights.deferredBadge')}</StatusBadge>
              {t('persona.insights.postAnalytics')}
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge tone="neutral" shape="dot">{t('persona.insights.deferredBadge')}</StatusBadge>
              {t('persona.insights.portfolioHealth')}
            </li>
          </ul>
        </Surface>
      </div>
    </>
  );
}

function PersonaInsightsPageForScope() {
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
    <PersonaShell personaId={personaId} current="insights">
      {(persona) => <InsightsBody persona={persona} />}
    </PersonaShell>
  );
}

export function PersonaInsightsPage() {
  return <PersonaInsightsPageForScope />;
}
