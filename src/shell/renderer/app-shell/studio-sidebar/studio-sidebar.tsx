import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  Image,
  Languages,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  SlidersHorizontal,
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
  SegmentedControl,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  Surface,
  Tooltip,
} from '@nimiplatform/kit/ui';
import { listOwnerPortfolioPersonas } from '../../features/portfolio/portfolio-client.js';
import type { OwnerPortfolioPersona } from '../../features/portfolio/portfolio-data.js';
import { type StudioLocale } from '../../i18n/studio-i18n.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import { ownerPortfolioListQueryKey } from '../../features/persona-detail/use-persona-detail-query.js';
import {
  PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_PENDING_REVIEWS,
} from '../../features/persona-detail/persona-workspace.visual-fixture.js';
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
  visualFixturePendingReviews?: Readonly<Record<string, number>>;
};

function SidebarBrand({ collapsed, onCollapsedChange }: StudioSidebarProps) {
  const { t } = useStudioI18n();
  const collapseLabel = t(collapsed ? 'shell.sidebar.expand' : 'shell.sidebar.collapse');
  const toggle = (
    <Tooltip content={collapseLabel} placement="right">
      <IconButton
        icon={collapsed ? <PanelLeftOpen size={17} strokeWidth={1.8} /> : <PanelLeftClose size={17} strokeWidth={1.8} />}
        tone="ghost"
        size="sm"
        aria-label={collapseLabel}
        title={collapseLabel}
        data-titlebar-interactive="true"
        onClick={() => onCollapsedChange(!collapsed)}
      />
    </Tooltip>
  );

  return (
    <SidebarHeader
      className="!min-h-0 !px-0 !py-0"
      title={collapsed ? (
        <div className="flex w-full flex-col items-center gap-3 py-1">
          <Avatar
            alt={t('app.name')}
            size="sm"
            shape="rounded"
            tone="accent"
            fallback={<span className="text-[10px] font-bold tracking-wide">{t('app.logoMark')}</span>}
          />
          {toggle}
        </div>
      ) : (
        <div className="flex w-full items-center justify-between gap-2 py-1">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar
              alt={t('app.name')}
              size="sm"
              shape="rounded"
              tone="accent"
              fallback={<span className="text-[10px] font-bold tracking-wide">{t('app.logoMark')}</span>}
            />
            <span className="min-w-0 truncate text-sm font-semibold text-[var(--nimi-text-primary)]">{t('app.name')}</span>
          </div>
          {toggle}
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
      className={collapsed ? 'justify-center !px-0' : undefined}
      onClick={onSelect}
    />
  );
  return collapsed ? <Tooltip content={label} placement="right">{item}</Tooltip> : item;
}

function PersonaRosterItem({
  persona,
  collapsed,
  active,
  pendingReviewCount,
  onSelect,
}: {
  persona: OwnerPortfolioPersona;
  collapsed: boolean;
  active: boolean;
  pendingReviewCount: number;
  onSelect: () => void;
}) {
  const label = persona.displayName || persona.id;
  const item = (
    <button
      type="button"
      className="ras-sidebar-persona"
      data-active={active}
      data-collapsed={collapsed}
      aria-label={label}
      title={collapsed ? label : undefined}
      onClick={onSelect}
    >
      <Avatar
        alt={label}
        src={persona.avatarUrl}
        size="md"
        shape="circle"
        tone="accent"
        fallback={<span className="text-sm font-semibold">{label.charAt(0).toUpperCase()}</span>}
      />
      {collapsed ? null : (
        <>
          <span className="ras-sidebar-persona__copy">
            <strong>{label}</strong>
            <small>{persona.worldName || '—'}</small>
          </span>
          {pendingReviewCount > 0 ? (
            <span className="ras-sidebar-persona__review">{pendingReviewCount} 待审核</span>
          ) : null}
        </>
      )}
    </button>
  );
  return collapsed ? <Tooltip content={label} placement="right">{item}</Tooltip> : item;
}

function LanguageSwitcher({ collapsed }: { collapsed: boolean }) {
  const { locale, setLocale, t } = useStudioI18n();
  const label = t('locale.ariaLabel');
  if (collapsed) {
    return (
      <Tooltip content={label} placement="right">
        <IconButton
          icon={<Languages size={17} strokeWidth={1.8} />}
          tone="ghost"
          size="sm"
          aria-label={label}
          title={label}
          data-titlebar-interactive="true"
          onClick={() => void setLocale(locale === 'en' ? 'zh' : 'en')}
        />
      </Tooltip>
    );
  }
  return (
    <div data-titlebar-interactive="true" className="min-w-0">
      <SegmentedControl
        size="sm"
        className="w-full [&_.nimi-segmented-control__item]:flex-1"
        ariaLabel={label}
        value={locale}
        onValueChange={(value) => void setLocale(value as StudioLocale)}
        items={[
          { value: 'en', label: t('locale.english') },
          { value: 'zh', label: t('locale.chinese') },
        ]}
      />
    </div>
  );
}

function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const { t } = useStudioI18n();
  const authUser = useAppStore((state) => state.auth.user);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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
  return suffix.startsWith('/posts') || suffix.startsWith('/assets') || suffix.startsWith('/settings') ? suffix : '';
}

export function StudioSidebar({
  collapsed,
  onCollapsedChange,
  visualFixturePersonas,
  visualFixturePendingReviews = {},
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
  const developmentFixtureFallback = import.meta.env.DEV
    && !fixtureMode
    && !portfolioQuery.isLoading
    && (portfolioQuery.isError || (portfolioQuery.data?.length ?? 0) === 0);
  const usingFixture = fixtureMode || developmentFixtureFallback;
  const personas = visualFixturePersonas
    ?? (developmentFixtureFallback ? PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST : portfolioQuery.data)
    ?? [];
  const pendingReviews = fixtureMode
    ? visualFixturePendingReviews
    : developmentFixtureFallback
      ? PERSONA_WORKSPACE_VISUAL_FIXTURE_PENDING_REVIEWS
      : {};
  const selectedPersonaId = currentPersonaId(location.pathname);
  const suffix = workspaceSuffix(location.pathname, selectedPersonaId);

  return (
    <Surface
      as="aside"
      material="glass-chrome"
      tone="panel"
      padding="none"
      data-collapsed={collapsed}
      data-titlebar-interactive="true"
      aria-label={t('shell.nav.appNavigation')}
      className="ras-studio-sidebar h-full min-h-0 overflow-hidden"
    >
      <div className="flex h-full min-h-0 flex-col gap-2 p-3">
        <SidebarBrand collapsed={collapsed} onCollapsedChange={onCollapsedChange} />

        <SidebarSection className="shrink-0 !px-0 !py-1">
          {collapsed ? (
            <Tooltip content={t('shell.sidebar.createPersona')} placement="right">
              <IconButton
                icon={<Plus size={18} strokeWidth={1.8} />}
                tone="primary"
                className="text-white"
                aria-label={t('shell.sidebar.createPersona')}
                onClick={() => navigate('/portfolio/create')}
              />
            </Tooltip>
          ) : (
            <Button
              tone="primary"
              fullWidth
              className="text-white"
              leadingIcon={<Plus size={17} strokeWidth={1.8} />}
              onClick={() => navigate('/portfolio/create')}
            >
              {t('shell.sidebar.createPersona')}
            </Button>
          )}
        </SidebarSection>

        <SidebarSection className="shrink-0 !px-0 !py-1">
          <NavigationItem
            collapsed={collapsed}
            label={t(myPersonasNavigationItem.labelKey)}
            active={location.pathname === myPersonasNavigationItem.to}
            Icon={myPersonasNavigationItem.Icon}
            onSelect={() => navigate(myPersonasNavigationItem.to)}
          />
        </SidebarSection>

        <SidebarSection className="flex min-h-0 flex-1 flex-col !px-0 !py-1">
          <ScrollArea className="min-h-0 flex-1" viewportClassName="bg-transparent">
            {portfolioQuery.isLoading && !fixtureMode ? (
              <div className="ras-sidebar-roster-state">{t('common.loadingEllipsis')}</div>
            ) : portfolioQuery.isError && !usingFixture ? (
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
                    pendingReviewCount={pendingReviews[persona.id] ?? 0}
                    onSelect={() => navigate(`/portfolio/${persona.id}${suffix}`)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </SidebarSection>

        <SidebarSection className="shrink-0 !px-0 !py-1">
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

        <div className={`flex shrink-0 flex-col gap-2 border-t border-[var(--nimi-border-subtle)] pt-3 ${collapsed ? 'items-center' : ''}`}>
          <LanguageSwitcher collapsed={collapsed} />
          <AccountMenu collapsed={collapsed} />
        </div>
      </div>
    </Surface>
  );
}
