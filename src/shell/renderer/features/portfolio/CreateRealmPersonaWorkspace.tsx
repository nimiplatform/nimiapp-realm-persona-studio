import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  EmptyState,
  FieldShell,
  FieldTrigger,
  IconButton,
  InlineAlert,
  NimiText,
  OverlayShell,
  SearchField,
  SelectField,
  StatusBadge,
  Surface,
  TextareaField,
  TextField,
  nimiToast,
} from '@nimiplatform/kit/ui';
import { ArrowLeft, Check, ChevronDown, Copy, ImageIcon, Pencil, RefreshCw, Scan, Sparkles, X } from 'lucide-react';
import {
  PERSONA_ARCHETYPES,
  PERSONA_TRAITS,
  PERSONA_TRAIT_MAX,
  adoptImportedReferenceImageCandidate,
  groupSelectableRealmWorldsForPicker,
  normalizeCreateRealmPersonaDraft,
  selectOasisDefaultWorld,
  validateCreateRealmPersonaReadiness,
  type CreateRealmPersonaDraftInput,
  type NormalizedRealmPersonaHandleAvailability,
  type PersonaArchetype,
  type PersonaTrait,
  type ReviewedCreateRealmPersonaPayload,
  type ReferenceImageCandidate,
  type ReferenceImageCandidateSlot,
  type SelectableRealmWorld,
} from './create-persona-draft.js';
import {
  checkCreateRealmPersonaHandleAvailability,
  createReviewedRealmPersonaWithProfileSettings,
  getOwnerPortfolioPersonaDetail,
  listCreateRealmPersonaSelectableWorlds,
  type RealmPersonaCreateWithProfileSettingsResult,
  type RealmPersonaHandleAvailabilityResult,
} from './portfolio-client.js';
import { personaCharacterFailureReason } from './portfolio-data.js';
import { ownerPersonaDetailQueryKey, ownerPortfolioListQueryKey } from '../persona-detail/use-persona-detail-query.js';
import {
  generatePersonaSeedFromDescription,
  type PersonaSeedGenerationResult,
  type PersonaSeedPromptSupplements,
} from './persona-seed-generator.js';
import {
  acceptPersonaCreationGraphForRealmCreate,
  personaCreationGraphSourceModeLabel,
  buildPersonaCreationGraphFromDraft,
  validatePersonaCreationGraphForRealmCreate,
  type PersonaCreationGraphSectionKey,
  type PersonaCreationGraphSourceMode,
} from './persona-creation-graph.js';
import {
  generatePersonaReferenceImage,
  initialReferenceImagePromptFromDraft,
  type PersonaReferenceImageResult,
} from './persona-reference-image.js';
import {
  CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS,
  CREATION_DRAFT_HISTORY_UPDATED_EVENT,
  createCreationDraftKey,
  dispatchCreationDraftHistoryUpdated,
  isCreationDraftKey,
  loadCreationDraft,
  persistCreationDraft,
  type CreationDraftPersistResult,
} from './creation-draft-store.js';
import { loadCreationDraftHistory, upsertCreationDraftHistoryEntry } from './creation-draft-history.js';
import {
  appendLocalCreativeAssetHistory,
  CREATIVE_ASSET_HISTORY_UPDATED_EVENT,
  loadAllLocalCreativeAssetHistory,
} from './creative-asset-history.js';
import {
  aggregateAssetLibraryData,
  type AssetLibraryEntry,
} from '../assets-library/asset-library-data.js';
import {
  getLocalAssetImportCapability,
  importLocalAssetFile,
  loadLocalImportedAssetRecords,
  type LocalImportCapabilityStatus,
} from '../assets-library/local-import-store.js';
import {
  ReferenceImageSourceChooser,
  type ReferenceImageSourceMode,
} from './reference-image-source-chooser.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import {
  translatePersonaArchetypeLabel,
  translatePersonaTraitLabel,
  type StudioTranslateOptions,
} from '../../i18n/studio-i18n.js';

export type CreatedRealmPersonaContext = {
  personaId: string;
  visibility: 'private' | 'unlisted' | 'public' | 'system';
  handle: string;
  displayName: string;
  selectedWorldId: string;
};

type CreateRealmPersonaWorkspaceProps = {
  onCreated?: (context: CreatedRealmPersonaContext) => void;
  onOpenCreatedPersona?: (personaId: string, target: 'detail' | 'settings') => void;
};

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

const SELECT_UNSET_VALUE = '__realm_persona_studio_unset__';

type CreateStage = 'describe' | 'review';
type AutosaveState = 'saved' | 'saving' | 'failed';
type DraftLoadState = 'loading' | 'ready' | 'failed';
type SupplementKey = 'speechSupplement' | 'boundarySupplement' | 'visualSupplement';
type PromptCopyTarget = 'seed' | 'image';
type CreateRealmPersonaDraftPatch = {
  [Key in keyof CreateRealmPersonaDraftInput]?: CreateRealmPersonaDraftInput[Key];
};
type ReferenceImageGenerationTarget = {
  mode: 'fill' | 'replace';
  slot: ReferenceImageCandidateSlot;
};
type ReferenceAssetLoadState = 'idle' | 'loading' | 'ready' | 'failed';
type CreateValidationField =
  | 'displayName'
  | 'handle'
  | 'concept'
  | 'personaArchetype'
  | 'personaTraits'
  | 'selectedWorldId'
  | 'visibility'
  | 'referenceImage';
type CreateFieldErrors = Partial<Record<CreateValidationField, string>>;

const CREATE_VALIDATION_FIELD_ORDER: readonly CreateValidationField[] = [
  'displayName',
  'handle',
  'concept',
  'personaArchetype',
  'personaTraits',
  'selectedWorldId',
  'visibility',
  'referenceImage',
];

const CREATE_VALIDATION_FIELD_BY_ERROR: Record<string, CreateValidationField> = {
  'handle missing': 'handle',
  'display name missing': 'displayName',
  'concept missing': 'concept',
  'selected world missing': 'selectedWorldId',
  'visibility missing': 'visibility',
  'persona archetype missing': 'personaArchetype',
  'persona archetype outside closed value set': 'personaArchetype',
  'persona trait outside closed value set': 'personaTraits',
  'persona traits exceed hard maximum of 3': 'personaTraits',
  'selected world not source-backed by Nimi App Access realm.worldCore.list': 'selectedWorldId',
  'handle availability not checked against owner PersonaCharacter portfolio': 'handle',
  'handle availability not checked for the current normalized handle': 'handle',
  'more than one reference image candidate is owner-selected': 'referenceImage',
  'reference image candidate is not owner-selected': 'referenceImage',
};

const CREATE_DRAFT_FIELD_TO_VALIDATION_FIELD: Partial<Record<keyof CreateRealmPersonaDraftInput, CreateValidationField>> = {
  displayName: 'displayName',
  handle: 'handle',
  concept: 'concept',
  personaArchetype: 'personaArchetype',
  personaTraits: 'personaTraits',
  selectedWorldId: 'selectedWorldId',
  visibility: 'visibility',
  referenceImageUrl: 'referenceImage',
  referenceImageCandidates: 'referenceImage',
};

const GRAPH_SECTION_TITLE_KEYS: Record<PersonaCreationGraphSectionKey, StudioCopyKey> = {
  identity: 'create.graph.section.identity.title',
  personaStyle: 'create.graph.section.personaStyle.title',
  behavior: 'create.graph.section.behavior.title',
  worldview: 'create.graph.section.worldview.title',
  greeting: 'create.graph.section.greeting.title',
  communicationVoice: 'create.graph.section.communicationVoice.title',
  contentVoice: 'create.graph.section.contentVoice.title',
  visualBrief: 'create.graph.section.visualBrief.title',
  voiceBrief: 'create.graph.section.voiceBrief.title',
  postBrief: 'create.graph.section.postBrief.title',
  sourceProvenance: 'create.graph.section.sourceProvenance.title',
  missingDecisions: 'create.graph.section.missingDecisions.title',
  riskNotes: 'create.graph.section.riskNotes.title',
  writePlan: 'create.graph.section.writePlan.title',
};

