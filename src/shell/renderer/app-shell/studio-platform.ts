import {
  createNimiClient,
  type NimiClient,
} from '@nimiplatform/sdk';
import {
  AccountSessionState,
  AuthorizationPreset,
  ExternalPrincipalType,
  PolicyMode,
  type AccountProjection,
  type AuthorizeExternalPrincipalResponse,
} from '@nimiplatform/sdk/runtime/generated';
import {
  Runtime,
  createNimiLocalFirstPartyRuntimeAccountCaller,
  createNimiRuntimeAppSessionMetadataProvider,
  createNimiRuntimeFullAppRegistration,
  toNimiRuntimeTimestamp,
  withNimiRuntimeIdempotencyMetadata,
  type NimiRuntimeAccountCaller,
  type RuntimeOptions,
} from '@nimiplatform/sdk/runtime';
import { createNimiClientId, createNimiError, ReasonCode, type CoreMetadata } from '@nimiplatform/sdk/types';
import { createStudioRealmBridgeOptions } from './studio-realm-transport.js';
import { getStudioNimiClient, setStudioNimiClient } from '../infra/studio-nimi-client.js';

// Studio is a Nimi first-party local Runtime account/session consumer. Runtime
// owns login custody, app sessions, and protected access metadata. Raw Realm
// account tokens are not exposed here.
export const STUDIO_RUNTIME_APP_ID = 'nimi.realm-persona-studio';
export const STUDIO_RUNTIME_APP_INSTANCE_ID = `${STUDIO_RUNTIME_APP_ID}.local-first-party`;
export const STUDIO_RUNTIME_DEVICE_ID = 'local-first-party-device';

const STUDIO_RUNTIME_APP_SESSION_INSTANCE_ID = `${STUDIO_RUNTIME_APP_ID}.platform-runtime-session`;
const STUDIO_RUNTIME_APP_SESSION_DEVICE_ID = 'platform-runtime-session';
const STUDIO_RUNTIME_APP_SESSION_TTL_SECONDS = 3600;
const STUDIO_RUNTIME_APP_SESSION_REFRESH_SKEW_MS = 30_000;
const STUDIO_RUNTIME_PROTECTED_SCOPES = ['ai.spend.meter'] as const;
const STUDIO_RUNTIME_PROTECTED_SCOPE_CATALOG_VERSION = 'sdk-v2';
const STUDIO_RUNTIME_PROTECTED_TOKEN_TTL_SECONDS = 3600;
const STUDIO_RUNTIME_PROTECTED_TOKEN_REFRESH_SKEW_MS = 60_000;
const STUDIO_RUNTIME_PROTECTED_CONSENT_ID = 'realm-persona-studio-runtime-account';
const STUDIO_RUNTIME_DEVELOPER_REGISTRATION = false;
export const STUDIO_REALM_API_SCOPES = [
  'realm.me.agents.read',
  'realm.me.agents.write',
  'realm.worlds.read',
  'realm.posts.write',
] as const;

export const studioRuntimeAccountCaller: NimiRuntimeAccountCaller =
  createNimiLocalFirstPartyRuntimeAccountCaller({
    appId: STUDIO_RUNTIME_APP_ID,
    appInstanceId: STUDIO_RUNTIME_APP_INSTANCE_ID,
    deviceId: STUDIO_RUNTIME_DEVICE_ID,
    scopes: [...STUDIO_REALM_API_SCOPES],
  });

let protectedAccessCache: {
  readonly subjectUserId: string;
  readonly metadata: CoreMetadata;
  readonly expiresAtMs: number;
} | null = null;
let protectedAccessInflight: Promise<{
  readonly subjectUserId: string;
  readonly metadata: CoreMetadata;
  readonly expiresAtMs: number;
}> | null = null;

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

export async function loadStudioRuntimeAccountUser(runtime: Runtime): Promise<StudioAuthUser | null> {
  const response = await runtime.account.getAccountSessionStatus({
    caller: studioRuntimeAccountCaller,
  });
  if (response.state !== AccountSessionState.AUTHENTICATED) {
    return null;
  }
  return normalizeStudioAccountProjection(response.accountProjection);
}

