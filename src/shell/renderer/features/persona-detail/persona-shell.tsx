import { type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Avatar,
  BackLink,
  Button,
  EmptyState,
  InlineAlert,
  PillTabs,
  ScrollArea,
  StatusBadge,
  Surface,
} from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { classifyPersonaDetailFailure } from '@renderer/features/portfolio/portfolio-data.js';
import {
  detailFriendCountLabel,
  settingFieldDisplayValue,
} from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import { type PersonaDetailReadScope, usePersonaDetailQuery } from './use-persona-detail-query.js';

export type PersonaShellTabKey = 'detail' | 'settings' | 'assets' | 'posts' | 'insights';
export type PersonaShellMode = PersonaDetailReadScope;

type PersonaTabDef = {
  key: PersonaShellTabKey;
  labelKey: StudioCopyKey;
  basePath: (personaId: string, mode: PersonaShellMode) => string;
  modes: readonly PersonaShellMode[];
};

const TABS: PersonaTabDef[] = [
  {
    key: 'detail',
    labelKey: 'persona.tabs.detail',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}`,
  },
  {
    key: 'settings',
    labelKey: 'persona.tabs.settings',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/settings`,
  },
  {
    key: 'assets',
    labelKey: 'persona.tabs.assets',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/assets`,
  },
  {
    key: 'posts',
    labelKey: 'persona.tabs.posts',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/posts`,
  },
  {
    key: 'insights',
    labelKey: 'persona.tabs.insights',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/insights`,
  },
];

export function PersonaTabBar({
  personaId,
  current,
  mode = 'owner',
}: {
  personaId: string;
  current: PersonaShellTabKey;
  mode?: PersonaShellMode;
}) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const tabs = TABS.filter((tab) => tab.modes.includes(mode));
  return (
    <PillTabs
      ariaLabel={t('persona.tabs.ariaLabel')}
      size="md"
      value={current}
      onValueChange={(value) => {
        const next = tabs.find((tab) => tab.key === value);
        if (next) navigate(next.basePath(personaId, mode));
      }}
      items={tabs.map((tab) => ({ value: tab.key, label: t(tab.labelKey) }))}
    />
  );
}

export function PersonaHeader({
  persona,
  back = '/portfolio',
  backLabel,
}: {
  persona: OwnerPortfolioPersonaDetail;
  back?: string;
  backLabel?: string;
}) {
  const { t } = useStudioI18n();
  const resolvedBackLabel = backLabel ?? t('persona.header.portfolio');
  return (
    <section className="ras-card">
      <div className="ras-persona-header">
        <BackLink asChild>
          <NavLink to={back} aria-label={t('persona.header.backTo', { label: resolvedBackLabel })}>
            <ArrowLeft size={15} strokeWidth={1.8} style={{ marginRight: 4 }} />
            {resolvedBackLabel}
          </NavLink>
        </BackLink>
        <div className="ras-persona-header__identity">
          <Avatar
            src={persona.avatarUrl ?? null}
            alt={persona.displayName.value || t('persona.header.realmPersonaAlt')}
            size="md"
            shape="circle"
            fallback={
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {(persona.displayName.value || 'A').charAt(0).toUpperCase()}
              </span>
            }
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="ras-persona-header__name">
              {settingFieldDisplayValue(persona.displayName, t('shared.displayNameNotSet'), t)}
            </h2>
            <span className="ras-persona-header__handle">
              {persona.handle.value ? `@${persona.handle.value}` : settingFieldDisplayValue(persona.handle, t('shared.handleNotSet'), t)}
            </span>
          </div>
        </div>
        <div className="ras-persona-header__meta">
          <StatusBadge tone={persona.friendCount.status === 'available' ? 'success' : 'warning'}>
            {detailFriendCountLabel(persona, t)}
          </StatusBadge>
          <StatusBadge tone="neutral">{settingFieldDisplayValue(persona.world, t('shared.worldNotSet'), t)}</StatusBadge>
        </div>
      </div>
    </section>
  );
}

/**
 * Standard workspace intro card used at the top of each `/portfolio/:personaId/*`
 * sub-route. Title + optional badges on the left, optional actions on the
 * right, optional description underneath.
 */
export function WorkspaceIntro({
  title,
  description,
  badges,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="ras-card">
      <div className="ras-workspace-intro">
        <div className="ras-workspace-intro__copy">
          <h2 className="ras-workspace-intro__title">
            {title}
            {badges}
          </h2>
          {description ? <p className="ras-workspace-intro__description">{description}</p> : null}
        </div>
        {actions ? <div className="ras-page-header__actions">{actions}</div> : null}
      </div>
    </section>
  );
}

function deriveCurrentTab(pathname: string, personaId: string): PersonaShellTabKey {
  if (pathname.startsWith(`/portfolio/${personaId}/settings`)) return 'settings';
  if (pathname.startsWith(`/portfolio/${personaId}/assets`)) return 'assets';
  if (pathname.startsWith(`/portfolio/${personaId}/posts`)) return 'posts';
  if (pathname.startsWith(`/portfolio/${personaId}/insights`)) return 'insights';
  return 'detail';
}

export function PersonaShell({
  personaId,
  current,
  mode = 'owner',
  children,
}: {
  personaId: string;
  current?: PersonaShellTabKey;
  mode?: PersonaShellMode;
  children: (persona: OwnerPortfolioPersonaDetail) => ReactNode;
}) {
  const { t } = useStudioI18n();
  const location = useLocation();
  const activeTab = current ?? deriveCurrentTab(location.pathname, personaId);
  const detailQuery = usePersonaDetailQuery(personaId, mode);

  if (detailQuery.isLoading) {
    return (
      <ScrollArea className="flex-1" viewportClassName="bg-transparent">
        <div className="ras-page">
          <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
            <EmptyState
              title={t('persona.loading.title')}
              description={t('persona.loading.description')}
            />
          </Surface>
        </div>
      </ScrollArea>
    );
  }

  if (detailQuery.isError) {
    const failure = classifyPersonaDetailFailure(detailQuery.error);
    const titleKeyByKind = {
      'realm-unavailable': 'portfolio.failure.realmUnavailable.title',
      'permission-missing': 'portfolio.failure.permissionMissing.title',
      'owner-authority-missing': 'portfolio.failure.ownerAuthorityMissing.title',
      'setting-read-unavailable': 'portfolio.failure.settingReadUnavailable.title',
      unknown: 'portfolio.failure.portfolioUnavailable.title',
    } as const satisfies Record<typeof failure.kind, StudioCopyKey>;
    const detailKeyByKind = {
      'realm-unavailable': 'portfolio.failure.detail.realm',
      'permission-missing': 'portfolio.failure.detail.permission',
      'owner-authority-missing': 'portfolio.failure.detail.owner',
      'setting-read-unavailable': 'portfolio.failure.detail.setting',
      unknown: 'portfolio.failure.detail.unknown',
    } as const satisfies Record<typeof failure.kind, StudioCopyKey>;
    return (
      <ScrollArea className="flex-1" viewportClassName="bg-transparent">
        <div className="ras-page">
          <section className="ras-card">
            <InlineAlert tone="danger">
              <strong>{t(titleKeyByKind[failure.kind])}</strong>
              <div>{t(detailKeyByKind[failure.kind])}</div>
            </InlineAlert>
            <div>
              <Button
                tone="primary"
                onClick={() => void detailQuery.refetch()}
                loading={detailQuery.isFetching}
              >
                {t('common.retry')}
              </Button>
            </div>
          </section>
        </div>
      </ScrollArea>
    );
  }

  const persona = detailQuery.data;
  if (!persona) return null;

  return (
    <ScrollArea className="flex-1" viewportClassName="bg-transparent">
      <div className="ras-page">
        <PersonaHeader persona={persona} />
        <PersonaTabBar personaId={personaId} current={activeTab} mode={mode} />
        {children(persona)}
      </div>
    </ScrollArea>
  );
}