const CREATE_FIXED_MESSAGE_KEYS: Record<string, StudioCopyKey> = {
  'handle missing': 'create.error.handleMissing',
  'display name missing': 'create.error.displayNameMissing',
  'concept missing': 'create.error.conceptMissing',
  'selected world missing': 'create.error.selectedWorldMissing',
  'persona archetype missing': 'create.error.personaArchetypeMissing',
  'persona archetype outside closed value set': 'create.error.personaArchetypeOutsideClosedSet',
  'persona trait outside closed value set': 'create.error.personaTraitsOutsideClosedSet',
  'persona traits exceed hard maximum of 3': 'create.error.personaTraitsTooMany',
  'Draft key must be a valid ULID.': 'create.error.draftKeyInvalid',
  'Draft fields could not be normalized.': 'create.error.draftFieldsInvalid',
  'Draft storage is unavailable.': 'create.error.draftStorageUnavailable',
  'Draft storage read failed.': 'create.error.draftStorageUnavailable',
  'Stored draft is invalid.': 'create.error.draftStorageUnavailable',
  'Draft could not be persisted through protected storage.': 'create.error.draftPersistFailed',
  'Creation draft history protected storage is unavailable.': 'create.error.draftHistoryPersistFailed',
  'Creation draft history protected storage read failed.': 'create.error.draftHistoryPersistFailed',
  'Creation draft history protected storage write failed.': 'create.error.draftHistoryPersistFailed',
  'Creation draft history entry is invalid.': 'create.error.draftHistoryPersistFailed',
  'Draft contains an invalid reference image candidate.': 'create.error.draftCandidateInvalid',
  'Draft contains more than one owner-selected reference image candidate.': 'create.error.referenceSelectionInvalid',
  'Draft reference image is not an owner-selected candidate.': 'create.error.referenceSelectionInvalid',
  'more than one reference image candidate is owner-selected': 'create.error.referenceSelectionInvalid',
  'reference image candidate is not owner-selected': 'create.error.referenceSelectionInvalid',
  'Draft contains more than 3 persona traits.': 'create.error.personaTraitsTooMany',
  'Draft contains a persona trait outside the closed value set.': 'create.error.personaTraitsOutsideClosedSet',
  'LLM output personaTraits must contain at most 3 values from the supported trait vocabulary.': 'create.error.seedTraitsInvalid',
  'persona description empty': 'create.error.seedDescriptionEmpty',
  'Persona seed payload invalid.': 'create.error.seedPayloadInvalid',
  'LLM output missing required `displayName` or `concept`.': 'create.error.seedRequiredOutputMissing',
  'LLM output personaArchetype missing or outside the supported archetypes.': 'create.error.seedArchetypeInvalid',
  'Persona seed output invalid.': 'create.error.seedOutputInvalid',
  'selected world not source-backed by Nimi App Access realm.worldCore.list': 'create.error.selectedWorldNotSourceBacked',
  'visibility missing': 'create.error.visibilityMissing',
  'handle availability not checked against owner PersonaCharacter portfolio': 'create.error.handleAvailabilityMissing',
  'handle availability not checked for the current normalized handle': 'create.error.handleAvailabilityStale',
  'Persona handle check requires a non-empty normalized handle.': 'create.error.handleAvailabilityEmpty',
  'Realm handle availability check did not return an availability boolean.': 'create.error.handleAvailabilityMissingBoolean',
  'Realm handle availability check failed.': 'create.error.handleAvailabilityFailed',
  'PersonaCharacter handle availability check failed.': 'create.error.handleAvailabilityFailed',
  'PersonaCharacter create returned no persona object.': 'create.error.realmCreateNoPersona',
  'PersonaCharacter create returned no canonical persona id.': 'create.error.realmCreateNoId',
  'PersonaCharacter create returned incomplete canonical source fields.': 'create.error.realmCreateIncompleteSource',
  'PersonaCharacter create failed.': 'create.error.realmCreateFailed',
  'reference image prompt empty': 'create.error.referencePromptEmpty',
  'reference image generation count must be 1': 'create.error.referenceCountInvalid',
  'Reference image payload invalid.': 'create.error.referencePayloadInvalid',
  'Runtime image.generate returned no readable artifact.': 'create.error.referenceNoArtifact',
  'Runtime image.generate produced a local candidate but no display-safe HTTPS URI that Realm can store as a public reference image.': 'create.error.referenceLocalArtifactNoUrl',
  'A PersonaCharacter with this handle already exists in the owner portfolio.': 'create.error.handleAlreadyExists',
};

const PERSONA_FAILURE_REASONS = new Set([
  'capability-unavailable', 'invalid-input', 'session-invalid', 'access-denied',
  'owner-authority-missing', 'not-found', 'content-conflict', 'realm-unavailable',
  'rate-limited', 'upstream-failed', 'contract-invalid', 'request-too-large', 'response-too-large',
]);

const PERSONA_ARCHETYPE_DESCRIPTION_KEYS: Record<PersonaArchetype, StudioCopyKey> = {
  CARING: 'create.personaStyle.archetype.CARING',
  PLAYFUL: 'create.personaStyle.archetype.PLAYFUL',
  INTELLECTUAL: 'create.personaStyle.archetype.INTELLECTUAL',
  CONFIDENT: 'create.personaStyle.archetype.CONFIDENT',
  MYSTERIOUS: 'create.personaStyle.archetype.MYSTERIOUS',
  ROMANTIC: 'create.personaStyle.archetype.ROMANTIC',
};

const PERSONA_TRAIT_DESCRIPTION_KEYS: Record<PersonaTrait, StudioCopyKey> = {
  HUMOROUS: 'create.personaStyle.trait.HUMOROUS',
  SARCASTIC: 'create.personaStyle.trait.SARCASTIC',
  GENTLE: 'create.personaStyle.trait.GENTLE',
  DIRECT: 'create.personaStyle.trait.DIRECT',
  OPTIMISTIC: 'create.personaStyle.trait.OPTIMISTIC',
  REALISTIC: 'create.personaStyle.trait.REALISTIC',
  DRAMATIC: 'create.personaStyle.trait.DRAMATIC',
  PASSIONATE: 'create.personaStyle.trait.PASSIONATE',
  REBELLIOUS: 'create.personaStyle.trait.REBELLIOUS',
  INNOCENT: 'create.personaStyle.trait.INNOCENT',
  WISE: 'create.personaStyle.trait.WISE',
  ECCENTRIC: 'create.personaStyle.trait.ECCENTRIC',
};

function translateGraphSectionTitle(sectionKey: string, t: StudioTranslator): string {
  const key = GRAPH_SECTION_TITLE_KEYS[sectionKey as PersonaCreationGraphSectionKey];
  return key ? t(key) : t('create.graph.section.unknown');
}

function translateGraphReviewError(error: string, t: StudioTranslator): string {
  if (error === 'Persona Creation Graph missing (R-RPS-GRAPH-003).') return t('create.graph.error.graphMissing');
  if (error === 'Persona Creation Graph write plan missing Realm create target (R-RPS-GRAPH-017).') return t('create.graph.error.writePlanMissing');
  if (error === 'Persona Creation Graph write plan is blocked for Realm create (R-RPS-GRAPH-017).') return t('create.graph.error.writePlanBlocked');
  if (error === 'Persona Creation Graph review missing or stale (R-RPS-GRAPH-019).') return t('create.graph.error.reviewMissing');

  const missingSection = error.match(/^Persona Creation Graph section missing: (.+) \(R-RPS-GRAPH-016\)\.$/);
  if (missingSection) return t('create.graph.error.sectionMissing', { section: translateGraphSectionTitle(missingSection[1] ?? '', t) });

  const blockedSection = error.match(/^Persona Creation Graph (.+) section is blocked \(R-RPS-GRAPH-027\)\.$/);
  if (blockedSection) return t('create.graph.error.sectionBlocked', { section: translateGraphSectionTitle(blockedSection[1] ?? '', t) });

  return t('create.graph.error.unknown');
}

function translateGraphReviewErrors(errors: string[], t: StudioTranslator): string {
  return errors.map((error) => translateGraphReviewError(error, t)).join('; ');
}

function translateCreateFixedMessage(message: string, t: StudioTranslator): string {
  if (PERSONA_FAILURE_REASONS.has(message)) return t('persona.failure.sanitized', { reason: message });
  if (message.startsWith('Persona Creation Graph ')) return translateGraphReviewError(message, t);
  const handleUnavailable = message.match(/^handle unavailable: (.+)$/);
  if (handleUnavailable) {
    const reason = handleUnavailable[1] ?? '';
    const handleReason = CREATE_FIXED_MESSAGE_KEYS[reason];
    return handleReason
      ? t(handleReason)
      : t('create.error.handleUnavailable', { message: reason });
  }
  if (message.startsWith('Nimi text candidate generation failed:')) return t('create.error.seedGenerationTransportFailed');
  const key = CREATE_FIXED_MESSAGE_KEYS[message];
  return key ? t(key) : t('common.operationFailed');
}

function translateReferenceImageFailure(
  result: Extract<PersonaReferenceImageResult, { ok: false }>,
  t: StudioTranslator,
): string {
  if (result.failure === 'runtime-payload-invalid') return t('create.error.referencePayloadInvalid');
  if (result.failure === 'runtime-capability-unavailable' || result.failure === 'runtime-route-unbound') {
    return t('create.error.referenceCandidateUnavailable');
  }
  if (result.failure === 'runtime-transport-unavailable') return t('create.error.referenceTransportUnavailable');
  if (result.failure === 'runtime-output-malformed') return t('create.error.referenceNoArtifact');
  if (result.failure === 'runtime-call-failed') return t('create.error.referenceGenerateFailed');
  return translateCreateFixedMessage(result.message, t);
}

function translateCreateFixedMessages(messages: string[], t: StudioTranslator): string {
  return messages.map((message) => translateCreateFixedMessage(message, t)).join('; ');
}

function validationFieldForCreateError(error: string): CreateValidationField | null {
  if (error.startsWith('handle unavailable:')) return 'handle';
  return CREATE_VALIDATION_FIELD_BY_ERROR[error] || null;
}

function createFieldErrorsFromReadiness(errors: string[]): CreateFieldErrors {
  const fieldErrors: CreateFieldErrors = {};
  for (const error of errors) {
    const field = validationFieldForCreateError(error);
    if (field && !fieldErrors[field]) fieldErrors[field] = error;
  }
  return fieldErrors;
}

function firstInvalidCreateField(fieldErrors: CreateFieldErrors): CreateValidationField | null {
  return CREATE_VALIDATION_FIELD_ORDER.find((field) => Boolean(fieldErrors[field])) || null;
}

function createEmptyDraft(): CreateRealmPersonaDraftInput {
  return {
    handle: '',
    displayName: '',
    concept: '',
    description: '',
    ruleText: '',
    selectedWorldId: '',
    visibility: '',
    personaArchetype: '',
    personaTraits: [],
    referenceImageUrl: '',
    referenceImagePrompt: '',
    originalDescription: '',
    speechSupplement: '',
    boundarySupplement: '',
    visualSupplement: '',
    referenceImageCandidates: [],
  };
}

type ExistingReferenceAssetLoadResult = {
  entries: AssetLibraryEntry[];
  unavailableCount: number;
  sourceUnavailable: boolean;
};

function isRealmReferenceImageUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function loadExistingReferenceAssets(
  currentDraftKey: string,
  capability: LocalImportCapabilityStatus,
): Promise<ExistingReferenceAssetLoadResult> {
  const [imported, creative, history] = await Promise.all([
    loadLocalImportedAssetRecords(capability),
    loadAllLocalCreativeAssetHistory(),
    loadCreationDraftHistory(),
  ]);
  const draftRecords = history.ok
    ? (await Promise.all(history.entries.map((entry) => loadCreationDraft(entry.draftKey))))
      .flatMap((loaded) => loaded.ok && loaded.record ? [loaded.record] : [])
    : [];
  const unavailableCount = imported.unavailableCount
    + creative.unavailableCount
    + (history.ok ? history.unavailableCount : 0)
    + (history.ok ? history.entries.length - draftRecords.length : 0);
  const data = aggregateAssetLibraryData({
    creativeHistoryRecords: creative.records,
    creationDraftRecords: draftRecords,
    importedRecords: imported.records,
    sourceUnavailableCount: unavailableCount,
  });
  const seenUrls = new Set<string>();
  const entries = data.images.filter((entry) => {
    if (
      entry.reviewState === 'candidate-only'
      || !isRealmReferenceImageUrl(entry.previewUrl)
      || (entry.provenance.kind === 'draft' && entry.provenance.draftKey === currentDraftKey)
      || seenUrls.has(entry.previewUrl)
    ) return false;
    seenUrls.add(entry.previewUrl);
    return true;
  });
  return {
    entries,
    unavailableCount: data.unavailableCount,
    sourceUnavailable: Boolean(imported.failure || !creative.ok || !history.ok),
  };
}

function selectedDraftKey(search: string): string | null {
  const value = new URLSearchParams(search).get('draft');
  return isCreationDraftKey(value) ? value.trim() : null;
}

function worldOptionLabel(world: SelectableRealmWorld): string {
  const type = world.type ? ` · ${world.type}` : '';
  return `${world.name}${type}`;
}

export function countCompletedCreationDraftFields(input: CreateRealmPersonaDraftInput): number {
  const draft = normalizeCreateRealmPersonaDraft(input);
  const scalarFields = [
    draft.originalDescription,
    draft.handle,
    draft.displayName,
    draft.concept,
    draft.description,
    draft.ruleText,
    draft.selectedWorldId,
    draft.visibility,
    draft.personaArchetype,
    draft.speechSupplement,
    draft.boundarySupplement,
    draft.visualSupplement,
    draft.referenceImagePrompt,
    draft.referenceImageUrl,
  ];
  return scalarFields.filter(Boolean).length
    + (draft.personaTraits.length > 0 ? 1 : 0)
    + (draft.referenceImageCandidates.length > 0 ? 1 : 0);
}

function ownerPromptFromDraft(input: CreateRealmPersonaDraftInput): string {
  const draft = normalizeCreateRealmPersonaDraft(input);
  return [
    draft.originalDescription,
    draft.speechSupplement ? `Speaking style supplement:\n${draft.speechSupplement}` : '',
    draft.boundarySupplement ? `Behavior boundary supplement:\n${draft.boundarySupplement}` : '',
    draft.visualSupplement ? `Visual character supplement:\n${draft.visualSupplement}` : '',
  ].filter(Boolean).join('\n\n');
}

function AutosaveIndicator({ state, failureMessage }: { state: AutosaveState; failureMessage: string | null }) {
  const { t } = useStudioI18n();
  const tone = state === 'saved' ? 'success' : state === 'saving' ? 'info' : 'danger';
  const label = state === 'saved' ? t('create.autosave.saved') : state === 'saving' ? t('create.autosave.saving') : t('create.autosave.failed');
  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <StatusBadge tone={tone}>{label}</StatusBadge>
      {state === 'failed' && failureMessage ? <span className="max-w-72 text-right text-xs text-[var(--nimi-status-danger)]">{failureMessage}</span> : null}
    </div>
  );
}

function HandleAvailabilityBadge({
  handle,
  query,
  availability,
}: {
  handle: string;
  query: { isFetching: boolean; isError: boolean; data?: RealmPersonaHandleAvailabilityResult };
  availability: NormalizedRealmPersonaHandleAvailability | null;
}) {
  const { t } = useStudioI18n();
  if (!handle || query.isFetching) return <StatusBadge tone="neutral">{t('create.handleStatus.pending')}</StatusBadge>;
  if (query.isError || (query.data && !query.data.ok)) return <StatusBadge tone="info">{t('create.handleStatus.unavailable')}</StatusBadge>;
  if (!query.data) return <StatusBadge tone="neutral">{t('create.handleStatus.pending')}</StatusBadge>;
  return availability?.available
    ? <StatusBadge tone="success">{t('create.handleStatus.available')}</StatusBadge>
    : <StatusBadge tone="danger">{t('create.handleStatus.occupied')}</StatusBadge>;
}

function WorldPicker({
  open,
  worlds,
  selectedWorldId,
  onSelect,
  onClose,
}: {
  open: boolean;
  worlds: SelectableRealmWorld[];
  selectedWorldId: string;
  onSelect: (worldId: string) => void;
  onClose: () => void;
}) {
  const { t } = useStudioI18n();
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  const groups = useMemo(() => {
    const filtered = worlds.filter((world) => world.name.toLocaleLowerCase().includes(query));
    const grouped = groupSelectableRealmWorldsForPicker(filtered);
    return grouped;
  }, [query, worlds]);
  const orderedWorlds = [...groups.recommended, ...groups.others];

  function moveRadio(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? orderedWorlds.length - 1
        : event.key === 'ArrowDown'
          ? Math.min(index + 1, orderedWorlds.length - 1)
          : Math.max(index - 1, 0);
    const nextWorld = orderedWorlds[nextIndex];
    if (!nextWorld) return;
    onSelect(nextWorld.id);
    const group = event.currentTarget.closest('[role="radiogroup"]');
    const radios = group ? Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')) : [];
    radios[nextIndex]?.focus();
  }

  const renderWorld = (world: SelectableRealmWorld, index: number, recommended: boolean) => {
    const selected = world.id === selectedWorldId;
    return (
      <Surface
        key={world.id}
        as="button"
        type="button"
        tone="card"
        padding="sm"
        interactive
        active={selected}
        role="radio"
        aria-checked={selected}
        aria-label={worldOptionLabel(world)}
        onClick={() => onSelect(world.id)}
        onKeyDown={(event) => moveRadio(event, index)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--nimi-radius-md)] bg-[var(--nimi-action-primary-bg)] text-sm font-semibold text-[var(--nimi-action-primary-text)]">
          {world.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-[var(--nimi-text-primary)]">{world.name}</span>
            {recommended ? <StatusBadge tone="info">{t('create.world.defaultBadge')}</StatusBadge> : null}
          </div>
          <div className="truncate text-xs text-[var(--nimi-text-muted)]">{world.tagline || world.description || worldOptionLabel(world)}</div>
        </div>
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-[var(--nimi-border-strong)]" aria-hidden="true">
          {selected ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--nimi-action-primary-bg)]" /> : null}
        </span>
      </Surface>
    );
  };

  return (
    <OverlayShell
      open={open}
      kind="dialog"
      size="S"
      onClose={onClose}
      title={t('create.world.select')}
      footer={<div className="text-center text-xs text-[var(--nimi-text-muted)]">{t('create.world.selectionNote')}</div>}
      dataTestId="realm-persona-world-picker"
    >
      <div className="grid gap-4">
        <SearchField value={search} placeholder={t('create.world.search')} aria-label={t('create.world.search')} onChange={(event) => setSearch(event.currentTarget.value)} />
        {orderedWorlds.length === 0 ? <EmptyState title={t('create.world.noMatches')} description={t('create.world.search')} /> : (
          <div role="radiogroup" aria-label={t('create.world.select')} className="grid max-h-[52vh] gap-4 overflow-y-auto">
            {groups.recommended.length > 0 ? <section className="grid gap-2"><h3 className="m-0 text-xs font-semibold text-[var(--nimi-text-muted)]">{t('create.world.recommended')}</h3>{groups.recommended.map((world, index) => renderWorld(world, index, true))}</section> : null}
            {groups.others.length > 0 ? <section className="grid gap-2"><h3 className="m-0 text-xs font-semibold text-[var(--nimi-text-muted)]">{t('create.world.all')}</h3>{groups.others.map((world, index) => renderWorld(world, groups.recommended.length + index, false))}</section> : null}
          </div>
        )}
      </div>
    </OverlayShell>
  );
}

function WorldRecoveryPanel({
  completedCount,
  retrying,
  onRetry,
  createDisabled,
}: {
  completedCount: number;
  retrying: boolean;
  onRetry: () => void;
  createDisabled: boolean;
}) {
  const { t } = useStudioI18n();
  const plural = completedCount === 1 ? '' : 's';
  return (
    <Surface tone="card" material="glass-regular" padding="lg" className="grid gap-5 rounded-[var(--nimi-radius-xl)]">
      <div className="grid gap-2">
        <StatusBadge tone="danger">{t('create.worldSelectionUnavailable')}</StatusBadge>
        <h2 className="m-0 text-xl font-semibold text-[var(--nimi-text-primary)]">{t('create.worldRecovery.title')}</h2>
        <p className="m-0 text-sm text-[var(--nimi-text-muted)]">{t('create.worldRecovery.savedCount', { count: completedCount, plural })}</p>
        <p className="m-0 text-sm text-[var(--nimi-text-muted)]">{t('create.worldRecovery.waiting')}</p>
      </div>
      <InlineAlert tone="warning">{t('create.worldRecovery.submitDisabled')}</InlineAlert>
      <div className="flex flex-wrap items-center gap-3">
        <Button tone="secondary" loading={retrying} onClick={onRetry} leadingIcon={<RefreshCw size={16} aria-hidden="true" />}>
          {t('create.worldRecovery.retry')}
        </Button>
        <Button tone="primary" disabled={createDisabled}>{t('create.submit')}</Button>
      </div>
    </Surface>
  );
}

