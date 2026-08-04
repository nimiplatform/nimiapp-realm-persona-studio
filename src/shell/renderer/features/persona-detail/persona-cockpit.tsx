import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { useLocalCreativeAssetHistory } from '@renderer/features/portfolio/use-local-creative-asset-history.js';
import { loadLocalPostSchedule } from '@renderer/features/portfolio/local-post-schedule-store.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { detailFriendCountLabel, settingFieldDisplayValue } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import type { StudioTranslateOptions } from '@renderer/i18n/studio-i18n.js';
import { PersonaProfileOverview } from './persona-profile-overview.js';
import { WorkspaceIntro } from './persona-shell.js';
import {
  derivePersonaCockpitModel,
  type PersonaCockpitAction,
  type PersonaCockpitActionKey,
  type PersonaCockpitCard,
  type PersonaCockpitCardStatus,
} from './persona-cockpit-model.js';
import {
  deriveMaintenanceSuggestions,
  type MaintenanceSuggestion,
  type MaintenanceSuggestionPriority,
  type MaintenanceSuggestionRoute,
  type MaintenanceSuggestionStatus,
} from './maintenance-suggestion.js';

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

function statusTone(status: PersonaCockpitCardStatus | MaintenanceSuggestionStatus): 'success' | 'warning' | 'neutral' | 'info' {
  if (status === 'ready') return 'success';
  if (status === 'missing' || status === 'unavailable' || status === 'blocked') return 'warning';
  return 'neutral';
}

function actionPath(personaId: string, action: PersonaCockpitAction): string {
  if (action.route === 'settings') return `/portfolio/${personaId}/settings`;
  if (action.route === 'assets') return `/portfolio/${personaId}/assets`;
  if (action.route === 'posts') return `/portfolio/${personaId}/posts`;
  return `/portfolio/${personaId}/insights`;
}

function suggestionPath(personaId: string, route: MaintenanceSuggestionRoute): string {
  if (route === 'settings') return `/portfolio/${personaId}/settings`;
  if (route === 'assets') return `/portfolio/${personaId}/assets`;
  if (route === 'posts') return `/portfolio/${personaId}/posts`;
  if (route === 'schedule') return `/portfolio/${personaId}/posts/schedule`;
  return `/portfolio/${personaId}/insights`;
}

const STATUS_LABEL_KEYS: Record<PersonaCockpitCardStatus | MaintenanceSuggestionStatus, StudioCopyKey> = {
  ready: 'persona.cockpit.status.ready',
  missing: 'persona.cockpit.status.missing',
  unavailable: 'persona.cockpit.status.unavailable',
  blocked: 'persona.cockpit.status.blocked',
};

const PRIORITY_LABEL_KEYS: Record<MaintenanceSuggestionPriority, StudioCopyKey> = {
  high: 'persona.cockpit.priority.high',
  medium: 'persona.cockpit.priority.medium',
  low: 'persona.cockpit.priority.low',
};

const ACTION_LABEL_KEYS: Record<PersonaCockpitActionKey, StudioCopyKey> = {
  'improve-settings': 'persona.cockpit.action.improveSettings.label',
  'generate-identity': 'persona.cockpit.action.generateIdentity.label',
  'create-post': 'persona.cockpit.action.createPost.label',
  'review-visibility': 'persona.cockpit.action.reviewVisibility.label',
  'inspect-source': 'persona.cockpit.action.inspectSource.label',
};

const ACTION_REASON_KEYS: Record<PersonaCockpitActionKey, StudioCopyKey> = {
  'improve-settings': 'persona.cockpit.action.improveSettings.reason',
  'generate-identity': 'persona.cockpit.action.generateIdentity.reason',
  'create-post': 'persona.cockpit.action.createPost.reason',
  'review-visibility': 'persona.cockpit.action.reviewVisibility.reason',
  'inspect-source': 'persona.cockpit.action.inspectSource.reason',
};

const CARD_TITLE_KEYS: Record<PersonaCockpitCard['key'], StudioCopyKey> = {
  profile: 'persona.cockpit.card.profile.title',
  'ai-readiness': 'persona.cockpit.card.aiReadiness.title',
  identity: 'persona.cockpit.card.identity.title',
  content: 'persona.cockpit.card.content.title',
  adoption: 'persona.cockpit.card.adoption.title',
};

