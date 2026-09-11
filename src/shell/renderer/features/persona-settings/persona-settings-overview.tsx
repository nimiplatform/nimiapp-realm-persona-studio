import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { PersonaSettingsForm } from '@renderer/features/portfolio/OwnerPortfolio.settings.js';
import { useRefreshOwnerPersonaReads } from '@renderer/features/persona-detail/use-persona-detail-query.js';

export function PersonaSettingsOverview({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const refresh = useRefreshOwnerPersonaReads(persona.id);
  return <PersonaSettingsForm key={persona.id} persona={persona} onPersonaWrite={refresh} mode="page" />;
}
