import { InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import {
  EvidenceCard,
  ReadOnlySettingField,
  detailFriendCountLabel,
  ownerScopeLabel,
  settingFieldDisplayValue,
} from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

export function PersonaProfileOverview({
  persona,
  compact = false,
}: {
  persona: OwnerPortfolioPersonaDetail;
  compact?: boolean;
}) {
  const { t } = useStudioI18n();
  return (
    <Surface tone="panel" material="glass-regular" padding={compact ? 'md' : 'lg'} className="ras-radius-xl">
      <div
        className="ras-profile-grid"
        data-compact={compact || undefined}
      >
        <div className={compact ? 'ras-profile-cover ras-profile-cover--compact' : 'ras-profile-cover'}>
          {compact ? (
            persona.avatarUrl ? <img src={persona.avatarUrl} alt="" className="ras-profile-cover__img" /> : null
          ) : (
            <>
              <div className="ras-profile-cover__hero">
                {persona.profileCoverUrl.status === 'available' ? (
                  <img src={persona.profileCoverUrl.value} alt="" className="ras-profile-cover__img" />
                ) : null}
              </div>
              <div className="ras-profile-cover__heading">
                <div className="ras-profile-cover__title-row">
                  <h2 className="ras-break-anywhere ras-profile-cover__title">
                    {settingFieldDisplayValue(persona.displayName, t('shared.displayNameNotSet'), t)}
                  </h2>
                  <StatusBadge tone="info">{t('persona.profile.realmPersonaBadge')}</StatusBadge>
                  <StatusBadge tone="neutral">{t('persona.profile.currentProfileBadge')}</StatusBadge>
                </div>
                <p className="ras-break-anywhere ras-profile-cover__handle">
                  {persona.handle.value ? `@${persona.handle.value}` : settingFieldDisplayValue(persona.handle, t('shared.handleNotSet'), t)}
                </p>
              </div>
              <div className="ras-profile-fields">
                <ReadOnlySettingField field={persona.displayName} />
                <ReadOnlySettingField field={persona.handle} />
                <ReadOnlySettingField field={persona.bio} multiline />
                <ReadOnlySettingField field={persona.greeting} multiline />
                <ReadOnlySettingField field={persona.profileCoverUrl} />
              </div>
            </>
          )}
        </div>
        <div className={compact ? 'ras-profile-meta ras-profile-meta--compact' : 'ras-profile-meta'}>
          {compact ? (
            <>
              <div className="ras-profile-cover__title-row">
                <h2 className="ras-break-anywhere ras-profile-cover__title">
                  {settingFieldDisplayValue(persona.displayName, t('shared.displayNameNotSet'), t)}
                </h2>
                <StatusBadge tone="info">{t('persona.profile.realmPersonaBadge')}</StatusBadge>
              </div>
              <p className="ras-break-anywhere ras-text-secondary mt-1">
                {persona.handle.value ? `@${persona.handle.value}` : settingFieldDisplayValue(persona.handle, t('shared.handleNotSet'), t)}
              </p>
              <p className="ras-break-anywhere ras-text-muted ras-text-size-sm mt-2 leading-[1.55]">
                {settingFieldDisplayValue(persona.bio, t('shared.profileDescriptionNotSet'), t)}
              </p>
            </>
          ) : (
            <>
              <div className="ras-info-tile">
                <div className="ras-info-tile__label">{t('persona.profile.ownershipLabel')}</div>
                <div className="ras-info-tile__value">
                  {t('persona.profile.ownershipValue', { scope: ownerScopeLabel(persona.ownerScope, t) })}
                </div>
              </div>
              {persona.friendCount.status === 'available' ? (
                <div className="ras-info-tile">
                  <div className="ras-info-tile__label">{t('persona.profile.friendCountLabel')}</div>
                  <div className="ras-info-tile__value">{detailFriendCountLabel(persona, t)}</div>
                </div>
              ) : (
                <InlineAlert tone="warning">{detailFriendCountLabel(persona, t)}</InlineAlert>
              )}
              <EvidenceCard field={persona.ownership} />
              <EvidenceCard field={persona.world} />
              <EvidenceCard field={persona.state} />
            </>
          )}
        </div>
        {compact ? (
          <div className="ras-profile-meta__compact-badges">
            <StatusBadge tone={persona.friendCount.status === 'available' ? 'success' : 'warning'}>
              {detailFriendCountLabel(persona, t)}
            </StatusBadge>
            <StatusBadge tone="neutral">{settingFieldDisplayValue(persona.world, t('shared.worldNotSet'), t)}</StatusBadge>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
