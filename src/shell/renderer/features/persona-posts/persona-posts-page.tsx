import { useParams } from 'react-router-dom';
import { InlineAlert, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell } from '@renderer/features/persona-detail/persona-shell.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import { PersonaPostEditor } from './persona-post-editor.js';

export function PersonaPostsPage() {
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
      {(persona, visualData) => <PersonaPostEditor persona={persona} visualData={visualData} />}
    </PersonaShell>
  );
}
