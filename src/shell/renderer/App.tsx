import { useEffect, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { NimiAppAccessGate } from '@nimiplatform/kit/auth/app';
import { NimiThemeProvider, NimiToaster, TooltipProvider, LoadingSkeleton } from '@nimiplatform/kit/ui';
import { ShellErrorBoundary } from '@nimiplatform/kit/telemetry/error-boundary';
import type { NimiThemeScheme } from '@nimiplatform/kit/ui';
import { AppRoutes } from './app-shell/routes.js';
import { ShellLayout } from './app-shell/shell-layout.js';
import { StudioScopeProvider, type StudioScope } from './app-shell/studio-scope.js';
import { createStudioQueryClient } from './infra/query-client.js';
import { useStudioI18n } from './i18n/use-studio-i18n.js';
import { StudioNavigationGuardProvider } from './app-shell/studio-navigation-guard.js';
import { readStoredThemeScheme } from './app-shell/theme-scheme.js';

export function App() {
  const { t, locale } = useStudioI18n();
  return <ShellErrorBoundary appName={t('app.name')} fallbackTitle={t('shell.error.title')} fallbackHint={t('shell.error.hint')}>
    <NimiAppAccessGate title={t('app.name')} language={locale}>{scope => <ConnectedStudio scope={scope} />}</NimiAppAccessGate>
  </ShellErrorBoundary>;
}
function ConnectedStudio({ scope }: { scope: StudioScope }) {
  const { t } = useStudioI18n();
  const [scheme, setScheme] = useState<NimiThemeScheme | null>(null);
  const [queryClient] = useState(createStudioQueryClient);
  const [router] = useState(() => createHashRouter([{ path: '*', element: <StudioNavigationGuardProvider><ShellLayout><AppRoutes /></ShellLayout></StudioNavigationGuardProvider> }]));
  useEffect(() => {
    let live = true;
    void readStoredThemeScheme(scope).then(value => { if (live && !scope.signal.aborted) setScheme(value ?? 'light'); });
    return () => { live = false; void queryClient.cancelQueries(); queryClient.clear(); router.dispose(); history.replaceState(history.state, '', location.pathname + location.search); };
  }, [scope, queryClient, router]);
  if (!scheme) return <LoadingSkeleton lines={2} aria-label={t('shell.entry.loading')} />;
  return <StudioScopeProvider scope={scope}><NimiThemeProvider accentPack="nimi-accent" defaultScheme={scheme} defaultDensity="compact">
    <QueryClientProvider client={queryClient}><TooltipProvider><RouterProvider router={router} /><NimiToaster /></TooltipProvider></QueryClientProvider>
  </NimiThemeProvider></StudioScopeProvider>;
}
