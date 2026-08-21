import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { Button, Checkbox, EmptyState, FieldShell, InlineAlert, nimiToast, SelectField, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  PERSONA_ARCHETYPES,
  PERSONA_TRAITS,
  PERSONA_TRAIT_MAX,
  type PersonaArchetype,
  type PersonaTrait,
} from './create-persona-draft.js';
import {
  PERSONA_VISIBILITY_FIELDS,
  PERSONA_VISIBILITY_VALUES,
  createPersonaVisibilityDraft,
  getPersonaVisibilitySettings,
  getPortfolioPersonaSettings,
  projectPersonaChatReadinessContextSummary,
  projectPersonaRuntimeContextSummary,
  readPersonaStylePreference,
  updateReviewedPersonaVisibility,
  updateReviewedPortfolioPersonaSettings,
  type PersonaChatReadinessSummaryResult,
  type PersonaVisibilityDraft,
  type PersonaVisibilityField,
  type RealmPersonaVisibilityUpdateResult,
  type RealmOwnerPersonaSettings,
  type RuntimeProjectionSummaryResult,
} from './portfolio-client.js';
import {
  RAW_RULE_REVIEW_DEFERRED_REASON,
  createOwnerPersonaSettingsDraft,
  type OwnerPersonaSettingsDraft,
} from './setting-proposal.js';
import { TechnicalReviewDetails } from './OwnerPortfolio.shared.js';
import { translatePersonaArchetypeLabel, translatePersonaTraitLabel } from '../../i18n/studio-i18n.js';
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

type BasicInfoSettingsDraft = {
  displayName: string;
  description: string;
  personaArchetype: PersonaArchetype | '';
  personaTraits: PersonaTrait[];
};

const PERSONA_ARCHETYPE_DESCRIPTION_KEYS: Record<PersonaArchetype, StudioCopyKey> = {
  CARING: 'create.personaStyle.archetype.CARING',
  PLAYFUL: 'create.personaStyle.archetype.PLAYFUL',
  INTELLECTUAL: 'create.personaStyle.archetype.INTELLECTUAL',
  CONFIDENT: 'create.personaStyle.archetype.CONFIDENT',
  MYSTERIOUS: 'create.personaStyle.archetype.MYSTERIOUS',
  ROMANTIC: 'create.personaStyle.archetype.ROMANTIC',
};

function createBasicInfoSettingsDraft(settings: RealmOwnerPersonaSettings): BasicInfoSettingsDraft {
  const style = readPersonaStylePreference(settings);
  return {
    displayName: settings.displayName ?? '',
    description: settings.description ?? '',
    personaArchetype: style.archetype ?? '',
    personaTraits: style.traits,
  };
}

