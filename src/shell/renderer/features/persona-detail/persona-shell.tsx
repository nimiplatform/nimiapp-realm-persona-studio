import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AudioLines, BadgeCheck, Pause, Pencil, Play, Settings } from 'lucide-react';
import {
  ActionMenu,
  Avatar,
  Button,
  InlineAlert,
  LoadingSkeleton,
  nimiToast,
  PillTabs,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  StatusBadge,
  Surface,
} from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { classifyPersonaDetailFailure } from '@renderer/features/portfolio/portfolio-data.js';
import { failureKindCopyKey } from '@renderer/features/portfolio/failure-copy.js';
import { settingFieldDisplayValue } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { PersonaVisualIdentityDialog, PersonaVoiceEditorDialog } from '@renderer/features/portfolio/OwnerPortfolio.assets.js';
import { resolvePersonaVoiceSummary } from '@renderer/features/portfolio/persona-voice-summary.js';
import { PersonaSettingsModal } from '@renderer/features/persona-settings/persona-settings-modal.js';
import { VisibilityInlineSelect } from '@renderer/features/persona-settings/persona-visibility-select.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import {
  type PersonaDetailReadScope,
  usePersonaDetailQuery,
  useRefreshPersonaReads,
} from './use-persona-detail-query.js';
import { usePersonaVisualPreview } from './persona-visual-preview-context.js';

/**
 * Opens the persona settings editor dialog owned by `PersonaWorkspaceFrame`.
 * Available to anything rendered inside the frame (hero header edit action,
 * overview edit-profile action).
 */
const PersonaSettingsEditorContext = createContext<(() => void) | null>(null);

export function useOpenPersonaSettingsEditor(): () => void {
  const openSettingsEditor = useContext(PersonaSettingsEditorContext);
  if (!openSettingsEditor) {
    throw new Error('useOpenPersonaSettingsEditor must be used within PersonaWorkspaceFrame.');
  }
  return openSettingsEditor;
}

/**
 * Opens the visual identity change dialog owned by `PersonaWorkspaceFrame`.
 * Used by the hero avatar edit affordance.
 */
const PersonaVisualIdentityEditorContext = createContext<(() => void) | null>(null);

export function useOpenPersonaVisualIdentityEditor(): () => void {
  const openVisualIdentityEditor = useContext(PersonaVisualIdentityEditorContext);
  if (!openVisualIdentityEditor) {
    throw new Error('useOpenPersonaVisualIdentityEditor must be used within PersonaWorkspaceFrame.');
  }
  return openVisualIdentityEditor;
}

/**
 * Opens the voice editor dialog owned by `PersonaWorkspaceFrame`.
 * Used by the hero avatar voice affordance when no playable voice preview
 * exists.
 */
const PersonaVoiceEditorContext = createContext<(() => void) | null>(null);

export function useOpenPersonaVoiceEditor(): () => void {
  const openVoiceEditor = useContext(PersonaVoiceEditorContext);
  if (!openVoiceEditor) {
    throw new Error('useOpenPersonaVoiceEditor must be used within PersonaWorkspaceFrame.');
  }
  return openVoiceEditor;
}

export type PersonaShellTabKey = 'overview' | 'settings' | 'identity' | 'posts';
export type PersonaShellMode = PersonaDetailReadScope;

type PersonaTabDef = {
  key: PersonaShellTabKey;
  labelKey: StudioCopyKey;
  basePath: (personaId: string, mode: PersonaShellMode) => string;
  modes: readonly PersonaShellMode[];
};