function WorldLoadingPanel() {
  const { t } = useStudioI18n();
  return <EmptyState title={t('create.world.loadingTitle')} description={t('create.world.loadingDescription')} />;
}

export function CreateRealmPersonaWorkspace({ onCreated, onOpenCreatedPersona }: CreateRealmPersonaWorkspaceProps) {
  const { t } = useStudioI18n();
  const location = useLocation();
  const initialDraftKey = useRef<string | null>(null);
  initialDraftKey.current ??= selectedDraftKey(location.search) || createCreationDraftKey();
  const [draftKey, setDraftKey] = useState(initialDraftKey.current);
  const [draft, setDraft] = useState<CreateRealmPersonaDraftInput>(createEmptyDraft);
  const [draftLoadState, setDraftLoadState] = useState<DraftLoadState>('loading');
  const [stage, setStage] = useState<CreateStage>('describe');
  const [sourceMode, setSourceMode] = useState<PersonaCreationGraphSourceMode>('description');
  const [graphAcceptedFingerprint, setGraphAcceptedFingerprint] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<PersonaSeedGenerationResult | null>(null);
  const [seedOriginalDisplayName, setSeedOriginalDisplayName] = useState('');
  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [referenceImageGenerationTarget, setReferenceImageGenerationTarget] = useState<ReferenceImageGenerationTarget | null>(null);
  const [referenceImageFailure, setReferenceImageFailure] = useState<string | null>(null);
  const [referenceImageLoadFailed, setReferenceImageLoadFailed] = useState(false);
  const [referenceCandidateLoadFailures, setReferenceCandidateLoadFailures] = useState<Set<string>>(() => new Set());
  const [referenceImageSourceMode, setReferenceImageSourceMode] = useState<ReferenceImageSourceMode | null>('ai');
  const [referenceImageEditorOpen, setReferenceImageEditorOpen] = useState(false);
  const [traitPickerOpen, setTraitPickerOpen] = useState(false);
  const traitPickerRef = useRef<HTMLDivElement>(null);
  const [referenceAssetLoadState, setReferenceAssetLoadState] = useState<ReferenceAssetLoadState>('idle');
  const [referenceAssets, setReferenceAssets] = useState<AssetLibraryEntry[]>([]);
  const [referenceAssetsUnavailableCount, setReferenceAssetsUnavailableCount] = useState(0);
  const [referenceAssetsSourceUnavailable, setReferenceAssetsSourceUnavailable] = useState(false);
  const [referenceSourceFailure, setReferenceSourceFailure] = useState<string | null>(null);
  const [isImportingReferenceImage, setIsImportingReferenceImage] = useState(false);
  const [createdContext, setCreatedContext] = useState<CreatedRealmPersonaContext | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CreateFieldErrors>({});
  const [worldModalOpen, setWorldModalOpen] = useState(false);
  const [expandedSupplements, setExpandedSupplements] = useState<Record<SupplementKey, boolean>>({
    speechSupplement: false,
    boundarySupplement: false,
    visualSupplement: false,
  });
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('saving');
  const [autosaveFailureMessage, setAutosaveFailureMessage] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState<PromptCopyTarget | null>(null);
  const [promptCopyFailed, setPromptCopyFailed] = useState(false);
  const queryClient = useQueryClient();
  const translatorRef = useRef(t);
  translatorRef.current = t;
  const autosaveSequence = useRef(0);
  const autosaveQueue = useRef<Promise<void>>(Promise.resolve());
  const referenceImageFileInputRef = useRef<HTMLInputElement>(null);
  const [localImportCapability] = useState<LocalImportCapabilityStatus>(() => getLocalAssetImportCapability());

  const selectedKey = selectedDraftKey(location.search);
  const lastLocationSearch = useRef(location.search);
  useEffect(() => {
    if (lastLocationSearch.current === location.search) return;
    lastLocationSearch.current = location.search;
    const nextKey = selectedKey || createCreationDraftKey();
    if (nextKey === draftKey) return;
    setDraftKey(nextKey);
    setDraft(createEmptyDraft());
    setDraftLoadState('loading');
    setAutosaveState('saving');
    setAutosaveFailureMessage(null);
    setStage('describe');
    setSourceMode('description');
    setReferenceImageSourceMode('ai');
    setReferenceImageEditorOpen(false);
    setReferenceAssetLoadState('idle');
    setReferenceAssets([]);
    setReferenceSourceFailure(null);
    setSeedResult(null);
    setSeedOriginalDisplayName('');
    setGraphAcceptedFingerprint(null);
    setFieldErrors({});
    setCreatedContext(null);
  }, [draftKey, location.search, selectedKey]);

  useEffect(() => {
    let cancelled = false;
    setDraftLoadState('loading');
    setAutosaveState('saving');
    setAutosaveFailureMessage(null);
    void loadCreationDraft(draftKey).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setDraft(createEmptyDraft());
        setDraftLoadState('failed');
        setAutosaveState('failed');
        setAutosaveFailureMessage(translateCreateFixedMessage(result.message, translatorRef.current));
        return;
      }
      if (result.record) {
        const { draftKey: _storedDraftKey, updatedAt: _updatedAt, ...storedDraft } = result.record;
        setDraft(storedDraft);
      } else {
        setDraft(createEmptyDraft());
      }
      setDraftLoadState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!traitPickerOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (traitPickerRef.current && !traitPickerRef.current.contains(event.target as Node)) {
        setTraitPickerOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTraitPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [traitPickerOpen]);

  const worldsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'create-persona-worlds'],
    queryFn: () => listCreateRealmPersonaSelectableWorlds(),
  });
  const worlds = worldsQuery.data || [];
  const selectableWorldIds = useMemo(() => worlds.map((world) => world.id), [worlds]);
  const oasisWorld = useMemo(() => selectOasisDefaultWorld(worlds), [worlds]);
  const selectedWorld = worlds.find((world) => world.id === draft.selectedWorldId) || null;
  const normalizedDraft = useMemo(() => normalizeCreateRealmPersonaDraft(draft), [draft]);

  const handleAvailabilityQuery = useQuery<RealmPersonaHandleAvailabilityResult>({
    queryKey: ['realm-persona-studio', 'create-persona-handle-availability', normalizedDraft.handle],
    queryFn: () => checkCreateRealmPersonaHandleAvailability(normalizedDraft.handle),
    enabled: normalizedDraft.handle.length > 0,
  });
  const handleAvailability = handleAvailabilityQuery.data?.ok ? handleAvailabilityQuery.data.availability : null;
  const creationGraph = useMemo(() => buildPersonaCreationGraphFromDraft(draft, {
    sourceMode,
    sourceLabel: sourceMode === 'description'
      ? (ownerPromptFromDraft(draft) || personaCreationGraphSourceModeLabel(sourceMode))
      : personaCreationGraphSourceModeLabel(sourceMode),
    runtimeRationale: seedResult?.ok ? seedResult.rationale : '',
    extraSourceFields: [],
    acceptedForCreateFingerprint: graphAcceptedFingerprint,
  }), [draft, graphAcceptedFingerprint, seedResult, sourceMode]);
  useEffect(() => {
    if (!draft.selectedWorldId && oasisWorld) {
      setDraft((current) => current.selectedWorldId ? current : { ...current, selectedWorldId: oasisWorld.id });
    }
  }, [draft.selectedWorldId, oasisWorld]);

  useEffect(() => {
    if (draftLoadState !== 'ready') return undefined;
    const sequence = autosaveSequence.current + 1;
    autosaveSequence.current = sequence;
    setAutosaveState('saving');
    setAutosaveFailureMessage(null);
    const timeout = window.setTimeout(() => {
      autosaveQueue.current = autosaveQueue.current.catch(() => undefined).then(async () => {
        const result: CreationDraftPersistResult = await persistCreationDraft(draftKey, draft);
        if (!result.ok) {
          if (autosaveSequence.current === sequence) {
            setAutosaveState('failed');
            setAutosaveFailureMessage(translateCreateFixedMessage(result.message, t));
          }
          return;
        }
        if (normalizedDraft.displayName) {
          const historyResult = await upsertCreationDraftHistoryEntry({
            draftKey,
            displayName: normalizedDraft.displayName,
            ...(selectedWorld?.name ? { worldName: selectedWorld.name } : {}),
            ...(normalizedDraft.personaArchetype ? { archetype: normalizedDraft.personaArchetype } : {}),
            updatedAt: result.record.updatedAt,
          });
          if (!historyResult.ok) {
            if (autosaveSequence.current === sequence) {
              setAutosaveState('failed');
              setAutosaveFailureMessage(translateCreateFixedMessage(historyResult.message, t));
            }
            return;
          }
          dispatchCreationDraftHistoryUpdated();
        }
        if (autosaveSequence.current === sequence) {
          setAutosaveState('saved');
          setAutosaveFailureMessage(null);
        }
      });
    }, CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [draft, draftKey, draftLoadState, normalizedDraft, selectedWorld?.name, t]);

  const refreshReferenceAssets = useCallback(async () => {
    setReferenceAssetLoadState('loading');
    const result = await loadExistingReferenceAssets(draftKey, localImportCapability);
    setReferenceAssets(result.entries);
    setReferenceAssetsUnavailableCount(result.unavailableCount);
    setReferenceAssetsSourceUnavailable(result.sourceUnavailable);
    setReferenceAssetLoadState(result.sourceUnavailable && result.entries.length === 0 ? 'failed' : 'ready');
  }, [draftKey, localImportCapability]);

  useEffect(() => {
    if (stage !== 'review') return undefined;
    const refresh = () => void refreshReferenceAssets();
    void refreshReferenceAssets();
    window.addEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, refresh);
    window.addEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, refresh);
      window.removeEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, refresh);
    };
  }, [refreshReferenceAssets, stage]);

  function resetCreateOutcome() {
    setFieldErrors({});
    setCreatedContext(null);
  }

  function clearCreateFieldErrors(fields: readonly CreateValidationField[]) {
    if (fields.length === 0) return;
    setFieldErrors((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  function focusCreateField(field: CreateValidationField) {
    window.requestAnimationFrame(() => {
      const fieldRoot = document.querySelector<HTMLElement>(`[data-create-field="${field}"]`);
      if (!fieldRoot) return;
      const control = fieldRoot.matches('[data-create-field-control]')
        ? fieldRoot
        : fieldRoot.querySelector<HTMLElement>('[data-create-field-control], input, textarea, button');
      fieldRoot.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      control?.focus({ preventScroll: true });
    });
  }

  function updateDraft(
    patch: CreateRealmPersonaDraftPatch | ((current: CreateRealmPersonaDraftInput) => CreateRealmPersonaDraftPatch),
  ) {
    if (typeof patch !== 'function') {
      clearCreateFieldErrors(
        Object.keys(patch)
          .map((key) => CREATE_DRAFT_FIELD_TO_VALIDATION_FIELD[key as keyof CreateRealmPersonaDraftInput])
          .filter((field): field is CreateValidationField => Boolean(field)),
      );
    }
    setDraft((current) => ({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch),
    }));
    setGraphAcceptedFingerprint(null);
    setCreatedContext(null);
    setReferenceImageLoadFailed(false);
  }

  const createMutation = useMutation<RealmPersonaCreateWithProfileSettingsResult, Error, ReviewedCreateRealmPersonaPayload>({
    mutationFn: (payload) => createReviewedRealmPersonaWithProfileSettings(payload),
    onSuccess: async (result) => {
      const canonical = result.ok ? result.canonical : result.createdCanonical;
      if (canonical && normalizedDraft.referenceImageCandidates.length > 0) {
        const rebound = await Promise.all(normalizedDraft.referenceImageCandidates.map((candidate) => (
          appendLocalCreativeAssetHistory(canonical.id, {
            sourceContentHash: canonical.contentHash,
            kind: 'runtime-image-candidate',
            sourceKind: candidate.sourceKind,
            reviewState: candidate.reviewState === 'owner-selected' ? 'owner-reviewed' : 'candidate-only',
            label: normalizedDraft.displayName || 'Realm Persona portrait candidate',
            source: 'Realm Persona creation draft reference image candidate',
            detail: candidate.url,
            previewUrl: candidate.url,
            originDraftKey: candidate.draftKey,
          })
        )));
        if (rebound.some((entry) => !entry.ok)) {
          nimiToast.danger(t('create.reference.rebindFailed'));
        }
      }
      if (result.ok) {
        const currentDraft = normalizeCreateRealmPersonaDraft(draft);
        const context: CreatedRealmPersonaContext = {
          personaId: result.canonical.id,
          visibility: result.canonical.visibility,
          handle: currentDraft.handle,
          displayName: currentDraft.displayName,
          selectedWorldId: currentDraft.selectedWorldId,
        };
        setFieldErrors({});
        await queryClient.invalidateQueries({ queryKey: ownerPortfolioListQueryKey() });
        try {
          await queryClient.fetchQuery({
            queryKey: ownerPersonaDetailQueryKey(result.canonical.id),
            queryFn: () => getOwnerPortfolioPersonaDetail(result.canonical.id),
          });
        } catch (error) {
          const reason = personaCharacterFailureReason(error);
          nimiToast.danger(t('create.createdPartial', {
            message: t('persona.failure.sanitized', { reason }),
            created: t('create.createdPersonaId', { id: result.canonical.id }),
          }));
          onOpenCreatedPersona?.(result.canonical.id, 'detail');
          return;
        }
        nimiToast.success(t('create.createdSuccess', { id: result.canonical.id }));
        onCreated?.(context);
        if (onOpenCreatedPersona) {
          onOpenCreatedPersona(result.canonical.id, 'detail');
        } else {
          setCreatedContext(context);
        }
      } else {
        nimiToast.danger(t('create.createdPartial', {
          message: translateCreateFixedMessage(result.message, t),
          created: result.createdCanonical ? t('create.createdPersonaId', { id: result.createdCanonical.id }) : '',
        }));
      }
    },
  });

  function submitCreate() {
    const readiness = validateCreateRealmPersonaReadiness(draft, { selectableWorldIds, handleAvailability });
    if (!readiness.ready) {
      const nextFieldErrors = createFieldErrorsFromReadiness(readiness.errors);
      setFieldErrors(nextFieldErrors);
      const firstInvalidField = firstInvalidCreateField(nextFieldErrors);
      if (firstInvalidField) {
        if (firstInvalidField === 'referenceImage') setReferenceImageEditorOpen(true);
        focusCreateField(firstInvalidField);
      } else {
        nimiToast.danger(translateCreateFixedMessages(readiness.errors, t));
      }
      return;
    }
    const acceptedFingerprint = acceptPersonaCreationGraphForRealmCreate(creationGraph);
    const acceptedGraphReview = validatePersonaCreationGraphForRealmCreate(creationGraph, acceptedFingerprint);
    if (!acceptedGraphReview.ready) {
      nimiToast.danger(translateGraphReviewErrors(acceptedGraphReview.errors, t));
      return;
    }
    setGraphAcceptedFingerprint(acceptedFingerprint);
    setFieldErrors({});
    createMutation.mutate(readiness.payload);
  }

  async function runSeedGeneration() {
    const seedDescription = normalizeCreateRealmPersonaDraft(draft).originalDescription;
    if (!seedDescription) return;
    setIsGeneratingSeed(true);
    setSeedResult(null);
    setSourceMode('description');
    setGraphAcceptedFingerprint(null);
    resetCreateOutcome();
    const supplements: PersonaSeedPromptSupplements = {
      speechSupplement: normalizedDraft.speechSupplement,
      boundarySupplement: normalizedDraft.boundarySupplement,
      visualSupplement: normalizedDraft.visualSupplement,
    };
    try {
      const result = await generatePersonaSeedFromDescription(seedDescription, undefined, supplements);
      setSeedResult(result);
      if (result.ok) {
        setSeedOriginalDisplayName(result.seed.displayName);
        setDraft((current) => {
          const nextDraft: CreateRealmPersonaDraftInput = {
            ...current,
            handle: result.seed.handle || current.handle,
            displayName: result.seed.displayName || current.displayName,
            concept: result.seed.concept || current.concept,
            description: result.seed.description || current.description,
            ruleText: result.seed.ruleText || current.ruleText,
            personaArchetype: result.seed.personaArchetype || current.personaArchetype,
            personaTraits: result.seed.personaTraits.length > 0 ? result.seed.personaTraits : current.personaTraits,
            originalDescription: seedDescription,
          };
          return {
            ...nextDraft,
            referenceImagePrompt: current.referenceImagePrompt.trim()
              || initialReferenceImagePromptFromDraft(nextDraft),
          };
        });
        setStage('review');
      } else {
        nimiToast.danger(t('create.seedGenerationFailed', { message: translateCreateFixedMessage(result.message, t) }));
      }
    } finally {
      setIsGeneratingSeed(false);
    }
  }

  function skipSeedAndCreateManually() {
    setSourceMode('manual');
    setGraphAcceptedFingerprint(null);
    setSeedResult(null);
    setSeedOriginalDisplayName('');
    updateDraft((current) => ({
      referenceImagePrompt: current.referenceImagePrompt.trim()
        || initialReferenceImagePromptFromDraft(current),
    }));
    resetCreateOutcome();
    setStage('review');
  }

  function returnToDescribeStage() {
    setStage('describe');
    setGraphAcceptedFingerprint(null);
    resetCreateOutcome();
  }

  async function runReferenceImageGeneration(target: ReferenceImageGenerationTarget) {
    if (referenceImageGenerationTarget) return;
    const currentDraft = normalizeCreateRealmPersonaDraft(draft);
    const occupiedTarget = currentDraft.referenceImageCandidates.find((candidate) => candidate.slot === target.slot);
    if (target.mode === 'fill' && occupiedTarget) return;
    if (
      target.mode === 'replace'
      && (!occupiedTarget || occupiedTarget.url !== currentDraft.referenceImageUrl)
    ) {
      return;
    }

    setReferenceImageGenerationTarget(target);
    setReferenceImageFailure(null);
    const prompt = currentDraft.referenceImagePrompt;
    try {
      const result = await generatePersonaReferenceImage({ prompt, count: 1 });
      if (!result.ok) {
        const message = translateReferenceImageFailure(result, t);
        setReferenceImageFailure(message);
        const toastMessage = t('create.referenceFailed', { message });
        if (
          result.failure === 'runtime-capability-unavailable'
          || result.failure === 'runtime-route-unbound'
          || result.failure === 'runtime-transport-unavailable'
        ) {
          nimiToast.info(toastMessage);
        } else {
          nimiToast.danger(toastMessage);
        }
        return;
      }
      const createdAt = new Date().toISOString();
      const urls = [...new Set([...(result.artifactUris || []), result.referenceImageUrl].filter(Boolean))];
      const url = urls[0];
      if (!url) {
        const message = t('create.reference.capabilityUnavailable');
        setReferenceImageFailure(message);
        nimiToast.info(message);
        return;
      }
      const candidate: ReferenceImageCandidate = {
        draftKey,
        slot: target.slot,
        url,
        prompt,
        createdAt,
        sourceKind: 'generated',
        reviewState: 'candidate-only',
      };
      setReferenceCandidateLoadFailures((current) => {
        const next = new Set(current);
        if (occupiedTarget) next.delete(occupiedTarget.url);
        next.delete(url);
        return next;
      });
      updateDraft((latest) => {
        const normalizedLatest = normalizeCreateRealmPersonaDraft(latest);
        const replaced = normalizedLatest.referenceImageCandidates.find((item) => item.slot === target.slot);
        const nextCandidates = normalizedLatest.referenceImageCandidates
          .filter((item) => item.slot !== target.slot)
          .concat(candidate)
          .sort((left, right) => left.slot - right.slot);
        return {
          referenceImageCandidates: nextCandidates,
          referenceImageUrl: replaced?.url === normalizedLatest.referenceImageUrl
            ? ''
            : normalizedLatest.referenceImageUrl,
        };
      });
      setReferenceImageFailure(null);
    } finally {
      setReferenceImageGenerationTarget(null);
    }
  }

  function clearReferenceImage() {
    updateDraft({
      referenceImageUrl: '',
      referenceImageCandidates: normalizedDraft.referenceImageCandidates.map((candidate) => ({
        ...candidate,
        reviewState: 'candidate-only',
      })),
    });
    setReferenceImageFailure(null);
  }

  function resetReferenceImagePrompt() {
    updateDraft({ referenceImagePrompt: initialReferenceImagePromptFromDraft(draft) });
  }

  function selectReferenceImageCandidate(url: string) {
    if (referenceCandidateLoadFailures.has(url)) {
      return;
    }
    updateDraft({
      referenceImageUrl: url,
      referenceImageCandidates: normalizedDraft.referenceImageCandidates.map((candidate) => ({
        ...candidate,
        reviewState: candidate.url === url ? 'owner-selected' : 'candidate-only',
      })),
    });
  }

  function markReferenceImageUnavailable(url: string) {
    setReferenceCandidateLoadFailures((current) => new Set(current).add(url));
    if (normalizedDraft.referenceImageUrl === url) {
      clearReferenceImage();
    }
  }

  function adoptReferenceImageUrl(url: string) {
    const result = adoptImportedReferenceImageCandidate(draft, draftKey, url);
    if (!result.ok) {
      setReferenceSourceFailure(t(result.failure === 'candidate-slots-full'
        ? 'create.reference.sourceSlotsFull'
        : 'create.reference.sourceUrlUnavailable'));
      return;
    }
    updateDraft({
      referenceImageUrl: result.referenceImageUrl,
      referenceImageCandidates: result.referenceImageCandidates,
    });
    setReferenceCandidateLoadFailures((current) => {
      const next = new Set(current);
      next.delete(result.referenceImageUrl);
      return next;
    });
    setReferenceSourceFailure(null);
    nimiToast.success(t('create.reference.sourceSelected'));
  }

  function selectReferenceImageSourceMode(mode: ReferenceImageSourceMode) {
    setReferenceImageSourceMode(mode);
    setReferenceSourceFailure(null);
  }

  function requestReferenceImageUpload() {
    if (isImportingReferenceImage) return;
    setReferenceImageSourceMode(null);
    setReferenceSourceFailure(null);
    referenceImageFileInputRef.current?.click();
  }

  async function handleReferenceImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.toLocaleLowerCase().startsWith('image/')) {
      setReferenceSourceFailure(t('assets.visualChange.uploadInvalid'));
      return;
    }
    setIsImportingReferenceImage(true);
    setReferenceSourceFailure(null);
    try {
      const result = await importLocalAssetFile(file, localImportCapability);
      if (!result.ok) {
        setReferenceSourceFailure(t(result.failure === 'capability-unavailable'
          ? 'create.reference.uploadUnavailable'
          : 'create.reference.uploadFailed'));
        return;
      }
      await refreshReferenceAssets();
      if (!isRealmReferenceImageUrl(result.record.previewUrl)) {
        setReferenceSourceFailure(t('create.reference.uploadLocalOnly'));
        return;
      }
      adoptReferenceImageUrl(result.record.previewUrl);
    } finally {
      setIsImportingReferenceImage(false);
    }
  }

  async function copyPrompt(target: PromptCopyTarget, text: string) {
    setPromptCopyFailed(false);
    if (!text.trim() || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setPromptCopyFailed(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setPromptCopied(target);
      window.setTimeout(() => setPromptCopied((current) => current === target ? null : current), 1500);
    } catch {
      setPromptCopyFailed(true);
    }
  }

  const createDisabled = createMutation.isPending || worldsQuery.isLoading || worldsQuery.isError || worlds.length === 0;
  const worldsUnavailable = worldsQuery.isError || (!worldsQuery.isLoading && worlds.length === 0);
  const seedPrompt = ownerPromptFromDraft(draft);
  const imagePrompt = normalizedDraft.referenceImagePrompt;
  const candidateCount = normalizedDraft.referenceImageCandidates.length;
  const selectedReferenceCandidate = normalizedDraft.referenceImageCandidates.find(
    (candidate) => candidate.url === normalizedDraft.referenceImageUrl,
  ) || null;
  const previewReferenceCandidate = selectedReferenceCandidate
    || normalizedDraft.referenceImageCandidates.find(
      (candidate) => !referenceCandidateLoadFailures.has(candidate.url),
    )
    || null;
  const isGeneratingReferenceImage = referenceImageGenerationTarget !== null;
  const referenceImagePromptChanged = Boolean(
    previewReferenceCandidate
    && previewReferenceCandidate.sourceKind === 'generated'
    && imagePrompt !== previewReferenceCandidate.prompt,
  );
  const displayNameError = fieldErrors.displayName ? translateCreateFixedMessage(fieldErrors.displayName, t) : null;
  const handleError = fieldErrors.handle ? translateCreateFixedMessage(fieldErrors.handle, t) : null;
  const conceptError = fieldErrors.concept ? translateCreateFixedMessage(fieldErrors.concept, t) : null;
  const personaArchetypeError = fieldErrors.personaArchetype ? translateCreateFixedMessage(fieldErrors.personaArchetype, t) : null;
  const personaTraitsError = fieldErrors.personaTraits ? translateCreateFixedMessage(fieldErrors.personaTraits, t) : null;
  const selectedWorldError = fieldErrors.selectedWorldId ? translateCreateFixedMessage(fieldErrors.selectedWorldId, t) : null;
  const visibilityError = fieldErrors.visibility ? translateCreateFixedMessage(fieldErrors.visibility, t) : null;
  const referenceImageError = fieldErrors.referenceImage ? translateCreateFixedMessage(fieldErrors.referenceImage, t) : null;

  const renderHeader = () => (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <NimiText as="h1" role="page-title" className="m-0">
        {t('create.title')}
      </NimiText>
      <AutosaveIndicator state={autosaveState} failureMessage={autosaveFailureMessage} />
    </header>
  );

  if (draftLoadState === 'loading') {
    return (
      <div className="ras-page ras-create-page">
        {renderHeader()}
        <Surface tone="card" padding="lg">
          <EmptyState title={t('create.draft.loadingTitle')} description={t('create.draft.loadingDescription')} />
        </Surface>
      </div>
    );
  }

  if (stage === 'describe') {
    const supplementButtons: Array<{ key: SupplementKey; labelKey: StudioCopyKey }> = [
      { key: 'speechSupplement', labelKey: 'create.supplement.speech' },
      { key: 'boundarySupplement', labelKey: 'create.supplement.boundary' },
      { key: 'visualSupplement', labelKey: 'create.supplement.visual' },
    ];
    const supplementLabels: Record<SupplementKey, { labelKey: StudioCopyKey; placeholderKey: StudioCopyKey }> = {
      speechSupplement: { labelKey: 'create.supplement.speechLabel', placeholderKey: 'create.supplement.speechPlaceholder' },
      boundarySupplement: { labelKey: 'create.supplement.boundaryLabel', placeholderKey: 'create.supplement.boundaryPlaceholder' },
      visualSupplement: { labelKey: 'create.supplement.visualLabel', placeholderKey: 'create.supplement.visualPlaceholder' },
    };
    return (
      <div className="ras-page ras-create-page ras-create-page--describe">
        {renderHeader()}
        <Surface tone="card" material="glass-thick" padding="none" className="ras-create-describe-card">
          <div className="ras-create-describe-card__body">
          <FieldShell
            label={(
              <span className="ras-create-describe-field-label">
                <span>{t('create.oneLineLabel')}</span>
                <span className="ras-create-describe-field-label__hint">{t('create.oneLineRequired')}</span>
              </span>
            )}
          >
            <TextareaField
              rows={5}
              className="ras-create-describe-textarea"
              value={draft.originalDescription}
              placeholder={t('create.oneLinePlaceholder')}
              onChange={(event) => updateDraft({ originalDescription: event.currentTarget.value })}
            />
          </FieldShell>
          <div className="grid gap-2">
            <p className="m-0 text-xs text-[var(--nimi-text-muted)]">{t('create.supplement.hint')}</p>
            <div className="ras-create-supplement-chips flex flex-wrap gap-2">
              {supplementButtons.map(({ key, labelKey }) => (
                <Button
                  key={key}
                  tone="secondary"
                  size="sm"
                  className="rounded-full"
                  aria-expanded={expandedSupplements[key]}
                  onClick={() => setExpandedSupplements((current) => ({ ...current, [key]: !current[key] }))}
                >
                  {t(labelKey)}
                </Button>
              ))}
            </div>
          </div>
          {seedResult && !seedResult.ok ? (
            <InlineAlert tone="danger">
              {t('create.seedGenerationFailed', { message: translateCreateFixedMessage(seedResult.message, t) })}
            </InlineAlert>
          ) : null}
          {supplementButtons.map(({ key }) => expandedSupplements[key] ? (
            <FieldShell key={key} label={t(supplementLabels[key].labelKey)}>
              <TextareaField
                rows={3}
                value={normalizedDraft[key]}
                placeholder={t(supplementLabels[key].placeholderKey)}
                onChange={(event) => updateDraft({ [key]: event.currentTarget.value })}
              />
            </FieldShell>
          ) : null)}

          <div className="ras-create-describe-divider" aria-hidden="true" />

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Button
                tone="primary"
                size="lg"
                fullWidth
                className="ras-create-ai-button min-h-14 rounded-xl"
                disabled={!normalizedDraft.originalDescription}
                loading={isGeneratingSeed}
                leadingIcon={isGeneratingSeed ? undefined : <Sparkles size={18} aria-hidden="true" />}
                onClick={() => void runSeedGeneration()}
              >
                {isGeneratingSeed ? t('create.aiButton.generating') : t('create.aiButton.label')}
              </Button>
              <p className="m-0 text-center text-xs text-[var(--nimi-text-muted)]">{t('create.aiButton.helper')}</p>
            </div>
            <Button
              tone="secondary"
              size="lg"
              fullWidth
              className="ras-create-manual-button min-h-14 rounded-xl"
              leadingIcon={<Pencil size={18} aria-hidden="true" />}
              onClick={skipSeedAndCreateManually}
            >
              {t('create.manualButton.label')}
            </Button>
          </div>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="ras-page ras-create-page">
      {renderHeader()}
      <section className="min-w-0">
          {worldsQuery.isLoading ? <Surface tone="card" padding="lg" className="rounded-[var(--nimi-radius-xl)]"><WorldLoadingPanel /></Surface> : worldsUnavailable ? (
            <WorldRecoveryPanel
              completedCount={countCompletedCreationDraftFields(draft)}
              retrying={worldsQuery.isFetching}
              onRetry={() => void worldsQuery.refetch()}
              createDisabled={createDisabled}
            />
          ) : (
            <div className="grid min-w-0 gap-5 px-1 pb-6 pt-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <Button tone="ghost" size="sm" onClick={returnToDescribeStage} leadingIcon={<ArrowLeft size={15} aria-hidden="true" />}>{t('create.review.back')}</Button>
              </div>

              <Surface tone="card" material="glass-thick" padding="none" className="ras-create-review-card">
                <div className="ras-create-review-form">
                <div className="ras-create-review-card__heading"><h3>{t('create.review.basicInfo')}</h3><StatusBadge tone="info">{t('create.review.aiDraft')}</StatusBadge></div>
                <Surface
                  tone="card"
                  material="glass-thick"
                  padding="none"
                  tabIndex={-1}
                  aria-invalid={Boolean(referenceImageError) || undefined}
                  data-create-field="referenceImage"
                  className={`ras-create-reference-card ${referenceImageError ? 'ras-create-reference-card--error' : ''}`}
                >
                  <h4 className="ras-create-reference-card__title">{t('create.referenceTitle')}</h4>
                  <button
                    type="button"
                    className="ras-create-reference-card__preview"
                    data-create-field-control
                    aria-expanded={referenceImageEditorOpen}
                    aria-label={`${t('create.referenceTitle')}: ${previewReferenceCandidate ? t('create.referenceAttached') : t('create.reference.emptyTitle')}. ${t('create.reference.sourceTitle')}`}
                    onClick={() => setReferenceImageEditorOpen(true)}
                  >
                    <Scan className="ras-create-reference-card__corner" data-corner="top-left" strokeWidth={1.15} aria-hidden="true" />
                    <Scan className="ras-create-reference-card__corner" data-corner="top-right" strokeWidth={1.15} aria-hidden="true" />
                    <Scan className="ras-create-reference-card__corner" data-corner="bottom-left" strokeWidth={1.15} aria-hidden="true" />
                    <Scan className="ras-create-reference-card__corner" data-corner="bottom-right" strokeWidth={1.15} aria-hidden="true" />
                    {previewReferenceCandidate && !referenceImageLoadFailed ? (
                      <img
                        src={previewReferenceCandidate.url}
                        alt={t('create.referenceAlt')}
                        className="ras-create-reference-card__image"
                        onError={() => markReferenceImageUnavailable(previewReferenceCandidate.url)}
                      />
                    ) : (
                      <span className="ras-create-reference-card__empty">
                        <span className="ras-create-reference-card__empty-icon" aria-hidden="true">
                          <ImageIcon size={21} strokeWidth={1.8} />
                        </span>
                        <span className="ras-create-reference-card__empty-title">{t('create.reference.emptyTitle')}</span>
                        <span className="ras-create-reference-card__empty-description">{t('create.reference.emptyDescription')}</span>
                      </span>
                    )}
                  </button>

                  <OverlayShell
                    open={referenceImageEditorOpen}
                    size="M"
                    onClose={() => setReferenceImageEditorOpen(false)}
                    title={(
                      <div className="ras-visual-change__title-row">
                        <span>{t('create.referenceTitle')}</span>
                        <IconButton
                          tone="ghost"
                          size="sm"
                          className="ras-visual-change__close"
                          aria-label={t('common.close')}
                          onClick={() => setReferenceImageEditorOpen(false)}
                          icon={<X size={18} strokeWidth={1.8} aria-hidden="true" />}
                        />
                      </div>
                    )}
                    description={<span className="ras-visual-change__description">{t('create.reference.sourceTitle')}</span>}
                    panelClassName="ras-visual-change-dialog"
                    contentClassName="ras-visual-change-dialog__content"
                    footer={(
                      <div className="flex justify-end">
                        <Button tone="secondary" onClick={() => setReferenceImageEditorOpen(false)}>{t('common.cancel')}</Button>
                      </div>
                    )}
                    dataTestId="create-reference-image-dialog"
                  >
                    <div className="ras-visual-change">
                      <input
                        ref={referenceImageFileInputRef}
                        type="file"
                        accept="image/*"
                        className="ras-create-visual-source__file-input"
                        aria-label={t('assets.visualChange.uploadAriaLabel')}
                        onChange={(event) => void handleReferenceImageUpload(event)}
                      />

                      <ReferenceImageSourceChooser
                        value={referenceImageSourceMode}
                        attached={Boolean(normalizedDraft.referenceImageUrl)}
                        uploadDisabled={isImportingReferenceImage}
                        onUploadRequest={requestReferenceImageUpload}
                        onValueChange={selectReferenceImageSourceMode}
                      />

                      {referenceImageSourceMode === 'assets' ? (
                        <div className="grid gap-2" data-testid="create-reference-assets">
                          {referenceAssetLoadState === 'loading' || referenceAssetLoadState === 'idle' ? (
                            <EmptyState title={t('create.reference.assetsLoading')} description={t('create.reference.assetsLoadingDescription')} />
                          ) : referenceAssets.length === 0 ? (
                            <EmptyState
                              title={t(referenceAssetLoadState === 'failed'
                                ? 'create.reference.assetsUnavailable'
                                : 'assets.visualChange.assetsEmptyTitle')}
                              description={t(referenceAssetLoadState === 'failed'
                                ? 'create.reference.assetsUnavailableDescription'
                                : 'create.reference.assetsEmptyDescription')}
                            />
                          ) : (
                            <div className="ras-create-visual-source__assets">
                              {referenceAssets.map((asset) => (
                                <button
                                  key={asset.id}
                                  type="button"
                                  className="ras-create-visual-source__asset"
                                  aria-label={t('create.reference.useAsset', { title: asset.title })}
                                  onClick={() => asset.previewUrl ? adoptReferenceImageUrl(asset.previewUrl) : undefined}
                                >
                                  <img src={asset.previewUrl || ''} alt={asset.title} />
                                  <span>{asset.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {referenceAssetsSourceUnavailable || referenceAssetsUnavailableCount > 0 ? (
                            <InlineAlert tone="warning">{t('create.reference.assetsPartial')}</InlineAlert>
                          ) : null}
                        </div>
                      ) : null}

                      {referenceImageSourceMode === 'ai' ? (
                        <div className="grid gap-3" data-testid="create-reference-ai">
                          <FieldShell label={t('create.imagePromptLabel')} message={t('create.imagePromptMessage')}>
                            <TextareaField
                              rows={3}
                              value={draft.referenceImagePrompt}
                              placeholder={t('create.imagePromptPlaceholder')}
                              onChange={(event) => updateDraft({ referenceImagePrompt: event.currentTarget.value })}
                            />
                          </FieldShell>
                          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                            {referenceImagePromptChanged ? (
                              <StatusBadge tone="warning">{t('create.imagePromptChanged')}</StatusBadge>
                            ) : <span />}
                            <Button tone="ghost" size="sm" onClick={resetReferenceImagePrompt}>
                              {t('create.imagePromptReset')}
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {referenceImageSourceMode === 'ai' ? candidateCount === 0 ? (
                        <Button
                          tone="primary"
                          fullWidth
                          disabled={!imagePrompt}
                          loading={referenceImageGenerationTarget?.mode === 'fill' && referenceImageGenerationTarget.slot === 0}
                          onClick={() => void runReferenceImageGeneration({ mode: 'fill', slot: 0 })}
                          leadingIcon={<Sparkles size={15} aria-hidden="true" />}
                        >
                          {t('create.generateReference')}
                        </Button>
                      ) : (
                        <>
                          {previewReferenceCandidate && !selectedReferenceCandidate ? (
                            <Button
                              tone="primary"
                              fullWidth
                              disabled={referenceCandidateLoadFailures.has(previewReferenceCandidate.url) || isGeneratingReferenceImage}
                              onClick={() => selectReferenceImageCandidate(previewReferenceCandidate.url)}
                            >
                              {t('create.reference.selectCandidate')}
                            </Button>
                          ) : null}
                          <Button
                            tone="secondary"
                            fullWidth
                            disabled={!selectedReferenceCandidate || !imagePrompt}
                            loading={referenceImageGenerationTarget?.mode === 'replace'}
                            onClick={() => selectedReferenceCandidate
                              ? void runReferenceImageGeneration({ mode: 'replace', slot: selectedReferenceCandidate.slot })
                              : undefined}
                            leadingIcon={<RefreshCw size={15} aria-hidden="true" />}
                          >
                            {t('create.reference.regenerateSelected')}
                          </Button>
                          <p className="m-0 text-xs text-[var(--nimi-text-muted)]">
                            {selectedReferenceCandidate
                              ? t('create.reference.regenerateSelectedHelp')
                              : t('create.reference.selectToRegenerate')}
                          </p>
                        </>
                      ) : null}
                      {referenceSourceFailure ? <InlineAlert tone="danger">{referenceSourceFailure}</InlineAlert> : null}
                      {normalizedDraft.referenceImageUrl ? <Button tone="ghost" size="sm" onClick={clearReferenceImage}>{t('create.clearReference')}</Button> : null}
                    </div>
                  </OverlayShell>
                  {referenceImageError ? <p className="ras-create-reference-card__error">{referenceImageError}</p> : null}
                  {referenceImageFailure ? <div className="ras-create-reference-card__failure"><InlineAlert tone="danger">{referenceImageFailure}</InlineAlert></div> : null}
                </Surface>
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
                  <div className="min-w-0" data-create-field="handle">
                    <FieldShell
                      label={<span className="flex flex-wrap items-center gap-2">{t('create.handleLabel')}<HandleAvailabilityBadge handle={normalizedDraft.handle} query={handleAvailabilityQuery} availability={handleAvailability} /></span>}
                      message={handleError}
                      messageTone={handleError ? 'danger' : 'neutral'}
                    >
                      <TextField tone={handleError ? 'danger' : 'default'} className={handleError ? 'focus-within:!border-[var(--nimi-field-focus)] focus-within:!ring-[var(--nimi-focus-ring-color)]' : undefined} data-create-field-control value={draft.handle} placeholder={t('create.handlePlaceholder')} onChange={(event) => updateDraft({ handle: event.currentTarget.value })} />
                    </FieldShell>
                    {handleAvailabilityQuery.isError ? <InlineAlert tone="danger">{t('create.handleCheckFailed')}</InlineAlert> : null}
                  </div>
                </div>
                <div className="min-w-0" data-create-field="concept">
                  <FieldShell label={t('create.conceptLabel')} message={conceptError || t('create.conceptMessage')} messageTone={conceptError ? 'danger' : 'neutral'}>
                    <TextareaField tone={conceptError ? 'danger' : 'default'} className={conceptError ? 'focus-within:!border-[var(--nimi-field-focus)] focus-within:!ring-[var(--nimi-focus-ring-color)]' : undefined} data-create-field-control rows={3} value={draft.concept} placeholder={t('create.conceptPlaceholder')} onChange={(event) => updateDraft({ concept: event.currentTarget.value })} />
                  </FieldShell>
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
                      options={[{ value: SELECT_UNSET_VALUE, label: t('create.personaArchetypePlaceholder') }, ...PERSONA_ARCHETYPES.map((archetype) => ({ value: archetype, label: `${translatePersonaArchetypeLabel(archetype, t)} — ${t(PERSONA_ARCHETYPE_DESCRIPTION_KEYS[archetype])}` }))]}
                      onValueChange={(value) => updateDraft({ personaArchetype: value === SELECT_UNSET_VALUE ? '' : value as PersonaArchetype })}
                    />
                  </FieldShell>
                </div>
                <div className="min-w-0" data-create-field="personaTraits">
                  <FieldShell label={t('create.personaTraitsLabel', { max: PERSONA_TRAIT_MAX })} message={personaTraitsError} messageTone={personaTraitsError ? 'danger' : 'neutral'}>
                    <div ref={traitPickerRef} className="ras-create-trait-picker" data-open={traitPickerOpen || undefined}>
                      <button
                        type="button"
                        data-create-field-control
                        aria-expanded={traitPickerOpen}
                        aria-invalid={Boolean(personaTraitsError) || undefined}
                        className={`ras-create-trait-trigger ${personaTraitsError ? 'ras-create-trait-trigger--error' : ''}`}
                        onClick={() => setTraitPickerOpen((open) => !open)}
                      >
                        <span className="ras-create-trait-trigger__selection">
                          {draft.personaTraits.length > 0 ? draft.personaTraits.map((trait) => (
                            <span key={trait} className="ras-create-trait-chip">
                              {translatePersonaTraitLabel(trait, t).split(' · ')[0]}
                            </span>
                          )) : (
                            <span className="ras-create-trait-trigger__placeholder">{t('create.personaTraitsPlaceholder', { max: PERSONA_TRAIT_MAX })}</span>
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
                                  title={t(PERSONA_TRAIT_DESCRIPTION_KEYS[trait])}
                                  aria-pressed={active}
                                  disabled={disabled}
                                  onClick={() => updateDraft({ personaTraits: active ? draft.personaTraits.filter((value) => value !== trait) : [...draft.personaTraits, trait] })}
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
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--nimi-radius-sm)] bg-[var(--nimi-action-primary-bg)] text-xs font-semibold text-[var(--nimi-action-primary-text)]">{selectedWorld?.name.charAt(0).toUpperCase() || '?'}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{selectedWorld?.name || t('create.world.select')}</span><span className="block truncate text-xs text-[var(--nimi-text-muted)]">{selectedWorld ? worldOptionLabel(selectedWorld) : t('create.worldDefaultUnavailable')}</span></span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--nimi-text-secondary)]">{t('create.world.change')}<ChevronDown size={14} aria-hidden="true" /></span>
                    </FieldTrigger>
                  </FieldShell>
                </div>
                <div className="min-w-0" data-create-field="visibility">
                  <FieldShell
                    label={t('create.visibilityLabel')}
                    message={visibilityError || t('create.visibilityMessage')}
                    messageTone={visibilityError ? 'danger' : 'neutral'}
                  >
                    <SelectField
                      value={draft.visibility || SELECT_UNSET_VALUE}
                      options={[
                        { value: SELECT_UNSET_VALUE, label: t('create.visibilityPlaceholder') },
                        { value: 'private', label: t('visibility.value.private') },
                        { value: 'unlisted', label: t('visibility.value.unlisted') },
                        { value: 'public', label: t('visibility.value.public') },
                      ]}
                      onValueChange={(value) => updateDraft({ visibility: value === SELECT_UNSET_VALUE ? '' : value as CreateRealmPersonaDraftInput['visibility'] })}
                    />
                  </FieldShell>
                </div>
                </div>

              <details className="ras-create-prompt-panel grid gap-3 rounded-[var(--nimi-radius-lg)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-4">
                <summary className="cursor-pointer font-medium text-[var(--nimi-text-primary)]">{t('create.prompt.title')}</summary>
                <p className="m-0 text-sm text-[var(--nimi-text-muted)]">{t('create.prompt.description')}</p>
                <PromptReadOnly label={t('create.prompt.ownerLabel')} text={seedPrompt} target="seed" copied={promptCopied === 'seed'} onCopy={copyPrompt} />
                <PromptReadOnly label={t('create.prompt.imageLabel')} text={imagePrompt} target="image" copied={promptCopied === 'image'} onCopy={copyPrompt} />
                {promptCopyFailed ? <InlineAlert tone="warning">{t('create.prompt.copyFailed')}</InlineAlert> : null}
              </details>

              {createdContext ? (
                <Surface tone="card" padding="md" className="ras-create-created-card">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0"><div className="font-medium">{t('create.createdCardTitle')}</div><div className="ras-break-anywhere mt-1 text-sm text-[var(--nimi-text-muted)]">@{createdContext.handle} · {createdContext.personaId}</div></div><StatusBadge tone="success">{t(`visibility.value.${createdContext.visibility}` as StudioCopyKey)}</StatusBadge></div>
                  <div className="mt-3 flex flex-wrap gap-3"><Button tone="secondary" onClick={() => onOpenCreatedPersona?.(createdContext.personaId, 'detail')}>{t('create.openCockpit')}</Button><Button tone="ghost" onClick={() => onOpenCreatedPersona?.(createdContext.personaId, 'settings')}>{t('create.openSettings')}</Button></div>
                </Surface>
              ) : null}
              <div className="ras-create-review-actions">
                <Button tone="primary" disabled={createDisabled} loading={createMutation.isPending} onClick={submitCreate}>{t('create.submit')}</Button>
              </div>
              </Surface>
            </div>
          )}
      </section>
      <WorldPicker open={worldModalOpen} worlds={worlds} selectedWorldId={draft.selectedWorldId} onSelect={(worldId) => { updateDraft({ selectedWorldId: worldId }); setWorldModalOpen(false); }} onClose={() => setWorldModalOpen(false)} />
    </div>
  );
}

function PromptReadOnly({
  label,
  text,
  target,
  copied,
  onCopy,
}: {
  label: string;
  text: string;
  target: PromptCopyTarget;
  copied: boolean;
  onCopy: (target: PromptCopyTarget, text: string) => void;
}) {
  const { t } = useStudioI18n();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{label}</span><Button tone="secondary" size="sm" disabled={!text.trim()} onClick={() => void onCopy(target, text)} leadingIcon={copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}>{copied ? t('create.prompt.copied') : t('create.prompt.copy')}</Button></div>
      <pre className="ras-break-anywhere m-0 max-h-40 overflow-auto whitespace-pre-wrap rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs text-[var(--nimi-text-secondary)]">{text || t('create.prompt.empty')}</pre>
    </div>
  );
}
