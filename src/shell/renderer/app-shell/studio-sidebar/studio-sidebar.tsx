import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  Image,
  Languages,
  LayoutGrid,
  Moon,
  PanelLeft,
  Plus,
  SlidersHorizontal,
  Sun,
  UserRound,
} from 'lucide-react';
import {
  AccountPanel,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  Surface,
  Tooltip,
  useNimiTheme,
} from '@nimiplatform/kit/ui';
import { motion, NIMI_PRESSED_SCALE, useNimiReducedMotion } from '@nimiplatform/kit/ui/motion';
import studioLogoUrl from '@renderer/assets/brand/studio-logo.png?url';
import { listOwnerPortfolioPersonas } from '../../features/portfolio/portfolio-client.js';
import type { OwnerPortfolioPersona } from '../../features/portfolio/portfolio-data.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import { ownerPortfolioListQueryKey } from '../../features/persona-detail/use-persona-detail-query.js';
import { persistThemeScheme } from '../theme-scheme.js';
import { useAppStore } from '../app-store.js';

export const STUDIO_SIDEBAR_PREFERENCE_STORAGE_PATH = 'shell/sidebar.json';

const navigationItems = [
  { to: '/assets', labelKey: 'shell.nav.assets', Icon: Image },
  { to: '/ai-config', labelKey: 'shell.nav.aiConfig', Icon: SlidersHorizontal },
] as const;

const myPersonasNavigationItem = {
  to: '/portfolio',
  labelKey: 'shell.nav.myPersonas',
  Icon: LayoutGrid,
} as const;

export type StudioSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  visualFixturePersonas?: readonly OwnerPortfolioPersona[];
};

function SidebarBrand({ collapsed, onCollapsedChange }: StudioSidebarProps) {
  const { t } = useStudioI18n();
  const collapseLabel = t(collapsed ? 'shell.sidebar.expand' : 'shell.sidebar.collapse');

  return (
    <SidebarHeader
      className="min-h-0 px-0 py-0"
      title={collapsed ? (
        <div className="flex w-full justify-center py-1">
          <Tooltip content={collapseLabel} placement="right">
            <button
              type="button"
              className="ras-sidebar-brand-switcher"
              aria-label={collapseLabel}
              title={collapseLabel}
              data-titlebar-interactive="true"
              data-testid="sidebar-brand-expand"
              onClick={() => onCollapsedChange(false)}
            >
              <span className="ras-sidebar-brand-switcher__logo">
                <Avatar
                  alt={t('app.name')}
                  src={studioLogoUrl}
                  size="sm"
                  shape="rounded"
                  tone="accent"
                  fallback={<span className="text-[10px] font-bold tracking-wide">{t('app.logoMark')}</span>}
                />
              </span>
              <PanelLeft
                className="ras-sidebar-brand-switcher__icon"
                size={20}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between gap-2 py-1">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar
              alt={t('app.name')}
              src={studioLogoUrl}
              size="sm"
              shape="rounded"
              tone="accent"
              fallback={<span className="text-[10px] font-bold tracking-wide">{t('app.logoMark')}</span>}
            />
            <span className="min-w-0 truncate text-sm font-semibold text-[var(--nimi-text-primary)]">{t('app.name')}</span>
          </div>
          <Tooltip content={collapseLabel} placement="right">
            <IconButton
              icon={<PanelLeft size={18} strokeWidth={1.8} />}
              tone="ghost"
              size="sm"
              aria-label={collapseLabel}
              title={collapseLabel}
              data-titlebar-interactive="true"
              data-testid="sidebar-collapse"
              onClick={() => onCollapsedChange(true)}
            />
          </Tooltip>
        </div>
      )}
    />
  );
}

function NavigationItem({
  collapsed,
  label,
  active,
  Icon,
  onSelect,
}: {
  collapsed: boolean;
  label: string;
  active: boolean;
  Icon: typeof Image;
  onSelect: () => void;
}) {
  const item = (
    <SidebarItem
      kind="nav-row"
      active={active}
      icon={<Icon size={18} strokeWidth={1.8} />}
      label={collapsed ? <span className="sr-only">{label}</span> : label}
      aria-label={label}
      title={collapsed ? label : undefined}
      data-titlebar-interactive="true"
      className={collapsed ? 'ras-sidebar-navigation-item--collapsed' : undefined}
      onClick={onSelect}
    />
  );
  return collapsed ? (
    <Tooltip content={label} placement="right" className="ras-sidebar-navigation-tooltip">
      {item}
    </Tooltip>
  ) : item;
}

