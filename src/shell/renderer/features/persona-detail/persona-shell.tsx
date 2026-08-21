import { type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, PenLine } from 'lucide-react';
import {
  Avatar,
  Button,
  EmptyState,
  InlineAlert,
  NimiTabs,
  ScrollArea,
  StatusBadge,
  Surface,
} from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { classifyPersonaDetailFailure } from '@renderer/features/portfolio/portfolio-data.js';
import { settingFieldDisplayValue } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import { type PersonaDetailReadScope, usePersonaDetailQuery } from './use-persona-detail-query.js';
import type { PersonaWorkspaceVisualData } from './persona-workspace-visual-data.js';
import { usePersonaVisualPreview } from './persona-visual-preview-context.js';

export type PersonaShellTabKey = 'detail' | 'settings' | 'assets' | 'posts' | 'insights' | 'launch';
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
    key: 'insights',
    labelKey: 'persona.tabs.insights',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/insights`,
  },
  {
    key: 'launch',
    labelKey: 'persona.tabs.launch',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/launch`,
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
      <NimiTabs
        items={tabs.map((tab) => ({ value: tab.key, label: t(tab.labelKey) }))}
        value={current}
        onValueChange={(value) => {
          const tab = tabs.find((candidate) => candidate.key === value);
          if (tab) navigate(tab.basePath(personaId, mode));
        }}
        ariaLabel={t('persona.tabs.ariaLabel')}
      />
    </nav>
  );
}

function personaVisibilityLabel(persona: OwnerPortfolioPersonaDetail, t: ReturnType<typeof useStudioI18n>['t']): string {
  const visibility = persona.visibility.status === 'available' ? persona.visibility.value : '';
  if (visibility === 'public') return t('persona.workspace.public');
  if (visibility === 'unlisted') return t('visibility.value.unlisted');
  if (visibility === 'private') return t('persona.workspace.private');
  if (visibility === 'system') return t('visibility.value.system');
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
  const coverFallback = persona.profileCoverUrl.status === 'available-empty'
    ? t('persona.workspace.coverNotSet')
    : t('persona.workspace.coverUnavailable');
  return (
    <section className="ras-persona-profile-header">
      <div className="ras-persona-profile-header__cover">
        {coverAvailable ? (
          <img src={persona.profileCoverUrl.value} alt={t('persona.workspace.coverAlt', { name })} />
        ) : (
          <div className="ras-persona-profile-header__cover-unavailable">{coverFallback}</div>
        )}
      </div>
      <div className="ras-persona-profile-header__identity-row">
        <div className="ras-persona-profile-header__identity">
          <Avatar
            src={persona.avatarUrl ?? null}
            alt={persona.displayName.value || t('persona.header.personaCharacterAlt')}
            size="lg"
            shape="circle"
            tone="accent"
            className="ras-persona-profile-header__avatar"
            fallback={<span className="text-2xl font-semibold">{name.charAt(0).toUpperCase()}</span>}
          />
          <div className="ras-persona-profile-header__copy">
            <div className="ras-persona-profile-header__title-row">
              <h1>{name}</h1>
              <span className="ras-persona-profile-header__visibility">
                <i aria-hidden="true" />
                {personaVisibilityLabel(persona, t)}
              </span>
            </div>
            <p>{handle} <span aria-hidden="true">·</span> {world}</p>
          </div>
        </div>
        <div className="ras-persona-profile-header__actions">
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
  if (pathname.startsWith(`/portfolio/${personaId}/insights`)) return 'insights';
  if (pathname.startsWith(`/portfolio/${personaId}/launch`)) return 'launch';
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
  const visualPreview = usePersonaVisualPreview();
  const developmentFixturePersona = visualPreview?.details[personaId];
  const developmentVisualData = developmentFixturePersona
    ? visualPreview?.visualData[personaId]
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
      'invalid-input': 'portfolio.failure.settingReadUnavailable.title',
      'session-invalid': 'portfolio.failure.accessDenied.title',
      'access-denied': 'portfolio.failure.accessDenied.title',
      'owner-authority-missing': 'portfolio.failure.ownerAuthorityMissing.title',
      'not-found': 'portfolio.failure.portfolioUnavailable.title',
      'content-conflict': 'portfolio.failure.settingReadUnavailable.title',
      'realm-unavailable': 'portfolio.failure.realmUnavailable.title',
      'rate-limited': 'portfolio.failure.realmUnavailable.title',
      'upstream-failed': 'portfolio.failure.realmUnavailable.title',
      'contract-invalid': 'portfolio.failure.settingReadUnavailable.title',
      'request-too-large': 'portfolio.failure.settingReadUnavailable.title',
      'response-too-large': 'portfolio.failure.settingReadUnavailable.title',
    } as const satisfies Record<typeof failure.kind, StudioCopyKey>;
    const detailKeyByKind = {
      'capability-unavailable': 'portfolio.failure.detail.capabilityUnavailable',
      'invalid-input': 'portfolio.failure.detail.setting',
      'session-invalid': 'portfolio.failure.detail.accessDenied',
      'access-denied': 'portfolio.failure.detail.accessDenied',
      'owner-authority-missing': 'portfolio.failure.detail.owner',
      'not-found': 'portfolio.failure.detail.unknown',
      'content-conflict': 'portfolio.failure.detail.setting',
      'realm-unavailable': 'portfolio.failure.detail.realm',
      'rate-limited': 'portfolio.failure.detail.realm',
      'upstream-failed': 'portfolio.failure.detail.realm',
      'contract-invalid': 'portfolio.failure.detail.setting',
      'request-too-large': 'portfolio.failure.detail.setting',
      'response-too-large': 'portfolio.failure.detail.setting',
    } as const satisfies Record<typeof failure.kind, StudioCopyKey>;
    return (
      <ScrollArea className="flex-1" viewportClassName="bg-transparent">
        <div className="ras-page">
          <section className="ras-card">
            <InlineAlert tone={failure.kind === 'capability-unavailable' ? 'info' : 'danger'}>
              <strong>{t(titleKeyByKind[failure.kind])}</strong>
              <div>{t(detailKeyByKind[failure.kind])}</div>
              <StatusBadge tone="neutral">{failure.kind}</StatusBadge>
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
