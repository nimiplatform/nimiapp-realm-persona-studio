import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Checkbox, EmptyState, FieldShell, InlineAlert, nimiToast, SelectField, StatusBadge, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  PERSONA_VISIBILITY_FIELDS,
  PERSONA_VISIBILITY_VALUES,
  createPersonaVisibilityDraft,
  getPersonaVisibilitySettings,
  getPortfolioPersonaSettings,
  projectPersonaChatReadinessContextSummary,
  projectPersonaRuntimeContextSummary,
  proposeReviewedPortfolioPersonaSettings,
  updateReviewedPersonaVisibility,
  updateReviewedPortfolioPersonaSettings,
  type PersonaChatReadinessSummaryResult,
  type PersonaVisibilityDraft,
  type PersonaVisibilityField,
  type RealmPersonaVisibilityUpdateResult,
  type RealmOwnerPersonaSettings,
  type RealmOwnerPersonaSettingsUpdateResult,
  type RuntimeOwnerSettingsProposalResult,
  type RuntimeProjectionSummaryResult,
} from './portfolio-client.js';
import {
  RAW_RULE_REVIEW_DEFERRED_REASON,
  applyRuntimeOwnerSettingsProposal,
  buildRealmOwnerPersonaSettingsUpdateInput,
  createOwnerPersonaSettingsDraft,
  type OwnerPersonaSettingsDraft,
} from './setting-proposal.js';
import { TechnicalReviewDetails } from './OwnerPortfolio.shared.js';
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
  'Owner settings payload invalid.': 'settings.error.ownerSettingsPayloadInvalid',
  'Realm owner settings update failed.': 'settings.error.ownerSettingsUpdateFailed',
  'Nimi App Access does not provide Runtime source materialization for Persona Studio yet.': 'runtimeProjection.error.unavailable',
  'visibility payload invalid': 'settings.error.visibilityPayloadInvalid',
  'visibility settings have no reviewed changes': 'visibility.noChanges',
  'Realm visibility update failed.': 'settings.error.visibilityUpdateFailed',
  'displayName cannot be empty because RealmPersonaCoreV1 requires presentation.displayName': 'settings.error.displayNameRequired',
  'description cannot be empty because RealmPersonaCoreV1 requires identity.summary and presentation.profileLine': 'settings.error.descriptionRequired',
  'Runtime settings proposal returned no supported setting changes.': 'settings.error.proposalNoChanges',
  'Runtime projection requires worldId evidence from Realm WorldCoreController.getRealmPersona.': 'runtimeProjection.error.worldIdRequired',
  'Runtime projection response did not include RUNTIME_PAYLOAD checksum summary.': 'runtimeProjection.error.checksumMissing',
  'Realm runtime projection failed.': 'runtimeProjection.error.failed',
  'localAgent Chat readiness projection requires RealmPersona id and worldId evidence.': 'runtimeProjection.error.chatWorldRequired',
  'localAgent Chat readiness projection response did not include source-specific RUNTIME_PAYLOAD summary.': 'runtimeProjection.error.chatChecksumMissing',
  'Realm Persona Chat readiness projection failed.': 'runtimeProjection.error.chatFailed',
};