const CARD_SUMMARY_KEYS: Record<string, StudioCopyKey> = {
  'Realm did not return all required profile fields.': 'persona.cockpit.card.profile.summary.unavailable',
  'Public profile needs owner-reviewed completion.': 'persona.cockpit.card.profile.summary.missing',
  'Public profile fields are source-backed.': 'persona.cockpit.card.profile.summary.ready',
  'Runtime actions can use only visible owner-approved profile fields and explicit owner prompts.': 'persona.cockpit.card.aiReadiness.summary',
  'Profile media source is unavailable from Realm.': 'persona.cockpit.card.identity.summary.unavailable',
  'Avatar, cover, or voice candidates need owner review.': 'persona.cockpit.card.identity.summary.missing',
  'Identity media has source-backed profile evidence.': 'persona.cockpit.card.identity.summary.ready',
  'Post drafts need stronger profile voice evidence before generation.': 'persona.cockpit.card.content.summary.missing',
  'Profile voice is available for owner-reviewed post drafting.': 'persona.cockpit.card.content.summary.ready',
  'friendCount source is unavailable; no fallback metric is shown.': 'persona.cockpit.card.adoption.summary.unavailable',
};

const EVIDENCE_LABEL_KEYS: Record<string, StudioCopyKey> = {
  'Display name': 'persona.cockpit.field.displayName',
  Handle: 'persona.cockpit.field.handle',
  'Profile description': 'persona.cockpit.field.profileDescription',
  Greeting: 'persona.cockpit.field.greeting',
  'Profile cover URL': 'persona.cockpit.field.profileCoverUrl',
  world: 'persona.cockpit.field.world',
  state: 'persona.cockpit.field.state',
  Avatar: 'persona.cockpit.field.avatar',
  'Voice config': 'persona.cockpit.field.voiceConfig',
  friendCount: 'persona.cockpit.field.friendCount',
};

const EVIDENCE_STATUS_KEYS: Record<string, StudioCopyKey> = {
  available: 'common.available',
  'not set': 'common.notSet',
  'source unavailable': 'common.sourceUnavailable',
  'runtime-image-candidate': 'persona.maintenance.kind.runtimeImageCandidate',
  'avatar-package-candidate': 'persona.maintenance.kind.avatarPackageCandidate',
  'identity-resource-upload': 'persona.maintenance.kind.identityResourceUpload',
  'voice-demo-candidate': 'persona.maintenance.kind.voiceDemoCandidate',
};

const SIGNAL_LABEL_KEYS: Record<string, StudioCopyKey> = {
  'display name': 'persona.cockpit.field.displayName',
  handle: 'persona.cockpit.field.handle',
  'profile description': 'persona.cockpit.field.profileDescription',
  greeting: 'persona.cockpit.field.greeting',
  'profile cover URL': 'persona.cockpit.field.profileCoverUrl',
  world: 'persona.cockpit.field.world',
  state: 'persona.cockpit.field.state',
  avatar: 'persona.cockpit.field.avatar',
  friendCount: 'persona.cockpit.field.friendCount',
};

const MAINTENANCE_COPY_KEYS: Record<string, { title: StudioCopyKey; rationale: StudioCopyKey }> = {
  'profile-source-unavailable': {
    title: 'persona.maintenance.profileSourceUnavailable.title',
    rationale: 'persona.maintenance.profileSourceUnavailable.rationale',
  },
  'complete-profile-voice': {
    title: 'persona.maintenance.completeProfileVoice.title',
    rationale: 'persona.maintenance.completeProfileVoice.rationale',
  },
  'identity-source-unavailable': {
    title: 'persona.maintenance.identitySourceUnavailable.title',
    rationale: 'persona.maintenance.identitySourceUnavailable.rationale',
  },
  'generate-identity-pack': {
    title: 'persona.maintenance.generateIdentityPack.title',
    rationale: 'persona.maintenance.generateIdentityPack.rationale',
  },
  'review-local-creative-candidate': {
    title: 'persona.maintenance.reviewLocalCreativeCandidate.title',
    rationale: 'persona.maintenance.reviewLocalCreativeCandidate.rationale',
  },
  'content-source-unavailable': {
    title: 'persona.maintenance.contentSourceUnavailable.title',
    rationale: 'persona.maintenance.contentSourceUnavailable.rationale',
  },
  'strengthen-content-voice': {
    title: 'persona.maintenance.strengthenContentVoice.title',
    rationale: 'persona.maintenance.strengthenContentVoice.rationale',
  },
  'create-content-variant': {
    title: 'persona.maintenance.createContentVariant.title',
    rationale: 'persona.maintenance.createContentVariant.rationale',
  },
  'review-local-post-schedule': {
    title: 'persona.maintenance.reviewLocalPostSchedule.title',
    rationale: 'persona.maintenance.reviewLocalPostSchedule.rationale',
  },
  'friendcount-source-unavailable': {
    title: 'persona.maintenance.friendCountSourceUnavailable.title',
    rationale: 'persona.maintenance.friendCountSourceUnavailable.rationale',
  },
};

