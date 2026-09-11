import { useEffect, useId, useRef, useState } from 'react';
import {
  Button,
  FieldShell,
  FieldTrigger,
  SelectField,
  InlineAlert,
  NimiTabs,
  StatusBadge,
  Surface,
  TextareaField,
  TextField,
} from '@nimiplatform/kit/ui';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Globe } from 'lucide-react';
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
import { translatePersonaArchetypeLabel } from '../../../i18n/studio-i18n.js';
import {
  PERSONA_ARCHETYPE_DESCRIPTION_KEYS,
  firstInvalidCreateField,
  translateCreateFlowFailure,
} from './create-flow-copy.js';
import { focusCreateField, worldOptionLabel } from './draft-utils.js';
import { BehaviorFields } from './behavior-fields.js';
import { HandleField } from './handle-field.js';
import { PromptDisclosure } from './prompt-disclosure.js';
import { ReferenceImageCard } from './reference-image-card.js';
import { TraitsMultiSelect } from './traits-multi-select.js';
import { WorldLoadingPanel, WorldPicker } from './world-picker.js';
import type { UseReferenceImageResult } from './use-reference-image.js';
import type {
  CreateFieldErrors,
  CreatedRealmPersonaContext,
  CreateRealmPersonaDraftPatchInput,
  ReferenceAssetsState,
} from './types.js';
import { SELECT_UNSET_VALUE } from './types.js';
import { CharacterPreview } from '../../persona-workshop/character-preview.js';
import { characterWritingIssues } from '../persona-character-authoring.js';

