import { useNavigate } from 'react-router-dom';
import { CreateRealmPersonaWorkspace } from '@renderer/features/portfolio/CreateRealmPersonaWorkspace.js';

export function PersonaCreatePage() {
  const navigate = useNavigate();

  return (
    <CreateRealmPersonaWorkspace
      onOpenCreatedPersona={(personaId) => {
        navigate(`/portfolio/${personaId}/settings`);
      }}
    />
  );
}
