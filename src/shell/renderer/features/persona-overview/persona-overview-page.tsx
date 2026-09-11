import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, Image, PenLine, TriangleAlert, UserRound } from 'lucide-react';
import { Button, InlineAlert, Statistic, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import {
  PersonaShell,
  WorkspaceIntro,
  useOpenPersonaSettingsEditor,
} from '@renderer/features/persona-detail/persona-shell.js';
import { CreativeAssetActivityFeed } from '@renderer/features/portfolio/OwnerPortfolio.assets.js';
import { loadLocalPostSchedule } from '@renderer/features/portfolio/local-post-schedule-store.js';
import type { OwnerPortfolioPersonaDetail, SettingField } from '@renderer/features/portfolio/portfolio-data.js';
import { settingFieldDisplayValue } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';

type OverviewHint = {
  id: 'profile-source-gap' | 'identity-source-gap' | 'identity-missing' | 'review-schedule' | 'compose-post';
  copyKey: StudioCopyKey;
  copyOptions?: { time: string };
  actionLabelKey: StudioCopyKey;
  actionPath: string;
};

const HINT_ICONS: Record<OverviewHint['id'], typeof TriangleAlert> = {
  'profile-source-gap': TriangleAlert,
  'identity-source-gap': TriangleAlert,
  'identity-missing': Image,
  'review-schedule': CalendarClock,
  'compose-post': PenLine,
};

function isSourceGap(field: SettingField): boolean {
  return field.status === 'source-unavailable';
}

function hasValue(field: SettingField): boolean {
  return field.status === 'available' && field.value.trim().length > 0;
}

/**
 * Next-step hints derived only from loaded persona state: Realm source gaps,
 * missing visual identity, and the single app-local post schedule. Every hint
 * links to the workspace that owns the underlying field; nothing is inferred
 * from private or unavailable state.
 */
function deriveOverviewHints(persona: OwnerPortfolioPersonaDetail): OverviewHint[] {
  const base = `/portfolio/${persona.id}`;
  const hints: OverviewHint[] = [];

  if ([persona.displayName, persona.handle, persona.bio, persona.greeting].some(isSourceGap)) {
    hints.push({
      id: 'profile-source-gap',
      copyKey: 'overview.hint.profileSourceGap',
      actionLabelKey: 'overview.action.openSettings',
      actionPath: `${base}/settings`,
    });
  }

  if (isSourceGap(persona.profileCoverUrl)) {
    hints.push({
      id: 'identity-source-gap',
      copyKey: 'overview.hint.identitySourceGap',
      actionLabelKey: 'overview.action.openIdentity',
      actionPath: `${base}/identity`,
    });
  } else if (!persona.avatarUrl || !hasValue(persona.profileCoverUrl)) {
    hints.push({
      id: 'identity-missing',
      copyKey: 'overview.hint.identityMissing',
      actionLabelKey: 'overview.action.openIdentity',
      actionPath: `${base}/identity`,
    });
  }

  const localSchedule = loadLocalPostSchedule(persona.id);
  if (localSchedule) {
    hints.push({
      id: 'review-schedule',
      copyKey: 'overview.hint.reviewSchedule',
      copyOptions: { time: new Date(localSchedule.localRunAt).toLocaleString() },
      actionLabelKey: 'overview.action.openPosts',
      actionPath: `${base}/posts`,
    });
  } else {
    hints.push({
      id: 'compose-post',
      copyKey: 'overview.hint.composePost',
      actionLabelKey: 'overview.action.openPosts',
      actionPath: `${base}/posts`,
    });
  }

  return hints;
}

function OverviewNextSteps({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const hints = useMemo(() => deriveOverviewHints(persona), [persona]);

  return (
    <Surface tone="card" padding="lg" className="ras-radius-xl">
      <div className="ras-workspace-intro">
        <div className="ras-workspace-intro__copy">
          <h2 className="ras-workspace-intro__title">{t('overview.nextSteps.title')}</h2>
        </div>
      </div>
      {hints.length === 0 ? (
        <p className="m-0 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
          {t('overview.nextSteps.empty')}
        </p>
      ) : (
        <ul className="m-0 mt-3 grid list-none gap-2 p-0">
          {hints.map((hint) => {
            const HintIcon = HINT_ICONS[hint.id];
            return (
              <li key={hint.id} className="flex min-w-0 flex-wrap items-center gap-3">
                <HintIcon size={15} strokeWidth={1.9} className="shrink-0 text-[var(--nimi-text-muted)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-primary)]">
                  {t(hint.copyKey, hint.copyOptions)}
                </span>
                <Button tone="ghost" size="sm" onClick={() => navigate(hint.actionPath)}>
                  {t(hint.actionLabelKey)}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

/**
 * Presentational public-profile card driven by the real persona record. It
 * renders the same public fields a Realm profile exposes (cover, avatar,
 * name, handle, description, greeting) and stays honest about field-level
 * source gaps instead of filling placeholders.
 */
function OverviewPublicProfilePreview({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const profileCoverAvailable = hasValue(persona.profileCoverUrl);
  const profileCoverUnavailable = isSourceGap(persona.profileCoverUrl);

  return (
    <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('overview.preview.title')}</h2>
        <StatusBadge tone="info">{t('overview.preview.savedInRealm')}</StatusBadge>
      </div>
      <div className="mt-3 overflow-hidden rounded-[var(--nimi-radius-panel)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)]">
        <div className="relative min-h-52 bg-[var(--nimi-surface-panel)]">
          {profileCoverAvailable ? (
            <img src={persona.profileCoverUrl.value} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="flex min-h-52 items-center justify-center text-[var(--nimi-text-muted)]">
              <Image size={36} strokeWidth={1.6} />
            </div>
          )}
          <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)]">
              {persona.avatarUrl ? (
                <img src={persona.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={30} strokeWidth={1.8} />
              )}
            </div>
            <div className="min-w-0 rounded-[var(--nimi-radius-field)] bg-[color-mix(in_srgb,var(--nimi-surface-card)_88%,transparent)] p-3">
              <h3 className="m-0 text-xl font-semibold">{settingFieldDisplayValue(persona.displayName, t('shared.displayNameNotSet'), t)}</h3>
              <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                {persona.handle.value ? `@${persona.handle.value}` : settingFieldDisplayValue(persona.handle, t('shared.handleNotSet'), t)}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-4">
          <div>
            <div className="text-[length:var(--nimi-type-body-xs-size)] font-semibold uppercase text-[var(--nimi-text-muted)]">{t('overview.preview.publicDescription')}</div>
            <p className="ras-break-anywhere m-0 mt-1 text-[var(--nimi-text-primary)]">
              {settingFieldDisplayValue(persona.bio, t('shared.profileDescriptionNotSet'), t)}
            </p>
          </div>
          <div>
            <div className="text-[length:var(--nimi-type-body-xs-size)] font-semibold uppercase text-[var(--nimi-text-muted)]">{t('overview.preview.greeting')}</div>
            <p className="ras-break-anywhere m-0 mt-1 text-[var(--nimi-text-primary)]">
              {settingFieldDisplayValue(persona.greeting, t('common.notSet'), t)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={persona.displayName.status === 'available' ? 'success' : 'warning'}>{t('overview.preview.profileSource')}</StatusBadge>
            <StatusBadge tone={profileCoverAvailable ? 'success' : profileCoverUnavailable ? 'warning' : 'neutral'}>
              {profileCoverAvailable ? t('overview.preview.coverAvailable') : profileCoverUnavailable ? t('identity.visual.coverSourceUnavailable') : t('overview.preview.coverMissing')}
            </StatusBadge>
            <StatusBadge tone="neutral">{settingFieldDisplayValue(persona.world, t('shared.worldNotSet'), t)}</StatusBadge>
          </div>
        </div>
      </div>
      <InlineAlert tone="info" className="mt-3">
        {t('overview.preview.boundary')}
      </InlineAlert>
    </Surface>
  );
}

function OverviewBody({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const openSettingsEditor = useOpenPersonaSettingsEditor();

  return (
    <>
      <WorkspaceIntro
        title={t('overview.title')}
        description={t('overview.description')}
        actions={
          <Button tone="secondary" onClick={openSettingsEditor}>
            {t('overview.editProfile')}
          </Button>
        }
      />

      <OverviewNextSteps persona={persona} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <OverviewPublicProfilePreview persona={persona} />

        <div className="grid content-start gap-4">
          <Surface tone="card" padding="md">
            <Statistic
              label={t('persona.profile.friendCountLabel')}
              value={persona.friendCount.status === 'available'
                ? persona.friendCount.value
                : t('portfolio.card.friendCountUnavailable')}
              tone={persona.friendCount.status === 'available' ? 'primary' : 'warning'}
            />
          </Surface>
          <Surface tone="card" padding="md">
            <CreativeAssetActivityFeed personaId={persona.id} />
          </Surface>
        </div>
      </div>
    </>
  );
}

export function PersonaOverviewPage() {
  const { t } = useStudioI18n();
  const { personaId } = useParams<{ personaId: string }>();

  if (!personaId) {
    return (
      <Surface tone="panel" material="glass-regular" padding="lg">
        <InlineAlert tone="danger">{t('common.personaIdMissing')}</InlineAlert>
      </Surface>
    );
  }

  return (
    <PersonaShell personaId={personaId} current="overview">
      {(persona) => <OverviewBody persona={persona} />}
    </PersonaShell>
  );
}
