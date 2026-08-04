import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import {
  groupCreationDraftHistoryByRecency,
  loadCreationDraftHistory,
  type CreationDraftHistoryEntry,
  type CreationDraftHistoryGroup,
} from '../../features/portfolio/creation-draft-history.js';
import { CREATION_DRAFT_HISTORY_UPDATED_EVENT } from '../../features/portfolio/creation-draft-store.js';
import { translatePersonaArchetypeLabel, type StudioLocale } from '../../i18n/studio-i18n.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import { useAppStore } from '../app-store.js';

export const STUDIO_SIDEBAR_PREFERENCE_STORAGE_PATH = 'shell/sidebar.json';

const navigationItems = [
  { to: '/portfolio', labelKey: 'shell.nav.myPersonas', Icon: LayoutGrid },
  { to: '/assets', labelKey: 'shell.nav.assets', Icon: Image },
  { to: '/ai-config', labelKey: 'shell.nav.aiConfig', Icon: SlidersHorizontal },
] as const;

export type StudioSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

function isNavigationItemActive(to: string, pathname: string): boolean {
  if (to === '/portfolio') {
    return pathname === '/portfolio' || (pathname.startsWith('/portfolio/') && pathname !== '/portfolio/create');
  }
  return pathname === to;
}

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
  Icon: typeof LayoutGrid;
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

function CreationHistoryItem({
  collapsed,
  entry,
  active,
  onOpen,
}: {
  collapsed: boolean;
  entry: CreationDraftHistoryEntry;
  active: boolean;
  onOpen: () => void;
}) {
  const { t } = useStudioI18n();
  const label = entry.displayName;
  const description = [
    entry.worldName,
    entry.archetype ? translatePersonaArchetypeLabel(entry.archetype, t) : null,
  ].filter(Boolean).join(' · ');
  const item = (
    <SidebarItem
      kind="entity-row"
      active={active}
      icon={(
        <Avatar
          alt={label}
          size="sm"
          shape="rounded"
          tone="accent"
          fallback={<span className="text-xs font-semibold">{label.charAt(0).toUpperCase()}</span>}
        />
      )}
      label={collapsed ? <span className="sr-only">{label}</span> : label}
      description={collapsed ? undefined : description || undefined}
      aria-label={label}
      title={collapsed ? label : undefined}
      data-titlebar-interactive="true"
      className={collapsed ? 'justify-center !px-0' : undefined}
      onClick={onOpen}
    />
  );

  return collapsed ? <Tooltip content={label} placement="right">{item}</Tooltip> : item;
}

function HistoryGroups({
  collapsed,
  groups,
  unavailable,
  currentDraftKey,
  onOpen,
}: {
  collapsed: boolean;
  groups: CreationDraftHistoryGroup[];
  unavailable: boolean;
  currentDraftKey: string | null;
  onOpen: (draftKey: string) => void;
}) {
  const { t } = useStudioI18n();
  const hasEntries = groups.some((group) => group.entries.length > 0);

  if (unavailable) {
    return collapsed ? null : (
      <EmptyState
        title={t('shell.sidebar.history.unavailableTitle')}
        description={t('shell.sidebar.history.unavailableDescription')}
        className="border-0 bg-transparent p-3 shadow-none"
      />
    );
  }

  if (!hasEntries) {
    return collapsed ? null : (
      <EmptyState
        title={t('shell.sidebar.history.emptyTitle')}
        description={t('shell.sidebar.history.emptyDescription')}
        className="border-0 bg-transparent p-3 shadow-none"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => group.entries.length > 0 ? (
        <SidebarSection
          key={group.id}
          label={collapsed ? undefined : t(group.labelKey)}
          className="!px-0 !py-1"
        >
          <div className="flex flex-col gap-1">
            {group.entries.map((entry) => (
              <CreationHistoryItem
                key={entry.draftKey}
                collapsed={collapsed}
                entry={entry}
                active={currentDraftKey === entry.draftKey}
                onOpen={() => onOpen(entry.draftKey)}
              />
            ))}
          </div>
        </SidebarSection>
      ) : null)}
    </div>
  );
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
        className="w-full"
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

  const accountTrigger = collapsed ? (
    <Tooltip content={t('shell.account.openMenu')} placement="right">
      <PopoverTrigger asChild>
        <IconButton
          icon={(
            <Avatar
              alt={displayName}
              src={avatarUrl}
              size="sm"
              tone="accent"
              fallback={<span className="text-xs font-semibold">{initial}</span>}
            />
          )}
          tone="ghost"
          size="sm"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('shell.account.openMenu')}
          title={t('shell.account.openMenu')}
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
        trailingIcon={<ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />}
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
      {accountTrigger}
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

export function StudioSidebar({ collapsed, onCollapsedChange }: StudioSidebarProps) {
  const { t } = useStudioI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [history, setHistory] = useState<CreationDraftHistoryEntry[]>([]);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refreshHistory = async () => {
      const result = await loadCreationDraftHistory();
      if (cancelled) return;
      setHistory(result.entries);
      setHistoryUnavailable(!result.ok || result.unavailableCount > 0);
    };
    const handleHistoryUpdated = () => void refreshHistory();
    void refreshHistory();
    window.addEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, handleHistoryUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, handleHistoryUpdated);
    };
  }, []);
  const historyGroups = useMemo(
    () => groupCreationDraftHistoryByRecency(history, new Date()),
    [history],
  );
  const currentDraftKey = new URLSearchParams(location.search).get('draft');

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
                aria-label={t('shell.sidebar.createPersona')}
                title={t('shell.sidebar.createPersona')}
                data-titlebar-interactive="true"
                onClick={() => navigate('/portfolio/create')}
              />
            </Tooltip>
          ) : (
            <Button
              tone="primary"
              fullWidth
              leadingIcon={<Plus size={17} strokeWidth={1.8} />}
              data-titlebar-interactive="true"
              onClick={() => navigate('/portfolio/create')}
            >
              {t('shell.sidebar.createPersona')}
            </Button>
          )}
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
                  active={isNavigationItemActive(to, location.pathname)}
                  Icon={Icon}
                  onSelect={() => navigate(to)}
                />
              );
            })}
          </div>
        </SidebarSection>

        <SidebarSection
          label={collapsed ? undefined : t('shell.sidebar.creationHistory')}
          className="flex min-h-0 flex-1 flex-col !px-0 !py-1"
        >
          <ScrollArea className="min-h-0 flex-1" viewportClassName="bg-transparent">
            <HistoryGroups
              collapsed={collapsed}
              groups={historyGroups}
              unavailable={historyUnavailable}
              currentDraftKey={currentDraftKey}
              onOpen={(draftKey) => navigate(`/portfolio/create?draft=${encodeURIComponent(draftKey)}`)}
            />
          </ScrollArea>
        </SidebarSection>

        <div className={`flex shrink-0 flex-col gap-2 border-t border-[var(--nimi-border-subtle)] pt-3 ${collapsed ? 'items-center' : ''}`}>
          <LanguageSwitcher collapsed={collapsed} />
          <AccountMenu collapsed={collapsed} />
        </div>
      </div>
    </Surface>
  );
}
