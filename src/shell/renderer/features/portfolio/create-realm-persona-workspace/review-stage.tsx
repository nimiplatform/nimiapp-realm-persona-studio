import { useState } from 'react';
import {
  Button,
  FieldShell,
  FieldTrigger,
  SelectField,
  StatusBadge,
  Surface,
  TextareaField,
  TextField,
} from '@nimiplatform/kit/ui';
import { ArrowLeft, ChevronDown, Globe } from 'lucide-react';
import {
  PERSONA_ARCHETYPES,
  PERSONA_TRAIT_MAX,
  type CreateRealmPersonaDraftInput,
  type NormalizedCreateRealmPersonaDraft,
  type NormalizedRealmPersonaHandleAvailability,
  type PersonaArchetype,
  type PersonaTrait,
  type SelectableRealmWorld,
} from '../create-persona-draft.js';
import type { RealmPersonaHandleAvailabilityResult } from '../portfolio-client.js';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../../i18n/studio-copy.js';
import { translatePersonaArchetypeLabel } from '../../../i18n/studio-i18n.js';
import {
  PERSONA_ARCHETYPE_DESCRIPTION_KEYS,
  translateCreateFlowFailure,
} from './create-flow-copy.js';
import { countCompletedCreationDraftFields, worldOptionLabel } from './draft-utils.js';
import { BehaviorFields } from './behavior-fields.js';
import { HandleField } from './handle-field.js';
import { PromptDisclosure } from './prompt-disclosure.js';
import { ReferenceImageCard } from './reference-image-card.js';
import { TraitsMultiSelect } from './traits-multi-select.js';
import { WorldLoadingPanel, WorldPicker, WorldRecoveryPanel } from './world-picker.js';
import type { UseReferenceImageResult } from './use-reference-image.js';
import type {
  CreateFieldErrors,
  CreatedRealmPersonaContext,
  CreateRealmPersonaDraftPatchInput,
  ReferenceAssetsState,
} from './types.js';
import { SELECT_UNSET_VALUE } from './types.js';

