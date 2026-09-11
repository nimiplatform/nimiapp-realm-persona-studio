import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-client.js';
import type { OwnerPortfolioPersona } from '@renderer/features/portfolio/portfolio-data.js';

export type PersonaDetailReadScope = 'owner';

export function ownerPersonaDetailQueryKey(personaId: string): readonly unknown[] {
  return ['realm-persona-studio', 'owner-portfolio-persona-detail', personaId] as const;
}

export function ownerPortfolioListQueryKey(): readonly unknown[] {
  return ['realm-persona-studio', 'owner-portfolio'] as const;
}

export function personaDetailQueryKey(personaId: string, _scope: PersonaDetailReadScope): readonly unknown[] {
  return ownerPersonaDetailQueryKey(personaId);
}

export function usePersonaDetailQuery(
  personaId: string,
  scope: PersonaDetailReadScope = 'owner',
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: personaDetailQueryKey(personaId, scope),
    queryFn: () => getOwnerPortfolioPersonaDetail(personaId),
    enabled: personaId.length > 0 && options.enabled !== false,
  });
}

export function useOwnerPersonaDetailQuery(personaId: string) {
  return usePersonaDetailQuery(personaId, 'owner');
}

export function useRefreshPersonaReads(personaId: string, scope: PersonaDetailReadScope = 'owner') {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: personaDetailQueryKey(personaId, scope) }),
      queryClient.invalidateQueries({ queryKey: ownerPortfolioListQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ['realm-persona-studio', 'owner-persona-visibility', personaId] }),
    ]);
  };
}

export function useRefreshOwnerPersonaReads(personaId: string) {
  return useRefreshPersonaReads(personaId, 'owner');
}

// @nimi-authority: rule.realm-persona-studio.acceptance.r003
export async function removeDeletedOwnerPersonaReads(
  queryClient: QueryClient,
  personaId: string,
): Promise<void> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: ownerPersonaDetailQueryKey(personaId), exact: true }),
    queryClient.cancelQueries({ queryKey: ownerPortfolioListQueryKey(), exact: true }),
  ]);
  queryClient.removeQueries({
    queryKey: ownerPersonaDetailQueryKey(personaId),
    exact: true,
  });
  queryClient.setQueryData<OwnerPortfolioPersona[]>(
    ownerPortfolioListQueryKey(),
    (current) => current?.filter((persona) => persona.id !== personaId),
  );
  void queryClient.invalidateQueries({
    queryKey: ownerPortfolioListQueryKey(),
    exact: true,
    refetchType: 'active',
  });
}
