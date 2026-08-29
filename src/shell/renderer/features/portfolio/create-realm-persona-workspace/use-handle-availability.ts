import { useQuery } from '@tanstack/react-query';
import type { NormalizedRealmPersonaHandleAvailability } from '../create-persona-draft.js';
import {
  checkCreateRealmPersonaHandleAvailability,
  type RealmPersonaHandleAvailabilityResult,
} from '../portfolio-client.js';

/**
 * Polls owner-portfolio handle availability for the current normalized handle.
 * The query is disabled for an empty handle; the badge keeps its pending tone.
 */
export function useHandleAvailability(normalizedHandle: string): {
  query: {
    isFetching: boolean;
    isError: boolean;
    data?: RealmPersonaHandleAvailabilityResult;
  };
  availability: NormalizedRealmPersonaHandleAvailability | null;
} {
  const query = useQuery<RealmPersonaHandleAvailabilityResult>({
    queryKey: ['realm-persona-studio', 'create-persona-handle-availability', normalizedHandle],
    queryFn: () => checkCreateRealmPersonaHandleAvailability(normalizedHandle),
    enabled: normalizedHandle.length > 0,
  });
  const availability = query.data?.ok ? query.data.availability : null;
  return { query, availability };
}
