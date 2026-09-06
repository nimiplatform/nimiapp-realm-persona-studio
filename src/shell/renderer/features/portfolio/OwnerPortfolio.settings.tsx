import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { Avatar, Button, EmptyState, FieldShell, InlineAlert, nimiToast, SelectField, StatusBadge, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
import { personaCharacterFailureReason, type OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import { failureKindCopyKey } from './failure-copy.js';
import {
  getPortfolioPersonaSettings,
  listCreateRealmPersonaSelectableWorlds,
  proposeReviewedPortfolioPersonaSettings,
  updateReviewedPortfolioPersonaSettings,
  type RealmOwnerPersonaSettings,
  type RuntimeOwnerSettingsProposalResult,
} from './portfolio-client.js';
import {
  RAW_RULE_REVIEW_DEFERRED_REASON,
  buildRealmOwnerPersonaSettingsUpdateInput,
  createOwnerPersonaSettingsDraft,
  partitionConsistencySuggestions,
  type OwnerPersonaSettingsDraft,
} from './setting-proposal.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import type { StudioTranslateOptions } from '../../i18n/studio-i18n.js';

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

const SETTINGS_FIXED_MESSAGE_KEYS: Record<string, StudioCopyKey> = {
  [RAW_RULE_REVIEW_DEFERRED_REASON]: 'settings.error.rawRuleReviewDeferred',
  'owner settings have no reviewed changes': 'settings.error.noReviewedChanges',
  'natural-language setting intent missing': 'settings.error.intentMissing',
  'Runtime settings proposal payload invalid.': 'settings.error.runtimeProposalPayloadInvalid',
  'Runtime settings proposal output invalid.': 'settings.error.runtimeProposalOutputInvalid',
  'visibility settings have no reviewed changes': 'visibility.noChanges',
  'displayName cannot be empty because PersonaCharacter profile.presentation.displayName is required': 'settings.error.displayNameRequired',
  'description cannot be empty because PersonaCharacter profile.identity.summary is required': 'settings.error.descriptionRequired',
  'worldId cannot be empty because PersonaCharacter replace requires a home world': 'settings.error.worldIdRequired',
  'Runtime settings proposal returned no supported setting changes.': 'settings.error.proposalNoChanges',
  'PersonaCharacter settings context identity mismatch.': 'common.operationFailed',
};

const PERSONA_FAILURE_REASONS = new Set([
  'capability-unavailable', 'invalid-input', 'session-invalid', 'access-denied',
  'owner-authority-missing', 'not-found', 'content-conflict', 'realm-unavailable',
  'rate-limited', 'upstream-failed', 'contract-invalid', 'request-too-large', 'response-too-large',
]);

function translateSettingsFixedMessage(message: string, t: StudioTranslator): string {
  if (PERSONA_FAILURE_REASONS.has(message)) return t('persona.failure.sanitized', { reason: t(failureKindCopyKey(message)) });
  const enumInvalid = message.match(/^(formality|response length|sentiment) must be one of:/);
  if (enumInvalid) {
    const fieldKey: StudioCopyKey = enumInvalid[1] === 'formality'
      ? 'settings.formalityLabel'
      : enumInvalid[1] === 'response length'
        ? 'settings.responseLengthLabel'
        : 'settings.sentimentLabel';
    return t('settings.error.enumInvalid', { field: t(fieldKey) });
  }
  if (message.startsWith('Runtime settings proposal rejected forbidden ')) return t('settings.error.proposalForbiddenField');
  if (message.startsWith('Runtime settings proposal rejected invalid ')) return t('settings.error.proposalInvalidField');
  if (message.startsWith('Nimi App Access ai.text.generateCandidate failed:')) return t('settings.error.runtimeProposalFailed');
  if (message.startsWith('owner settings update rejected: forbidden ')) return t('settings.error.updateForbiddenField');
  const key = SETTINGS_FIXED_MESSAGE_KEYS[message];
  return key ? t(key) : t('common.operationFailed');
}

const CONSISTENCY_FIELD_LABEL_KEYS = {
  displayName: 'settingField.displayName',
  description: 'settings.descriptionLabel',
  greeting: 'settingField.greeting',
} as const satisfies Record<string, StudioCopyKey>;

function useOwnerSettingsWorkspace(persona: OwnerPortfolioPersonaDetail, onPersonaWrite: () => Promise<void>) {
  const { t } = useStudioI18n();
  const settingsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'persona-settings', persona.ownerScope, persona.id],
    queryFn: () => getPortfolioPersonaSettings(persona),
  });
  const [draft, setDraft] = useState<OwnerPersonaSettingsDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewResult, setReviewResult] = useState<RuntimeOwnerSettingsProposalResult | null>(null);
  const [appliedKeys, setAppliedKeys] = useState<ReadonlySet<string>>(new Set());
  const [isReviewing, setIsReviewing] = useState(false);
  const settingsFailure = settingsQuery.isError ? personaCharacterFailureReason(settingsQuery.error) : null;
  const proposal = useMemo(() => (
    draft && settingsQuery.data
      ? buildRealmOwnerPersonaSettingsUpdateInput(draft, settingsQuery.data as RealmOwnerPersonaSettings)
      : null
  ), [draft, settingsQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft(createOwnerPersonaSettingsDraft(settingsQuery.data));
    }
  }, [persona.id, settingsQuery.data]);

  useEffect(() => {
    setReviewResult(null);
    setAppliedKeys(new Set());
  }, [persona.id]);

  function updateDraft(patch: Partial<OwnerPersonaSettingsDraft>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  async function runConsistencyReview() {
    if (!draft || !settingsQuery.data) {
      return;
    }
    setIsReviewing(true);
    setReviewResult(null);
    setAppliedKeys(new Set());
    try {
      const review = await proposeReviewedPortfolioPersonaSettings(
        persona,
        { ...draft, naturalLanguageIntent: t('settings.consistency.defaultIntent') },
        settingsQuery.data as RealmOwnerPersonaSettings,
      );
      setReviewResult(review);
    } finally {
      setIsReviewing(false);
    }
  }

  function applyConsistencySuggestion(key: 'displayName' | 'description' | 'greeting') {
    if (!reviewResult?.ok) {
      return;
    }
    const { visible } = partitionConsistencySuggestions(reviewResult.proposal.draftPatch);
    const value = visible[key];
    if (value === undefined) {
      return;
    }
    if (key === 'displayName') {
      updateDraft({ displayName: value });
    } else if (key === 'description') {
      updateDraft({ description: value });
    } else {
      updateDraft({ greeting: value });
    }
    setAppliedKeys((current) => new Set(current).add(key));
    nimiToast.success(t('settings.consistency.applied'));
  }

  function applyAllConsistencySuggestions() {
    if (!reviewResult?.ok) {
      return;
    }
    const { visible } = partitionConsistencySuggestions(reviewResult.proposal.draftPatch);
    const keys = Object.keys(visible);
    if (keys.length === 0) {
      return;
    }
    updateDraft(visible);
    setAppliedKeys((current) => new Set([...current, ...keys]));
    nimiToast.success(t('settings.consistency.applied'));
  }

  function dismissConsistencyReview() {
    setReviewResult(null);
    setAppliedKeys(new Set());
  }

  async function saveOwnerSettings() {
    if (!draft || !settingsQuery.data) {
      return;
    }
    setIsSaving(true);
    try {
      const updateResult = await updateReviewedPortfolioPersonaSettings(persona, draft, settingsQuery.data);
      if (updateResult.ok) {
        nimiToast.success(t('settings.saved'));
        dismissConsistencyReview();
        await settingsQuery.refetch();
        await onPersonaWrite();
      } else {
        nimiToast.danger(translateSettingsFixedMessage(updateResult.message, t));
      }
    } finally {
      setIsSaving(false);
    }
  }

  return {
    persona,
    settingsQuery,
    settingsFailure,
    draft,
    proposal,
    isSaving,
    reviewResult,
    appliedKeys,
    isReviewing,
    updateDraft,
    runConsistencyReview,
    applyConsistencySuggestion,
    applyAllConsistencySuggestions,
    dismissConsistencyReview,
    saveOwnerSettings,
  };
}

