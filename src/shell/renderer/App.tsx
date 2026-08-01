import { HashRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { NimiToaster, TooltipProvider } from '@nimiplatform/kit/ui';
import { ShellErrorBoundary } from '@nimiplatform/kit/telemetry/error-boundary';
import { AppRoutes } from './app-shell/routes.js';
import { ShellLayout } from './app-shell/shell-layout.js';
import { AuthProvider } from './app-shell/auth-provider.js';
import { studioQueryClient } from './infra/query-client.js';
import { useStudioI18n } from './i18n/use-studio-i18n.js';

export function App() {
  const { t } = useStudioI18n();

  return (
    <ShellErrorBoundary
      appName={t('app.name')}
      fallbackTitle={t('shell.error.title')}
      fallbackHint={t('shell.error.hint')}
    >
      <QueryClientProvider client={studioQueryClient}>
        <TooltipProvider>
          <HashRouter>
            <AuthProvider>
              <ShellLayout>
                <AppRoutes />
              </ShellLayout>
            </AuthProvider>
          </HashRouter>
          <NimiToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ShellErrorBoundary>
  );
}
