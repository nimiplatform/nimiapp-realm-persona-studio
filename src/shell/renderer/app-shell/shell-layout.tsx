import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutGrid, Plus, User, SlidersHorizontal } from 'lucide-react';
import {
  AmbientBackground,
  Avatar,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  Tooltip,
} from '@nimiplatform/kit/ui';
import { useAppStore } from './app-store.js';
import { startStudioWindowDrag } from '../bridge/window-drag.js';
import { useStudioI18n } from '../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../i18n/studio-copy.js';
import type { StudioLocale } from '../i18n/studio-i18n.js';

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

const navItems = [
  { to: '/portfolio', labelKey: 'shell.nav.portfolio', Icon: LayoutGrid, end: true },
  { to: '/portfolio/create', labelKey: 'shell.nav.create', Icon: Plus, end: true },
  { to: '/ai-config', labelKey: 'shell.nav.aiModels', Icon: SlidersHorizontal, end: true },
] as const;

function SidebarItem({
  to,
  label,
  end,
  children,
}: {
  to: string;
  label: string;
  end: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <NavLink
        to={to}
        end={end}
        data-titlebar-interactive="true"
        aria-label={label}
        className={({ isActive }) =>
          isActive ? 'ras-sidebar__item ras-sidebar__item--active' : 'ras-sidebar__item'
        }
      >
        {children}
      </NavLink>
    </Tooltip>
  );
}

function AccountMenu() {
  const { t } = useStudioI18n();
  const authUser = useAppStore((s) => s.auth.user);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const displayName = authUser?.displayName || t('shell.account.ownerFallback');
  const avatarUrl = authUser?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase() || t('shell.account.ownerFallback').charAt(0).toUpperCase();

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-titlebar-interactive="true"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('shell.account.openMenu')}
          className="ras-avatar-trigger"
        >
          <Avatar
            src={avatarUrl}
            alt={displayName}
            size="sm"
            shape="circle"
            fallback={<span style={{ fontSize: 14, fontWeight: 600 }}>{initial}</span>}
          />
          <ChevronDown
            className="ras-avatar-trigger__chevron"
            size={14}
            strokeWidth={1.9}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="ras-avatar-popover">
        <div role="menu" aria-label={t('shell.account.menu')}>
          <div className="ras-avatar-menu__header">
            <Avatar
              src={avatarUrl}
              alt={displayName}
              size="md"
              shape="circle"
              fallback={<span style={{ fontSize: 16, fontWeight: 600 }}>{initial}</span>}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="ras-avatar-menu__name">{displayName}</p>
              <p className="ras-avatar-menu__email">{authUser?.email || t('shell.account.runtimeAccount')}</p>
            </div>
          </div>
          <div className="ras-avatar-menu__actions">
            <Button
              tone="ghost"
              size="sm"
              fullWidth
              role="menuitem"
              className="ras-avatar-menu__action"
              leadingIcon={<User size={16} strokeWidth={1.8} />}
              onClick={() => {
                setOpen(false);
                navigate('/portfolio');
              }}
            >
              {t('shell.account.ownerPortfolio')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LanguageSwitcher() {
  const { locale, setLocale, t } = useStudioI18n();
  return (
    <SegmentedControl
      size="sm"
      className="ras-language-switcher"
      ariaLabel={t('locale.ariaLabel')}
      value={locale}
      onValueChange={(value) => void setLocale(value as StudioLocale)}
      items={[
        { value: 'en', label: t('locale.english') },
        { value: 'zh', label: t('locale.chinese') },
      ]}
    />
  );
}

export function ShellLayout({ children }: { children: ReactNode }) {
  const { t } = useStudioI18n();
  const isTitlebarInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element && target.closest(TITLEBAR_INTERACTIVE_SELECTOR) !== null;

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
          <div className="ras-topbar__right">
            <LanguageSwitcher />
            <AccountMenu />
          </div>
        </div>
      </div>

      <div className="ras-shell__body">
        <aside className="ras-sidebar">
          <div className="ras-sidebar__logo">
            <div className="ras-sidebar__logo-mark" aria-label={t('app.name')}>
              {t('app.logoMark')}
            </div>
          </div>
          <nav className="ras-sidebar__nav" aria-label={t('shell.nav.appNavigation')}>
            {navItems.map((item) => (
              <SidebarItem key={item.to} to={item.to} label={t(item.labelKey as StudioCopyKey)} end={item.end}>
                <item.Icon size={19} strokeWidth={1.8} />
              </SidebarItem>
            ))}
          </nav>
        </aside>

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
          {children}
        </main>
      </div>
    </AmbientBackground>
  );
}
