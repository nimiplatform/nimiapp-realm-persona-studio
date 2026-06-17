// Studio mirrors parentos PO-SHELL-008 / K-ACCSVC-008: the app does not own
// access/refresh token custody. Auth session storage commands and token
// exchange commands stay disabled at the host layer and are not re-exported
// here.
export {
  hasTauriInvoke,
  invoke,
  invokeChecked,
  BridgeError,
  getDaemonStatus,
  oauthListenForCode,
  openExternalUrl,
  focusMainWindow,
  parseRuntimeBridgeDaemonStatus,
  hasTauriRuntime,
  invokeTauri,
} from '@nimiplatform/kit/shell/renderer/bridge';
export type {
  RuntimeBridgeDaemonStatus,
  JsonValue,
  JsonObject,
  JsonPrimitive,
} from '@nimiplatform/kit/shell/renderer/bridge';

import type { TauriOAuthBridge } from '@nimiplatform/kit/core/oauth';
import {
  focusMainWindow,
  hasTauriInvoke,
  oauthListenForCode,
  openExternalUrl,
} from '@nimiplatform/kit/shell/renderer/bridge';

export const STUDIO_TOKEN_EXCHANGE_FORBIDDEN =
  'Realm Persona Studio does not expose OAuth token exchange; Runtime account service owns token custody.';

export type StudioRuntimeDefaults = {
  readonly realm: {
    readonly realmBaseUrl: string | null;
  } | null;
};

function readEnv(name: string): string {
  const importMetaEnv = (import.meta as { env?: Record<string, string> }).env;
  const processEnv =
    typeof globalThis.process !== 'undefined'
      ? ((globalThis.process as { env?: Record<string, string> }).env ?? {})
      : {};
  return String(importMetaEnv?.[name] || processEnv[name] || '').trim();
}

function normalizeLoopbackHttpUrl(rawValue: string, defaultPort: number): string {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const host = String(parsed.hostname || '').toLowerCase();
    const hasExplicitPort = String(parsed.port || '').trim().length > 0;
    const isLoopbackHttp = parsed.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1');
    if (isLoopbackHttp && !hasExplicitPort) {
      parsed.port = String(defaultPort);
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return value.replace(/\/+$/, '');
  }
}

export async function getStudioRuntimeDefaults(): Promise<StudioRuntimeDefaults> {
  const realmBaseUrl = normalizeLoopbackHttpUrl(
    readEnv('NIMI_REALM_URL') || readEnv('VITE_NIMI_REALM_BASE_URL') || 'http://localhost:3002',
    3002,
  ) || null;
  return {
    realm: {
      realmBaseUrl,
    },
  };
}

export const studioTauriOAuthBridge: TauriOAuthBridge = {
  hasTauriInvoke,
  oauthListenForCode,
  openExternalUrl,
  focusMainWindow,
  oauthTokenExchange: async () => {
    throw new Error(STUDIO_TOKEN_EXCHANGE_FORBIDDEN);
  },
};