const TABS: PersonaTabDef[] = [
  {
    key: 'overview',
    labelKey: 'persona.tabs.overview',
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
    key: 'identity',
    labelKey: 'persona.tabs.identity',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/identity`,
  },
  {
    key: 'posts',
    labelKey: 'persona.tabs.posts',
    modes: ['owner'],
    basePath: (personaId) => `/portfolio/${personaId}/posts`,
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
    <div className="ras-persona-tabs">
      <PillTabs
        ariaLabel={t('persona.tabs.ariaLabel')}
        value={current}
        items={tabs.map((tab) => ({ value: tab.key, label: t(tab.labelKey) }))}
        onValueChange={(value) => {
          const next = tabs.find((tab) => tab.key === value);
          if (next) navigate(next.basePath(personaId, mode));
        }}
      />
    </div>
  );
}

export function PersonaHeader({
  persona,
  compact = false,
}: {
  persona: OwnerPortfolioPersonaDetail;
  compact?: boolean;
}) {
  const { t } = useStudioI18n();
  const openSettingsEditor = useOpenPersonaSettingsEditor();
  const openVisualIdentityEditor = useOpenPersonaVisualIdentityEditor();
  const openVoiceEditor = useOpenPersonaVoiceEditor();
  const developmentVisualData = usePersonaVisualPreview()?.visualData[persona.id];
  const voiceSummary = resolvePersonaVoiceSummary(persona, developmentVisualData);
  const voicePreviewUrl = voiceSummary.kind === 'development-selected' ? voiceSummary.previewUrl : null;
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const name = settingFieldDisplayValue(persona.displayName, t('shared.displayNameNotSet'), t);
  const handle = persona.handle.value ? `@${persona.handle.value}` : settingFieldDisplayValue(persona.handle, t('shared.handleNotSet'), t);
  const world = settingFieldDisplayValue(persona.world, t('shared.worldNotSet'), t);
  const coverState = persona.profileCoverUrl.status === 'available' && persona.profileCoverUrl.value
    ? 'image'
    : persona.profileCoverUrl.status === 'available-empty'
      ? 'default'
      : 'unavailable';
  const voiceAriaLabel = voiceSummary.kind === 'not-configured'
    ? t('assets.overview.createVoice')
    : voiceSummary.kind === 'development-selected' && voicePreviewUrl
      ? t('assets.overview.voice.playbackAriaLabel', { fileName: voiceSummary.fileName })
      : t('assets.overview.editVoice');

  useEffect(() => {
    setIsVoicePlaying(false);
    setVoiceMenuOpen(false);
    voiceAudioRef.current?.pause();
    voiceAudioRef.current = null;
  }, [persona.id, voicePreviewUrl]);

  useEffect(() => () => {
    voiceAudioRef.current?.pause();
    voiceAudioRef.current = null;
  }, []);

  function stopVoicePlayback() {
    voiceAudioRef.current?.pause();
    voiceAudioRef.current = null;
    setIsVoicePlaying(false);
  }

  function toggleVoicePlayback() {
    if (!voicePreviewUrl) {
      return;
    }
    if (isVoicePlaying) {
      stopVoicePlayback();
      return;
    }
    const audio = new Audio(voicePreviewUrl);
    voiceAudioRef.current = audio;
    audio.onended = () => {
      voiceAudioRef.current = null;
      setIsVoicePlaying(false);
    };
    setIsVoicePlaying(true);
    void audio.play().catch(() => {
      voiceAudioRef.current = null;
      setIsVoicePlaying(false);
      nimiToast.info(t('assets.overview.voice.previewUnavailable'));
    });
  }

  function handleVoiceEdit() {
    stopVoicePlayback();
    setVoiceMenuOpen(false);
    openVoiceEditor();
  }

  const voiceButtonIcon = voiceSummary.kind === 'not-configured' ? (
    <AudioLines size={11} strokeWidth={2} aria-hidden="true" />
  ) : isVoicePlaying ? (
    <Pause size={11} strokeWidth={2} aria-hidden="true" />
  ) : (
    <Play size={11} strokeWidth={2} aria-hidden="true" />
  );

  if (compact) {
    return <header className="ras-persona-compact-header">
      <Avatar src={persona.avatarUrl ?? null} alt={name} size="md" shape="circle" tone="accent" fallback={name.charAt(0).toUpperCase()} />
      <div><h1>{name}</h1><p>{handle} · {world}</p></div>
      <VisibilityInlineSelect persona={persona} />
    </header>;
  }

  return (
    <section className="ras-persona-hero">
      <div className="ras-persona-hero__cover">
        {coverState === 'image' ? (
          <>
            <img src={persona.profileCoverUrl.value} alt={t('persona.workspace.coverAlt', { name })} />
            <div className="ras-persona-hero__cover-veil" aria-hidden="true" />
          </>
        ) : coverState === 'default' ? (
          <div
            className="ras-persona-hero__cover-default"
            role="img"
            aria-label={t('persona.workspace.coverNotSet')}
          />
        ) : (
          <div className="ras-persona-hero__cover-unavailable">{t('persona.workspace.coverUnavailable')}</div>
        )}
      </div>
      <div className="ras-persona-hero__body">
        <div className="ras-persona-hero__topline">
          <div className="ras-persona-hero__avatar-wrap">
            <Avatar
              src={persona.avatarUrl ?? null}
              alt={persona.displayName.value || t('persona.header.personaCharacterAlt')}
              size="lg"
              shape="circle"
              tone="accent"
              className="ras-persona-hero__avatar"
              fallback={<span className="text-3xl font-semibold">{name.charAt(0).toUpperCase()}</span>}
            />
            <button
              type="button"
              className="ras-persona-hero__avatar-edit"
              data-testid="persona-avatar-edit"
              aria-label={t('assets.visualChange.title')}
              onClick={openVisualIdentityEditor}
            >
              <Pencil size={11} strokeWidth={2} aria-hidden="true" />
            </button>
            {voiceSummary.kind === 'not-configured' || !voicePreviewUrl ? (
              <button
                type="button"
                className="ras-persona-hero__avatar-voice"
                data-testid="persona-avatar-voice"
                aria-label={voiceAriaLabel}
                onClick={handleVoiceEdit}
              >
                {voiceButtonIcon}
              </button>
            ) : (
              <Popover open={voiceMenuOpen} onOpenChange={setVoiceMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="ras-persona-hero__avatar-voice"
                    data-testid="persona-avatar-voice"
                    aria-label={voiceAriaLabel}
                    aria-haspopup="menu"
                    aria-expanded={voiceMenuOpen}
                  >
                    {voiceButtonIcon}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="border-0 bg-transparent p-0 shadow-none"
                >
                  <ActionMenu
                    ariaLabel={voiceAriaLabel}
                    items={[
                      {
                        id: 'voice-playback',
                        label: isVoicePlaying ? t('assets.overview.voice.pause') : t('assets.overview.voice.play'),
                        icon: isVoicePlaying
                          ? <Pause size={13} strokeWidth={2} aria-hidden="true" />
                          : <Play size={13} strokeWidth={2} aria-hidden="true" />,
                        onSelect: () => {
                          toggleVoicePlayback();
                          setVoiceMenuOpen(false);
                        },
                      },
                      {
                        id: 'voice-replace',
                        label: t('assets.overview.replaceVoice'),
                        icon: <AudioLines size={13} strokeWidth={2} aria-hidden="true" />,
                        onSelect: handleVoiceEdit,
                      },
                    ]}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="ras-persona-hero__actions">
            <VisibilityInlineSelect persona={persona} />
            <Button
              tone="primary"
              leadingIcon={<Settings size={15} />}
              onClick={openSettingsEditor}
            >
              {t('persona.overview.editAction')}
            </Button>
          </div>
        </div>
        <div className="ras-persona-hero__copy">
          <h1>
            <span className="ras-persona-hero__name">{name}</span>
            <BadgeCheck
              size={22}
              strokeWidth={2.1}
              className="ras-persona-hero__name-badge"
              role="img"
              aria-label={t('persona.profile.personaCharacterBadge')}
            />
          </h1>
          <p>{handle} <span aria-hidden="true">·</span> {world}</p>
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
    <Surface tone="card" padding="lg" className="ras-radius-xl">
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
    </Surface>
  );
}

function deriveCurrentTab(pathname: string, personaId: string): PersonaShellTabKey {
  const base = `/portfolio/${personaId}`;
  if (pathname.startsWith(`${base}/settings`)) return 'settings';
  if (pathname.startsWith(`${base}/identity`)) return 'identity';
  if (pathname.startsWith(`${base}/posts`)) return 'posts';
  return 'overview';
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
  const [settingsEditorOpen, setSettingsEditorOpen] = useState(false);
  const openSettingsEditor = useCallback(() => setSettingsEditorOpen(true), []);
  const [visualIdentityEditorOpen, setVisualIdentityEditorOpen] = useState(false);
  const openVisualIdentityEditor = useCallback(() => setVisualIdentityEditorOpen(true), []);
  const [voiceEditorOpen, setVoiceEditorOpen] = useState(false);
  const openVoiceEditor = useCallback(() => setVoiceEditorOpen(true), []);
  const refreshPersonaReads = useRefreshPersonaReads(persona.id, mode);
  return (
    <PersonaSettingsEditorContext.Provider value={openSettingsEditor}>
      <PersonaVisualIdentityEditorContext.Provider value={openVisualIdentityEditor}>
        <PersonaVoiceEditorContext.Provider value={openVoiceEditor}>
          <div className="ras-persona-workspace" data-view={current}>
            <section className="ras-persona-surface">
              <PersonaHeader persona={persona} compact={current === 'settings'} />
              <PersonaTabBar personaId={persona.id} current={current} mode={mode} />
              <div className="ras-persona-surface__content">{children}</div>
            </section>
          </div>
          <PersonaSettingsModal
            persona={persona}
            open={settingsEditorOpen}
            onClose={() => setSettingsEditorOpen(false)}
            onPersonaWrite={refreshPersonaReads}
          />
          <PersonaVisualIdentityDialog
            persona={persona}
            open={visualIdentityEditorOpen}
            onClose={() => setVisualIdentityEditorOpen(false)}
            onPersonaWrite={refreshPersonaReads}
          />
          <PersonaVoiceEditorDialog
            persona={persona}
            open={voiceEditorOpen}
            onClose={() => setVoiceEditorOpen(false)}
          />
        </PersonaVoiceEditorContext.Provider>
      </PersonaVisualIdentityEditorContext.Provider>
    </PersonaSettingsEditorContext.Provider>
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
  children: (persona: OwnerPortfolioPersonaDetail) => ReactNode;
}) {
  const { t } = useStudioI18n();
  const location = useLocation();
  const activeTab = current ?? deriveCurrentTab(location.pathname, personaId);
  const visualPreview = usePersonaVisualPreview();
  const developmentFixturePersona = visualPreview?.details[personaId];
  const detailQuery = usePersonaDetailQuery(personaId, mode, {
    enabled: developmentFixturePersona === undefined,
  });

  if (!developmentFixturePersona && detailQuery.isLoading) {
    return (
      <ScrollArea className="flex-1" viewportClassName="bg-transparent">
        <div className="ras-page">
          <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
            <div className="grid gap-4" aria-label={t('persona.loading.description')}>
              <LoadingSkeleton lines={2} label={t('persona.loading.title')} />
              <LoadingSkeleton lines={4} />
            </div>
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
          <Surface tone="card" padding="lg" className="ras-radius-xl grid gap-4">
            <InlineAlert tone={failure.kind === 'capability-unavailable' ? 'info' : 'danger'}>
              <strong>{t(titleKeyByKind[failure.kind])}</strong>
              <div>{t(detailKeyByKind[failure.kind])}</div>
              <StatusBadge tone="neutral">{t(failureKindCopyKey(failure.kind))}</StatusBadge>
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
          </Surface>
        </div>
      </ScrollArea>
    );
  }

  const persona = developmentFixturePersona ?? detailQuery.data;
  if (!persona) return null;

  return (
    <ScrollArea className="flex-1" viewportClassName="bg-transparent">
      <div className="ras-page ras-persona-workspace-page">
        <PersonaWorkspaceFrame key={persona.id} persona={persona} current={activeTab} mode={mode}>
          {children(persona)}
        </PersonaWorkspaceFrame>
      </div>
    </ScrollArea>
  );
}
