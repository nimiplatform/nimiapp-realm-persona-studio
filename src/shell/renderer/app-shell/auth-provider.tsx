import { useCallback, useEffect, type ReactNode } from 'react';
import { AmbientBackground, Button, InlineAlert, LoadingSkeleton, Surface } from '@nimiplatform/kit/ui';
import { useAppStore } from './app-store.js';
import { runStudioBootstrap } from '../infra/studio-bootstrap.js';
import { useStudioI18n } from '../i18n/use-studio-i18n.js';

const INSTALLED_APP_AUTH_REQUIRED_TITLE = 'Desktop shared Runtime account required';
const INSTALLED_APP_AUTH_REQUIRED_REASON = 'capability-unavailable';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useStudioI18n();
  const authStatus = useAppStore((s) => s.auth.status);
  const bootstrapReady = useAppStore((s) => s.bootstrapReady);
  const bootstrapError = useAppStore((s) => s.bootstrapError);

  useEffect(() => {
    void runStudioBootstrap();
  }, []);

  const retryBootstrap = useCallback(() => {
    void runStudioBootstrap({ force: true });
  }, []);

  if (bootstrapError) {
    return (
      <BootstrapFrame>
        <InlineAlert
          tone="danger"
          action={<Button tone="secondary" size="sm" onClick={retryBootstrap}>{t('common.retry')}</Button>}
        >
          <div className="ras-bootstrap-copy">
            <strong>{t('shell.bootstrap.failed')}</strong>
            <span>{bootstrapError}</span>
          </div>
        </InlineAlert>
      </BootstrapFrame>
    );
  }

  if (!bootstrapReady || authStatus === 'bootstrapping') {
    return (
      <BootstrapFrame>
        <div className="ras-entry-fallback__title">{t('app.name')}</div>
        <LoadingSkeleton lines={2} aria-label={t('shell.entry.opening')} />
      </BootstrapFrame>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <BootstrapFrame>
        <InlineAlert tone="warning">
          <div className="ras-bootstrap-copy">
            <strong>{INSTALLED_APP_AUTH_REQUIRED_TITLE}</strong>
            <span>
              {INSTALLED_APP_AUTH_REQUIRED_REASON}: launch Realm Persona Studio from an authenticated Nimi Desktop installed app session.
            </span>
          </div>
        </InlineAlert>
      </BootstrapFrame>
    );
  }

  return <>{children}</>;
}

function BootstrapFrame({ children }: { children: ReactNode }) {
  return (
    <AmbientBackground variant="mesh" className="ras-entry-fallback">
      <Surface tone="panel" padding="lg" className="ras-entry-fallback__panel">
        {children}
      </Surface>
    </AmbientBackground>
  );
}
