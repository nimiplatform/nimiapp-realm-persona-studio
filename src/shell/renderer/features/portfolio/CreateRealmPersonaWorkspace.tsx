import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  EmptyState,
  FieldShell,
  FieldTrigger,
  InlineAlert,
  OverlayShell,
  SearchField,
  SelectField,
  StatusBadge,
  Surface,
  TextareaField,
  TextField,
  nimiToast,
} from '@nimiplatform/kit/ui';
import { ArrowLeft, Check, ChevronDown, Copy, Pencil, Plus, RefreshCw, Sparkles } from 'lucide-react';
import {
  PERSONA_ARCHETYPES,
  PERSONA_TRAITS,
  PERSONA_TRAIT_MAX,
  REFERENCE_IMAGE_CANDIDATE_SLOT_COUNT,
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
  listCreateRealmPersonaSelectableWorlds,
  type RealmPersonaCreateWithProfileSettingsResult,
  type RealmPersonaHandleAvailabilityResult,
} from './portfolio-client.js';
import { RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE } from './portfolio-media-client.js';
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
  defaultReferenceImagePromptFromDraft,
  generatePersonaReferenceImage,
} from './persona-reference-image.js';
import {
  CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS,
  createCreationDraftKey,
  dispatchCreationDraftHistoryUpdated,
  isCreationDraftKey,
  loadCreationDraft,
  persistCreationDraft,
  type CreationDraftPersistResult,
} from './creation-draft-store.js';
import { upsertCreationDraftHistoryEntry } from './creation-draft-history.js';
import { appendLocalCreativeAssetHistory } from './creative-asset-history.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import {
  translatePersonaArchetypeLabel,
  translatePersonaTraitLabel,
  type StudioTranslateOptions,
} from '../../i18n/studio-i18n.js';

export type CreatedRealmPersonaContext = {
  personaId: string;
  state: string | null;
  handle: string;
  displayName: string;
  selectedWorldId: string;
};

type CreateRealmPersonaWorkspaceProps = {
  onCreated?: (context: CreatedRealmPersonaContext) => void;
  onOpenCreatedPersona?: (personaId: string, target: 'detail' | 'settings') => void;
};

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

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
  'Draft contains more than 3 persona traits.': 'create.error.personaTraitsTooMany',
  'Draft contains a persona trait outside the closed value set.': 'create.error.personaTraitsOutsideClosedSet',
  'LLM output personaTraits must contain at most 3 values from the supported trait vocabulary.': 'create.error.seedTraitsInvalid',
  'persona description empty': 'create.error.seedDescriptionEmpty',
  'Persona seed payload invalid.': 'create.error.seedPayloadInvalid',
  'LLM output missing required `displayName` or `concept`.': 'create.error.seedRequiredOutputMissing',
  'LLM output personaArchetype missing or outside the supported archetypes.': 'create.error.seedArchetypeInvalid',
  'Persona seed output invalid.': 'create.error.seedOutputInvalid',
  'selected world not source-backed by WorldCoreController.listWorldCores': 'create.error.selectedWorldNotSourceBacked',
  'handle availability not checked by WorldCoreController.listRealmPersonas': 'create.error.handleAvailabilityMissing',
  'handle availability not checked against WorldCoreController.listRealmPersonas': 'create.error.handleAvailabilityMissing',
  'handle availability not checked for the current normalized handle': 'create.error.handleAvailabilityStale',
  'Persona handle check requires a non-empty normalized handle.': 'create.error.handleAvailabilityEmpty',
  'Realm handle availability check did not return an availability boolean.': 'create.error.handleAvailabilityMissingBoolean',
  'Realm handle availability check failed.': 'create.error.handleAvailabilityFailed',
  'RealmPersona handle availability check failed.': 'create.error.handleAvailabilityFailed',
  'Realm create RealmPersona returned no persona object.': 'create.error.realmCreateNoPersona',
  'Realm create RealmPersona returned no canonical persona id.': 'create.error.realmCreateNoId',
  'Realm create RealmPersona returned incomplete canonical source fields.': 'create.error.realmCreateIncompleteSource',
  'Realm create RealmPersona failed.': 'create.error.realmCreateFailed',
  'Realm owner settings read failed after create.': 'create.error.ownerSettingsReadFailed',
  'Realm owner settings update failed.': 'settings.error.ownerSettingsUpdateFailed',
  'reference image prompt empty': 'create.error.referencePromptEmpty',
  'reference image generation count must be 1': 'create.error.referenceCountInvalid',
  'Reference image payload invalid.': 'create.error.referencePayloadInvalid',
  'Runtime imageGenerate scenario transport unavailable: Tauri IPC runtime transport is required.': 'create.error.referenceTransportUnavailable',
  [RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE]: 'create.error.referenceCandidateUnavailable',
  'Runtime imageGenerate scenario returned no readable artifact.': 'create.error.referenceNoArtifact',
  'Runtime imageGenerate produced a local artifact but no http(s) URL that Realm can store as a public reference image.': 'create.error.referenceLocalArtifactNoUrl',
  'A RealmPersona with this handle already exists in the owner portfolio.': 'create.error.handleAlreadyExists',
};

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
  if (message.startsWith('Persona Creation Graph ')) return translateGraphReviewError(message, t);
  const handleUnavailable = message.match(/^handle unavailable: (.+)$/);
  if (handleUnavailable) {
    const reason = handleUnavailable[1] ?? '';
    const handleReason = CREATE_FIXED_MESSAGE_KEYS[reason];
    return handleReason
      ? t(handleReason)
      : t('create.error.handleUnavailable', { message: reason });
  }
  if (message.startsWith('Runtime imageGenerate scenario failed:')) return t('create.error.referenceGenerateFailed');
  if (message.startsWith('Nimi text candidate generation failed:')) return t('create.error.seedGenerationTransportFailed');
  const key = CREATE_FIXED_MESSAGE_KEYS[message];
  return key ? t(key) : t('common.operationFailed');
}

