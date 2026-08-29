import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Checkbox, EmptyState, FieldShell, InlineAlert, nimiToast, SelectField, StatusBadge, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
import { personaCharacterFailureReason, type OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import { failureKindCopyKey } from './failure-copy.js';
import {
  PERSONA_VISIBILITY_VALUES,
  createPersonaVisibilityDraft,
  getPersonaVisibilitySettings,
  getPortfolioPersonaSettings,
  proposeReviewedPortfolioPersonaSettings,
  updateReviewedPersonaVisibility,
  updateReviewedPortfolioPersonaSettings,
  type PersonaVisibilityDraft,
  type RealmPersonaVisibilityUpdateResult,
  type RealmOwnerPersonaSettings,
  type RealmOwnerPersonaSettingsUpdateResult,
  type RuntimeOwnerSettingsProposalResult,
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
  'Nimi App Access does not provide Runtime source materialization for Persona Studio yet.': 'runtimeProjection.error.unavailable',
  'visibility settings have no reviewed changes': 'visibility.noChanges',
  'displayName cannot be empty because PersonaCharacter profile.presentation.displayName is required': 'settings.error.displayNameRequired',
  'description cannot be empty because PersonaCharacter profile.identity.summary is required': 'settings.error.descriptionRequired',
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
  const settingsFailure = settingsQuery.isError ? personaCharacterFailureReason(settingsQuery.error) : null;
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
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
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
          {settingsFailure ? (
            <InlineAlert tone="danger">
              {t('settings.unavailable', {
                message: t('persona.failure.sanitized', { reason: t(failureKindCopyKey(settingsFailure)) }),
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
              <InlineAlert tone="info">{t('settings.nativeProfileBoundary')}</InlineAlert>
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
        <div className="grid min-w-0 content-start gap-4">
          <Surface tone="card" padding="md">
            <div className="font-medium">{t('create.referenceTitle')}</div>
            {persona.avatarUrl ? (
              <div className="mt-3 overflow-hidden rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)]">
                <img src={persona.avatarUrl} alt={draft?.displayName || persona.displayName.value} className="aspect-square w-full object-cover" />
              </div>
            ) : (
              <div className="mt-3 grid aspect-square place-items-center rounded-[var(--nimi-radius-field)] border border-dashed border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-4 text-center text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                {t('create.reference.emptyTitle')}
              </div>
            )}
          </Surface>
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
  const visibilityFailure = visibilityQuery.isError ? personaCharacterFailureReason(visibilityQuery.error) : null;

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
    return draft.visibility !== visibilityQuery.data.visibility;
  }, [draft, visibilityQuery.data]);

  function updateDraft(value: string) {
    setDraft((current) => current ? { ...current, visibility: value } : current);
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
      {visibilityFailure ? (
        <InlineAlert tone="danger">
          {t('visibility.unavailable', {
            message: t('persona.failure.sanitized', { reason: t(failureKindCopyKey(visibilityFailure)) }),
          })}
        </InlineAlert>
      ) : null}
      {draft && visibilityQuery.data ? (
        <div className="mt-4 grid gap-4">
          {visibilityQuery.data.visibility === 'system' ? (
            <InlineAlert tone="warning">{t('visibility.systemReadOnly')}</InlineAlert>
          ) : (
            <FieldShell label={t('settingField.visibility')} message={t('visibility.allowedValues')}>
              <SelectField
                value={draft.visibility}
                options={PERSONA_VISIBILITY_VALUES.map((value) => ({ value, label: t(`visibility.value.${value}` as StudioCopyKey) }))}
                onValueChange={updateDraft}
              />
            </FieldShell>
          )}
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
              disabled={visibilityQuery.data.visibility === 'system' || !hasChanges || !humanReviewed || isSaving}
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

export function RuntimeProjectionWorkspace() {
  const { t } = useStudioI18n();

  return (
    <Surface tone="panel" padding="lg" className="mt-5">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h3 className="m-0 text-xl font-semibold">{t('runtimeProjection.title')}</h3>
        <StatusBadge tone="info">{t('common.aiContext')}</StatusBadge>
        <StatusBadge tone="warning">{t('common.sourceUnavailable')}</StatusBadge>
        <StatusBadge tone="warning">{t('common.readOnly')}</StatusBadge>
      </div>
      <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
        {t('runtimeProjection.description')}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button disabled>
          {t('runtimeProjection.generateContext')}
        </Button>
        <Button disabled>
          {t('runtimeProjection.generateChatReadiness')}
        </Button>
      </div>
      <InlineAlert tone="warning" className="mt-3">
        {t('runtimeProjection.error.unavailable')}
      </InlineAlert>
    </Surface>
  );
}
