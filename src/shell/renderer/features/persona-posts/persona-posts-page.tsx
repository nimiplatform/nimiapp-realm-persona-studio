import { useNavigate, useParams } from 'react-router-dom';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell, WorkspaceIntro } from '@renderer/features/persona-detail/persona-shell.js';
import { CreativePostWorkspace } from '@renderer/features/portfolio/OwnerPortfolio.posts.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

export function PersonaPostsPage() {
  const { t } = useStudioI18n();
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();

  if (!personaId) {
    return (
      <Surface tone="panel" material="glass-regular" padding="lg">
        <InlineAlert tone="danger">{t('common.personaIdMissing')}</InlineAlert>
      </Surface>
    );
  }

  return (
    <PersonaShell personaId={personaId} current="posts">
      {(persona) => (
        <>
          <WorkspaceIntro
            title={t('persona.posts.title')}
            badges={<StatusBadge tone="info">{t('common.workspace')}</StatusBadge>}
            description={t('persona.posts.description')}
            actions={
              <Button tone="secondary" onClick={() => navigate(`/portfolio/${personaId}/posts/schedule`)}>
                {t('persona.posts.openSchedule')}
              </Button>
            }
          />

          <CreativePostWorkspace persona={persona} mode="posts" />
        </>
      )}
    </PersonaShell>
  );
}
