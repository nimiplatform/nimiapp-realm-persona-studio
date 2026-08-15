import { useCallback, useEffect, type ReactNode } from 'react';
import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { AmbientBackground, Button, InlineAlert, LoadingSkeleton, Surface } from '@nimiplatform/kit/ui';
import { useAppStore } from './app-store.js';
import { runStudioBootstrap } from '../infra/studio-bootstrap.js';
import { useStudioI18n } from '../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../i18n/studio-copy.js';
import type { StudioProtectedSessionState } from './protected-session-state.js';

const PROTECTED_SESSION_COPY = {
  'action-required': {
    title: 'shell.protectedSession.state.actionRequired.title',
    description: 'shell.protectedSession.state.actionRequired.description',
    action: 'shell.protectedSession.state.actionRequired.action',
  },
  'runtime-unavailable': {
    title: 'shell.protectedSession.state.runtimeUnavailable.title',
    description: 'shell.protectedSession.state.runtimeUnavailable.description',
    action: 'shell.protectedSession.state.runtimeUnavailable.action',
  },
  'access-denied': {
    title: 'shell.protectedSession.state.accessDenied.title',
    description: 'shell.protectedSession.state.accessDenied.description',
    action: 'shell.protectedSession.state.accessDenied.action',
  },
  'session-ended': {
    title: 'shell.protectedSession.state.sessionEnded.title',
    description: 'shell.protectedSession.state.sessionEnded.description',
    action: 'shell.protectedSession.state.sessionEnded.action',
  },
  'repair-required': {
    title: 'shell.protectedSession.state.repairRequired.title',
    description: 'shell.protectedSession.state.repairRequired.description',
    action: 'shell.protectedSession.state.repairRequired.action',
  },
  'capability-unavailable': {
    title: 'shell.protectedSession.state.capabilityUnavailable.title',
    description: 'shell.protectedSession.state.capabilityUnavailable.description',
    action: 'shell.protectedSession.state.capabilityUnavailable.action',
  },
} satisfies Record<StudioProtectedSessionState, {
  readonly title: StudioCopyKey;
  readonly description: StudioCopyKey;
  readonly action: StudioCopyKey;
}>;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useStudioI18n();
  const authStatus = useAppStore((s) => s.auth.status);
  const bootstrapReady = useAppStore((s) => s.bootstrapReady);
  const bootstrapError = useAppStore((s) => s.bootstrapError);
  const bootstrapFailure = useAppStore((s) => s.bootstrapFailure);

  useEffect(() => {
    void runStudioBootstrap();
  }, []);

  const retryBootstrap = useCallback(() => {
    void runStudioBootstrap({ force: true });
  }, []);

  if (bootstrapFailure) {
    const copy = PROTECTED_SESSION_COPY[bootstrapFailure.state];
    return (
      <BootstrapFrame>
        <Surface
          data-testid="persona-studio-protected-session-failure"
          data-protected-state={bootstrapFailure.state}
          tone="card"
          material="solid"
          elevation="raised"
          padding="md"
          className="ras-protected-session"
        >
          <div className="ras-protected-session__stack">
            <div className="ras-protected-session__heading">
              <div className="ras-protected-session__icon" aria-hidden="true">
                <ShieldAlert size={22} />
              </div>
              <div className="ras-protected-session__copy">
                <p className="ras-protected-session__eyebrow">{t('shell.protectedSession.eyebrow')}</p>
                <h1>{t(copy.title)}</h1>
                <p>{t(copy.description)}</p>
              </div>
            </div>

            <InlineAlert tone="warning" role="alert" icon={<LockKeyhole size={17} aria-hidden="true" />}>
              <strong>{t('shell.protectedSession.operationsLocked')}</strong>
            </InlineAlert>

            <div className="ras-protected-session__next-step">
              <strong>{t('shell.protectedSession.nextStep')}</strong>
              <span>{t(copy.action)}</span>
            </div>

            {bootstrapFailure.reasonCode || bootstrapFailure.actionHint ? (
              <details className="ras-bootstrap-technical-details">
                <summary>{t('shell.protectedSession.technicalDetails')}</summary>
                <div className="ras-protected-session__codes">
                  {bootstrapFailure.reasonCode ? (
                    <span><strong>{t('shell.protectedSession.reasonCode')}:</strong> {bootstrapFailure.reasonCode}</span>
                  ) : null}
                  {bootstrapFailure.actionHint ? (
                    <span><strong>{t('shell.protectedSession.actionHint')}:</strong> {bootstrapFailure.actionHint}</span>
                  ) : null}
                </div>
              </details>
            ) : null}

            <div className="ras-protected-session__actions">
              <Button
                data-testid="persona-studio-protected-session-retry"
                tone="secondary"
                onClick={retryBootstrap}
              >
                {t('shell.protectedSession.recheck')}
              </Button>
              <Button
                data-testid="persona-studio-protected-operations-locked"
                disabled
                tone="secondary"
                leadingIcon={<LockKeyhole size={16} aria-hidden="true" />}
              >
                {t('shell.protectedSession.operationsUnavailable')}
              </Button>
            </div>
          </div>
        </Surface>
      </BootstrapFrame>
    );
  }

  if (bootstrapError) {
    return (
      <BootstrapFrame>
        <InlineAlert
          tone="danger"
          action={<Button tone="secondary" size="sm" onClick={retryBootstrap}>{t('common.retry')}</Button>}
        >
          <div className="ras-bootstrap-copy">
            <strong>{t('shell.bootstrap.failed')}</strong>
            <details className="ras-bootstrap-technical-details">
              <summary>{t('shell.bootstrap.technicalDetails')}</summary>
              <span>{bootstrapError}</span>
            </details>
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
        <InlineAlert tone="info">
          <div className="ras-bootstrap-copy">
            <strong>{t('shell.nimiAccess.requiredTitle')}</strong>
            <span>{t('shell.nimiAccess.requiredReason')}</span>
            <div className="ras-bootstrap-actions">
              <Button tone="secondary" size="sm" disabled>
                {t('shell.nimiAccess.operationsUnavailable')}
              </Button>
              <Button tone="secondary" size="sm" onClick={retryBootstrap}>{t('common.retry')}</Button>
            </div>
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
