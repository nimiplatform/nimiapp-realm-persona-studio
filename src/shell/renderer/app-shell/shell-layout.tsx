import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
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

async function readStoredSidebarCollapsed(): Promise<SidebarPreferenceReadResult> {
  try {
    const document = await getStudioProtectedJsonStorage().readJson(STUDIO_SIDEBAR_PREFERENCE_STORAGE_PATH);
    if (!document.value || typeof document.value !== 'object' || Array.isArray(document.value)) return { ok: false };
    const collapsed = (document.value as Record<string, unknown>).collapsed;
    return typeof collapsed === 'boolean' ? { ok: true, collapsed } : { ok: false };
  } catch (error) {
    return isStudioStorageNotFoundError(error) ? { ok: true, collapsed: false } : { ok: false };
  }
}

async function persistSidebarCollapsed(collapsed: boolean): Promise<boolean> {
  try {
    await getStudioProtectedJsonStorage().writeJson(STUDIO_SIDEBAR_PREFERENCE_STORAGE_PATH, { collapsed });
    return true;
  } catch {
    return false;
  }
}

export function ShellLayout({ children }: { children: ReactNode }) {
  const { t } = useStudioI18n();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceUnavailable, setSidebarPreferenceUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void readStoredSidebarCollapsed().then((result) => {
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
    setSidebarCollapsed(collapsed);
    void persistSidebarCollapsed(collapsed).then((persisted) => {
      if (!persisted) setSidebarPreferenceUnavailable(true);
    });
  };

  const handleTitlebarMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.detail > 1) return;
    if (event.clientX < MACOS_TRAFFIC_LIGHT_SAFE_ZONE_PX) return;
    if (isTitlebarInteractiveTarget(event.target)) return;
    void startStudioWindowDrag();
  };

  return (
    <AmbientBackground variant="mesh" className="ras-shell">
      <div className="ras-topbar" onMouseDown={handleTitlebarMouseDown}>
        <div className="ras-topbar__inner">
          <h1 className="ras-topbar__title">{t('app.name')}</h1>
          <span className="ras-topbar__chip">{t('app.owner')}</span>
        </div>
      </div>

      <div className="ras-shell__body">
        <StudioSidebar collapsed={sidebarCollapsed} onCollapsedChange={handleSidebarCollapsedChange} />

        <main
          className="ras-main"
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