const MAINTENANCE_ACTION_KEYS: Record<MaintenanceSuggestionRoute, StudioCopyKey> = {
  settings: 'persona.maintenance.action.openSettings',
  assets: 'persona.maintenance.action.openAssets',
  posts: 'persona.maintenance.action.openPosts',
  schedule: 'persona.maintenance.action.openSchedule',
  insights: 'persona.maintenance.action.inspectSource',
};

function translateEvidenceItem(item: string, t: StudioTranslator): string {
  if (item.startsWith('Created: ')) {
    return t('persona.maintenance.created', { value: item.slice('Created: '.length) });
  }
  if (item.startsWith('Run at: ')) {
    return t('persona.maintenance.runAt', { value: item.slice('Run at: '.length) });
  }
  if (item === 'Scope: app-local foreground execution') {
    return t('persona.maintenance.scopeAppLocalForeground');
  }

  const separator = item.indexOf(': ');
  if (separator === -1) return item;
  const label = item.slice(0, separator);
  const status = item.slice(separator + 2);
  const labelText = EVIDENCE_LABEL_KEYS[label] ? t(EVIDENCE_LABEL_KEYS[label]) : label;
  const statusText = EVIDENCE_STATUS_KEYS[status] ? t(EVIDENCE_STATUS_KEYS[status]) : status;
  return t('persona.cockpit.evidence', { label: labelText, status: statusText });
}

function translateSignal(signal: string, t: StudioTranslator): string {
  return SIGNAL_LABEL_KEYS[signal] ? t(SIGNAL_LABEL_KEYS[signal]) : signal;
}

function translateCardSummary(card: PersonaCockpitCard, persona: OwnerPortfolioPersonaDetail, t: StudioTranslator): string {
  if (card.key === 'adoption' && persona.friendCount.status === 'available') {
    return t('persona.cockpit.card.adoption.summary.available', { count: persona.friendCount.value });
  }
  const key = CARD_SUMMARY_KEYS[card.summary];
  return key ? t(key) : card.summary;
}

function translateSuggestionTitle(suggestion: MaintenanceSuggestion, t: StudioTranslator): string {
  const copy = MAINTENANCE_COPY_KEYS[suggestion.id];
  return copy ? t(copy.title) : suggestion.title;
}

function translateSuggestionRationale(suggestion: MaintenanceSuggestion, t: StudioTranslator): string {
  const copy = MAINTENANCE_COPY_KEYS[suggestion.id];
  return copy ? t(copy.rationale) : suggestion.rationale;
}