function PersonaRosterItem({
  persona,
  collapsed,
  active,
  onSelect,
}: {
  persona: OwnerPortfolioPersona;
  collapsed: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const reducedMotion = useNimiReducedMotion();
  const label = persona.displayName || persona.id;
  const item = (
    <motion.button
      type="button"
      className="ras-sidebar-persona"
      data-active={active}
      data-collapsed={collapsed}
      aria-label={label}
      title={collapsed ? label : undefined}
      onClick={onSelect}
      whileHover={reducedMotion ? undefined : { y: -1 }}
      whileTap={reducedMotion ? undefined : { scale: NIMI_PRESSED_SCALE }}
    >
      {active ? (
        <motion.span
          layoutId="studio-sidebar-active-persona"
          className="ras-sidebar-persona__active-bg"
          aria-hidden="true"
          transition={reducedMotion ? { duration: 0 } : undefined}
        />
      ) : null}
      <Avatar
        alt={label}
        src={persona.avatarUrl}
        size="md"
        shape="rounded"
        tone="accent"
        fallback={<span className="text-sm font-semibold">{label.charAt(0).toUpperCase()}</span>}
      />
      {collapsed ? null : (
        <span className="ras-sidebar-persona__copy">
          <strong>{label}</strong>
          <small>{persona.worldName || '—'}</small>
        </span>
      )}
    </motion.button>
  );
  return collapsed ? <Tooltip content={label} placement="right">{item}</Tooltip> : item;
}

function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const { locale, setLocale, t } = useStudioI18n();
  const { scheme, setScheme } = useNimiTheme();
  const authUser = useAppStore((state) => state.auth.user);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [schemePersistFailed, setSchemePersistFailed] = useState(false);
  const displayName = authUser?.displayName?.trim() || t('shell.account.ownerFallback');
  const email = authUser?.email?.trim() || t('shell.account.runtimeAccount');
  const avatarUrl = authUser?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase() || t('shell.account.ownerFallback').charAt(0).toUpperCase();
  const accountUser = {
    displayName,
    email,
    avatarSrc: avatarUrl,
    fallback: <span className="text-sm font-semibold">{initial}</span>,
  };
  const navigateTo = (path: string) => {
    setOpen(false);
    navigate(path);
  };
  const switchLocale = () => {
    setOpen(false);
    void setLocale(locale === 'en' ? 'zh' : 'en');
  };
  const switchScheme = () => {
    const next = scheme === 'dark' ? 'light' : 'dark';
    setScheme(next);
    void persistThemeScheme(next).then((persisted) => {
      if (persisted) {
        setSchemePersistFailed(false);
        setOpen(false);
        return;
      }
      setSchemePersistFailed(true);
    });
  };

  const trigger = collapsed ? (
    <Tooltip content={t('shell.account.openMenu')} placement="right">
      <PopoverTrigger asChild>
        <IconButton
          icon={<Avatar alt={displayName} src={avatarUrl} size="sm" tone="accent" fallback={initial} />}
          tone="ghost"
          size="sm"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('shell.account.openMenu')}
          data-titlebar-interactive="true"
        />
      </PopoverTrigger>
    </Tooltip>
  ) : (
    <PopoverTrigger asChild>
      <Button
        tone="ghost"
        size="sm"
        fullWidth
        leadingIcon={<Avatar alt={displayName} src={avatarUrl} size="sm" tone="accent" fallback={initial} />}
        trailingIcon={<ChevronDown size={15} strokeWidth={1.8} />}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('shell.account.openMenu')}
        data-titlebar-interactive="true"
        className="justify-start"
      >
        {displayName}
      </Button>
    </PopoverTrigger>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {trigger}
      <PopoverContent
        side={collapsed ? 'right' : 'top'}
        align="end"
        sideOffset={10}
        className="border-0 bg-transparent p-0 shadow-none"
      >
        <AccountPanel
          user={accountUser}
          ariaLabel={t('shell.account.menu')}
          className="w-[min(320px,calc(100vw-24px))]"
          statusMessage={schemePersistFailed ? t('shell.account.schemePersistFailed') : undefined}
          items={[
            {
              id: 'owner-portfolio',
              label: t('shell.account.ownerPortfolio'),
              icon: <UserRound size={16} strokeWidth={1.8} />,
              onSelect: () => navigateTo('/portfolio'),
            },
            {
              id: 'ai-config',
              label: t('shell.account.aiConfig'),
              icon: <SlidersHorizontal size={16} strokeWidth={1.8} />,
              onSelect: () => navigateTo('/ai-config'),
            },
          ]}
          footerItems={[
            {
              id: 'language',
              label: t(locale === 'en' ? 'locale.switchToChinese' : 'locale.switchToEnglish'),
              icon: <Languages size={16} strokeWidth={1.8} />,
              onSelect: switchLocale,
            },
            {
              id: 'color-scheme',
              label: t(scheme === 'dark' ? 'shell.account.switchToLight' : 'shell.account.switchToDark'),
              icon: scheme === 'dark' ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />,
              onSelect: switchScheme,
            },
          ]}
        />
      </PopoverContent>
    </Popover>
  );
}

function currentPersonaId(pathname: string): string | null {
  const match = pathname.match(/^\/portfolio\/([^/]+)/);
  if (!match?.[1] || match[1] === 'create') return null;
  return decodeURIComponent(match[1]);
}