type OwnerSettingsWorkspaceState = ReturnType<typeof useOwnerSettingsWorkspace>;

export function SettingsSection({ muted = false, children }: { muted?: boolean; children: ReactNode }) {
  return (
    <section className={muted ? 'ras-settings-section ras-settings-section--muted' : 'ras-settings-section'}>
      {children}
    </section>
  );
}

export function SettingsSectionHead({
  icon,
  title,
  description,
  badges,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ras-settings-section__head">
      <span className="ras-settings-section__icon" aria-hidden="true">{icon}</span>
      <div className="ras-settings-section__heading">
        <h3 className="ras-settings-section__title">{title}</h3>
        {description ? <p className="ras-settings-section__description">{description}</p> : null}
      </div>
      {badges || actions ? (
        <div className="ras-settings-section__badges">
          {badges}
          {actions}
        </div>
      ) : null}
    </header>
  );
}

function OwnerProfileSection({ settings }: { settings: OwnerSettingsWorkspaceState }) {
  const { t } = useStudioI18n();
  const {
    persona,
    settingsQuery,
    settingsFailure,
    draft,
    proposal,
    isSaving,
    isReviewing,
    reviewResult,
    appliedKeys,
    updateDraft,
    saveOwnerSettings,
    runConsistencyReview,
    applyConsistencySuggestion,
    applyAllConsistencySuggestions,
    dismissConsistencyReview,
  } = settings;
  const consistency = reviewResult?.ok ? partitionConsistencySuggestions(reviewResult.proposal.draftPatch) : null;
  const suggestionRows = consistency
    ? (Object.keys(CONSISTENCY_FIELD_LABEL_KEYS) as Array<keyof typeof CONSISTENCY_FIELD_LABEL_KEYS>).flatMap((key) => {
      const value = consistency.visible[key];
      return value === undefined ? [] : [{ key, labelKey: CONSISTENCY_FIELD_LABEL_KEYS[key], value }];
    })
    : [];
  // Home-world selection is WorldCore-backed (scope.r003); the select stays
  // disabled and the world unchanged when the source list is unavailable.
  const worldsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'create-persona-worlds'],
    queryFn: () => listCreateRealmPersonaSelectableWorlds(),
  });
  const worldOptions = useMemo(() => {
    const options = (worldsQuery.data || []).map((world) => ({ value: world.id, label: world.name }));
    const currentWorldId = draft?.worldId || '';
    if (currentWorldId && !options.some((option) => option.value === currentWorldId)) {
      options.unshift({ value: currentWorldId, label: currentWorldId });
    }
    return options;
  }, [worldsQuery.data, draft?.worldId]);

  return (
    <div className="ras-settings-dialog__section">
      <div className="ras-settings-dialog__head">
        <div className="ras-settings-dialog__heading">
          <h3 className="ras-settings-dialog__title">{t('settings.section.profile')}</h3>
          <p className="ras-settings-dialog__subtitle">{t('settings.profileDialog.description')}</p>
        </div>
        <Button
          tone="secondary"
          size="sm"
          leadingIcon={<Sparkles size={15} />}
          onClick={() => void runConsistencyReview()}
          disabled={settingsQuery.isLoading || Boolean(settingsFailure) || !draft || isReviewing}
          loading={isReviewing}
        >
          {t('settings.consistency.run')}
        </Button>
      </div>
      {settingsQuery.isLoading ? (
        <EmptyState title={t('settings.loadingTitle')} description={t('settings.loadingDescription')} />
      ) : null}
      {settingsFailure ? (
        <InlineAlert tone="danger">
          {t('settings.unavailable', {
            message: t('persona.failure.sanitized', { reason: t(failureKindCopyKey(settingsFailure)) }),
          })}
        </InlineAlert>
      ) : null}
      {draft && settingsQuery.data ? (
        <>
          <div className="ras-profile-editor">
            <div className="ras-profile-editor__identity">
              <Avatar
                src={persona.avatarUrl}
                alt={draft.displayName || persona.displayName.value || t('persona.header.personaCharacterAlt')}
                size="lg"
                shape="circle"
                tone="accent"
                fallback={<span className="text-xl font-semibold">{(draft.displayName || persona.displayName.value || '?').charAt(0).toUpperCase()}</span>}
              />
              <div className="ras-profile-editor__identity-main">
                <FieldShell label={t('settingField.displayName')}>
                  <TextField
                    value={draft.displayName}
                    placeholder={t('settings.displayNamePlaceholder')}
                    onChange={(event) => updateDraft({ displayName: event.currentTarget.value })}
                  />
                </FieldShell>
                <div className="ras-profile-editor__identity-fields">
                  <FieldShell label={t('settingField.handle')} message={t('settings.handleHint')}>
                    <TextField
                      value={draft.handle}
                      leading={<span aria-hidden="true">@</span>}
                      placeholder={t('settings.handlePlaceholder')}
                      onChange={(event) => updateDraft({ handle: event.currentTarget.value })}
                    />
                  </FieldShell>
                  <FieldShell label={t('settings.worldLabel')}>
                    <SelectField
                      value={draft.worldId}
                      options={worldOptions}
                      disabled={worldsQuery.isLoading || worldsQuery.isError}
                      contentLayer="dialog"
                      onValueChange={(value) => updateDraft({ worldId: value })}
                    />
                  </FieldShell>
                </div>
              </div>
            </div>
            {worldsQuery.isError ? (
              <InlineAlert tone="warning">{t('settings.worldUnavailable')}</InlineAlert>
            ) : null}
            <FieldShell label={t('settingField.greeting')} message={t('settings.greetingHint')}>
              <TextareaField
                tone="quiet"
                className="ras-greeting-editor"
                textareaClassName="ras-greeting-editor__input"
                value={draft.greeting}
                placeholder={t('settings.greetingPlaceholder')}
                rows={3}
                onChange={(event) => updateDraft({ greeting: event.currentTarget.value })}
              />
            </FieldShell>
            <FieldShell label={t('settings.descriptionLabel')}>
              <TextareaField
                value={draft.description}
                placeholder={t('settings.descriptionPlaceholder')}
                rows={4}
                onChange={(event) => updateDraft({ description: event.currentTarget.value })}
              />
            </FieldShell>
          </div>
          {reviewResult ? (
            <Surface tone="panel" padding="md">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{t('settings.consistency.title')}</div>
                  {reviewResult.ok ? (
                    <div className="ras-break-anywhere mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                      {reviewResult.proposal.rationale}
                    </div>
                  ) : null}
                </div>
                <StatusBadge tone={reviewResult.ok ? 'info' : 'danger'}>
                  {reviewResult.ok ? t('common.candidate') : t('common.sourceUnavailable')}
                </StatusBadge>
              </div>
              {reviewResult.ok ? (
                <>
                  {suggestionRows.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {suggestionRows.map((row) => (
                        <div
                          key={row.key}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] p-2.5"
                        >
                          <div className="min-w-0">
                            <div className="text-[length:var(--nimi-type-body-sm-size)] font-medium">{t(row.labelKey)}</div>
                            <div className="ras-break-anywhere text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">{row.value}</div>
                          </div>
                          {appliedKeys.has(row.key) ? (
                            <StatusBadge tone="success">{t('common.ownerReviewed')}</StatusBadge>
                          ) : (
                            <Button tone="secondary" onClick={() => applyConsistencySuggestion(row.key)}>
                              {t('settings.consistency.apply')}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {consistency && consistency.deferredKeys.length > 0 ? (
                    <InlineAlert tone="info" className="mt-3">
                      {t('settings.consistency.deferredNote')}
                    </InlineAlert>
                  ) : null}
                  <InlineAlert tone="info" className="mt-3">
                    {t('settings.consistency.description')}
                  </InlineAlert>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {suggestionRows.length > 1 ? (
                      <Button onClick={applyAllConsistencySuggestions}>{t('settings.consistency.applyAll')}</Button>
                    ) : null}
                    <Button tone="ghost" onClick={dismissConsistencyReview}>
                      {t('settings.consistency.dismiss')}
                    </Button>
                  </div>
                </>
              ) : (
                <InlineAlert tone="danger" className="mt-3">
                  {translateSettingsFixedMessage(reviewResult.message, t)}
                </InlineAlert>
              )}
            </Surface>
          ) : null}
          <div className="ras-settings-actions">
            <Button
              tone="primary"
              disabled={!proposal?.ok || isSaving}
              loading={isSaving}
              onClick={() => void saveOwnerSettings()}
            >
              {t('settings.save')}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Editable owner settings form (public profile) rendered inside the settings
 * editor dialog. Visibility is changed directly from the settings workspace
 * page select, so the dialog only carries the profile fields. Layout mirrors
 * the public profile instead of an admin table: an identity row (avatar +
 * display name), the owner-reviewed handle and WorldCore-backed home-world
 * selection under it, the greeting edited inside a quote bubble that matches
 * the read-only greeting card, then the description.
 */
export function PersonaSettingsForm({
  persona,
  onPersonaWrite,
}: {
  persona: OwnerPortfolioPersonaDetail;
  onPersonaWrite: () => Promise<void>;
}) {
  const settings = useOwnerSettingsWorkspace(persona, onPersonaWrite);

  return (
    <div className="ras-settings ras-settings--dialog">
      <OwnerProfileSection settings={settings} />
    </div>
  );
}
