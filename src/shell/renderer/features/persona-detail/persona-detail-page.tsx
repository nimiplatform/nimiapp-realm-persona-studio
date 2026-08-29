import { useParams } from 'react-router-dom';
import { InlineAlert, Surface } from '@nimiplatform/kit/ui';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import { PersonaCockpit } from './persona-cockpit.js';
import { PersonaShell } from './persona-shell.js';

function PersonaDetailPageForScope() {
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
    <PersonaShell personaId={personaId} current="detail">
      {(persona) => (
        <PersonaCockpit persona={persona} />
      )}
    </PersonaShell>
  );
}

export function PersonaDetailPage() {
  return <PersonaDetailPageForScope />;
}