export function SettingProposalWorkspace({ persona, onPersonaWrite }: { persona: OwnerPortfolioPersonaDetail; onPersonaWrite: () => Promise<void> }) {
  const { t } = useStudioI18n();
  const settingsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'persona-settings', persona.ownerScope, persona.id],
    queryFn: () => getPortfolioPersonaSettings(persona),
  });
  const [draft, setDraft] = useState<BasicInfoSettingsDraft | null>(null);
  const [ownerReviewed, setOwnerReviewed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [traitPickerOpen, setTraitPickerOpen] = useState(false);
  const traitPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft(createBasicInfoSettingsDraft(settingsQuery.data));
      setOwnerReviewed(false);
      setTraitPickerOpen(false);
    }
  }, [persona.id, settingsQuery.data]);

  useEffect(() => {
    if (!traitPickerOpen) {
      return;
    }
    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (!traitPickerRef.current?.contains(event.target as Node)) {
        setTraitPickerOpen(false);
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
  }, [traitPickerOpen]);

  function updateDraft(patch: Partial<BasicInfoSettingsDraft>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setOwnerReviewed(false);
  }

  async function saveBasicInfo() {
    if (!draft || !settingsQuery.data) {
      return;
    }
    setIsSaving(true);
    try {
      const payload: OwnerPersonaSettingsDraft = {
        ...createOwnerPersonaSettingsDraft(settingsQuery.data),
        displayName: draft.displayName,
        description: draft.description,
      };
      const updateResult = await updateReviewedPortfolioPersonaSettings(persona, payload, settingsQuery.data);
      if (updateResult.ok) {
        nimiToast.success(t('settings.saved'));
        await settingsQuery.refetch();
        await onPersonaWrite();
      } else {
        nimiToast.danger(translateSettingsFixedMessage(updateResult.message, t));
      }
    } catch {
      nimiToast.danger(t('settings.error.ownerSettingsUpdateFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  const handleDisplay = persona.handle.value.trim() ? `@${persona.handle.value.trim()}` : '';
  const worldDisplay = [persona.world.value.trim(), persona.homeWorldId.trim()].filter(Boolean).join(' · ');

  return (
    <Surface tone="panel" padding="lg" className="mt-5">
      <h3 className="m-0 text-xl font-semibold">{t('settings.workspace.title')}</h3>
      <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
        {t('settings.workspace.description')}
      </p>

      {settingsQuery.isLoading ? (
        <EmptyState title={t('settings.loadingTitle')} description={t('settings.loadingDescription')} />
      ) : null}
      {settingsQuery.isError ? (
        <div className="mt-4">
          <EmptyState title={t('settings.unavailableTitle')} description={t('settings.unavailableDescription')} />
        </div>
      ) : null}
      {draft && settingsQuery.data ? (
        <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[1fr_320px]">
          <div className="grid min-w-0 content-start gap-6">
            <div className="ras-create-identity-grid">
              <div className="min-w-0">
                <FieldShell label={t('create.displayNameLabel')}>
                  <TextField
                    value={draft.displayName}
                    placeholder={t('create.displayNamePlaceholder')}
                    onChange={(event) => updateDraft({ displayName: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              <div className="min-w-0">
                <FieldShell label={t('create.handleLabel')}>
                  <TextField readOnly value={handleDisplay} placeholder={t('create.handlePlaceholder')} />
                </FieldShell>
              </div>
            </div>

            <div className="min-w-0">
              <FieldShell label={t('create.conceptLabel')} message={t('create.conceptMessage')}>
                <TextareaField
                  rows={3}
                  value={draft.description}
                  placeholder={t('create.conceptPlaceholder')}
                  onChange={(event) => updateDraft({ description: event.currentTarget.value })}
                />
              </FieldShell>
            </div>

            <div className="ras-create-personality-grid">
              <div className="min-w-0">
                <FieldShell label={t('create.personaArchetypeLabel')}>
                  <SelectField
                    value={draft.personaArchetype}
                    options={[
                      { value: '', label: t('create.personaArchetypePlaceholder') },
                      ...PERSONA_ARCHETYPES.map((archetype) => ({
                        value: archetype,
                        label: `${translatePersonaArchetypeLabel(archetype, t)} — ${t(PERSONA_ARCHETYPE_DESCRIPTION_KEYS[archetype])}`,
                      })),
                    ]}
                    onValueChange={(value) => updateDraft({ personaArchetype: value as PersonaArchetype | '' })}
                  />
                </FieldShell>
              </div>
              <div className="min-w-0">
                <FieldShell label={t('create.personaTraitsLabel', { max: PERSONA_TRAIT_MAX })}>
                  <div ref={traitPickerRef} className="ras-create-trait-picker" data-open={traitPickerOpen || undefined}>
                    <button
                      type="button"
                      aria-expanded={traitPickerOpen}
                      className="ras-create-trait-trigger"
                      onClick={() => setTraitPickerOpen((open) => !open)}
                    >
                      <span className="ras-create-trait-trigger__selection">
                        {draft.personaTraits.length > 0 ? draft.personaTraits.map((trait) => (
                          <span key={trait} className="ras-create-trait-chip">
                            {translatePersonaTraitLabel(trait, t).split(' · ')[0]}
                          </span>
                        )) : (
                          <span className="ras-create-trait-trigger__placeholder">
                            {t('create.personaTraitsPlaceholder', { max: PERSONA_TRAIT_MAX })}
                          </span>
                        )}
                      </span>
                      <ChevronDown className="ras-create-trait-trigger__chevron" size={15} aria-hidden="true" />
                    </button>
                    {traitPickerOpen ? (
                      <div className="ras-create-trait-popover">
                        <div className="ras-create-trait-grid">
                          {PERSONA_TRAITS.map((trait) => {
                            const active = draft.personaTraits.includes(trait);
                            const disabled = !active && draft.personaTraits.length >= PERSONA_TRAIT_MAX;
                            return (
                              <button
                                key={trait}
                                type="button"
                                aria-pressed={active}
                                disabled={disabled}
                                onClick={() => updateDraft({
                                  personaTraits: active
                                    ? draft.personaTraits.filter((value) => value !== trait)
                                    : [...draft.personaTraits, trait],
                                })}
                                className="ras-create-trait-option"
                              >
                                {active ? <Check size={13} strokeWidth={2.2} aria-hidden="true" /> : null}
                                {translatePersonaTraitLabel(trait, t)}
                              </button>
                            );
                          })}
                        </div>
                        <div className="ras-create-trait-popover__footer">
                          <span>{t('create.personaTraitsSelectedCount', { count: draft.personaTraits.length, max: PERSONA_TRAIT_MAX })}</span>
                          <button type="button" disabled={draft.personaTraits.length === 0} onClick={() => updateDraft({ personaTraits: [] })}>
                            {t('create.personaTraitsClear')}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </FieldShell>
              </div>
            </div>

            <div className="min-w-0">
              <FieldShell label={t('create.worldLabel')}>
                <TextField readOnly value={worldDisplay} />
              </FieldShell>
            </div>

            <div className="grid gap-3">
              <Checkbox
                checked={ownerReviewed}
                onChange={(event) => setOwnerReviewed(event.currentTarget.checked)}
                label={t('settings.confirmReview')}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!ownerReviewed || isSaving}
                  loading={isSaving}
                  onClick={() => void saveBasicInfo()}
                >
                  {t('settings.save')}
                </Button>
                <Button
                  tone="secondary"
                  disabled={isSaving}
                  onClick={() => {
                    setDraft(createBasicInfoSettingsDraft(settingsQuery.data as RealmOwnerPersonaSettings));
                    setOwnerReviewed(false);
                  }}
                >
                  {t('settings.reset')}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 content-start gap-4">
            <Surface tone="card" padding="md">
              <div className="font-medium">{t('create.referenceTitle')}</div>
              {persona.avatarUrl ? (
                <div className="mt-3 overflow-hidden rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)]">
                  <img src={persona.avatarUrl} alt={draft.displayName} className="aspect-square w-full object-cover" />
                </div>
              ) : (
                <div className="mt-3 grid aspect-square place-items-center rounded-[var(--nimi-radius-field)] border border-dashed border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-4 text-center text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                  {t('create.reference.emptyTitle')}
                </div>
              )}
            </Surface>
          </div>
        </div>
      ) : null}
    </Surface>
  );
}

export const VISIBILITY_FIELD_LABEL_KEYS: Record<PersonaVisibilityField, StudioCopyKey> = {
  defaultPostVisibility: 'visibility.field.defaultPostVisibility',
  dmVisibility: 'visibility.field.dmVisibility',
  profileVisibility: 'visibility.field.profileVisibility',
};

const VISIBILITY_FIELD_MESSAGE_KEYS: Record<PersonaVisibilityField, StudioCopyKey> = {
  defaultPostVisibility: 'visibility.fieldMessage.defaultPostVisibility',
  dmVisibility: 'visibility.fieldMessage.dmVisibility',
  profileVisibility: 'visibility.fieldMessage.profileVisibility',
};

const VISIBILITY_VALUE_LABEL_KEYS: Record<string, StudioCopyKey> = {
  PUBLIC: 'visibility.option.public',
  FRIENDS: 'visibility.option.friends',
  PRIVATE: 'visibility.option.private',
};

export function VisibilitySettingsWorkspace({ persona, onPersonaWrite }: { persona: OwnerPortfolioPersonaDetail; onPersonaWrite: () => Promise<void> }) {
  const { t } = useStudioI18n();
  const visibilityQuery = useQuery({
    queryKey: ['realm-persona-studio', 'owner-persona-visibility', persona.id],
    queryFn: () => getPersonaVisibilitySettings(persona),
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
      <h3 className="m-0 text-xl font-semibold">{t('visibility.title')}</h3>
      <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
        {t('visibility.description')}
      </p>

      {visibilityQuery.isLoading ? (
        <EmptyState title={t('visibility.loadingTitle')} description={t('visibility.loadingDescription')} />
      ) : null}
      {visibilityQuery.isError ? (
        <div className="mt-4">
          <EmptyState title={t('visibility.unavailableTitle')} description={t('visibility.unavailableDescription')} />
        </div>
      ) : null}
      {draft && visibilityQuery.data ? (
        <div className="mt-4 grid max-w-3xl gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {PERSONA_VISIBILITY_FIELDS.map((field) => (
              <FieldShell key={field} label={t(VISIBILITY_FIELD_LABEL_KEYS[field])} message={t(VISIBILITY_FIELD_MESSAGE_KEYS[field])}>
                <SelectField
                  value={draft[field]}
                  options={PERSONA_VISIBILITY_VALUES.map((value) => ({
                    value,
                    label: t(VISIBILITY_VALUE_LABEL_KEYS[value] ?? 'common.none'),
                  }))}
                  onValueChange={(value) => updateDraft(field, value)}
                />
              </FieldShell>
            ))}
          </div>
          {!hasChanges ? (
            <p className="m-0 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
              {t('visibility.noChanges')}
            </p>
          ) : null}
          <Checkbox
            checked={humanReviewed}
            onChange={(event) => setHumanReviewed(event.currentTarget.checked)}
            label={t('settings.confirmReview')}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!hasChanges || !humanReviewed || isSaving}
              loading={isSaving}
              onClick={() => void saveVisibility()}
            >
              {t('visibility.save')}
            </Button>
            <Button
              tone="secondary"
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
            <pre className="ras-json-preview m-0 mt-3 min-h-24 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs">
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
      <h3 className="m-0 text-xl font-semibold">{t('runtimeProjection.title')}</h3>
      <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
        {t('runtimeProjection.description')}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button disabled={isProjecting || persona.world.status !== 'available'} loading={isProjecting} onClick={() => void projectRuntimeContext()}>
          {t('runtimeProjection.generateContext')}
        </Button>
        <Button tone="secondary" disabled={isProjecting || persona.world.status !== 'available'} loading={isProjecting} onClick={() => void projectPersonaChatReadinessContext()}>
          {t('runtimeProjection.generateChatReadiness')}
        </Button>
      </div>
      {persona.world.status !== 'available' ? (
        <InlineAlert tone="warning" className="mt-3">
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
