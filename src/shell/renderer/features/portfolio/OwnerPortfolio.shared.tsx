import { ArrowRight } from 'lucide-react';
import { StatusBadge } from '@nimiplatform/kit/ui';
import { translateStudioCopy, type StudioTranslateOptions } from '../../i18n/studio-i18n.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import type { OwnerPortfolioPersona, SettingField, SettingFieldKey } from './portfolio-data.js';

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

export type PersonaLibraryStatus = 'local-draft' | 'public' | 'unlisted' | 'private' | 'system';

const PERSONA_LIBRARY_STATUS_PRESENTATION: Record<
  PersonaLibraryStatus,
  { labelKey: StudioCopyKey; tone: 'info' | 'warning' | 'success' }
> = {
  'local-draft': { labelKey: 'portfolio.status.localDraft', tone: 'info' },
  public: { labelKey: 'persona.workspace.public', tone: 'success' },
  unlisted: { labelKey: 'visibility.value.unlisted', tone: 'info' },
  private: { labelKey: 'persona.workspace.private', tone: 'warning' },
  system: { labelKey: 'visibility.value.system', tone: 'warning' },
};

const SETTING_FIELD_LABEL_KEYS: Record<SettingFieldKey, StudioCopyKey> = {
  displayName: 'settingField.displayName',
  handle: 'settingField.handle',
  bio: 'settingField.bio',
  greeting: 'settingField.greeting',
  profileCoverUrl: 'settingField.profileCoverUrl',
  ownership: 'settingField.ownership',
  world: 'settingField.world',
  visibility: 'settingField.visibility',
};

export function friendCountLabel(persona: OwnerPortfolioPersona, t: StudioTranslator = translateStudioCopy) {
  if (persona.friendCount.status === 'available') {
    return t('shared.friendCount.available', { count: persona.friendCount.value });
  }
  return t('shared.friendCount.unavailable');
}

export function settingFieldLabel(field: SettingField, t: StudioTranslator = translateStudioCopy): string {
  return t(SETTING_FIELD_LABEL_KEYS[field.key]);
}

export function settingFieldDisplayValue(
  field: SettingField,
  emptyLabel = translateStudioCopy('common.notSet'),
  t: StudioTranslator = translateStudioCopy,
): string {
  if (field.value) return field.value;
  if (field.status === 'available-empty') return emptyLabel;
  return t('shared.fieldStatus.sourceUnavailable');
}

export function PersonaLibraryStatusBadge({ status }: { status: PersonaLibraryStatus }) {
  const { t } = useStudioI18n();
  const presentation = PERSONA_LIBRARY_STATUS_PRESENTATION[status];
  return (
    <StatusBadge tone={presentation.tone} className="ras-persona-library-status">
      {t(presentation.labelKey)}
    </StatusBadge>
  );
}

export function personaLibraryStatusFromVisibility(
  visibility: OwnerPortfolioPersona['visibility'],
): PersonaLibraryStatus {
  return visibility;
}

export function PersonaCard({
  persona,
  worldBannerUrl,
  worldName = persona.worldName,
  active,
  onSelect,
}: {
  persona: OwnerPortfolioPersona;
  worldBannerUrl: string | null;
  worldName?: string | null;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useStudioI18n();
  return (
    <article className="ras-world-persona-card" data-active={active || undefined}>
      <div className="ras-world-persona-card__visual">
        {persona.avatarUrl ? (
          <img
            className="ras-world-persona-card__portrait"
            src={persona.avatarUrl}
            alt={persona.displayName}
          />
        ) : worldBannerUrl ? (
          <>
            <img
              className="ras-world-persona-card__world-backdrop"
              src={worldBannerUrl}
              alt=""
            />
            <span className="ras-world-persona-card__image-unavailable">
              {t('portfolio.card.imageUnavailable')}
            </span>
          </>
        ) : (
          <span className="ras-world-persona-card__image-unavailable">
            {t('portfolio.card.imageUnavailable')}
          </span>
        )}
        <span
          className="ras-world-persona-card__world-label"
          data-unavailable={worldName ? undefined : true}
        >
          {worldName || t('shared.worldUnavailable')}
        </span>
      </div>
      <div className="ras-world-persona-card__panel">
        <div className="ras-world-persona-card__identity">
          <div className="ras-world-persona-card__title-row">
            <h2>{persona.displayName}</h2>
            <PersonaLibraryStatusBadge status={personaLibraryStatusFromVisibility(persona.visibility)} />
          </div>
          <p>
            {persona.handle === null
              ? t('shared.fieldStatus.sourceUnavailable')
              : persona.handle
                ? `@${persona.handle}`
                : t('shared.handleNotSet')}
          </p>
        </div>
        <div className="ras-world-persona-card__footer">
          <div className="ras-world-persona-card__friend-count">
            <StatusBadge tone={persona.friendCount.status === 'available' ? 'success' : 'warning'} shape="dot">
              {persona.friendCount.status === 'available'
                ? friendCountLabel(persona, t)
                : t('portfolio.card.friendCountUnavailable')}
            </StatusBadge>
          </div>
          <button
            type="button"
            className="ras-world-persona-card__enter"
            aria-label={t('portfolio.card.enter', { persona: persona.displayName })}
            title={t('portfolio.card.enter', { persona: persona.displayName })}
            onClick={onSelect}
          >
            <ArrowRight size={22} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
