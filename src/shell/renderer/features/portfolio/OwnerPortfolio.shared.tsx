import { type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { FieldShell, StatusBadge, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
import { translateStudioCopy, type StudioTranslateOptions } from '../../i18n/studio-i18n.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import type { OwnerPortfolioPersona, OwnerPortfolioPersonaDetail, SettingField, SettingFieldKey } from './portfolio-data.js';

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

export type PersonaLibraryStatus = 'local-draft' | 'public' | 'friends' | 'private' | 'source-unavailable';

const PERSONA_LIBRARY_STATUS_PRESENTATION: Record<
  PersonaLibraryStatus,
  { labelKey: StudioCopyKey; tone: 'info' | 'warning' | 'success' }
> = {
  'local-draft': { labelKey: 'portfolio.status.localDraft', tone: 'info' },
  public: { labelKey: 'persona.workspace.public', tone: 'success' },
  friends: { labelKey: 'persona.workspace.friends', tone: 'info' },
  private: { labelKey: 'persona.workspace.private', tone: 'warning' },
  'source-unavailable': { labelKey: 'common.sourceUnavailable', tone: 'warning' },
};

const SETTING_FIELD_LABEL_KEYS: Record<SettingFieldKey, StudioCopyKey> = {
  displayName: 'settingField.displayName',
  handle: 'settingField.handle',
  bio: 'settingField.bio',
  greeting: 'settingField.greeting',
  profileCoverUrl: 'settingField.profileCoverUrl',
  ownership: 'settingField.ownership',
  world: 'settingField.world',
  state: 'settingField.state',
};

export function TechnicalReviewDetails({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="ras-technical-details">
      <summary>{title}</summary>
      <div className="mt-3">
        {children}
      </div>
    </details>
  );
}

export function CandidateFactGrid({
  facts,
}: {
  facts: ReadonlyArray<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="ras-fact-grid">
      {facts.map((fact) => (
        <div key={fact.label} className="ras-fact">
          <div className="ras-fact__label">{fact.label}</div>
          <div className="ras-fact__value ras-break-anywhere">{fact.value}</div>
        </div>
      ))}
    </div>
  );
}

export function friendCountLabel(persona: OwnerPortfolioPersona, t: StudioTranslator = translateStudioCopy) {
  if (persona.friendCount.status === 'available') {
    return t('shared.friendCount.available', { count: persona.friendCount.value });
  }
  return t('shared.friendCount.unavailable');
}

export function detailFriendCountLabel(persona: OwnerPortfolioPersonaDetail, t: StudioTranslator = translateStudioCopy) {
  if (persona.friendCount.status === 'available') {
    return t('shared.friendCount.available', { count: persona.friendCount.value });
  }
  return t('shared.friendCount.unavailable');
}

export function ownerScopeLabel(
  scope: OwnerPortfolioPersona['ownerScope'] | OwnerPortfolioPersonaDetail['ownerScope'],
  t: StudioTranslator = translateStudioCopy,
): string {
  if (scope === 'owner-created') return t('shared.ownerScope.ownerCreated');
  return scope;
}

export function settingFieldLabel(field: SettingField, t: StudioTranslator = translateStudioCopy): string {
  return t(SETTING_FIELD_LABEL_KEYS[field.key]);
}

export function settingFieldStatusLabel(field: SettingField, t: StudioTranslator = translateStudioCopy): string {
  if (field.status === 'available') return t('shared.fieldStatus.available');
  if (field.status === 'available-empty') return t('shared.fieldStatus.notSet');
  return t('shared.fieldStatus.sourceUnavailable');
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

export function personaLibraryStatusFromRealmState(realmState: string | null): PersonaLibraryStatus {
  const normalized = realmState?.trim().toUpperCase();
  if (normalized === 'PUBLIC') return 'public';
  if (normalized === 'FRIENDS') return 'friends';
  if (normalized === 'PRIVATE') return 'private';
  return 'source-unavailable';
}

function settingFieldStatusTone(field: SettingField): 'success' | 'neutral' | 'warning' {
  if (field.status === 'available') return 'success';
  if (field.status === 'available-empty') return 'neutral';
  return 'warning';
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
            <PersonaLibraryStatusBadge status={personaLibraryStatusFromRealmState(persona.realmState)} />
          </div>
          <p>@{persona.handle}</p>
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

export function FieldStatus({ field }: { field: SettingField }) {
  const { t } = useStudioI18n();
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      <StatusBadge tone={settingFieldStatusTone(field)} shape="dot">
        {settingFieldStatusLabel(field, t)}
      </StatusBadge>
      <StatusBadge tone="neutral">{t('common.readOnly')}</StatusBadge>
    </div>
  );
}

export function ReadOnlySettingField({ field, multiline = false }: { field: SettingField; multiline?: boolean }) {
  const { t } = useStudioI18n();
  const sourceUnavailable = field.status === 'source-unavailable';
  const message = field.status === 'available'
    ? t('shared.field.currentPublicValue')
    : field.status === 'available-empty'
      ? t('shared.field.emptyFromRealm')
      : t('shared.field.sourceMissingFromRealm');

  const placeholder = field.status === 'available-empty'
    ? t('shared.fieldStatus.notSet')
    : t('shared.fieldStatus.sourceUnavailable');

  return (
    <FieldShell label={settingFieldLabel(field, t)} message={message} messageTone={sourceUnavailable ? 'danger' : 'neutral'}>
      {multiline ? (
        <TextareaField readOnly value={field.value} placeholder={placeholder} />
      ) : (
        <TextField readOnly value={field.value} placeholder={placeholder} />
      )}
    </FieldShell>
  );
}

export function EvidenceCard({ field }: { field: SettingField }) {
  const { t } = useStudioI18n();
  return (
    <Surface tone="card" padding="md">
      <div className="text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{settingFieldLabel(field, t)}</div>
      <div className="ras-break-anywhere mt-1 font-medium">{settingFieldDisplayValue(field, t('common.notSet'), t)}</div>
      <FieldStatus field={field} />
    </Surface>
  );
}
