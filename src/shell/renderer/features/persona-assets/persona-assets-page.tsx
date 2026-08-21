import { useParams } from 'react-router-dom';
import { InlineAlert, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell } from '@renderer/features/persona-detail/persona-shell.js';
import { MediaVoiceCandidateWorkspace } from '@renderer/features/portfolio/OwnerPortfolio.assets.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

function PersonaAssetsPageForScope() {
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
    <PersonaShell personaId={personaId} current="assets">
      {(persona, visualData) => (
        <MediaVoiceCandidateWorkspace
          persona={persona}
          developmentVisualData={visualData}
        />
      )}
    </PersonaShell>
  );
}

export function PersonaAssetsPage() {
  return <PersonaAssetsPageForScope />;
}