function studioRuntimeOptions(authMetadata?: () => Promise<CoreMetadata>): RuntimeOptions {
  return {
    appId: STUDIO_RUNTIME_APP_ID,
    metadata: {
      callerId: STUDIO_RUNTIME_APP_ID,
      surfaceId: 'realm-persona-studio',
    },
    ...(authMetadata ? { authMetadata } : {}),
    transport: {
      type: 'tauri-ipc',
      commandNamespace: 'runtime_bridge',
      eventNamespace: 'runtime_bridge',
    },
  };
}

async function registerStudioRuntimeAccountCaller(accountRuntime: Runtime): Promise<void> {
  await createNimiRuntimeFullAppRegistration(
    () => ({ auth: accountRuntime.auth }),
    {
      appId: STUDIO_RUNTIME_APP_ID,
      appInstanceId: studioRuntimeAccountCaller.appInstanceId,
      deviceId: studioRuntimeAccountCaller.deviceId,
      capabilities: [...STUDIO_RUNTIME_PROTECTED_SCOPES],
      developerRegistration: STUDIO_RUNTIME_DEVELOPER_REGISTRATION,
      rejectionLabel: 'Realm Persona Studio Runtime account caller registration rejected',
    },
  )();
}

function createStudioRuntimeAuthMetadataProvider(accountRuntime: Runtime): () => Promise<CoreMetadata> {
  const requiredRuntimeSessionMetadata = createNimiRuntimeAppSessionMetadataProvider({
    appId: STUDIO_RUNTIME_APP_ID,
    appInstanceId: STUDIO_RUNTIME_APP_SESSION_INSTANCE_ID,
    deviceId: STUDIO_RUNTIME_APP_SESSION_DEVICE_ID,
    ttlSeconds: STUDIO_RUNTIME_APP_SESSION_TTL_SECONDS,
    refreshSkewMs: STUDIO_RUNTIME_APP_SESSION_REFRESH_SKEW_MS,
    capabilities: [...STUDIO_RUNTIME_PROTECTED_SCOPES],
    developerRegistration: STUDIO_RUNTIME_DEVELOPER_REGISTRATION,
    auth: accountRuntime.auth,
  });
  return async () => {
    const session = await accountRuntime.account.getAccountSessionStatus({
      caller: studioRuntimeAccountCaller,
    });
    if (session.state !== AccountSessionState.AUTHENTICATED || !session.accountProjection?.accountId) {
      return {};
    }
    const appSessionMetadata = await requiredRuntimeSessionMetadata();
    const protectedAccessMetadata = await getStudioRuntimeProtectedAccessMetadata(
      accountRuntime,
      session.accountProjection.accountId,
    );
    return {
      ...appSessionMetadata,
      ...protectedAccessMetadata,
    };
  };
}

async function getStudioRuntimeProtectedAccessMetadata(
  accountRuntime: Runtime,
  subjectUserId: string,
): Promise<CoreMetadata> {
  if (
    protectedAccessCache
    && protectedAccessCache.subjectUserId === subjectUserId
    && protectedAccessCache.expiresAtMs - Date.now() > STUDIO_RUNTIME_PROTECTED_TOKEN_REFRESH_SKEW_MS
  ) {
    return protectedAccessCache.metadata;
  }
  protectedAccessInflight ??= issueStudioRuntimeProtectedAccessMetadata(accountRuntime, subjectUserId);
  try {
    protectedAccessCache = await protectedAccessInflight;
    return protectedAccessCache.metadata;
  } finally {
    protectedAccessInflight = null;
  }
}