export function ReviewStage({
  draft,
  normalizedDraft,
  fieldErrors,
  seedOriginalDisplayName,
  createdContext,
  referenceAssets,
  referenceSourceFailure,
  referenceImageSourceMode,
  referenceImageEditorOpen,
  referenceImageLoadFailed,
  worlds,
  worldsLoading,
  worldsUnavailable,
  worldsRetrying,
  selectedWorld,
  createDisabled,
  createPending,
  handleQuery,
  handleAvailability,
  referenceImage,
  seedPrompt,
  updateDraft,
  onSetReferenceImageEditorOpen,
  onReturnToDescribe,
  onRetryWorlds,
  onSubmit,
  onOpenCreatedPersona,
}: {
  draft: CreateRealmPersonaDraftInput;
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  fieldErrors: CreateFieldErrors;
  seedOriginalDisplayName: string;
  createdContext: CreatedRealmPersonaContext | null;
  referenceAssets: ReferenceAssetsState;
  referenceSourceFailure: string | null;
  referenceImageSourceMode: 'assets' | 'ai' | null;
  referenceImageEditorOpen: boolean;
  referenceImageLoadFailed: boolean;
  worlds: SelectableRealmWorld[];
  worldsLoading: boolean;
  worldsUnavailable: boolean;
  worldsRetrying: boolean;
  selectedWorld: SelectableRealmWorld | null;
  createDisabled: boolean;
  createPending: boolean;
  handleQuery: { isFetching: boolean; isError: boolean; data?: RealmPersonaHandleAvailabilityResult };
  handleAvailability: NormalizedRealmPersonaHandleAvailability | null;
  referenceImage: UseReferenceImageResult;
  seedPrompt: string;
  updateDraft: (patch: CreateRealmPersonaDraftPatchInput) => void;
  onSetReferenceImageEditorOpen: (open: boolean) => void;
  onReturnToDescribe: () => void;
  onRetryWorlds: () => void;
  onSubmit: () => void;
  onOpenCreatedPersona?: (personaId: string) => void;
}) {
  const { t } = useStudioI18n();
  const [worldModalOpen, setWorldModalOpen] = useState(false);

  const displayNameError = fieldErrors.displayName ? translateCreateFlowFailure(fieldErrors.displayName, t) : null;
  const handleError = fieldErrors.handle ? translateCreateFlowFailure(fieldErrors.handle, t) : null;
  const conceptError = fieldErrors.concept ? translateCreateFlowFailure(fieldErrors.concept, t) : null;
  const personaArchetypeError = fieldErrors.personaArchetype ? translateCreateFlowFailure(fieldErrors.personaArchetype, t) : null;
  const personaTraitsError = fieldErrors.personaTraits ? translateCreateFlowFailure(fieldErrors.personaTraits, t) : null;
  const selectedWorldError = fieldErrors.selectedWorldId ? translateCreateFlowFailure(fieldErrors.selectedWorldId, t) : null;
  const visibilityError = fieldErrors.visibility ? translateCreateFlowFailure(fieldErrors.visibility, t) : null;
  const referenceImageError = fieldErrors.referenceImage ? translateCreateFlowFailure(fieldErrors.referenceImage, t) : null;
  const imagePrompt = normalizedDraft.referenceImagePrompt;

  return (
    <>
      <section className="min-w-0">
          {worldsLoading ? <Surface tone="card" padding="lg" className="rounded-[var(--nimi-radius-xl)]"><WorldLoadingPanel /></Surface> : worldsUnavailable ? (
            <WorldRecoveryPanel
              completedCount={countCompletedCreationDraftFields(draft)}
              retrying={worldsRetrying}
              onRetry={onRetryWorlds}
              createDisabled={createDisabled}
            />
          ) : (
            <div className="grid min-w-0 gap-5 px-1 pb-6 pt-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <Button tone="ghost" size="sm" onClick={onReturnToDescribe} leadingIcon={<ArrowLeft size={15} aria-hidden="true" />}>{t('create.review.back')}</Button>
              </div>

              <Surface tone="card" material="glass-thick" padding="none" className="ras-create-review-card">
                <div className="ras-create-review-form">
                <div className="ras-create-review-form__top">
                <div className="ras-create-review-form__fields">
                <div className="ras-create-review-card__heading"><h3>{t('create.review.basicInfo')}</h3><StatusBadge tone="info">{t('create.review.aiDraft')}</StatusBadge></div>
                <div className="ras-create-identity-grid">
                  <div className="min-w-0" data-create-field="displayName">
                    <FieldShell
                      label={<span className="flex flex-wrap items-center gap-2">{t('create.displayNameLabel')}{seedOriginalDisplayName && normalizedDraft.displayName !== seedOriginalDisplayName ? <StatusBadge tone="success">{t('create.review.modified')}</StatusBadge> : null}</span>}
                      message={displayNameError}
                      messageTone={displayNameError ? 'danger' : 'neutral'}
                    >
                      <TextField tone={displayNameError ? 'danger' : 'default'} className={displayNameError ? 'focus-within:!border-[var(--nimi-field-focus)] focus-within:!ring-[var(--nimi-focus-ring-color)]' : undefined} data-create-field-control value={draft.displayName} placeholder={t('create.displayNamePlaceholder')} onChange={(event) => updateDraft({ displayName: event.currentTarget.value })} />
                    </FieldShell>
                  </div>
                  <HandleField
                    handle={draft.handle}
                    normalizedHandle={normalizedDraft.handle}
                    query={handleQuery}
                    availability={handleAvailability}
                    handleError={handleError}
                    updateDraft={updateDraft}
                  />
                </div>
                <div className="min-w-0" data-create-field="concept">
                  <FieldShell label={t('create.conceptLabel')} message={conceptError || t('create.conceptMessage')} messageTone={conceptError ? 'danger' : 'neutral'}>
                    <TextareaField tone={conceptError ? 'danger' : 'default'} className={conceptError ? 'focus-within:!border-[var(--nimi-field-focus)] focus-within:!ring-[var(--nimi-focus-ring-color)]' : undefined} data-create-field-control rows={3} value={draft.concept} placeholder={t('create.conceptPlaceholder')} onChange={(event) => updateDraft({ concept: event.currentTarget.value })} />
                  </FieldShell>
                </div>
                </div>
                <div className={`ras-create-review-form__aside ${referenceImageError ? 'ras-create-review-form__aside--error' : ''}`}>
                <ReferenceImageCard
                  draft={draft}
                  normalizedDraft={normalizedDraft}
                  error={referenceImageError}
                  referenceAssets={referenceAssets}
                  referenceSourceFailure={referenceSourceFailure}
                  referenceImageSourceMode={referenceImageSourceMode}
                  referenceImageEditorOpen={referenceImageEditorOpen}
                  referenceImageLoadFailed={referenceImageLoadFailed}
                  referenceImage={referenceImage}
                  onEditorOpenChange={onSetReferenceImageEditorOpen}
                  onReferenceImagePromptChange={(value) => updateDraft({ referenceImagePrompt: value })}
                />
                </div>
                </div>
                <div className="ras-create-personality-grid">
                <div className="min-w-0" data-create-field="personaArchetype">
                  <FieldShell
                    label={t('create.personaArchetypeLabel')}
                    message={personaArchetypeError}
                    messageTone={personaArchetypeError ? 'danger' : 'neutral'}
                  >
                    <SelectField
                      required
                      value={draft.personaArchetype || SELECT_UNSET_VALUE}
                      className={personaArchetypeError ? '!border-[var(--nimi-status-danger)] focus:!border-[var(--nimi-field-focus)] focus:!ring-[var(--nimi-focus-ring-color)]' : undefined}
                      options={[{ value: SELECT_UNSET_VALUE, label: <span className="text-xs font-normal text-[var(--nimi-text-muted)]">{t('create.personaArchetypePlaceholder')}</span> }, ...PERSONA_ARCHETYPES.map((archetype) => ({ value: archetype, label: `${translatePersonaArchetypeLabel(archetype, t)} — ${t(PERSONA_ARCHETYPE_DESCRIPTION_KEYS[archetype])}` }))]}
                      onValueChange={(value) => updateDraft({ personaArchetype: value === SELECT_UNSET_VALUE ? '' : value as PersonaArchetype })}
                    />
                  </FieldShell>
                </div>
                <div className="min-w-0" data-create-field="personaTraits">
                  <FieldShell label={t('create.personaTraitsLabel', { max: PERSONA_TRAIT_MAX })} message={personaTraitsError} messageTone={personaTraitsError ? 'danger' : 'neutral'}>
                    <TraitsMultiSelect
                      value={draft.personaTraits}
                      error={personaTraitsError}
                      onChange={(personaTraits: PersonaTrait[]) => updateDraft({ personaTraits })}
                    />
                  </FieldShell>
                </div>
                </div>
                <BehaviorFields draft={draft} fieldErrors={fieldErrors} updateDraft={updateDraft} />
                <div className="ras-create-placement-grid">
                <div className="min-w-0" data-create-field="selectedWorldId">
                  <FieldShell label={t('create.worldLabel')} message={selectedWorldError} messageTone={selectedWorldError ? 'danger' : 'neutral'}>
                    <FieldTrigger
                      data-create-field-control
                      aria-invalid={Boolean(selectedWorldError) || undefined}
                      className={selectedWorldError ? '!border-[var(--nimi-status-danger)] focus:!border-[var(--nimi-field-focus)] focus:!ring-[var(--nimi-focus-ring-color)]' : undefined}
                      onClick={() => setWorldModalOpen(true)}
                      aria-haspopup="dialog"
                      aria-expanded={worldModalOpen}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--nimi-radius-sm)] bg-[var(--nimi-action-primary-bg)] text-xs font-semibold text-[var(--nimi-action-primary-text)]">{selectedWorld ? selectedWorld.name.charAt(0).toUpperCase() : <Globe size={14} aria-hidden="true" />}</span>
                      <span className="min-w-0 flex-1"><span className={`block truncate ${selectedWorld ? 'font-medium' : 'text-xs font-normal text-[var(--nimi-text-muted)]'}`}>{selectedWorld?.name || t('create.world.select')}</span><span className="block truncate text-xs text-[var(--nimi-text-muted)]">{selectedWorld ? worldOptionLabel(selectedWorld) : t('create.worldPreview.noneDescription')}</span></span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--nimi-text-secondary)]">{t('create.world.change')}<ChevronDown size={14} aria-hidden="true" /></span>
                    </FieldTrigger>
                  </FieldShell>
                </div>
                <div className="min-w-0" data-create-field="visibility">
                  <FieldShell
                    label={t('create.visibilityLabel')}
                    message={visibilityError}
                    messageTone={visibilityError ? 'danger' : 'neutral'}
                  >
                    <SelectField
                      value={draft.visibility || SELECT_UNSET_VALUE}
                      options={[
                        ...(!draft.visibility ? [{ value: SELECT_UNSET_VALUE, label: t('create.error.visibilityMissing'), disabled: true }] : []),
                        { value: 'private', label: t('visibility.value.private') },
                        { value: 'unlisted', label: t('visibility.value.unlisted') },
                        { value: 'public', label: t('visibility.value.public') },
                      ]}
                      onValueChange={(value) => updateDraft({ visibility: value as CreateRealmPersonaDraftInput['visibility'] })}
                    />
                  </FieldShell>
                </div>
                </div>
                </div>

              <PromptDisclosure seedPrompt={seedPrompt} imagePrompt={imagePrompt} />

              {createdContext ? (
                <Surface tone="card" padding="md" className="ras-create-created-card">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0"><div className="font-medium">{t('create.createdCardTitle')}</div><div className="ras-break-anywhere mt-1 text-sm text-[var(--nimi-text-muted)]">@{createdContext.handle} · {createdContext.personaId}</div></div><StatusBadge tone="success">{t(`visibility.value.${createdContext.visibility}` as StudioCopyKey)}</StatusBadge></div>
                  <div className="mt-3 flex flex-wrap gap-3"><Button tone="secondary" onClick={() => onOpenCreatedPersona?.(createdContext.personaId)}>{t('create.openSettings')}</Button></div>
                </Surface>
              ) : null}
              <div className="ras-create-review-actions">
                <Button tone="primary" disabled={createDisabled} loading={createPending} onClick={onSubmit}>{t('create.submit')}</Button>
              </div>
              </Surface>
            </div>
          )}
      </section>
      <WorldPicker open={worldModalOpen} worlds={worlds} selectedWorldId={draft.selectedWorldId} onSelect={(worldId) => { updateDraft({ selectedWorldId: worldId }); setWorldModalOpen(false); }} onClose={() => setWorldModalOpen(false)} />
    </>
  );
}
