import { useAppStore } from '../app-shell/app-store.js';
import { classifyStudioProtectedSessionFailure } from '../app-shell/protected-session-state.js';
import { getStudioLocalAppClient } from '../app-shell/studio-platform.js';
import { describeError, logRendererEvent } from './telemetry/renderer-log.js';

let bootstrapPromise: Promise<void> | null = null;

export async function runStudioBootstrap(options: { force?: boolean } = {}): Promise<void> {
  if (bootstrapPromise && !options.force) {
    return bootstrapPromise;
  }
  if (options.force) {
    bootstrapPromise = null;
  }
  bootstrapPromise = doRunStudioBootstrap().finally(() => {
    if (!useAppStore.getState().bootstrapReady) {
      bootstrapPromise = null;
    }
  });
  return bootstrapPromise;
}

export async function ensureStudioBootstrapReady(): Promise<void> {
  if (!useAppStore.getState().bootstrapReady) {
    await runStudioBootstrap();
  }
  const state = useAppStore.getState();
  if (!state.bootstrapReady) {
    throw new Error(
      state.bootstrapFailure?.message
      || state.bootstrapError
      || 'The protected Realm Persona Studio operation set is unavailable.',
    );
  }
}

async function doRunStudioBootstrap(): Promise<void> {
  const store = useAppStore.getState();
  const flowId = `studio-bootstrap-${Date.now().toString(36)}`;

  store.setBootstrapReady(false);
  store.setBootstrapError(null);
  store.setBootstrapFailure(null);
  store.clearAuthSession();

  try {
    const session = await getStudioLocalAppClient().auth.status();
    if (!session.sessionBound) {
      throw Object.assign(
        new Error('Realm Persona Studio Desktop-supervised local-app session is not bound.'),
        {
          reasonCode: session.reasonCode,
          actionHint: session.actionHint,
          source: 'sdk',
        },
      );
    }
    store.setProtectedSessionBound();
    store.setBootstrapReady(true);
  } catch (error) {
    const failure = classifyStudioProtectedSessionFailure(error);
    logRendererEvent({
      level: 'warn',
      area: 'studio-bootstrap.protected-session',
      message: 'action:protected-session-unavailable',
      flowId,
      details: {
        error: describeError(error),
        reasonCode: failure.reasonCode,
        actionHint: failure.actionHint,
        state: failure.state,
      },
    });
    store.setBootstrapFailure(failure);
    store.setBootstrapError(failure.message);
    store.setBootstrapReady(false);
  }
}
