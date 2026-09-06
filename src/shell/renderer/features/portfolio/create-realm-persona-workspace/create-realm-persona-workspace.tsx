import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EmptyState,
  NimiText,
  Surface,
  nimiToast,
} from '@nimiplatform/kit/ui';
import {
  normalizeCreateRealmPersonaDraft,
  selectOasisDefaultWorld,
  validateCreateRealmPersonaReadiness,
  type ReviewedCreateRealmPersonaPayload,
} from '../create-persona-draft.js';
import {
  createReviewedRealmPersonaWithProfileSettings,
  getOwnerPortfolioPersonaDetail,
  listCreateRealmPersonaSelectableWorlds,
  type RealmPersonaCreateWithProfileSettingsResult,
} from '../portfolio-client.js';
import { personaCharacterFailureReason } from '../portfolio-data.js';
import { failureKindCopyKey } from '../failure-copy.js';
import { ownerPersonaDetailQueryKey, ownerPortfolioListQueryKey } from '../../persona-detail/use-persona-detail-query.js';
import {
  acceptPersonaCreationGraphForRealmCreate,
  personaCreationGraphSourceModeLabel,
  buildPersonaCreationGraphFromDraft,
  validatePersonaCreationGraphForRealmCreate,
} from '../persona-creation-graph.js';
import {
  createCreationDraftKey,
  loadCreationDraft,
} from '../creation-draft-store.js';
import { appendLocalCreativeAssetHistory } from '../creative-asset-history.js';
import {
  getLocalAssetImportCapability,
  type LocalImportCapabilityStatus,
} from '../../assets-library/local-import-store.js';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';
import { AutosaveIndicator } from './autosave-indicator.js';
import { DescribeStage } from './describe-stage.js';
import { ReviewStage } from './review-stage.js';
import {
  createFieldErrorsFromReadiness,
  firstInvalidCreateField,
  logCreateFlowFailure,
  translateCreateFlowFailure,
  translateCreateFlowFailures,
} from './create-flow-copy.js';
import {
  createEmptyDraft,
  focusCreateField,
  ownerPromptFromDraft,
  selectedDraftKey,
} from './draft-utils.js';
import { useAutosaveDraft } from './use-autosave-draft.js';
import { useCreationDraft } from './use-creation-draft.js';
import { useHandleAvailability } from './use-handle-availability.js';
import { useDescriptionReroll, useSeedGeneration } from './use-seed-generation.js';
import { useReferenceImage } from './use-reference-image.js';
import type {
  CreateRealmPersonaWorkspaceProps,
  CreatedRealmPersonaContext,
} from './types.js';

