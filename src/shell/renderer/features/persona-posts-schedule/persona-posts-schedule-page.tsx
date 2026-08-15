import { useNavigate, useParams } from 'react-router-dom';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell, WorkspaceIntro } from '@renderer/features/persona-detail/persona-shell.js';
import { CreativePostWorkspace } from '@renderer/features/portfolio/OwnerPortfolio.posts.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

export function PersonaPostsSchedulePage() {
  const { t } = useStudioI18n();
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();

  if (!personaId) {
    return (
      <Surface tone="card" padding="lg">
        <InlineAlert tone="danger">{t('common.personaIdMissing')}</InlineAlert>
      </Surface>
    );
  }

  return (
    <PersonaShell personaId={personaId} current="posts">
      {(persona) => (
        <>
          <WorkspaceIntro
            title={t('persona.schedule.title')}
            badges={
              <>
                <StatusBadge tone="warning">{t('common.appLocal')}</StatusBadge>
                <StatusBadge tone="neutral">{t('common.foregroundOnly')}</StatusBadge>
              </>
            }
            description={t('persona.schedule.description')}
            actions={
              <Button tone="ghost" onClick={() => navigate(`/portfolio/${personaId}/posts`)}>
                {t('persona.schedule.backToPosts')}
              </Button>
            }
          />

          <CreativePostWorkspace persona={persona} mode="schedule" />
        </>
      )}
    </PersonaShell>
  );
}
