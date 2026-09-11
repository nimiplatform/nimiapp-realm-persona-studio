import { Quote } from 'lucide-react';
import { SettingsCard, SettingsSectionTitle } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail, SettingField } from '@renderer/features/portfolio/portfolio-data.js';
import {
  CreativeAssetActivityFeed,
} from '@renderer/features/portfolio/OwnerPortfolio.assets.js';
import {
  settingFieldDisplayValue,
  settingFieldLabel,
} from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import { FieldSourceAlert } from './persona-visibility-select.js';

/**
 * Read-only profile text value. Available values render as plain typography;
 * empty values render a muted not-set label; source gaps defer to the compact
 * alert chip.
 */
function ProfileTextValue({
  field,
  className,
}: {
  field: SettingField;
  className: string;
}) {
  const { t } = useStudioI18n();
  if (field.status !== 'available' && field.status !== 'available-empty') {
    return <FieldSourceAlert />;
  }
  const empty = field.value.trim().length === 0;
  return (
    <p className={className} data-empty={empty || undefined}>
      {settingFieldDisplayValue(field, t('common.notSet'), t)}
    </p>
  );
}

/**
 * Owner-facing persona settings page: a kit settings card that holds the
 * saved Realm profile (display name, character ID, world, greeting, bio) and
 * a second card for recent creative activity. Visibility switches inline from
 * the hero header select; profile text edits happen in the settings editor
 * dialog; media and voice changes happen in the candidate dialogs owned by
 * the workspace frame.
 */
export function PersonaSettingsOverview({
  persona,
}: {
  persona: OwnerPortfolioPersonaDetail;
}) {
  const { t } = useStudioI18n();
  const greetingAvailable = persona.greeting.status === 'available' || persona.greeting.status === 'available-empty';

  return (
    <div className="ras-settings">
      <SettingsCard>
        <div className="grid gap-4 p-5">
          <SettingsSectionTitle description={t('persona.settings.profileDescription')}>
            {t('settings.section.profile')}
          </SettingsSectionTitle>
          <div className="ras-profile-body">
            <div className="ras-profile-body__main">
              <div className="ras-profile-identity">
                <div className="ras-profile-field">
                  <div className="ras-profile-field__label">{settingFieldLabel(persona.displayName, t)}</div>
                  <ProfileTextValue field={persona.displayName} className="ras-profile-identity__value" />
                </div>
                <div className="ras-profile-field">
                  <div className="ras-profile-field__label">{settingFieldLabel(persona.handle, t)}</div>
                  <ProfileTextValue field={persona.handle} className="ras-profile-identity__value" />
                </div>
              </div>
              <div className="ras-profile-field">
                <div className="ras-profile-field__label">{settingFieldLabel(persona.world, t)}</div>
                <ProfileTextValue field={persona.world} className="ras-profile-field__value" />
              </div>
              <div className="ras-profile-field">
                <div className="ras-profile-field__label">{settingFieldLabel(persona.greeting, t)}</div>
                {greetingAvailable ? (
                  <blockquote className="ras-profile-greeting">
                    <Quote size={15} strokeWidth={2} className="ras-profile-greeting__icon" aria-hidden="true" />
                    <ProfileTextValue field={persona.greeting} className="ras-profile-greeting__text" />
                  </blockquote>
                ) : (
                  <FieldSourceAlert />
                )}
              </div>
              <div className="ras-profile-field">
                <div className="ras-profile-field__label">{settingFieldLabel(persona.bio, t)}</div>
                <ProfileTextValue field={persona.bio} className="ras-profile-field__value" />
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard>
        <div className="p-5">
          <CreativeAssetActivityFeed personaId={persona.id} />
        </div>
      </SettingsCard>
    </div>
  );
}
