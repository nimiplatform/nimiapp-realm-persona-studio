import { type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { InlineAlert, NimiText, Statistic, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell, WorkspaceIntro } from '@renderer/features/persona-detail/persona-shell.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import {
  settingFieldStatusLabel,
} from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

function InsightsSectionHeader({ title, badge }: { title: string; badge?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <NimiText as="h3" role="section-title" className="m-0">
        {title}
      </NimiText>
      {badge}
    </div>
  );
}

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
          <InsightsSectionHeader
            title={t('persona.insights.friendCountTitle')}
            badge={
              <StatusBadge tone={friendCountAvailable ? 'success' : 'warning'}>
                {friendCountAvailable ? t('persona.insights.sourceAvailable') : t('persona.insights.sourceUnavailable')}
              </StatusBadge>
            }
          />
          {friendCountAvailable ? (
            <Statistic
              className="mt-4"
              tone="primary"
              label={t('persona.insights.friendCountTitle')}
              value={friendCount}
            />
          ) : (
            <div className="mt-4">
              <InlineAlert tone="warning">
                {t('persona.insights.unavailableDetail')}
              </InlineAlert>
            </div>
          )}
          <NimiText role="helper" className="mt-3 leading-[1.55]">
            {t('persona.insights.friendCountDescription')}
          </NimiText>
        </Surface>

        <Surface tone="panel" material="glass-regular" padding="lg" className="ras-insights-grid__span ras-radius-xl">
          <InsightsSectionHeader
            title={t('persona.insights.sourceAvailabilityTitle')}
            badge={<StatusBadge tone="neutral">{t('persona.insights.realmReads')}</StatusBadge>}
          />
          <ul className="m-0 mt-3 grid list-none gap-2 p-0">
            {([
              ['displayName', persona.displayName],
              ['handle', persona.handle],
              ['bio', persona.bio],
              ['greeting', persona.greeting],
              ['profileCoverUrl', persona.profileCoverUrl],
              ['world', persona.world],
              ['visibility', persona.visibility],
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
          <NimiText role="helper" className="mt-3">
            {t('persona.insights.sourceAvailabilityDescription')}
          </NimiText>
        </Surface>

        <Surface tone="panel" material="glass-regular" padding="lg" className="ras-insights-grid__span ras-radius-xl">
          <InsightsSectionHeader
            title={t('persona.insights.deferredTitle')}
            badge={<StatusBadge tone="neutral">{t('persona.insights.specDeferred')}</StatusBadge>}
          />
          <NimiText role="helper" className="mt-2">
            {t('persona.insights.deferredDescription')}
          </NimiText>
          <ul className="m-0 mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2 p-0">
            <li className="flex items-center gap-2">
              <StatusBadge tone="neutral" shape="dot">{t('persona.insights.deferredBadge')}</StatusBadge>
              {t('persona.insights.profileViewMetrics')}
            </li>
            <li className="flex items-center gap-2">
              <StatusBadge tone="neutral" shape="dot">{t('persona.insights.deferredBadge')}</StatusBadge>
              {t('persona.insights.friendCountTrend')}
            </li>
            <li className="flex items-center gap-2">
              <StatusBadge tone="neutral" shape="dot">{t('persona.insights.deferredBadge')}</StatusBadge>
              {t('persona.insights.postAnalytics')}
            </li>
            <li className="flex items-center gap-2">
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
