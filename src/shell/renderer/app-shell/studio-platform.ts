import {
  createInstalledNimiAppBootstrap,
  createNimiClient,
  type NimiClient,
} from '@nimiplatform/sdk';
import { AccountSessionState, type AccountProjection } from '@nimiplatform/sdk/runtime/generated';
import { Runtime, type NimiRuntimeAccountCaller, type RuntimeOptions } from '@nimiplatform/sdk/runtime';
import { createNimiError } from '@nimiplatform/sdk/types';
import {
  createInstalledNimiAppStandardShellSurface,
  hasElectronRuntime,
  hasTauriRuntime,
  readInstalledNimiAppLaunchBinding,
} from '../bridge/index.js';
import { createStudioRealmBridgeOptions } from './studio-realm-transport.js';
import { getStudioNimiClient, setStudioNimiClient } from '../infra/studio-nimi-client.js';

export const STUDIO_RUNTIME_APP_ID = 'nimi.realm-persona-studio';
export const STUDIO_CAPABILITY_UNAVAILABLE_REASON = 'capability-unavailable';

let currentStudioRuntimeAccountCaller: NimiRuntimeAccountCaller | null = null;

export type StudioAuthUser = {
  id: string;
  displayName: string;
};

export function normalizeStudioAccountProjection(
  projection: AccountProjection | null | undefined,
): StudioAuthUser | null {
  const accountId = String(projection?.accountId || '').trim();
  if (!accountId) {
    return null;
  }
  return {
    id: accountId,
    displayName: String(projection?.displayName || accountId).trim(),
  };
}

export function getCurrentStudioRuntimeAccountCaller(): NimiRuntimeAccountCaller {
  if (!currentStudioRuntimeAccountCaller) {
    throw createCapabilityUnavailableError(
      'Realm Persona Studio Runtime account caller is unavailable.',
      'launch_realm_persona_studio_from_desktop_installed_app_host',
    );
  }
  return currentStudioRuntimeAccountCaller;
}

export async function loadStudioRuntimeAccountUser(
  runtime: Runtime,
  caller: NimiRuntimeAccountCaller = getCurrentStudioRuntimeAccountCaller(),
): Promise<StudioAuthUser | null> {
  const response = await runtime.account.getAccountSessionStatus({ caller });
  if (response.state !== AccountSessionState.AUTHENTICATED) {
    return null;
  }
  return normalizeStudioAccountProjection(response.accountProjection);
}

function studioRuntimeOptions(): RuntimeOptions {
  return {
    appId: STUDIO_RUNTIME_APP_ID,
    metadata: {
      callerId: STUDIO_RUNTIME_APP_ID,
      surfaceId: 'realm-persona-studio',
    },
    transport: runtimeTransportOptions(),
  };
}

function runtimeTransportOptions(): RuntimeOptions['transport'] {
  if (hasElectronRuntime()) {
    return { type: 'electron-ipc' };
  }
  if (hasTauriRuntime()) {
    return {
      type: 'tauri-ipc',
      commandNamespace: 'runtime_bridge',
      eventNamespace: 'runtime_bridge',
    };
  }
  throw createCapabilityUnavailableError(
    'Realm Persona Studio requires an installed app Runtime bridge.',
    'launch_realm_persona_studio_from_desktop_installed_app_host',
  );
}

export async function buildStudioNimiClient(): Promise<NimiClient> {
  const standardShell = createInstalledNimiAppStandardShellSurface();
  const launchBinding = readInstalledNimiAppLaunchBinding();
  if (launchBinding.appId !== STUDIO_RUNTIME_APP_ID) {
    throw createCapabilityUnavailableError(
      `Realm Persona Studio received launch binding for ${launchBinding.appId}.`,
      'launch_matching_realm_persona_studio_app_id',
    );
  }
  const realmBaseUrl = requireHostProjectedRealmBaseUrl(launchBinding.realmBaseUrl);
  const runtime = new Runtime(studioRuntimeOptions());
  const bootstrap = createInstalledNimiAppBootstrap({
    realmBaseUrl,
    runtime,
    launchBinding,
    standardShell,
  });
  currentStudioRuntimeAccountCaller = bootstrap.accountCaller;
  const client = createNimiClient({
    appId: STUDIO_RUNTIME_APP_ID,
    runtime: bootstrap.runtime,
    realm: createStudioRealmBridgeOptions(realmBaseUrl, bootstrap.runtime, bootstrap.accountCaller),
    app: false,
    permissions: false,
  });
  await client.runtime.ready();
  return client;
}

export function getCurrentStudioNimiClient(): NimiClient {
  return getStudioNimiClient();
}

export function clearStudioNimiClient(): void {
  currentStudioRuntimeAccountCaller = null;
  setStudioNimiClient(null);
}

function requireHostProjectedRealmBaseUrl(value: unknown): string {
  const realmBaseUrl = String(value || '').trim();
  if (!realmBaseUrl) {
    throw createCapabilityUnavailableError(
      'Realm Persona Studio requires host-projected Realm base URL.',
      'provide_installed_app_realm_base_url_projection',
    );
  }
  return realmBaseUrl;
}

function createCapabilityUnavailableError(message: string, actionHint: string): Error {
  return createNimiError({
    message,
    reasonCode: STUDIO_CAPABILITY_UNAVAILABLE_REASON,
    actionHint,
    source: 'sdk',
  });
}