function translateCreateFixedMessages(messages: string[], t: StudioTranslator): string {
  return messages.map((message) => translateCreateFixedMessage(message, t)).join('; ');
}

function createEmptyDraft(): CreateRealmPersonaDraftInput {
  return {
    handle: '',
    displayName: '',
    concept: '',
    description: '',
    ruleText: '',
    selectedWorldId: '',
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

function initialReferenceImagePromptFromDraft(input: CreateRealmPersonaDraftInput): string {
  const ownerPrompt = ownerPromptFromDraft(input);
  if (ownerPrompt) return ownerPrompt;
  const draft = normalizeCreateRealmPersonaDraft(input);
  return defaultReferenceImagePromptFromDraft({
    description: draft.description,
    displayName: draft.displayName,
    concept: draft.concept,
    personaArchetype: draft.personaArchetype,
  });
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
        <Button tone="primary" className="text-white" disabled={createDisabled}>{t('create.submit')}</Button>
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
  const [createdContext, setCreatedContext] = useState<CreatedRealmPersonaContext | null>(null);
  const [localSubmitErrors, setLocalSubmitErrors] = useState<string[]>([]);
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
    setSeedResult(null);
    setSeedOriginalDisplayName('');
    setGraphAcceptedFingerprint(null);
    setLocalSubmitErrors([]);
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
  const creationGraphReview = useMemo(
    () => validatePersonaCreationGraphForRealmCreate(creationGraph, graphAcceptedFingerprint),
    [creationGraph, graphAcceptedFingerprint],
  );

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

  function resetCreateOutcome() {
    setLocalSubmitErrors([]);
    setCreatedContext(null);
  }

  function updateDraft(
    patch: CreateRealmPersonaDraftPatch | ((current: CreateRealmPersonaDraftInput) => CreateRealmPersonaDraftPatch),
  ) {
    setDraft((current) => ({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch),
    }));
    setGraphAcceptedFingerprint(null);
    resetCreateOutcome();
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
        nimiToast.success(t('create.createdSuccess', { id: result.canonical.id }));
        if (result.profileSettings.status !== 'not-applicable') {
          nimiToast.success(t('create.profileDescriptionSaved', {
            status: result.profileSettings.status === 'updated'
              ? t('create.profileDescriptionSavedUpdated')
              : t('create.profileDescriptionSavedCurrent'),
          }));
        }
        const currentDraft = normalizeCreateRealmPersonaDraft(draft);
        const context: CreatedRealmPersonaContext = {
          personaId: result.canonical.id,
          state: result.canonical.state || null,
          handle: currentDraft.handle,
          displayName: currentDraft.displayName,
          selectedWorldId: currentDraft.selectedWorldId,
        };
        setCreatedContext(context);
        setLocalSubmitErrors([]);
        onCreated?.(context);
        void queryClient.invalidateQueries({ queryKey: ['realm-persona-studio', 'owner-portfolio'] });
      } else {
        nimiToast.danger(t('create.createdPartial', {
          message: translateCreateFixedMessage(result.message, t),
          created: result.createdCanonical ? t('create.createdPersonaId', { id: result.createdCanonical.id }) : '',
        }));
      }
    },
  });

  function submitCreate() {
    const acceptedFingerprint = acceptPersonaCreationGraphForRealmCreate(creationGraph);
    const acceptedGraphReview = validatePersonaCreationGraphForRealmCreate(creationGraph, acceptedFingerprint);
    if (!acceptedGraphReview.ready) {
      setLocalSubmitErrors(acceptedGraphReview.errors);
      return;
    }
    const readiness = validateCreateRealmPersonaReadiness(draft, { selectableWorldIds, handleAvailability });
    if (!readiness.ready) {
      setLocalSubmitErrors(readiness.errors);
      return;
    }
    setGraphAcceptedFingerprint(acceptedFingerprint);
    setLocalSubmitErrors([]);
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
        const message = translateCreateFixedMessage(result.message, t);
        setReferenceImageFailure(message);
        const toastMessage = t('create.referenceFailed', { message });
        if (result.failure === 'persona-reference-image-candidate-unavailable') {
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

  const readiness = validateCreateRealmPersonaReadiness(draft, { selectableWorldIds, handleAvailability });
  const handleCheckBlocking = Boolean(normalizedDraft.handle)
    && (handleAvailabilityQuery.isLoading || handleAvailabilityQuery.isError || !handleAvailability?.available);
  const createDisabled = createMutation.isPending || worldsQuery.isLoading || worldsQuery.isError || worlds.length === 0 || !selectedWorld || !readiness.ready || !creationGraphReview.canAccept || handleCheckBlocking;
  const worldsUnavailable = worldsQuery.isError || (!worldsQuery.isLoading && worlds.length === 0);
  const seedPrompt = ownerPromptFromDraft(draft);
  const imagePrompt = normalizedDraft.referenceImagePrompt;
  const candidateCount = normalizedDraft.referenceImageCandidates.length;
  const candidateSlots = Array.from(
    { length: REFERENCE_IMAGE_CANDIDATE_SLOT_COUNT },
    (_, slot) => slot as ReferenceImageCandidateSlot,
  );
  const candidatesBySlot = new Map(
    normalizedDraft.referenceImageCandidates.map((candidate) => [candidate.slot, candidate]),
  );
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
    && imagePrompt !== previewReferenceCandidate.prompt,
  );
  const archetypeLabel = normalizedDraft.personaArchetype
    ? translatePersonaArchetypeLabel(normalizedDraft.personaArchetype, t)
    : t('create.personaArchetypePlaceholder');

  const renderHeader = () => (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="m-0 text-2xl font-semibold text-[var(--nimi-text-primary)]">{t('create.title')}</h1>
        <p className="m-0 mt-1 text-xs text-[var(--nimi-text-muted)]">{t('create.estimatedTime')}</p>
      </div>
      <AutosaveIndicator state={autosaveState} failureMessage={autosaveFailureMessage} />
    </header>
  );

  if (draftLoadState === 'loading') {
    return (
      <div className="mx-auto grid min-w-0 w-full max-w-[920px] gap-5 p-6 xl:p-8">
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
      <div className="mx-auto grid min-w-0 w-full max-w-[920px] gap-5 p-6 xl:p-8">
        {renderHeader()}
        <Surface tone="card" padding="lg" className="grid gap-6 rounded-[var(--nimi-radius-xl)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="m-0 text-3xl font-semibold tracking-tight text-[var(--nimi-text-primary)]">{t('create.describe.heading')}</h2>
            <StatusBadge tone="info">{t('create.describe.badge')}</StatusBadge>
          </div>
          <FieldShell label={t('create.oneLineLabel')} message={t('create.describe.helper')}>
            <TextareaField
              rows={5}
              value={draft.originalDescription}
              placeholder={t('create.oneLinePlaceholder')}
              onChange={(event) => updateDraft({ originalDescription: event.currentTarget.value })}
            />
          </FieldShell>
          <div className="flex flex-wrap gap-2">
            {supplementButtons.map(({ key, labelKey }) => (
              <Button
                key={key}
                tone="secondary"
                size="sm"
                className="rounded-full"
                aria-expanded={expandedSupplements[key]}
                onClick={() => setExpandedSupplements((current) => ({ ...current, [key]: !current[key] }))}
              >
                + {t(labelKey)}
              </Button>
            ))}
          </div>
          {seedResult && !seedResult.ok ? (
            <InlineAlert tone="info">
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

          <div className="grid gap-3">
            <Button
              tone="primary"
              size="lg"
              fullWidth
              className="min-h-14 rounded-xl text-white"
              disabled={!normalizedDraft.originalDescription}
              loading={isGeneratingSeed}
              leadingIcon={isGeneratingSeed ? undefined : <Sparkles size={18} aria-hidden="true" />}
              onClick={() => void runSeedGeneration()}
            >
              {isGeneratingSeed ? t('create.aiButton.generating') : t('create.aiButton.label')}
            </Button>
            <Button
              tone="secondary"
              size="lg"
              fullWidth
              className="min-h-14 rounded-xl"
              leadingIcon={<Pencil size={18} aria-hidden="true" />}
              onClick={skipSeedAndCreateManually}
            >
              {t('create.manualButton.label')}
            </Button>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 p-6 xl:p-8">
      {renderHeader()}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="grid min-w-0 gap-3 content-start">
          <Surface tone="card" material="glass-thick" padding="none" className="overflow-hidden rounded-[var(--nimi-radius-xl)]">
            <div className="relative h-[360px] overflow-hidden bg-[var(--nimi-surface-panel)]">
              {previewReferenceCandidate && !referenceImageLoadFailed ? (
                <>
                <img
                  src={previewReferenceCandidate.url}
                  alt={t('create.referenceAlt')}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={() => markReferenceImageUnavailable(previewReferenceCandidate.url)}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--nimi-text-primary)_82%,transparent)] via-transparent to-transparent" />
                <div className="absolute inset-x-5 bottom-5 text-[var(--nimi-text-inverse)]">
                  <StatusBadge tone="info" className="mb-3 bg-[color-mix(in_srgb,var(--nimi-text-primary)_60%,transparent)] text-[var(--nimi-text-inverse)]">{archetypeLabel}</StatusBadge>
                  <h2 className="m-0 text-2xl font-semibold">{normalizedDraft.displayName || t('create.displayNamePlaceholder')}</h2>
                  <div className="mt-1 font-mono text-sm opacity-80">@{normalizedDraft.handle || t('create.handlePlaceholder').replace(/^@/, '')}</div>
                </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center p-6">
                  <EmptyState title={t('create.reference.emptyTitle')} description={t('create.reference.emptyDescription')} />
                </div>
              )}
            </div>

            <div className="grid gap-3 border-t border-[var(--nimi-border-subtle)] p-4">
              <FieldShell label={t('create.imagePromptLabel')} message={t('create.imagePromptMessage')}>
                <TextareaField
                  rows={4}
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

              <div className="border-t border-[var(--nimi-border-subtle)] pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--nimi-text-muted)]">
                  <span>{t('create.reference.selectCandidate')}</span>
                  <span>{t('create.reference.slotCount', { count: candidateCount, max: REFERENCE_IMAGE_CANDIDATE_SLOT_COUNT })}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {candidateSlots.map((slot) => {
                    const candidate = candidatesBySlot.get(slot);
                    if (candidate) {
                      const unavailable = referenceCandidateLoadFailures.has(candidate.url);
                      return (
                        <Surface
                          key={`${slot}-${candidate.url}-${candidate.createdAt}`}
                          as="button"
                          type="button"
                          tone="card"
                          padding="none"
                          interactive={!unavailable}
                          disabled={unavailable || isGeneratingReferenceImage}
                          active={candidate.reviewState === 'owner-selected'}
                          aria-label={t('create.reference.selectCandidateSlot', { slot: slot + 1 })}
                          onClick={() => selectReferenceImageCandidate(candidate.url)}
                          className="relative aspect-square overflow-hidden rounded-[var(--nimi-radius-md)]"
                        >
                          {unavailable ? (
                            <span className="flex h-full items-center justify-center p-2 text-center text-xs text-[var(--nimi-text-muted)]">{t('common.sourceUnavailable')}</span>
                          ) : (
                            <img
                              src={candidate.url}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={() => markReferenceImageUnavailable(candidate.url)}
                            />
                          )}
                          {candidate.reviewState === 'owner-selected' ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--nimi-action-primary-bg)] text-[var(--nimi-action-primary-text)]"><Check size={12} aria-hidden="true" /></span> : null}
                        </Surface>
                      );
                    }
                    const generating = referenceImageGenerationTarget?.mode === 'fill'
                      && referenceImageGenerationTarget.slot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isGeneratingReferenceImage || !imagePrompt || candidateCount === 0}
                        aria-label={t('create.reference.generateSlot', { slot: slot + 1 })}
                        onClick={() => void runReferenceImageGeneration({ mode: 'fill', slot })}
                        className="grid aspect-square min-w-0 place-content-center justify-items-center gap-1 rounded-[var(--nimi-radius-md)] border border-dashed border-[var(--nimi-border-strong)] bg-[var(--nimi-surface-panel)] p-2 text-center text-xs text-[var(--nimi-text-secondary)] transition-colors hover:border-[var(--nimi-action-primary-bg)] hover:bg-[var(--nimi-surface-active)] disabled:cursor-not-allowed disabled:opacity-[var(--nimi-opacity-disabled)]"
                      >
                        {generating
                          ? <RefreshCw size={17} aria-hidden="true" className="animate-spin" />
                          : <Plus size={18} aria-hidden="true" />}
                        <span>{generating ? t('create.reference.generatingOne') : t('create.reference.generateOne')}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="m-0 mt-2 text-xs text-[var(--nimi-text-muted)]">{t('create.reference.generateOneHelp')}</p>
              </div>

              {candidateCount === 0 ? (
                <Button
                  tone="primary"
                  fullWidth
                  className="text-white"
                  disabled={!imagePrompt}
                  loading={referenceImageGenerationTarget?.mode === 'fill' && referenceImageGenerationTarget.slot === 0}
                  onClick={() => void runReferenceImageGeneration({ mode: 'fill', slot: 0 })}
                  leadingIcon={<Sparkles size={15} aria-hidden="true" />}
                >
                  {t('create.generateReference')}
                </Button>
              ) : (
                <>
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
              )}
              {normalizedDraft.referenceImageUrl ? <Button tone="ghost" size="sm" onClick={clearReferenceImage}>{t('create.clearReference')}</Button> : null}
            </div>
          </Surface>
          {referenceImageFailure ? <InlineAlert tone="info">{referenceImageFailure}</InlineAlert> : null}
        </section>

        <section className="min-w-0">
          {worldsQuery.isLoading ? <Surface tone="card" padding="lg" className="rounded-[var(--nimi-radius-xl)]"><WorldLoadingPanel /></Surface> : worldsUnavailable ? (
            <WorldRecoveryPanel
              completedCount={countCompletedCreationDraftFields(draft)}
              retrying={worldsQuery.isFetching}
              onRetry={() => void worldsQuery.refetch()}
              createDisabled={createDisabled}
            />
          ) : (
            <Surface tone="card" padding="lg" className="grid min-w-0 gap-6 rounded-[var(--nimi-radius-xl)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Button tone="ghost" size="sm" onClick={returnToDescribeStage} leadingIcon={<ArrowLeft size={15} aria-hidden="true" />}>{t('create.review.back')}</Button>
                  <h2 className="m-0 mt-3 text-3xl font-semibold tracking-tight text-[var(--nimi-text-primary)]">{t('create.review.title')}</h2>
                  <p className="m-0 mt-2 text-sm text-[var(--nimi-text-muted)]">{t('create.review.description')}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2"><h3 className="m-0 text-base font-semibold">{t('create.review.basicInfo')}</h3><StatusBadge tone="info">{t('create.review.aiDraft')}</StatusBadge></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldShell
                    label={<span className="flex flex-wrap items-center gap-2">{t('create.displayNameLabel')}{seedOriginalDisplayName && normalizedDraft.displayName !== seedOriginalDisplayName ? <StatusBadge tone="success">{t('create.review.modified')}</StatusBadge> : null}</span>}
                  >
                    <TextField value={draft.displayName} placeholder={t('create.displayNamePlaceholder')} onChange={(event) => updateDraft({ displayName: event.currentTarget.value })} />
                  </FieldShell>
                  <FieldShell
                    label={<span className="flex flex-wrap items-center gap-2">{t('create.handleLabel')}<HandleAvailabilityBadge handle={normalizedDraft.handle} query={handleAvailabilityQuery} availability={handleAvailability} /></span>}
                  >
                    <TextField value={draft.handle} placeholder={t('create.handlePlaceholder')} onChange={(event) => updateDraft({ handle: event.currentTarget.value })} />
                  </FieldShell>
                </div>
                {handleAvailabilityQuery.isError ? <InlineAlert tone="info">{t('create.handleCheckFailed')}</InlineAlert> : null}
                <FieldShell label={t('create.conceptLabel')} message={t('create.conceptMessage')}>
                  <TextareaField rows={3} value={draft.concept} placeholder={t('create.conceptPlaceholder')} onChange={(event) => updateDraft({ concept: event.currentTarget.value })} />
                </FieldShell>
                <FieldShell label={<span>{t('create.personaArchetypeLabel')}<span className="ml-1 align-super text-[var(--nimi-status-danger)]" aria-hidden="true">*</span></span>}>
                  <SelectField
                    required
                    value={draft.personaArchetype}
                    options={[{ value: '', label: t('create.personaArchetypePlaceholder') }, ...PERSONA_ARCHETYPES.map((archetype) => ({ value: archetype, label: `${translatePersonaArchetypeLabel(archetype, t)} — ${t(PERSONA_ARCHETYPE_DESCRIPTION_KEYS[archetype])}` }))]}
                    onValueChange={(value) => updateDraft({ personaArchetype: value as PersonaArchetype | '' })}
                  />
                </FieldShell>
                <FieldShell label={t('create.personaTraitsLabel', { max: PERSONA_TRAIT_MAX })} message={t('create.personaTraitsHardLimit', { max: PERSONA_TRAIT_MAX })} messageTone={draft.personaTraits.length > PERSONA_TRAIT_MAX ? 'danger' : 'neutral'}>
                  <div className="flex flex-wrap gap-2">
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
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${active ? 'border-[var(--nimi-action-primary-bg)] bg-[var(--nimi-surface-active)] text-[var(--nimi-text-primary)]' : 'border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] text-[var(--nimi-text-secondary)]'} disabled:cursor-not-allowed disabled:opacity-[var(--nimi-opacity-disabled)]`}
                        >
                          {translatePersonaTraitLabel(trait, t)}
                        </button>
                      );
                    })}
                  </div>
                </FieldShell>
                <FieldShell label={t('create.worldLabel')} message={selectedWorld ? t('create.worldDefault', { name: selectedWorld.name }) : t('create.worldDefaultUnavailable')} messageTone={selectedWorld ? 'neutral' : 'danger'}>
                  <FieldTrigger onClick={() => setWorldModalOpen(true)} aria-haspopup="dialog" aria-expanded={worldModalOpen}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--nimi-radius-sm)] bg-[var(--nimi-action-primary-bg)] text-xs font-semibold text-[var(--nimi-action-primary-text)]">{selectedWorld?.name.charAt(0).toUpperCase() || '?'}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{selectedWorld?.name || t('create.world.select')}</span><span className="block truncate text-xs text-[var(--nimi-text-muted)]">{selectedWorld ? worldOptionLabel(selectedWorld) : t('create.worldDefaultUnavailable')}</span></span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--nimi-text-secondary)]">{t('create.world.change')}<ChevronDown size={14} aria-hidden="true" /></span>
                  </FieldTrigger>
                </FieldShell>
              </div>

              <details className="grid gap-3 rounded-[var(--nimi-radius-lg)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-4">
                <summary className="cursor-pointer font-medium text-[var(--nimi-text-primary)]">{t('create.prompt.title')}</summary>
                <p className="m-0 text-sm text-[var(--nimi-text-muted)]">{t('create.prompt.description')}</p>
                <PromptReadOnly label={t('create.prompt.ownerLabel')} text={seedPrompt} target="seed" copied={promptCopied === 'seed'} onCopy={copyPrompt} />
                <PromptReadOnly label={t('create.prompt.imageLabel')} text={imagePrompt} target="image" copied={promptCopied === 'image'} onCopy={copyPrompt} />
                {promptCopyFailed ? <InlineAlert tone="warning">{t('create.prompt.copyFailed')}</InlineAlert> : null}
              </details>

              {!readiness.ready ? <InlineAlert tone="warning">{translateCreateFixedMessages(readiness.errors, t)}</InlineAlert> : null}
              {creationGraphReview.shapeErrors.length > 0 ? <InlineAlert tone="danger">{translateGraphReviewErrors(creationGraphReview.shapeErrors, t)}</InlineAlert> : null}
              {localSubmitErrors.length > 0 ? <InlineAlert tone="danger">{t('create.validationFailed', { errors: translateCreateFixedMessages(localSubmitErrors, t) })}</InlineAlert> : null}
              {createdContext ? (
                <Surface tone="card" padding="md">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0"><div className="font-medium">{t('create.createdCardTitle')}</div><div className="ras-break-anywhere mt-1 text-sm text-[var(--nimi-text-muted)]">@{createdContext.handle} · {createdContext.personaId}</div></div><StatusBadge tone="success">{t('create.createdStateFallback')}</StatusBadge></div>
                  <div className="mt-3 flex flex-wrap gap-3"><Button tone="secondary" onClick={() => onOpenCreatedPersona?.(createdContext.personaId, 'detail')}>{t('create.openCockpit')}</Button><Button tone="ghost" onClick={() => onOpenCreatedPersona?.(createdContext.personaId, 'settings')}>{t('create.openSettings')}</Button></div>
                </Surface>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--nimi-border-subtle)] pt-4">
                <span className="text-xs text-[var(--nimi-text-muted)]">{t('create.source.ownerLocal')}</span>
                <Button tone="primary" className="text-white" disabled={createDisabled} loading={createMutation.isPending} onClick={submitCreate}>{t('create.submit')}</Button>
              </div>
            </Surface>
          )}
        </section>
      </div>
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
