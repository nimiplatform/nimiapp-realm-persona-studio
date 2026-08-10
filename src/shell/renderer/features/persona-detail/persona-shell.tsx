import { type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, PenLine } from 'lucide-react';
import {
  Avatar,
  Button,
  EmptyState,
  InlineAlert,
  ScrollArea,
  Surface,
} from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { classifyPersonaDetailFailure } from '@renderer/features/portfolio/portfolio-data.js';
import { settingFieldDisplayValue } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import { type PersonaDetailReadScope, usePersonaDetailQuery } from './use-persona-detail-query.js';
import type { PersonaWorkspaceVisualData } from './persona-workspace-visual-data.js';
import {
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS,
} from './persona-workspace.visual-fixture.js';

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
    key: 'posts',
    labelKey: 'persona.tabs.posts',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/posts`,
  },
  {
    key: 'assets',
    labelKey: 'persona.tabs.assets',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/assets`,
  },
  {
    key: 'settings',
    labelKey: 'persona.tabs.settings',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/settings`,
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
    <nav className="ras-persona-tabs" aria-label={t('persona.tabs.ariaLabel')}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          data-active={current === tab.key}
          aria-current={current === tab.key ? 'page' : undefined}
          onClick={() => navigate(tab.basePath(personaId, mode))}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </nav>
  );
}

function personaVisibilityLabel(persona: OwnerPortfolioPersonaDetail, t: ReturnType<typeof useStudioI18n>['t']): string {
  const state = persona.state.status === 'available' ? persona.state.value.toUpperCase() : '';
  if (state === 'PUBLIC') return t('persona.workspace.public');
  if (state === 'FRIENDS') return t('persona.workspace.friends');
  if (state === 'PRIVATE') return t('persona.workspace.private');
  return t('common.sourceUnavailable');
}

export function PersonaHeader({
  persona,
}: {
  persona: OwnerPortfolioPersonaDetail;
}) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const name = settingFieldDisplayValue(persona.displayName, t('shared.displayNameNotSet'), t);
  const handle = persona.handle.value ? `@${persona.handle.value}` : settingFieldDisplayValue(persona.handle, t('shared.handleNotSet'), t);
  const world = settingFieldDisplayValue(persona.world, t('shared.worldNotSet'), t);
  const coverAvailable = persona.profileCoverUrl.status === 'available' && persona.profileCoverUrl.value;
  return (
    <section className="ras-persona-profile-header">
      <div className="ras-persona-profile-header__cover">
        {coverAvailable ? (
          <img src={persona.profileCoverUrl.value} alt={t('persona.workspace.coverAlt', { name })} />
        ) : (
          <div className="ras-persona-profile-header__cover-unavailable">{t('persona.workspace.coverUnavailable')}</div>
        )}
      </div>
      <div className="ras-persona-profile-header__identity-row">
        <div className="ras-persona-profile-header__identity">
          <Avatar
            src={persona.avatarUrl ?? null}
            alt={persona.displayName.value || t('persona.header.realmPersonaAlt')}
            size="lg"
            shape="circle"
            tone="accent"
            className="ras-persona-profile-header__avatar"
            fallback={<span className="text-2xl font-semibold">{name.charAt(0).toUpperCase()}</span>}
          />
          <div className="ras-persona-profile-header__copy">
            <h1>{name}</h1>
            <p>{handle} <span aria-hidden="true">·</span> {world}</p>
            <span className="ras-persona-profile-header__visibility">
              <i aria-hidden="true" />
              {personaVisibilityLabel(persona, t)}
            </span>
          </div>
        </div>
        <div className="ras-persona-profile-header__actions">
          <Button
            tone="primary"
            className="text-white"
            onClick={() => navigate(`/portfolio/${persona.id}/assets`)}
          >
            {t('persona.workspace.completeIdentity')}
          </Button>
          <Button
            tone="secondary"
            leadingIcon={<Eye size={16} />}
            onClick={() => navigate(`/portfolio/${persona.id}/preview`)}
          >
            {t('persona.workspace.previewProfile')}
          </Button>
          <Button
            tone="ghost"
            leadingIcon={<PenLine size={16} />}
            onClick={() => navigate(`/portfolio/${persona.id}/posts`)}
          >
            {t('persona.workspace.writePost')}
          </Button>
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
  return 'detail';
}

export function PersonaWorkspaceFrame({
  persona,
  current,
  mode = 'owner',
  children,
}: {
  persona: OwnerPortfolioPersonaDetail;
  current: PersonaShellTabKey;
  mode?: PersonaShellMode;
  children: ReactNode;
}) {
  return (
    <div className="ras-persona-workspace" data-view={current}>
      <PersonaHeader persona={persona} />
      <PersonaTabBar personaId={persona.id} current={current} mode={mode} />
      {children}
    </div>
  );
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
  children: (persona: OwnerPortfolioPersonaDetail, visualData?: PersonaWorkspaceVisualData) => ReactNode;
}) {
  const { t } = useStudioI18n();
  const location = useLocation();
  const activeTab = current ?? deriveCurrentTab(location.pathname, personaId);
  const developmentFixturePersona = import.meta.env.DEV
    ? PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS[personaId]
    : undefined;
  const developmentVisualData = developmentFixturePersona
    ? PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA[personaId]
    : undefined;
  const detailQuery = usePersonaDetailQuery(personaId, mode, {
    enabled: developmentFixturePersona === undefined,
  });

  if (!developmentFixturePersona && detailQuery.isLoading) {
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

  if (!developmentFixturePersona && detailQuery.isError) {
    const failure = classifyPersonaDetailFailure(detailQuery.error);
    const titleKeyByKind = {
      'capability-unavailable': 'portfolio.failure.capabilityUnavailable.title',
      'realm-unavailable': 'portfolio.failure.realmUnavailable.title',
      'access-denied': 'portfolio.failure.accessDenied.title',
      'owner-authority-missing': 'portfolio.failure.ownerAuthorityMissing.title',
      'setting-read-unavailable': 'portfolio.failure.settingReadUnavailable.title',
      unknown: 'portfolio.failure.portfolioUnavailable.title',
    } as const satisfies Record<typeof failure.kind, StudioCopyKey>;
    const detailKeyByKind = {
      'capability-unavailable': 'portfolio.failure.detail.capabilityUnavailable',
      'realm-unavailable': 'portfolio.failure.detail.realm',
      'access-denied': 'portfolio.failure.detail.accessDenied',
      'owner-authority-missing': 'portfolio.failure.detail.owner',
      'setting-read-unavailable': 'portfolio.failure.detail.setting',
      unknown: 'portfolio.failure.detail.unknown',
    } as const satisfies Record<typeof failure.kind, StudioCopyKey>;
    return (
      <ScrollArea className="flex-1" viewportClassName="bg-transparent">
        <div className="ras-page">
          <section className="ras-card">
            <InlineAlert tone={failure.kind === 'capability-unavailable' ? 'info' : 'danger'}>
              <strong>{t(titleKeyByKind[failure.kind])}</strong>
              <div>{t(detailKeyByKind[failure.kind])}</div>
            </InlineAlert>
            <div>
              <Button
                tone="primary"
                className="text-white"
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

  const persona = developmentFixturePersona ?? detailQuery.data;
  if (!persona) return null;

  return (
    <ScrollArea className="flex-1" viewportClassName="bg-transparent">
      <div className="ras-page ras-persona-workspace-page">
        <PersonaWorkspaceFrame persona={persona} current={activeTab} mode={mode}>
          {children(persona, developmentVisualData)}
        </PersonaWorkspaceFrame>
      </div>
    </ScrollArea>
  );
}