async function issueStudioRuntimeProtectedAccessMetadata(
  accountRuntime: Runtime,
  subjectUserId: string,
): Promise<{
  readonly subjectUserId: string;
  readonly metadata: CoreMetadata;
  readonly expiresAtMs: number;
}> {
  const token = await accountRuntime.grants.authorizeExternalPrincipal({
    domain: 'app-auth',
    appId: STUDIO_RUNTIME_APP_ID,
    externalPrincipalId: STUDIO_RUNTIME_APP_ID,
    externalPrincipalType: ExternalPrincipalType.APP,
    subjectUserId,
    consentId: STUDIO_RUNTIME_PROTECTED_CONSENT_ID,
    consentVersion: 'v1',
    decisionAt: toNimiRuntimeTimestamp(new Date()),
    policyVersion: 'realm-persona-studio-runtime-account-v1',
    policyMode: PolicyMode.CUSTOM,
    preset: AuthorizationPreset.UNSPECIFIED,
    scopes: [...STUDIO_RUNTIME_PROTECTED_SCOPES],
    resourceSelectors: {
      conversationIds: [],
      messageIds: [],
      documentIds: [],
      labels: {},
    },
    canDelegate: false,
    maxDelegationDepth: 0,
    ttlSeconds: STUDIO_RUNTIME_PROTECTED_TOKEN_TTL_SECONDS,
    scopeCatalogVersion: STUDIO_RUNTIME_PROTECTED_SCOPE_CATALOG_VERSION,
    policyOverride: false,
  }, withNimiRuntimeIdempotencyMetadata({
    metadata: { domain: 'app-auth' },
  }, createNimiClientId(`realm-persona-studio-runtime-protected-${sanitizeProtectedAccessId(subjectUserId)}`)));
  const tokenId = normalizeStudioText(token.tokenId);
  const secret = normalizeStudioText(token.secret);
  if (!tokenId || !secret) {
    throw createNimiError({
      message: 'Realm Persona Studio Runtime protected access token response is missing credentials.',
      reasonCode: ReasonCode.PRINCIPAL_UNAUTHORIZED,
      actionHint: 'authorize_studio_runtime_protected_access',
      source: 'runtime',
    });
  }
  return {
    subjectUserId,
    metadata: {
      'x-nimi-access-token-id': tokenId,
      'x-nimi-access-token-secret': secret,
    },
    expiresAtMs: runtimeTimestampMillis(token) || Date.now() + (STUDIO_RUNTIME_PROTECTED_TOKEN_TTL_SECONDS * 1000),
  };
}

function runtimeTimestampMillis(token: AuthorizeExternalPrincipalResponse): number {
  const expiresAt = token.expiresAt;
  if (!expiresAt) {
    return 0;
  }
  const seconds = Number(expiresAt.seconds || 0);
  const nanos = Number(expiresAt.nanos || 0);
  const millis = (seconds * 1000) + Math.floor(nanos / 1_000_000);
  return Number.isFinite(millis) && millis > 0 ? millis : 0;
}

function sanitizeProtectedAccessId(subjectUserId: string): string {
  return subjectUserId.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 80) || 'unknown';
}

function normalizeStudioText(value: unknown): string {
  return String(value || '').trim();
}

export async function buildStudioNimiClient(options: { realmBaseUrl?: string | null } = {}): Promise<NimiClient> {
  const realmBaseUrl = normalizeStudioText(options.realmBaseUrl);
  if (!realmBaseUrl) {
    throw createNimiError({
      message: 'Realm Persona Studio Realm base URL is unavailable from Runtime defaults.',
      reasonCode: ReasonCode.SDK_REALM_BASE_URL_REQUIRED,
      actionHint: 'provide_studio_runtime_realm_defaults',
      source: 'sdk',
    });
  }
  const accountRuntime = new Runtime(studioRuntimeOptions());
  await accountRuntime.ready();
  await registerStudioRuntimeAccountCaller(accountRuntime);
  const runtime = new Runtime(studioRuntimeOptions(
    createStudioRuntimeAuthMetadataProvider(accountRuntime),
  ));
  const client = createNimiClient({
    appId: STUDIO_RUNTIME_APP_ID,
    runtime,
    realm: createStudioRealmBridgeOptions(realmBaseUrl, accountRuntime, studioRuntimeAccountCaller),
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
  protectedAccessCache = null;
  protectedAccessInflight = null;
  setStudioNimiClient(null);
}
