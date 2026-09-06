import { useParams } from 'react-router-dom';
import { InlineAlert, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell } from '@renderer/features/persona-detail/persona-shell.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import { PersonaSettingsOverview } from './persona-settings-overview.js';

function PersonaSettingsPageForScope() {
  const { t } = useStudioI18n();
  const { personaId } = useParams<{ personaId: string }>();

  if (!personaId) {
    return (
      <Surface tone="card" padding="lg">
        <InlineAlert tone="danger">{t('common.personaIdMissing')}</InlineAlert>
      </Surface>
    );
  }

  return (
    <PersonaShell personaId={personaId} current="settings">
      {(persona) => <PersonaSettingsOverview persona={persona} />}
    </PersonaShell>
  );
}

export function PersonaSettingsPage() {
  return <PersonaSettingsPageForScope />;
}