export function PersonaCockpit({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const model = derivePersonaCockpitModel(persona);
  const creativeHistoryState = useLocalCreativeAssetHistory(persona.id);
  const creativeHistory = creativeHistoryState.records;
  const localPostSchedule = useMemo(() => loadLocalPostSchedule(persona.id), [persona.id]);
  const suggestions = deriveMaintenanceSuggestions({ persona, creativeHistory, localPostSchedule });
  const actionsByKey = new Map(model.actions.map((action) => [action.key, action]));

  return (
    <>
      <WorkspaceIntro
        title={t('persona.cockpit.title')}
        badges={
          <>
            <StatusBadge tone="info">{t('common.sourceBacked')}</StatusBadge>
            <StatusBadge tone={model.unavailableSignals.length > 0 ? 'warning' : 'success'}>
              {model.unavailableSignals.length > 0 ? t('persona.cockpit.sourceGaps') : t('persona.cockpit.sourcesAvailable')}
            </StatusBadge>
          </>
        }
        description={t('persona.cockpit.description')}
      />

      {creativeHistoryState.unavailable ? <InlineAlert tone="warning">{t('assets.history.unavailable')}</InlineAlert> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <PersonaProfileOverview persona={persona} compact />

          <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('persona.cockpit.nextActions')}</h3>
                <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                  {t('persona.cockpit.nextActionsDescription')}
                </p>
              </div>
              <StatusBadge tone="neutral">{t('persona.cockpit.noPrivateRuntimeState')}</StatusBadge>
            </div>
            {model.unavailableSignals.length > 0 ? (
              <InlineAlert tone="warning" className="mt-3">
                {t('persona.cockpit.sourceUnavailable', {
                  fields: model.unavailableSignals.map((signal) => translateSignal(signal, t)).join(', '),
                })}
              </InlineAlert>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {model.actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => navigate(actionPath(persona.id, action))}
                  className="rounded-[var(--nimi-radius-card)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-left transition hover:border-[var(--nimi-action-primary-bg)]"
                >
                  <div className="font-medium">{t(ACTION_LABEL_KEYS[action.key])}</div>
                  <div className="mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t(ACTION_REASON_KEYS[action.key])}
                  </div>
                </button>
              ))}
            </div>
          </Surface>

          <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('persona.cockpit.maintenanceSuggestions')}</h3>
                <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                  {t('persona.cockpit.maintenanceDescription')}
                </p>
              </div>
              <StatusBadge tone="info">{t('persona.cockpit.candidateGuidance')}</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="rounded-[var(--nimi-radius-card)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{translateSuggestionTitle(suggestion, t)}</div>
                      <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                        {translateSuggestionRationale(suggestion, t)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={statusTone(suggestion.status)}>{t(STATUS_LABEL_KEYS[suggestion.status])}</StatusBadge>
                      <StatusBadge tone="neutral">{t(PRIORITY_LABEL_KEYS[suggestion.priority])}</StatusBadge>
                    </div>
                  </div>
                  <ul className="m-0 mt-3 grid list-none gap-1 p-0 text-[length:var(--nimi-type-body-sm-size)]">
                    {suggestion.evidence.map((item) => (
                      <li key={item} className="ras-break-anywhere text-[var(--nimi-text-secondary)]">{translateEvidenceItem(item, t)}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      tone="secondary"
                      size="sm"
                      onClick={() => navigate(suggestionPath(persona.id, suggestion.action.route))}
                    >
                      {t(MAINTENANCE_ACTION_KEYS[suggestion.action.route])}
                    </Button>
                    <span className="text-[length:var(--nimi-type-body-xs-size)] text-[var(--nimi-text-muted)]">
                      {suggestion.sources.join(' + ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <div className="grid gap-3 md:grid-cols-2">
            {model.cards.map((card) => (
              <Surface key={card.key} tone="card" padding="md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{t(CARD_TITLE_KEYS[card.key])}</div>
                  <StatusBadge tone={statusTone(card.status)}>{t(STATUS_LABEL_KEYS[card.status])}</StatusBadge>
                </div>
                <p className="m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                  {translateCardSummary(card, persona, t)}
                </p>
                <ul className="m-0 mt-3 grid list-none gap-1 p-0 text-[length:var(--nimi-type-body-sm-size)]">
                  {card.evidence.map((item) => (
                    <li key={item} className="ras-break-anywhere text-[var(--nimi-text-secondary)]">{translateEvidenceItem(item, t)}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.actions.map((actionKey) => {
                    const action = actionsByKey.get(actionKey);
                    if (!action) return null;
                    return (
                      <Button
                        key={actionKey}
                        tone="secondary"
                        size="sm"
                        onClick={() => navigate(actionPath(persona.id, action))}
                      >
                        {t(ACTION_LABEL_KEYS[action.key])}
                      </Button>
                    );
                  })}
                </div>
              </Surface>
            ))}
          </div>
        </div>

        <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
          <div className="grid gap-3">
            <div>
              <h3 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('persona.cockpit.sourceInventory')}</h3>
              <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                {t('persona.cockpit.currentSource', { source: persona.source })}
              </p>
            </div>
            {([
              [t('persona.cockpit.inventory.displayName'), settingFieldDisplayValue(persona.displayName, t('common.notSet'), t)],
              [t('persona.cockpit.inventory.handle'), settingFieldDisplayValue(persona.handle, t('common.notSet'), t)],
              [t('persona.cockpit.inventory.profileDescription'), settingFieldDisplayValue(persona.bio, t('common.notSet'), t)],
              [t('persona.cockpit.inventory.greeting'), settingFieldDisplayValue(persona.greeting, t('common.notSet'), t)],
              [t('persona.cockpit.inventory.world'), settingFieldDisplayValue(persona.world, t('common.notSet'), t)],
              [t('persona.cockpit.inventory.state'), settingFieldDisplayValue(persona.state, t('common.notSet'), t)],
              [t('persona.cockpit.inventory.profileCover'), settingFieldDisplayValue(persona.profileCoverUrl, t('common.notSet'), t)],
              [t('persona.cockpit.inventory.avatar'), persona.avatarUrl || t('common.notSet')],
              ['friendCount', detailFriendCountLabel(persona, t)],
            ] as const).map(([label, value]) => (
              <div key={label} className="grid gap-1 rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-2">
                <div className="text-[length:var(--nimi-type-body-xs-size)] font-semibold uppercase text-[var(--nimi-text-muted)]">{label}</div>
                <div className="ras-break-anywhere text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-primary)]">{value}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </>
  );
}
