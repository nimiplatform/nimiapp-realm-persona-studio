import type { ReactNode } from 'react';
import { NimiAppSessionProvider, type NimiAppSession, type NimiAppSessionSnapshot } from '@nimiplatform/kit/auth/app';
import { StudioScopeProvider, type StudioScope } from '../shell/renderer/app-shell/studio-scope.js';

// Explicit component/operation fixtures only. They provide no Runtime bridge,
// approval or inference result; tests supply the actual exercised operation doubles.
export function createStudioTestScope(client: unknown = {}): StudioScope {
  return { client: client as StudioScope['client'], signal: new AbortController().signal, viewKey: 'unit-scope' };
}
export const studioTestScope = createStudioTestScope();
export function StudioTestProviders({ children, scope = studioTestScope }: { children: ReactNode; scope?: StudioScope }) {
  const snapshot: NimiAppSessionSnapshot = { identity: { status: 'signed-in', user: null, viewKey: 'unit-identity', signal: scope.signal },
    runtime: { status: 'connected', scope }, busy: 'none', issue: null, pendingRevocation: false };
  const session = { getSnapshot: () => snapshot, subscribe: () => () => {},
    account: { kind: 'home-managed', async openAccountOwner() { throw new Error('No native Home in this unit fixture.'); } },
  } as unknown as NimiAppSession;
  return <NimiAppSessionProvider session={session}><StudioScopeProvider scope={scope}>{children}</StudioScopeProvider></NimiAppSessionProvider>;
}