function workspaceSuffix(pathname: string, personaId: string | null): string {
  if (!personaId) return '';
  const prefix = `/portfolio/${encodeURIComponent(personaId)}`;
  const suffix = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  return suffix.startsWith('/posts') || suffix.startsWith('/settings') || suffix.startsWith('/identity') ? suffix : '';
}

export function StudioSidebar({
  collapsed,
  onCollapsedChange,
  visualFixturePersonas,
}: StudioSidebarProps) {
  const { t } = useStudioI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const fixtureMode = visualFixturePersonas !== undefined;
  const portfolioQuery = useQuery({
    queryKey: ownerPortfolioListQueryKey(),
    queryFn: () => listOwnerPortfolioPersonas(),
    enabled: !fixtureMode,
  });
  const personas = visualFixturePersonas ?? portfolioQuery.data ?? [];
  const selectedPersonaId = currentPersonaId(location.pathname);
  const suffix = workspaceSuffix(location.pathname, selectedPersonaId);

  return (
    <Surface
      as="aside"
      material="solid"
      tone="panel"
      padding="none"
      data-collapsed={collapsed}
      data-titlebar-interactive="true"
      aria-label={t('shell.nav.appNavigation')}
      className="ras-studio-sidebar h-full min-h-0 overflow-hidden rounded-none border-0 bg-[color-mix(in_srgb,var(--nimi-surface-card)_60%,transparent)] shadow-none"
    >
      <div className="flex h-full min-h-0 flex-col gap-1 px-3 pb-3 pt-8">
        <SidebarBrand collapsed={collapsed} onCollapsedChange={onCollapsedChange} />

        <SidebarSection className="shrink-0 px-0 py-1">
          {collapsed ? (
            <Tooltip content={t('shell.sidebar.createPersona')} placement="right">
              <IconButton
                icon={<Plus size={18} strokeWidth={1.8} />}
                tone="ghost"
                aria-label={t('shell.sidebar.createPersona')}
                className="ras-sidebar-create"
                onClick={() => navigate('/portfolio/create')}
              />
            </Tooltip>
          ) : (
            <SidebarItem
              kind="nav-row"
              icon={<Plus size={18} strokeWidth={1.8} />}
              label={t('shell.sidebar.createPersona')}
              aria-label={t('shell.sidebar.createPersona')}
              data-titlebar-interactive="true"
              className="ras-sidebar-create"
              onClick={() => navigate('/portfolio/create')}
            />
          )}
        </SidebarSection>

        <SidebarSection className="shrink-0 px-0 py-1">
          <NavigationItem
            collapsed={collapsed}
            label={t(myPersonasNavigationItem.labelKey)}
            active={location.pathname === myPersonasNavigationItem.to}
            Icon={myPersonasNavigationItem.Icon}
            onSelect={() => navigate(myPersonasNavigationItem.to)}
          />
        </SidebarSection>

        <SidebarSection className="flex min-h-0 flex-1 flex-col px-0 py-1">
          <ScrollArea className="min-h-0 flex-1" viewportClassName="bg-transparent">
            {portfolioQuery.isLoading && !fixtureMode ? (
              <div className="ras-sidebar-roster-state">{t('common.loadingEllipsis')}</div>
            ) : portfolioQuery.isError && !fixtureMode ? (
              collapsed ? null : (
                <EmptyState
                  title={t('persona.workspace.rosterUnavailable')}
                  description={t('persona.workspace.rosterUnavailableDescription')}
                  className="border-0 bg-transparent p-3 shadow-none"
                />
              )
            ) : personas.length === 0 ? (
              collapsed ? null : (
                <EmptyState
                  title={t('persona.workspace.rosterEmpty')}
                  description={t('persona.workspace.rosterEmptyDescription')}
                  className="border-0 bg-transparent p-3 shadow-none"
                />
              )
            ) : (
              <div className="ras-sidebar-persona-list">
                {personas.map((persona) => (
                  <PersonaRosterItem
                    key={persona.id}
                    persona={persona}
                    collapsed={collapsed}
                    active={selectedPersonaId === persona.id}
                    onSelect={() => navigate(`/portfolio/${persona.id}${suffix}`)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </SidebarSection>

        <SidebarSection className="shrink-0 px-0 py-1">
          <div className="flex flex-col gap-1">
            {navigationItems.map(({ to, labelKey, Icon }) => {
              const label = t(labelKey);
              return (
                <NavigationItem
                  key={to}
                  collapsed={collapsed}
                  label={label}
                  active={location.pathname === to}
                  Icon={Icon}
                  onSelect={() => navigate(to)}
                />
              );
            })}
          </div>
        </SidebarSection>

        <div className={`flex shrink-0 flex-col gap-2 pt-1 ${collapsed ? 'items-center' : ''}`}>
          <AccountMenu collapsed={collapsed} />
        </div>
      </div>
    </Surface>
  );
}
