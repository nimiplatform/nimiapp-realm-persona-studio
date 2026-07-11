import { useAppStore } from '../app-shell/app-store.js';
import {
  buildStudioNimiClient,
  clearStudioNimiClient,
  isStudioCapabilityUnavailable,
} from '../app-shell/studio-platform.js';
import { describeError, logRendererEvent } from './telemetry/renderer-log.js';
import { hasStudioNimiClient, setStudioNimiClient } from './studio-nimi-client.js';

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
  if (hasStudioNimiClient()) {
    return;
  }

  await runStudioBootstrap({ force: true });
  if (!hasStudioNimiClient()) {
    throw new Error('Realm Persona Studio Nimi client is unavailable after bootstrap retry');
  }
}

async function doRunStudioBootstrap(): Promise<void> {
  const store = useAppStore.getState();
  const flowId = `studio-bootstrap-${Date.now().toString(36)}`;

  try {
    clearStudioNimiClient();
    store.setBootstrapReady(false);
    store.setBootstrapError(null);

    const client = await buildStudioNimiClient();
    setStudioNimiClient(client);
    throw new Error('Realm Persona Studio protected installed client returned without an account projection.');
  } catch (error) {
    clearStudioNimiClient();
    if (isStudioCapabilityUnavailable(error)) {
      store.clearAuthSession();
      store.setBootstrapError(null);
      store.setBootstrapReady(true);
      return;
    }
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
