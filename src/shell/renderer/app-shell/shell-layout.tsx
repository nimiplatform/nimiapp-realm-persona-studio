import { useStudioScope, type StudioScope } from '@renderer/app-shell/studio-scope.js';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AmbientBackground, InlineAlert } from '@nimiplatform/kit/ui';
import { StudioSidebar, STUDIO_SIDEBAR_PREFERENCE_STORAGE_PATH } from './studio-sidebar/index.js';
import { getStudioProtectedJsonStorage, isStudioStorageNotFoundError } from './studio-storage.js';
import { startStudioWindowDrag } from '../bridge/window-drag.js';
import { useStudioI18n } from '../i18n/use-studio-i18n.js';

const MACOS_TRAFFIC_LIGHT_SAFE_ZONE_PX = 84;
const TITLEBAR_INTERACTIVE_SELECTOR = [
  '[data-titlebar-interactive="true"]',
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[tabindex]',
].join(',');

type SidebarPreferenceReadResult =
  | { ok: true; collapsed: boolean }
  | { ok: false };

async function readStoredSidebarCollapsed(scope: StudioScope): Promise<SidebarPreferenceReadResult> {
  try {
    const document = await getStudioProtectedJsonStorage(scope).readJson(STUDIO_SIDEBAR_PREFERENCE_STORAGE_PATH);
    if (!document.value || typeof document.value !== 'object' || Array.isArray(document.value)) return { ok: false };
    const collapsed = (document.value as Record<string, unknown>).collapsed;
    return typeof collapsed === 'boolean' ? { ok: true, collapsed } : { ok: false };
  } catch (error) {
    return isStudioStorageNotFoundError(error) ? { ok: true, collapsed: false } : { ok: false };
  }
}

async function persistSidebarCollapsed(scope: StudioScope, collapsed: boolean): Promise<boolean> {
  try {
    await getStudioProtectedJsonStorage(scope).writeJson(STUDIO_SIDEBAR_PREFERENCE_STORAGE_PATH, { collapsed });
    return true;
  } catch {
    return false;
  }
}

export function ShellLayout({ children }: { children: ReactNode }) {
  const scope = useStudioScope();
  const { t } = useStudioI18n();
  const location = useLocation();
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceUnavailable, setSidebarPreferenceUnavailable] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => { setCompact(media.matches); setMobileNavigationOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { setMobileNavigationOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    let cancelled = false;
    void readStoredSidebarCollapsed(scope).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setSidebarCollapsed(result.collapsed);
      } else {
        setSidebarPreferenceUnavailable(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const isTitlebarInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element && target.closest(TITLEBAR_INTERACTIVE_SELECTOR) !== null;

  const handleSidebarCollapsedChange = (collapsed: boolean) => {
    if (compact) {
      setMobileNavigationOpen(!collapsed);
      return;
    }
    setSidebarCollapsed(collapsed);
    void persistSidebarCollapsed(scope, collapsed).then((persisted) => {
      if (!persisted) setSidebarPreferenceUnavailable(true);
    });
  };

  return (
    <AmbientBackground variant="mesh" className="ras-shell" data-compact={compact}>
      <div className="ras-shell__body">
        <StudioSidebar collapsed={compact ? !mobileNavigationOpen : sidebarCollapsed} onCollapsedChange={handleSidebarCollapsedChange} />

        <main
          className="ras-main"
          hidden={compact && mobileNavigationOpen}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            if (event.detail > 1) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientY - rect.top > 40) return;
            if (event.clientX < MACOS_TRAFFIC_LIGHT_SAFE_ZONE_PX) return;
            if (isTitlebarInteractiveTarget(event.target)) return;
            void startStudioWindowDrag();
          }}
          data-testid="shell-main-drag-region"
        >
          {sidebarPreferenceUnavailable ? (
            <div className="px-6 pt-4 xl:px-8">
              <InlineAlert tone="warning">{t('shell.sidebar.preferenceUnavailable')}</InlineAlert>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </AmbientBackground>
  );
}
