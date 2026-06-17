import {
  createRuntimeAccountBrowserBroker,
  type AuthPlatformAdapter,
} from '@nimiplatform/kit/auth';
import { studioTauriOAuthBridge } from '../../bridge/index.js';
import {
  ensureStudioRuntimeClientReady,
} from '../../infra/studio-bootstrap.js';
import { getStudioNimiClient } from '../../infra/studio-nimi-client.js';
import {
  loadStudioRuntimeAccountUser,
  studioRuntimeAccountCaller,
  type StudioAuthUser,
} from '../../app-shell/studio-platform.js';

const STUDIO_EMBEDDED_AUTH_UNSUPPORTED =
  'Embedded auth flow is not supported in Realm Persona Studio desktop-browser mode.';

const STUDIO_TOKEN_PROXY_FORBIDDEN =
  'Realm Persona Studio does not own access/refresh token custody. Runtime is the sole owner; '
  + 'login through the desktop browser broker.';
const STUDIO_ACCOUNT_CONTROL_FORBIDDEN =
  'Realm Persona Studio is a first-party Studio app but cannot own Runtime account logout. '
  + 'Use the first-party Desktop account surface.';

function unsupported<T>(): Promise<T> {
  return Promise.reject(new Error(STUDIO_EMBEDDED_AUTH_UNSUPPORTED));
}

export async function loadCurrentUser(): Promise<StudioAuthUser | null> {
  await ensureStudioRuntimeClientReady();
  return loadStudioRuntimeAccountUser(getStudioNimiClient().runtime);
}

export async function logoutStudioRuntimeAccount(): Promise<void> {
  await ensureStudioRuntimeClientReady();
  throw new Error(STUDIO_ACCOUNT_CONTROL_FORBIDDEN);
}

/**
 * Adapter for the kit's `<DesktopShellAuthPage>` in Realm Persona Studio
 * desktop-browser mode. Account/session truth is owned by RuntimeAccountService;
 * this adapter intentionally rejects every app-owned token surface so a
 * regression that tries to flow a bearer or refresh token through the kit fails
 * fast.
 */
export function createStudioDesktopBrowserAuthAdapter(): AuthPlatformAdapter {
  return {
    checkEmail: unsupported,
    passwordLogin: unsupported,
    requestEmailOtp: unsupported,
    verifyEmailOtp: unsupported,
    verifyTwoFactor: unsupported,
    walletChallenge: unsupported,
    walletLogin: unsupported,
    oauthLogin: unsupported,
    updatePassword: unsupported,
    loadCurrentUser,
    applyToken: async () => {
      throw new Error(STUDIO_TOKEN_PROXY_FORBIDDEN);
    },
    persistSession: async () => {
      throw new Error(STUDIO_TOKEN_PROXY_FORBIDDEN);
    },
    clearPersistedSession: async () => {
      await logoutStudioRuntimeAccount();
    },
    oauthBridge: studioTauriOAuthBridge,
    syncAfterLogin: async () => {},
  };
}

/**
 * RuntimeAccountService browser broker for Studio desktop login. Pairs with
 * the kit's `performDesktopWebAuth` direct-to-loopback flow: runtime BeginLogin
 * returns a fully-formed realm OAuth authorize URL with PKCE S256 challenge
 * bound to runtime-held verifier; on user consent the realm 302-redirects
 * directly to the desktop loopback redirect_uri with a raw OAuth `code`;
 * runtime CompleteLogin exchanges the code with the realm token endpoint and
 * projects account material into runtime custody.
 *
 * The kit/desktop never observes access tokens or refresh tokens at any stage
 * of this flow.
 */
export function createStudioRuntimeAccountBrowserBroker() {
  const broker = createRuntimeAccountBrowserBroker({
    caller: studioRuntimeAccountCaller,
    beforeRequest: ensureStudioRuntimeClientReady,
    getClient: () => ({
      runtime: {
        account: getStudioNimiClient().runtime.account,
      },
    }),
    projectUser: (projection) => {
      const accountId = String(projection.accountId || '').trim();
      return accountId
        ? {
            id: accountId,
            displayName: String(projection.displayName || '').trim(),
          }
        : null;
    },
  });

  return {
    begin: broker.begin,
    complete: async (request: Parameters<typeof broker.complete>[0]) => {
      await broker.complete(request);
      const user = await loadCurrentUser();
      if (!user) {
        throw new Error('Runtime account login completed without a usable Runtime account session.');
      }
      return { user };
    },
  };
}
