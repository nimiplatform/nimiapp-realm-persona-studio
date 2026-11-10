import { createContext, useContext, type ReactNode } from 'react';
import type { NimiAppScope } from '@nimiplatform/kit/core/app-session';
export type StudioScope = NimiAppScope;
const Context = createContext<StudioScope | null>(null);
export function StudioScopeProvider({ scope, children }: { scope: StudioScope; children: ReactNode }) {
  return <Context.Provider value={scope}>{children}</Context.Provider>;
}
export function useStudioScope(): StudioScope {
  const scope = useContext(Context);
  if (!scope) throw new Error('StudioScopeProvider is required.');
  return scope;
}
