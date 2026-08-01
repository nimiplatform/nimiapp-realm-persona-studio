import { useAppStore } from '../app-shell/app-store.js';
import {
  createStudioProtectedOperationUnavailableError,
  getStudioLocalAppClient,
} from '../app-shell/studio-platform.js';
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
  const store = useAppStore.getState();
  if (store.bootstrapReady) {
    return;
  }
  await runStudioBootstrap();
  const next = useAppStore.getState();
  if (!next.bootstrapReady) {
    throw new Error(next.bootstrapError || 'Realm Persona Studio bootstrap did not complete');
  }
}

export async function ensureStudioRuntimeClientReady(): Promise<void> {
  await ensureStudioBootstrapReady();
  throw createStudioProtectedOperationUnavailableError('Runtime client access');
}

async function doRunStudioBootstrap(): Promise<void> {
  const store = useAppStore.getState();
  const flowId = `studio-bootstrap-${Date.now().toString(36)}`;

  try {
    store.setBootstrapReady(false);
    store.setBootstrapError(null);
    store.clearAuthSession();

    const session = await getStudioLocalAppClient().auth.status();
    if (!session.sessionBound) {
      store.setBootstrapReady(true);
      return;
    }
    store.setProtectedSessionBound();
    store.setBootstrapReady(true);
  } catch (error) {
    store.clearAuthSession();
    const message = error instanceof Error ? error.message : String(error);
    logRendererEvent({
      level: 'error',
      area: 'studio-bootstrap',
      message: 'action:bootstrap-failed',
      flowId,
      details: { error: describeError(error) },
    });
    store.setBootstrapError(message);
    store.setBootstrapReady(false);
  }
}
