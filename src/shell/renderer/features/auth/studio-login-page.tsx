import { useMemo, useState } from 'react';
import { DesktopShellAuthPage } from '@nimiplatform/kit/auth';
import '@nimiplatform/kit/auth/styles.css';
import { useAppStore } from '../../app-shell/app-store.js';
import {
  createStudioDesktopBrowserAuthAdapter,
  createStudioRuntimeAccountBrowserBroker,
} from './studio-auth-adapter.js';
import { studioTauriOAuthBridge } from '../../bridge/index.js';

export function StudioLoginPage() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const adapter = useMemo(() => createStudioDesktopBrowserAuthAdapter(), []);
  const runtimeAccountBroker = useMemo(() => createStudioRuntimeAccountBrowserBroker(), []);
  // Runtime owns the OAuth `authorize` URL end-to-end; the kit's optional
  // `baseUrl` is unused for Studio's loopback flow.
  const webBaseUrl = '';

  return (
    <DesktopShellAuthPage
      adapter={adapter}
      session={{
        mode: 'desktop-browser',
        authStatus: 'unauthenticated',
        authError: statusMessage,
        setAuthSession: (user) => {
          const store = useAppStore.getState();
          if (!user || !user.id) {
            store.clearAuthSession();
            return;
          }
          store.setAuthSession({
            id: String(user.id),
            displayName: String(user.displayName || user.name || ''),
            email: user.email ? String(user.email) : undefined,
            avatarUrl: user.avatarUrl ? String(user.avatarUrl) : undefined,
          });
        },
        setStatusBanner: (banner) => {
          setStatusMessage(banner?.message || null);
        },
      }}
      desktopBrowserAuth={{
        baseUrl: webBaseUrl || undefined,
        bridge: studioTauriOAuthBridge,
        runtimeAccountBroker,
        hintVisibility: 'always',
      }}
      testIds={{
        screen: 'realm-persona-studio-login-page',
        logoTrigger: 'realm-persona-studio-login-trigger',
      }}
    />
  );
}