export function ReviewStage({
  draft,
  normalizedDraft,
  fieldErrors,
  validationAttempt,
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
  validationAttempt: number;
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
  handleQuery: {
    isFetching: boolean;
    isError: boolean;
    data?: RealmPersonaHandleAvailabilityResult;
  };
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
  const id = useId();
  const [worldModalOpen, setWorldModalOpen] = useState(false);
  const [tab, setTab] = useState<'profile' | 'character' | 'visual' | 'finish'>('profile');
  const tabs = ['profile', 'character', 'visual', 'finish'] as const;
  const errorFor = (field: keyof CreateFieldErrors) =>
    fieldErrors[field] ? translateCreateFlowFailure(fieldErrors[field]!, t) : null;
  const profileError = errorFor('displayName') || errorFor('handle');
  const characterError =
    errorFor('concept') ||
    errorFor('personaArchetype') ||
    errorFor('personaTraits') ||
    errorFor('ruleText') ||
    errorFor('speechSupplement') ||
    errorFor('boundarySupplement');
  const previousValidation = useRef(validationAttempt);
  useEffect(() => {
    if (previousValidation.current === validationAttempt) return;
    previousValidation.current = validationAttempt;
    if (profileError) setTab('profile');
    else if (characterError) setTab('character');
    else if (fieldErrors.referenceImage) setTab('visual');
    const firstInvalidField = firstInvalidCreateField(fieldErrors);
    if (firstInvalidField) focusCreateField(firstInvalidField);
  }, [validationAttempt, profileError, characterError, fieldErrors]);
  const writing = {
    characterIdentity: normalizedDraft.concept,
    behaviorText: normalizedDraft.ruleText,
    speakingText: normalizedDraft.speechSupplement,
    boundariesText: normalizedDraft.boundarySupplement,
  };
  const writingReady =
    characterWritingIssues(writing).length === 0 && Boolean(normalizedDraft.personaArchetype);
  const tabIndex = tabs.indexOf(tab);

  return (
    <>
      <div className="ras-workshop-heading">
        <Button
          tone="ghost"
          size="sm"
          disabled={createPending}
          onClick={onReturnToDescribe}
          leadingIcon={<ArrowLeft size={15} aria-hidden="true" />}
        >
          {t('create.review.back')}
        </Button>
        <h2>{t('workshop.shape.title')}</h2>
        <p>{t('workshop.shape.description')}</p>
      </div>
      <div className="ras-workshop-layout">
        <Surface tone="card" padding="none" className="ras-workshop-editor">
          <NimiTabs
            value={tab}
            onValueChange={(value) => {
              if (!createPending) setTab(value as typeof tab);
            }}
            items={tabs.map((value, index) => ({
              value,
              label: `${index + 1}. ${t(`workshop.tab.${value}`)}`,
            }))}
            ariaLabel={t('workshop.shape.title')}
          />
          <fieldset disabled={createPending} className="ras-workshop-fieldset">
            <div hidden={tab !== 'profile'} className="ras-workshop-panel">
              <div className="ras-create-review-card__heading">
                <h3>{t('create.review.basicInfo')}</h3>
                {seedOriginalDisplayName ? (
                  <StatusBadge tone="info">{t('create.review.aiDraft')}</StatusBadge>
                ) : null}
              </div>
              <div className="ras-create-identity-grid">
                <div data-create-field="displayName">
                  <FieldShell
                    label={<label htmlFor={`${id}-name`}>{t('create.displayNameLabel')}</label>}
                    message={errorFor('displayName')}
                    messageTone={errorFor('displayName') ? 'danger' : 'neutral'}
                  >
                    <TextField
                      id={`${id}-name`}
                      tone={errorFor('displayName') ? 'danger' : 'default'}
                      aria-invalid={Boolean(errorFor('displayName')) || undefined}
                      data-create-field-control
                      value={draft.displayName}
                      placeholder={t('create.displayNamePlaceholder')}
                      onChange={(event) => updateDraft({ displayName: event.currentTarget.value })}
                    />
                  </FieldShell>
                </div>
                <HandleField
                  handle={draft.handle}
                  normalizedHandle={normalizedDraft.handle}
                  query={handleQuery}
                  availability={handleAvailability}
                  handleError={errorFor('handle')}
                  updateDraft={updateDraft}
                />
              </div>
              <FieldShell
                label={<label htmlFor={`${id}-bio`}>{t('workshop.profile.description')}</label>}
                message={t('workshop.profile.descriptionHint')}
              >
                <TextareaField
                  id={`${id}-bio`}
                  rows={4}
                  value={draft.description}
                  placeholder={t('workshop.profile.descriptionHint')}
                  onChange={(event) => updateDraft({ description: event.currentTarget.value })}
                />
              </FieldShell>
              <FieldShell
                label={<label htmlFor={`${id}-greeting`}>{t('workshop.profile.greeting')}</label>}
                message={t('workshop.profile.greetingHint')}
              >
                <TextareaField
                  id={`${id}-greeting`}
                  rows={3}
                  value={draft.greeting || ''}
                  placeholder={t('workshop.profile.greetingPlaceholder')}
                  onChange={(event) => updateDraft({ greeting: event.currentTarget.value })}
                />
              </FieldShell>
            </div>
            <div hidden={tab !== 'character'} className="ras-workshop-panel">
              <div data-create-field="concept">
                <FieldShell
                  label={
                    <label htmlFor={`${id}-concept`}>
                      {t('workshop.character.characterIdentity')}
                    </label>
                  }
                  message={errorFor('concept') || t('workshop.character.identityHint')}
                  messageTone={errorFor('concept') ? 'danger' : 'neutral'}
                >
                  <TextareaField
                    id={`${id}-concept`}
                    tone={errorFor('concept') ? 'danger' : 'default'}
                    aria-invalid={Boolean(errorFor('concept')) || undefined}
                    data-create-field-control
                    rows={3}
                    value={draft.concept}
                    placeholder={t('workshop.character.characterIdentityPlaceholder')}
                    onChange={(event) => updateDraft({ concept: event.currentTarget.value })}
                  />
                </FieldShell>
              </div>
              <div className="ras-create-form-grid">
                <div data-create-field="personaArchetype">
                  <FieldShell
                    label={t('create.personaArchetypeLabel')}
                    message={errorFor('personaArchetype')}
                    messageTone={errorFor('personaArchetype') ? 'danger' : 'neutral'}
                  >
                    <SelectField
                      required
                      tone={errorFor('personaArchetype') ? 'danger' : 'default'}
                      aria-label={t('create.personaArchetypeLabel')}
                      value={draft.personaArchetype || SELECT_UNSET_VALUE}
                      options={[
                        {
                          value: SELECT_UNSET_VALUE,
                          label: t('create.personaArchetypePlaceholder'),
                        },
                        ...PERSONA_ARCHETYPES.map((archetype) => ({
                          value: archetype,
                          label: `${translatePersonaArchetypeLabel(archetype, t)} — ${t(PERSONA_ARCHETYPE_DESCRIPTION_KEYS[archetype])}`,
                        })),
                      ]}
                      onValueChange={(value) =>
                        updateDraft({
                          personaArchetype:
                            value === SELECT_UNSET_VALUE ? '' : (value as PersonaArchetype),
                        })
                      }
                    />
                  </FieldShell>
                </div>
                <div data-create-field="personaTraits">
                  <FieldShell
                    label={t('create.personaTraitsLabel', { max: PERSONA_TRAIT_MAX })}
                    message={errorFor('personaTraits')}
                    messageTone={errorFor('personaTraits') ? 'danger' : 'neutral'}
                  >
                    <TraitsMultiSelect
                      value={draft.personaTraits}
                      error={errorFor('personaTraits')}
                      onChange={(personaTraits: PersonaTrait[]) => updateDraft({ personaTraits })}
                    />
                  </FieldShell>
                </div>
              </div>
              <BehaviorFields draft={draft} fieldErrors={fieldErrors} updateDraft={updateDraft} />
            </div>
            <div hidden={tab !== 'visual'} className="ras-workshop-panel">
              <h3>{t('workshop.tab.visual')}</h3>
              <p>{t('workshop.visual.description')}</p>
              <ReferenceImageCard
                draft={draft}
                normalizedDraft={normalizedDraft}
                error={errorFor('referenceImage')}
                referenceAssets={referenceAssets}
                referenceSourceFailure={referenceSourceFailure}
                referenceImageSourceMode={referenceImageSourceMode}
                referenceImageEditorOpen={referenceImageEditorOpen}
                referenceImageLoadFailed={referenceImageLoadFailed}
                referenceImage={referenceImage}
                onEditorOpenChange={onSetReferenceImageEditorOpen}
                onReferenceImagePromptChange={(value) =>
                  updateDraft({ referenceImagePrompt: value })
                }
              />
              <p className="ras-workshop-help">{t('workshop.visual.note')}</p>
              <PromptDisclosure
                seedPrompt={seedPrompt}
                imagePrompt={normalizedDraft.referenceImagePrompt}
              />
            </div>
            <div hidden={tab !== 'finish'} className="ras-workshop-panel">
              <h3>{t('workshop.finish.title')}</h3>
              <p>{t('workshop.finish.description')}</p>
              <div className="ras-workshop-readiness" data-ready={writingReady}>
                <Check size={18} aria-hidden="true" />
                <span>{t(writingReady ? 'workshop.finish.ready' : 'workshop.finish.missing')}</span>
                {!writingReady ? (
                  <Button tone="ghost" size="sm" onClick={() => setTab('character')}>
                    {t('workshop.tab.character')}
                  </Button>
                ) : null}
              </div>
              {worldsLoading ? (
                <WorldLoadingPanel />
              ) : worldsUnavailable ? (
                <InlineAlert
                  tone="warning"
                  action={
                    <Button
                      tone="secondary"
                      size="sm"
                      loading={worldsRetrying}
                      onClick={onRetryWorlds}
                    >
                      {t('common.retry')}
                    </Button>
                  }
                >
                  {t('workshop.finish.worldUnavailable')}
                </InlineAlert>
              ) : null}
              <div data-create-field="selectedWorldId">
                <FieldShell
                  label={t('create.worldLabel')}
                  message={errorFor('selectedWorldId')}
                  messageTone={errorFor('selectedWorldId') ? 'danger' : 'neutral'}
                >
                  <FieldTrigger
                    data-create-field-control
                    disabled={worldsUnavailable || worldsLoading}
                    onClick={() => setWorldModalOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={worldModalOpen}
                  >
                    <Globe size={18} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      {selectedWorld ? worldOptionLabel(selectedWorld) : t('create.world.select')}
                    </span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </FieldTrigger>
                </FieldShell>
              </div>
              <div data-create-field="visibility">
                <FieldShell
                  label={t('create.visibilityLabel')}
                  message={errorFor('visibility')}
                  messageTone={errorFor('visibility') ? 'danger' : 'neutral'}
                >
                  <SelectField
                    aria-label={t('create.visibilityLabel')}
                    value={draft.visibility || SELECT_UNSET_VALUE}
                    options={[
                      ...(!draft.visibility
                        ? [
                            {
                              value: SELECT_UNSET_VALUE,
                              label: t('create.error.visibilityMissing'),
                              disabled: true,
                            },
                          ]
                        : []),
                      { value: 'private', label: t('visibility.value.private') },
                      { value: 'unlisted', label: t('visibility.value.unlisted') },
                      { value: 'public', label: t('visibility.value.public') },
                    ]}
                    onValueChange={(value) =>
                      updateDraft({
                        visibility: value as CreateRealmPersonaDraftInput['visibility'],
                      })
                    }
                  />
                </FieldShell>
              </div>
              {draft.visibility ? (
                <p className="ras-workshop-visibility-note">
                  {t(`workshop.finish.${draft.visibility}`)}
                </p>
              ) : null}
              <p className="ras-workshop-help">{t('workshop.finish.review')}</p>
              {createdContext ? (
                <Button
                  tone="secondary"
                  onClick={() => onOpenCreatedPersona?.(createdContext.personaId)}
                >
                  {t('create.openSettings')}
                </Button>
              ) : null}
            </div>
          </fieldset>
          <footer className="ras-workshop-editor__footer">
            <Button
              tone="ghost"
              disabled={createPending}
              onClick={() => (tabIndex === 0 ? onReturnToDescribe() : setTab(tabs[tabIndex - 1]!))}
            >
              {t('workshop.previous')}
            </Button>
            {tab === 'finish' ? (
              <Button
                tone="primary"
                disabled={createDisabled || Boolean(createdContext)}
                loading={createPending}
                onClick={onSubmit}
              >
                {t('workshop.finish.create')}
              </Button>
            ) : (
              <Button
                tone="primary"
                trailingIcon={<ArrowRight size={16} aria-hidden="true" />}
                onClick={() => setTab(tabs[tabIndex + 1]!)}
              >
                {t('workshop.next')}
              </Button>
            )}
          </footer>
        </Surface>
        <CharacterPreview
          displayName={draft.displayName}
          handle={draft.handle}
          description={draft.description || draft.concept}
          greeting={draft.greeting || ''}
          identity={draft.concept}
          traits={
            draft.personaArchetype
              ? [translatePersonaArchetypeLabel(draft.personaArchetype as PersonaArchetype, t)]
              : []
          }
        />
      </div>
      <WorldPicker
        open={worldModalOpen}
        worlds={worlds}
        selectedWorldId={draft.selectedWorldId}
        onSelect={(worldId) => {
          updateDraft({ selectedWorldId: worldId });
          setWorldModalOpen(false);
        }}
        onClose={() => setWorldModalOpen(false)}
      />
    </>
  );
}