function translateSettingsFixedMessage(message: string, t: StudioTranslator): string {
  const visibilityFieldInvalid = message.match(/^(.+) must be PUBLIC, FRIENDS, or PRIVATE$/);
  if (visibilityFieldInvalid) {
    const field = visibilityFieldInvalid[1] ?? '';
    const fieldKeyMap: Record<string, StudioCopyKey> = {
      defaultPostVisibility: 'visibility.field.defaultPostVisibility',
      dmVisibility: 'visibility.field.dmVisibility',
      profileVisibility: 'visibility.field.profileVisibility',
    };
    const fieldKey = fieldKeyMap[field];
    return t('settings.error.visibilityFieldInvalid', {
      field: fieldKey ? t(fieldKey) : t('common.operationFailed'),
    });
  }
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

function translateSettingsFixedMessages(messages: string[], t: StudioTranslator): string {
  return messages.map((message) => translateSettingsFixedMessage(message, t)).join('; ');
}

export function SettingProposalWorkspace({ persona, onPersonaWrite }: { persona: OwnerPortfolioPersonaDetail; onPersonaWrite: () => Promise<void> }) {
  const { t } = useStudioI18n();
  const settingsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'persona-settings', persona.ownerScope, persona.id],
    queryFn: () => getPortfolioPersonaSettings(persona),
  });
  const [draft, setDraft] = useState<OwnerPersonaSettingsDraft | null>(null);
  const [ownerReviewed, setOwnerReviewed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<RealmOwnerPersonaSettingsUpdateResult | null>(null);
  const [runtimeProposal, setRuntimeProposal] = useState<RuntimeOwnerSettingsProposalResult | null>(null);
  const [isProposing, setIsProposing] = useState(false);
  const proposal = useMemo(() => (
    draft && settingsQuery.data
      ? buildRealmOwnerPersonaSettingsUpdateInput(draft, settingsQuery.data as RealmOwnerPersonaSettings)
      : null
  ), [draft, settingsQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft(createOwnerPersonaSettingsDraft(settingsQuery.data));
      setOwnerReviewed(false);
      setResult(null);
      setRuntimeProposal(null);
      setIsProposing(false);
    }
  }, [persona.id, settingsQuery.data]);

  function updateDraft(patch: Partial<OwnerPersonaSettingsDraft>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setOwnerReviewed(false);
    setResult(null);
    setRuntimeProposal(null);
  }

  function useInstructionAsRuleCandidate() {
    const instruction = draft?.naturalLanguageIntent.trim() ?? '';
    if (!instruction) {
      return;
    }
    updateDraft({ rawRuleTextCandidate: instruction });
  }

  async function saveOwnerSettings() {
    if (!draft || !settingsQuery.data) {
      return;
    }
    setIsSaving(true);
    setResult(null);
    try {
      const updateResult = await updateReviewedPortfolioPersonaSettings(persona, draft, settingsQuery.data);
      setResult(updateResult);
      if (updateResult.ok) {
        nimiToast.success(t('settings.saved'));
        await settingsQuery.refetch();
        await onPersonaWrite();
      } else {
        nimiToast.danger(translateSettingsFixedMessage(updateResult.message, t));
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function proposeRuntimeSettings() {
    if (!draft || !settingsQuery.data) {
      return;
    }
    setIsProposing(true);
    setRuntimeProposal(null);
    try {
      const proposalResult = await proposeReviewedPortfolioPersonaSettings(persona, draft, settingsQuery.data);
      setRuntimeProposal(proposalResult);
    } finally {
      setIsProposing(false);
    }
  }

  function applyRuntimeProposal() {
    if (!draft || !runtimeProposal?.ok) {
      return;
    }
    setDraft(applyRuntimeOwnerSettingsProposal(draft, runtimeProposal.proposal));
    setOwnerReviewed(false);
    setResult(null);
  }

  return (
    <Surface tone="panel" padding="lg" className="mt-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h3 className="m-0 text-xl font-semibold">{t('persona.settings.title')}</h3>
            <StatusBadge tone="success">{t('common.realmSave')}</StatusBadge>
            <StatusBadge tone="neutral">{t('common.ownerReviewed')}</StatusBadge>
          </div>
          <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {t('settings.workspace.description')}
          </p>

          {settingsQuery.isLoading ? (
            <EmptyState title={t('settings.loadingTitle')} description={t('settings.loadingDescription')} />
          ) : null}
          {settingsQuery.isError ? (
            <InlineAlert tone="danger">
              {t('settings.unavailable', {
                message: t('settings.readFailed'),
              })}
            </InlineAlert>
          ) : null}
          {draft && settingsQuery.data ? (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldShell label={t('settingField.displayName')} message={t('settings.displayNameMessage')}>
                  <TextField
                    value={draft.displayName}
                    placeholder={t('settings.displayNamePlaceholder')}
                    onChange={(event) => updateDraft({ displayName: event.currentTarget.value })}
                  />
                </FieldShell>
                <FieldShell label={t('settingField.greeting')} message={t('settings.greetingMessage')}>
                  <TextField
                    value={draft.greeting}
                    placeholder={t('settings.greetingPlaceholder')}
                    onChange={(event) => updateDraft({ greeting: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              <FieldShell label={t('settings.descriptionLabel')} message={t('settings.descriptionMessage')}>
                <TextareaField
                  value={draft.description}
                  placeholder={t('settings.descriptionPlaceholder')}
                  onChange={(event) => updateDraft({ description: event.currentTarget.value })}
                />
              </FieldShell>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldShell label={t('settings.publicRoleLabel')} message={t('settings.publicRoleMessage')}>
                  <TextField
                    value={draft.publicRole}
                    placeholder={t('settings.publicRolePlaceholder')}
                    onChange={(event) => updateDraft({ publicRole: event.currentTarget.value })}
                  />
                </FieldShell>
                <FieldShell label={t('settings.relationshipModeLabel')} message={t('settings.relationshipModeMessage')}>
                  <TextField
                    value={draft.relationshipMode}
                    placeholder={t('settings.relationshipModePlaceholder')}
                    onChange={(event) => updateDraft({ relationshipMode: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              <FieldShell label={t('settings.worldviewLabel')} message={t('settings.worldviewMessage')}>
                <TextareaField
                  value={draft.worldview}
                  placeholder={t('settings.worldviewPlaceholder')}
                  onChange={(event) => updateDraft({ worldview: event.currentTarget.value })}
                />
              </FieldShell>
              <FieldShell label={t('settings.personalitySummaryLabel')} message={t('settings.personalitySummaryMessage')}>
                <TextareaField
                  value={draft.personalitySummary}
                  placeholder={t('settings.personalitySummaryPlaceholder')}
                  onChange={(event) => updateDraft({ personalitySummary: event.currentTarget.value })}
                />
              </FieldShell>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldShell label={t('settings.interestsLabel')} message={t('settings.interestsMessage')}>
                  <TextareaField
                    value={draft.interestsText}
                    placeholder={t('settings.interestsPlaceholder')}
                    onChange={(event) => updateDraft({ interestsText: event.currentTarget.value })}
                  />
                </FieldShell>
                <FieldShell label={t('settings.goalsLabel')} message={t('settings.goalsMessage')}>
                  <TextareaField
                    value={draft.goalsText}
                    placeholder={t('settings.goalsPlaceholder')}
                    onChange={(event) => updateDraft({ goalsText: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              <FieldShell label={t('settings.contentStyleLabel')} message={t('settings.contentStyleMessage')}>
                <TextareaField
                  value={draft.contentStyle}
                  placeholder={t('settings.contentStylePlaceholder')}
                  onChange={(event) => updateDraft({ contentStyle: event.currentTarget.value })}
                />
              </FieldShell>
              <div className="grid gap-4 md:grid-cols-3">
                <FieldShell label={t('settings.formalityLabel')}>
                  <SelectField
                    value={draft.formality}
                    options={[
                      { value: '', label: t('settings.option.unset') },
                      { value: 'casual', label: t('settings.option.casual') },
                      { value: 'formal', label: t('settings.option.formal') },
                      { value: 'slang', label: t('settings.option.slang') },
                    ]}
                    onValueChange={(value) => updateDraft({ formality: value })}
                  />
                </FieldShell>
                <FieldShell label={t('settings.responseLengthLabel')}>
                  <SelectField
                    value={draft.responseLength}
                    options={[
                      { value: '', label: t('settings.option.unset') },
                      { value: 'short', label: t('settings.option.short') },
                      { value: 'medium', label: t('settings.option.medium') },
                      { value: 'long', label: t('settings.option.long') },
                    ]}
                    onValueChange={(value) => updateDraft({ responseLength: value })}
                  />
                </FieldShell>
                <FieldShell label={t('settings.sentimentLabel')}>
                  <SelectField
                    value={draft.sentiment}
                    options={[
                      { value: '', label: t('settings.option.unset') },
                      { value: 'positive', label: t('settings.option.positive') },
                      { value: 'neutral', label: t('settings.option.neutral') },
                      { value: 'cynical', label: t('settings.option.cynical') },
                    ]}
                    onValueChange={(value) => updateDraft({ sentiment: value })}
                  />
                </FieldShell>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldShell label={t('settings.allowedThemesLabel')} message={t('settings.allowedThemesMessage')}>
                  <TextareaField
                    value={draft.allowedThemesText}
                    placeholder={t('settings.allowedThemesPlaceholder')}
                    onChange={(event) => updateDraft({ allowedThemesText: event.currentTarget.value })}
                  />
                </FieldShell>
                <FieldShell label={t('settings.disallowedThemesLabel')} message={t('settings.disallowedThemesMessage')}>
                  <TextareaField
                    value={draft.disallowedThemesText}
                    placeholder={t('settings.disallowedThemesPlaceholder')}
                    onChange={(event) => updateDraft({ disallowedThemesText: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldShell label={t('settings.targetAudienceLabel')} message={t('settings.targetAudienceMessage')}>
                  <TextareaField
                    value={draft.targetAudience}
                    placeholder={t('settings.targetAudiencePlaceholder')}
                    onChange={(event) => updateDraft({ targetAudience: event.currentTarget.value })}
                  />
                </FieldShell>
                <FieldShell label={t('settings.positioningLabel')} message={t('settings.positioningMessage')}>
                  <TextareaField
                    value={draft.positioning}
                    placeholder={t('settings.positioningPlaceholder')}
                    onChange={(event) => updateDraft({ positioning: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              <FieldShell label={t('settings.intentLabel')} message={t('settings.intentMessage')}>
                <TextareaField
                  value={draft.naturalLanguageIntent}
                  placeholder={t('settings.intentPlaceholder')}
                  onChange={(event) => updateDraft({ naturalLanguageIntent: event.currentTarget.value })}
                />
              </FieldShell>
              <div className="flex flex-wrap gap-3">
                <Button disabled={!draft.naturalLanguageIntent.trim()} onClick={useInstructionAsRuleCandidate}>
                  {t('settings.useAsRuleNote')}
                </Button>
                <Button
                  tone="secondary"
                  disabled={!draft.naturalLanguageIntent.trim() || isProposing}
                  loading={isProposing}
                  onClick={() => void proposeRuntimeSettings()}
                >
                  {t('settings.askRuntime')}
                </Button>
              </div>
              {runtimeProposal ? (
                <Surface tone="card" padding="md">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{t('settings.runtimeProposalTitle')}</div>
                      <div className="ras-break-anywhere mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                        {runtimeProposal.ok
                          ? runtimeProposal.proposal.rationale
                          : translateSettingsFixedMessage(runtimeProposal.message, t)}
                      </div>
                    </div>
                    <StatusBadge tone={runtimeProposal.ok ? 'info' : 'danger'}>
                      {runtimeProposal.ok ? t('common.candidate') : t('common.sourceUnavailable')}
                    </StatusBadge>
                  </div>
                  {runtimeProposal.ok ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {runtimeProposal.proposal.changedSettingKeys.map((key) => (
                          <StatusBadge key={key} tone="neutral">{key}</StatusBadge>
                        ))}
                      </div>
                      <InlineAlert tone="info" className="mt-3">
                        {t('settings.runtimeCandidateBoundary')}
                      </InlineAlert>
                      <div className="mt-3">
                        <Button onClick={applyRuntimeProposal}>{t('settings.applyProposal')}</Button>
                      </div>
                    </>
                  ) : (
                    <InlineAlert tone="danger" className="mt-3">
                      {t('settings.runtimeUnavailableDetail')}
                    </InlineAlert>
                  )}
                </Surface>
              ) : null}
              <FieldShell label={t('settings.ruleReviewNoteLabel')} message={t('settings.ruleReviewNoteMessage')}>
                <TextareaField
                  value={draft.rawRuleTextCandidate}
                  placeholder={t('settings.ruleReviewNotePlaceholder')}
                  onChange={(event) => updateDraft({ rawRuleTextCandidate: event.currentTarget.value })}
                />
              </FieldShell>
              <FieldShell label={t('settingField.profileCoverUrl')} message={t('settings.profileCoverMessage')}>
                <TextField readOnly value={persona.profileCoverUrl.value} placeholder={t('settings.profileCoverUnavailable')} />
              </FieldShell>
              {proposal?.ok ? (
                <InlineAlert tone="info">
                  {t('settings.readyForSave', { keys: proposal.changedSettingKeys.join(', ') })}
                </InlineAlert>
              ) : (
                <InlineAlert tone="warning">
                  {proposal ? translateSettingsFixedMessages(proposal.errors, t) : t('settings.payloadUnavailable')}
                </InlineAlert>
              )}
              {draft.rawRuleTextCandidate.trim() ? (
                <InlineAlert tone="warning">
                  {t('settings.error.rawRuleReviewDeferred')}
                </InlineAlert>
              ) : null}
              <Checkbox
                checked={ownerReviewed}
                onChange={(event) => setOwnerReviewed(event.currentTarget.checked)}
                label={t('common.humanReviewComplete')}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!proposal?.ok || !ownerReviewed || isSaving}
                  loading={isSaving}
                  onClick={() => void saveOwnerSettings()}
                >
                  {t('settings.save')}
                </Button>
                <Button
                  tone="secondary"
                  disabled={isSaving}
                  onClick={() => {
                    setDraft(createOwnerPersonaSettingsDraft(settingsQuery.data as RealmOwnerPersonaSettings));
                    setOwnerReviewed(false);
                    setResult(null);
                  }}
                >
                  {t('settings.reset')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="m-0 text-base font-semibold">{t('settings.reviewSummary')}</h4>
            <StatusBadge tone={proposal?.ok ? 'success' : 'warning'}>{proposal?.ok ? t('settings.ready') : t('settings.notReady')}</StatusBadge>
          </div>
          <TechnicalReviewDetails title={t('settings.technicalReview')}>
            <pre className="ras-json-preview m-0 min-h-80 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs">
              {proposal?.ok ? JSON.stringify(proposal.preview, null, 2) : proposal?.errors.join('; ') || t('settings.noLoaded')}
            </pre>
          </TechnicalReviewDetails>
          {result ? (
            <TechnicalReviewDetails title={t('settings.saveResponse')}>
              <pre className="ras-json-preview m-0 min-h-24 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </TechnicalReviewDetails>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}

export const VISIBILITY_FIELD_LABEL_KEYS: Record<PersonaVisibilityField, StudioCopyKey> = {
  defaultPostVisibility: 'visibility.field.defaultPostVisibility',
  dmVisibility: 'visibility.field.dmVisibility',
  profileVisibility: 'visibility.field.profileVisibility',
};

export function VisibilitySettingsWorkspace({ persona, onPersonaWrite }: { persona: OwnerPortfolioPersonaDetail; onPersonaWrite: () => Promise<void> }) {
  const { t } = useStudioI18n();
  const visibilityQuery = useQuery({
    queryKey: ['realm-persona-studio', 'owner-persona-visibility', persona.id],
    queryFn: () => getPersonaVisibilitySettings(persona.id),
  });
  const [draft, setDraft] = useState<PersonaVisibilityDraft | null>(null);
  const [humanReviewed, setHumanReviewed] = useState(false);
  const [result, setResult] = useState<RealmPersonaVisibilityUpdateResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visibilityQuery.data) {
      setDraft(createPersonaVisibilityDraft(visibilityQuery.data));
      setHumanReviewed(false);
      setResult(null);
      setIsSaving(false);
    }
  }, [persona.id, visibilityQuery.data]);

  const hasChanges = useMemo(() => {
    if (!draft || !visibilityQuery.data) {
      return false;
    }
    return PERSONA_VISIBILITY_FIELDS.some((field) => draft[field] !== visibilityQuery.data?.[field]);
  }, [draft, visibilityQuery.data]);

  function updateDraft(field: PersonaVisibilityField, value: string) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setHumanReviewed(false);
    setResult(null);
  }

  async function saveVisibility() {
    if (!draft || !visibilityQuery.data) {
      return;
    }

    setIsSaving(true);
    setResult(null);
    try {
      const updateResult = await updateReviewedPersonaVisibility(persona.id, draft, visibilityQuery.data);
      setResult(updateResult);
      if (updateResult.ok) {
        nimiToast.success(t('visibility.saved'));
        await visibilityQuery.refetch();
        await onPersonaWrite();
      } else {
        nimiToast.danger(translateSettingsFixedMessage(updateResult.message, t));
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Surface tone="panel" padding="lg" className="mt-5">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h3 className="m-0 text-xl font-semibold">{t('visibility.title')}</h3>
        <StatusBadge tone="info">{t('common.realmSave')}</StatusBadge>
        <StatusBadge tone="neutral">{t('common.notLifecycle')}</StatusBadge>
      </div>
      <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
        {t('visibility.description')}
      </p>

      {visibilityQuery.isLoading ? (
        <EmptyState title={t('visibility.loadingTitle')} description={t('visibility.loadingDescription')} />
      ) : null}
      {visibilityQuery.isError ? (
        <InlineAlert tone="danger">
          {t('visibility.unavailable', {
            message: t('visibility.readFailed'),
          })}
        </InlineAlert>
      ) : null}
      {draft && visibilityQuery.data ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {PERSONA_VISIBILITY_FIELDS.map((field) => (
              <FieldShell key={field} label={t(VISIBILITY_FIELD_LABEL_KEYS[field])} message={t('visibility.allowedValues')}>
                <SelectField
                  value={draft[field]}
                  options={PERSONA_VISIBILITY_VALUES.map((value) => ({ value, label: value }))}
                  onValueChange={(value) => updateDraft(field, value)}
                />
              </FieldShell>
            ))}
          </div>
          <Checkbox
            checked={humanReviewed}
            onChange={(event) => setHumanReviewed(event.currentTarget.checked)}
            label={t('common.humanReviewComplete')}
          />
          {!hasChanges ? (
            <InlineAlert tone="warning">
              {t('visibility.noChanges')}
            </InlineAlert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!hasChanges || !humanReviewed || isSaving}
              loading={isSaving}
              onClick={() => void saveVisibility()}
            >
              {t('visibility.save')}
            </Button>
            <Button
              disabled={!visibilityQuery.data || isSaving}
              onClick={() => {
                if (visibilityQuery.data) {
                  setDraft(createPersonaVisibilityDraft(visibilityQuery.data));
                  setHumanReviewed(false);
                  setResult(null);
                }
              }}
            >
              {t('visibility.resetDraft')}
            </Button>
          </div>
          <TechnicalReviewDetails title={t('visibility.technicalReview')}>
            <pre className="ras-json-preview m-0 min-h-24 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs">
              {result ? JSON.stringify(result, null, 2) : JSON.stringify({ current: visibilityQuery.data, draft }, null, 2)}
            </pre>
          </TechnicalReviewDetails>
        </div>
      ) : null}
    </Surface>
  );
}

export function RuntimeProjectionWorkspace({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const [projectionResult, setProjectionResult] = useState<
    RuntimeProjectionSummaryResult | PersonaChatReadinessSummaryResult | null
  >(null);
  const [isProjecting, setIsProjecting] = useState(false);

  useEffect(() => {
    setProjectionResult(null);
    setIsProjecting(false);
  }, [persona.id]);

  async function projectRuntimeContext() {
    setIsProjecting(true);
    setProjectionResult(null);
    try {
      const result = await projectPersonaRuntimeContextSummary(persona);
      setProjectionResult(result);
      if (result.ok) {
        nimiToast.success(t('runtimeProjection.generated'));
      } else {
        nimiToast.info(translateSettingsFixedMessage(result.message, t));
      }
    } finally {
      setIsProjecting(false);
    }
  }

  async function projectPersonaChatReadinessContext() {
    setIsProjecting(true);
    setProjectionResult(null);
    try {
      const result = await projectPersonaChatReadinessContextSummary(persona);
      setProjectionResult(result);
      if (result.ok) {
        nimiToast.success(t('runtimeProjection.generated'));
      } else {
        nimiToast.info(translateSettingsFixedMessage(result.message, t));
      }
    } finally {
      setIsProjecting(false);
    }
  }

  return (
    <Surface tone="panel" padding="lg" className="mt-5">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h3 className="m-0 text-xl font-semibold">{t('runtimeProjection.title')}</h3>
        <StatusBadge tone="info">{t('common.aiContext')}</StatusBadge>
        <StatusBadge tone="neutral">{t('common.summaryOnly')}</StatusBadge>
        <StatusBadge tone="warning">{t('common.readOnly')}</StatusBadge>
      </div>
      <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
        {t('runtimeProjection.description')}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button disabled={isProjecting || persona.world.status !== 'available'} loading={isProjecting} onClick={() => void projectRuntimeContext()}>
          {t('runtimeProjection.generateContext')}
        </Button>
        <Button disabled={isProjecting || persona.world.status !== 'available'} loading={isProjecting} onClick={() => void projectPersonaChatReadinessContext()}>
          {t('runtimeProjection.generateChatReadiness')}
        </Button>
      </div>
      {persona.world.status !== 'available' ? (
        <InlineAlert tone="warning">
          {t('runtimeProjection.worldUnavailable')}
        </InlineAlert>
      ) : null}
      {projectionResult?.ok ? (
        <dl className="mt-4 grid gap-3 text-[length:var(--nimi-type-body-sm-size)] md:grid-cols-2">
          {Object.entries(projectionResult.summary).map(([key, value]) => (
            <div key={key} className="min-w-0 rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3">
              <dt className="font-medium text-[var(--nimi-text-muted)]">{key}</dt>
              <dd className="ras-break-anywhere m-0 mt-1 text-[var(--nimi-text-primary)]">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {projectionResult && !projectionResult.ok ? (
        <InlineAlert tone="danger" className="mt-3">
          {translateSettingsFixedMessage(projectionResult.message, t)}
        </InlineAlert>
      ) : null}
      {projectionResult ? (
        <TechnicalReviewDetails title={t('runtimeProjection.inputDetails')}>
          <pre className="ras-json-preview m-0 mt-3 min-h-24 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
            {JSON.stringify(projectionResult.submitted, null, 2)}
          </pre>
        </TechnicalReviewDetails>
      ) : null}
    </Surface>
  );
}