// @nimi-authority: rule.realm-persona-studio.create-flow.r004
// @nimi-authority: rule.realm-persona-studio.create-flow.r006
export function CreateRealmPersonaWorkspace({ onCreated, onOpenCreatedPersona }: CreateRealmPersonaWorkspaceProps) {
  const { t, locale } = useStudioI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const initialDraftKey = useRef<string | null>(null);
  initialDraftKey.current ??= selectedDraftKey(location.search) || createCreationDraftKey();
  const { state, dispatch, actions } = useCreationDraft(initialDraftKey.current);
  const {
    draftKey,
    draft,
    draftLoadState,
    edited,
    stage,
    sourceMode,
    graphAcceptedFingerprint,
    seedResult,
    seedOriginalDisplayName,
    fieldErrors,
    createdContext,
    referenceImageSourceMode,
    referenceImageEditorOpen,
    referenceImageLoadFailed,
    referenceAssets,
    referenceSourceFailure,
    autosaveState,
    autosaveFailureMessage,
  } = state;
  const queryClient = useQueryClient();
  const translatorRef = useRef(t);
  translatorRef.current = t;
  const [localImportCapability] = useState<LocalImportCapabilityStatus>(() => getLocalAssetImportCapability());

  const selectedKey = selectedDraftKey(location.search);
  useEffect(() => {
    if (selectedKey) return;
    const search = new URLSearchParams(location.search);
    search.set('draft', draftKey);
    navigate({ pathname: location.pathname, search: `?${search.toString()}` }, { replace: true });
  }, [draftKey, location.pathname, location.search, navigate, selectedKey]);
  const lastLocationSearch = useRef(location.search);
  useEffect(() => {
    if (lastLocationSearch.current === location.search) return;
    lastLocationSearch.current = location.search;
    const nextKey = selectedKey || createCreationDraftKey();
    if (nextKey === draftKey) return;
    dispatch({ type: 'load-draft', draftKey: nextKey });
  }, [dispatch, draftKey, location.search, selectedKey]);

  useEffect(() => {
    let cancelled = false;
    void loadCreationDraft(draftKey).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        logCreateFlowFailure('create-flow.draft-load', result.failure);
        dispatch({ type: 'hydrate-failed', failureMessage: translateCreateFlowFailure(result.failure, translatorRef.current) });
        return;
      }
      if (result.record) {
        const { draftKey: _storedDraftKey, updatedAt: _updatedAt, ...storedDraft } = result.record;
        dispatch({ type: 'hydrate', draft: storedDraft });
      } else {
        dispatch({ type: 'hydrate', draft: createEmptyDraft() });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, draftKey]);

  const worldsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'create-persona-worlds'],
    queryFn: () => listCreateRealmPersonaSelectableWorlds(),
  });
  const worlds = worldsQuery.data || [];
  const selectableWorldIds = useMemo(() => worlds.map((world) => world.id), [worlds]);
  const selectedWorld = worlds.find((world) => world.id === draft.selectedWorldId) || null;
  // OASIS is the local default world: once the source-backed world list is
  // available and the hydrated draft has no explicit selection, pre-select it.
  // This is a system-derived default, not an owner edit — it must not flip the
  // dirty guard or trigger autosave on a pristine draft.
  useEffect(() => {
    if (draftLoadState !== 'ready' || draft.selectedWorldId || worlds.length === 0) return;
    const oasisDefaultWorld = selectOasisDefaultWorld(worlds);
    if (!oasisDefaultWorld) return;
    actions.applyDefaultWorld(oasisDefaultWorld.id);
  }, [actions, draft.selectedWorldId, draftLoadState, worlds]);
  const normalizedDraft = useMemo(() => normalizeCreateRealmPersonaDraft(draft), [draft]);
  const draftHistoryLabel = useMemo(() => {
    const label = (normalizedDraft.displayName || normalizedDraft.originalDescription)
      .replace(/\s+/g, ' ')
      .trim();
    return label.length > 80 ? `${label.slice(0, 77)}...` : label;
  }, [normalizedDraft.displayName, normalizedDraft.originalDescription]);

  const { query: handleAvailabilityQuery, availability: handleAvailability } = useHandleAvailability(normalizedDraft.handle);
  const creationGraph = useMemo(() => buildPersonaCreationGraphFromDraft(draft, {
    sourceMode,
    sourceLabel: sourceMode === 'description'
      ? (ownerPromptFromDraft(draft) || personaCreationGraphSourceModeLabel(sourceMode))
      : personaCreationGraphSourceModeLabel(sourceMode),
    runtimeRationale: seedResult?.ok ? seedResult.rationale : '',
    extraSourceFields: [],
    acceptedForCreateFingerprint: graphAcceptedFingerprint,
  }), [draft, graphAcceptedFingerprint, seedResult, sourceMode]);
  useAutosaveDraft({
    draftKey,
    draft,
    edited,
    draftLoadState,
    draftHistoryLabel,
    selectedWorldName: selectedWorld?.name,
    normalizedDraft,
    t,
    setAutosave: actions.setAutosave,
  });

  const { isGeneratingSeed, runSeedGeneration } = useSeedGeneration({
    draft,
    normalizedDraft,
    locale,
    t,
    actions,
  });
  const { isGeneratingDescription, runDescriptionReroll } = useDescriptionReroll({
    normalizedDraft,
    locale,
    t,
    isGeneratingSeed,
    updateDraft: actions.updateDraft,
  });
  const referenceImage = useReferenceImage({
    draftKey,
    draft,
    normalizedDraft,
    stage,
    localImportCapability,
    locale,
    t,
    actions,
  });

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
        actions.setFieldErrors({});
        await queryClient.invalidateQueries({ queryKey: ownerPortfolioListQueryKey() });
        try {
          await queryClient.fetchQuery({
            queryKey: ownerPersonaDetailQueryKey(result.canonical.id),
            queryFn: () => getOwnerPortfolioPersonaDetail(result.canonical.id),
          });
        } catch (error) {
          const reason = personaCharacterFailureReason(error);
          nimiToast.danger(t('create.createdPartial', {
            message: t('persona.failure.sanitized', { reason: t(failureKindCopyKey(reason)) }),
            created: t('create.createdPersonaId', { id: result.canonical.id }),
          }));
          onOpenCreatedPersona?.(result.canonical.id);
          return;
        }
        nimiToast.success(t('create.createdSuccess', { id: result.canonical.id }));
        onCreated?.(context);
        if (onOpenCreatedPersona) {
          onOpenCreatedPersona(result.canonical.id);
        } else {
          actions.setCreatedContext(context);
        }
      } else {
        nimiToast.danger(t('create.createdPartial', {
          message: t('persona.failure.sanitized', { reason: t(failureKindCopyKey(result.failure)) }),
          created: result.createdCanonical ? t('create.createdPersonaId', { id: result.createdCanonical.id }) : '',
        }));
      }
    },
  });

  function submitCreate() {
    const readiness = validateCreateRealmPersonaReadiness(draft, { selectableWorldIds, handleAvailability });
    if (!readiness.ready) {
      const nextFieldErrors = createFieldErrorsFromReadiness(readiness.errors);
      actions.setFieldErrors(nextFieldErrors);
      const firstInvalidField = firstInvalidCreateField(nextFieldErrors);
      if (firstInvalidField) {
        if (firstInvalidField === 'referenceImage') actions.setReferenceImageEditorOpen(true);
        focusCreateField(firstInvalidField);
      } else {
        for (const failure of readiness.errors) logCreateFlowFailure('create-flow.readiness', failure);
        nimiToast.danger(translateCreateFlowFailures(readiness.errors, t));
      }
      return;
    }
    const acceptedFingerprint = acceptPersonaCreationGraphForRealmCreate(creationGraph);
    const acceptedGraphReview = validatePersonaCreationGraphForRealmCreate(creationGraph, acceptedFingerprint);
    if (!acceptedGraphReview.ready) {
      for (const failure of acceptedGraphReview.errors) logCreateFlowFailure('create-flow.graph-review', failure);
      nimiToast.danger(translateCreateFlowFailures(acceptedGraphReview.errors, t));
      return;
    }
    actions.setGraphAcceptedFingerprint(acceptedFingerprint);
    actions.setFieldErrors({});
    createMutation.mutate(readiness.payload);
  }

  const createDisabled = createMutation.isPending || worldsQuery.isLoading || worldsQuery.isError || worlds.length === 0;
  const worldsUnavailable = worldsQuery.isError || (!worldsQuery.isLoading && worlds.length === 0);
  const seedPrompt = ownerPromptFromDraft(draft);

  const renderHeader = () => (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <NimiText as="h1" role="page-title" className="m-0">
        {t('create.title')}
      </NimiText>
      <AutosaveIndicator state={autosaveState} failureMessage={autosaveFailureMessage} idle={!edited && autosaveState === 'saved'} />
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
    return (
      <div className="ras-page ras-create-page ras-create-page--describe">
        <DescribeStage
          originalDescription={draft.originalDescription}
          normalizedDraft={normalizedDraft}
          seedResult={seedResult}
          isGeneratingSeed={isGeneratingSeed}
          isGeneratingDescription={isGeneratingDescription}
          updateDraft={actions.updateDraft}
          onRunSeedGeneration={() => void runSeedGeneration()}
          onRunDescriptionReroll={() => void runDescriptionReroll()}
          onSkipSeed={actions.skipSeedAndCreateManually}
        />
        <AutosaveIndicator state={autosaveState} failureMessage={autosaveFailureMessage} idle={!edited && autosaveState === 'saved'} />
      </div>
    );
  }

  return (
    <div className="ras-page ras-create-page">
      {renderHeader()}
      <ReviewStage
        draft={draft}
        normalizedDraft={normalizedDraft}
        fieldErrors={fieldErrors}
        seedOriginalDisplayName={seedOriginalDisplayName}
        createdContext={createdContext}
        referenceAssets={referenceAssets}
        referenceSourceFailure={referenceSourceFailure}
        referenceImageSourceMode={referenceImageSourceMode}
        referenceImageEditorOpen={referenceImageEditorOpen}
        referenceImageLoadFailed={referenceImageLoadFailed}
        worlds={worlds}
        worldsLoading={worldsQuery.isLoading}
        worldsUnavailable={worldsUnavailable}
        worldsRetrying={worldsQuery.isFetching}
        selectedWorld={selectedWorld}
        createDisabled={createDisabled}
        createPending={createMutation.isPending}
        handleQuery={handleAvailabilityQuery}
        handleAvailability={handleAvailability}
        referenceImage={referenceImage}
        seedPrompt={seedPrompt}
        updateDraft={actions.updateDraft}
        onSetReferenceImageEditorOpen={actions.setReferenceImageEditorOpen}
        onReturnToDescribe={actions.returnToDescribeStage}
        onRetryWorlds={() => void worldsQuery.refetch()}
        onSubmit={submitCreate}
        onOpenCreatedPersona={onOpenCreatedPersona}
      />
    </div>
  );
}
