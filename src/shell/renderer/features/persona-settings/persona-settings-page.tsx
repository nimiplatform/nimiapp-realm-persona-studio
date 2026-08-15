import { useNavigate, useParams } from 'react-router-dom';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell, WorkspaceIntro } from '@renderer/features/persona-detail/persona-shell.js';
import { useRefreshPersonaReads } from '@renderer/features/persona-detail/use-persona-detail-query.js';
import {
  RuntimeProjectionWorkspace,
  SettingProposalWorkspace,
  VisibilitySettingsWorkspace,
} from '@renderer/features/portfolio/OwnerPortfolio.settings.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

function PersonaSettingsPageForScope() {
  const { t } = useStudioI18n();
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const refreshPersonaReads = useRefreshPersonaReads(personaId ?? '');

  if (!personaId) {
    return (
      <Surface tone="card" padding="lg">
        <InlineAlert tone="danger">{t('common.personaIdMissing')}</InlineAlert>
      </Surface>
    );
  }

  return (
    <PersonaShell personaId={personaId} current="settings">
      {(persona) => (
        <>
          <WorkspaceIntro
            title={t('persona.settings.title')}
            badges={<StatusBadge tone="info">{t('common.workspace')}</StatusBadge>}
            description={t('persona.settings.description')}
            actions={(
              <Button tone="secondary" onClick={() => navigate(`/portfolio/${personaId}/settings/review`)}>
                {t('persona.settings.openReview')}
              </Button>
            )}
          />

          <VisibilitySettingsWorkspace persona={persona} onPersonaWrite={refreshPersonaReads} />
          <SettingProposalWorkspace persona={persona} onPersonaWrite={refreshPersonaReads} />
          <RuntimeProjectionWorkspace persona={persona} />
        </>
      )}
    </PersonaShell>
  );
}

export function PersonaSettingsPage() {
  return <PersonaSettingsPageForScope />;
}
