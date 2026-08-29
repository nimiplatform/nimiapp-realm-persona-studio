import { useMemo, useReducer } from 'react';
import type {
  CreateRealmPersonaDraftInput,
} from '../create-persona-draft.js';
import { initialReferenceImagePromptFromDraft } from '../persona-reference-image.js';
import type { PersonaSeedGenerationResult } from '../persona-seed-generator.js';
import type { PersonaCreationGraphSourceMode } from '../persona-creation-graph.js';
import type { ReferenceImageSourceMode } from '../reference-image-source-chooser.js';
import {
  CREATE_DRAFT_FIELD_TO_VALIDATION_FIELD,
} from './create-flow-copy.js';
import { createEmptyDraft } from './draft-utils.js';
import {
  DEFAULT_REFERENCE_IMAGE_SOURCE_MODE,
  type AutosaveState,
  type CreateFieldErrors,
  type CreatedRealmPersonaContext,
  type CreateRealmPersonaDraftPatchInput,
  type CreateStage,
  type DraftLoadState,
  type ReferenceAssetsState,
} from './types.js';

/**
 * Draft-scoped workspace state. Everything that must reset atomically when the
 * owner switches local drafts lives here; genuinely local UI state (popover
 * open, expanded panels, in-flight generation flags) stays in the leaf
 * component or hook that owns it.
 */
export type CreationDraftWorkspaceState = {
  draftKey: string;
  draft: CreateRealmPersonaDraftInput;
  draftLoadState: DraftLoadState;
  /** Whether the current draft content came from a real edit (or AI fill) since the last load. */
  edited: boolean;
  stage: CreateStage;
  sourceMode: PersonaCreationGraphSourceMode;
  graphAcceptedFingerprint: string | null;
  seedResult: PersonaSeedGenerationResult | null;
  seedOriginalDisplayName: string;
  fieldErrors: CreateFieldErrors;
  createdContext: CreatedRealmPersonaContext | null;
  referenceImageSourceMode: ReferenceImageSourceMode | null;
  referenceImageEditorOpen: boolean;
  referenceImageLoadFailed: boolean;
  referenceAssets: ReferenceAssetsState;
  referenceSourceFailure: string | null;
  autosaveState: AutosaveState;
  autosaveFailureMessage: string | null;
};

export type CreationDraftAction =
  | { type: 'load-draft'; draftKey: string }
  | { type: 'hydrate'; draft: CreateRealmPersonaDraftInput }
  | { type: 'hydrate-failed'; failureMessage: string }
  | { type: 'patch'; patch: CreateRealmPersonaDraftPatchInput }
  | { type: 'prepare-seed-run' }
  | { type: 'apply-seed'; result: Extract<PersonaSeedGenerationResult, { ok: true }>; seedDescription: string }
  | { type: 'set-seed-result'; result: PersonaSeedGenerationResult | null }
  | { type: 'enter-manual-review' }
  | { type: 'return-to-describe' }
  | { type: 'set-graph-fingerprint'; fingerprint: string | null }
  | { type: 'set-field-errors'; errors: CreateFieldErrors }
  | { type: 'set-created-context'; context: CreatedRealmPersonaContext | null }
  | { type: 'set-reference-source-mode'; mode: ReferenceImageSourceMode | null }
  | { type: 'set-reference-editor-open'; open: boolean }
  | { type: 'set-reference-image-load-failed'; failed: boolean }
  | { type: 'set-reference-assets-loading' }
  | { type: 'set-reference-assets'; assets: Omit<ReferenceAssetsState, 'loadState'> & { failed: boolean } }
  | { type: 'set-reference-source-failure'; message: string | null }
  | { type: 'set-autosave'; state: AutosaveState; failureMessage: string | null };

function initialReferenceAssets(): ReferenceAssetsState {
  return {
    loadState: 'idle',
    entries: [],
    unavailableCount: 0,
    sourceUnavailable: false,
  };
}

function createInitialState(draftKey: string): CreationDraftWorkspaceState {
  return {
    draftKey,
    draft: createEmptyDraft(),
    draftLoadState: 'loading',
    edited: false,
    stage: 'describe',
    sourceMode: 'description',
    graphAcceptedFingerprint: null,
    seedResult: null,
    seedOriginalDisplayName: '',
    fieldErrors: {},
    createdContext: null,
    referenceImageSourceMode: DEFAULT_REFERENCE_IMAGE_SOURCE_MODE,
    referenceImageEditorOpen: false,
    referenceImageLoadFailed: false,
    referenceAssets: initialReferenceAssets(),
    referenceSourceFailure: null,
    autosaveState: 'saved',
    autosaveFailureMessage: null,
  };
}

function resetCreateOutcome(state: CreationDraftWorkspaceState): CreationDraftWorkspaceState {
  return {
    ...state,
    fieldErrors: {},
    createdContext: null,
  };
}

function creationDraftReducer(
  state: CreationDraftWorkspaceState,
  action: CreationDraftAction,
): CreationDraftWorkspaceState {
  switch (action.type) {
    case 'load-draft':
      return createInitialState(action.draftKey);
    case 'hydrate':
      return {
        ...state,
        draft: action.draft,
        draftLoadState: 'ready',
      };
    case 'hydrate-failed':
      return {
        ...state,
        draft: createEmptyDraft(),
        draftLoadState: 'failed',
        autosaveState: 'failed',
        autosaveFailureMessage: action.failureMessage,
      };
    case 'patch': {
      const patch = typeof action.patch === 'function' ? action.patch(state.draft) : action.patch;
      const fieldErrors = { ...state.fieldErrors };
      if (typeof action.patch !== 'function') {
        for (const key of Object.keys(patch)) {
          const field = CREATE_DRAFT_FIELD_TO_VALIDATION_FIELD[key as keyof CreateRealmPersonaDraftInput];
          if (field) delete fieldErrors[field];
        }
      }
      return {
        ...state,
        draft: { ...state.draft, ...patch },
        edited: true,
        graphAcceptedFingerprint: null,
        createdContext: null,
        referenceImageLoadFailed: false,
        fieldErrors,
      };
    }
    case 'prepare-seed-run':
      return resetCreateOutcome({
        ...state,
        seedResult: null,
        sourceMode: 'description',
        graphAcceptedFingerprint: null,
      });
    case 'apply-seed': {
      const { result, seedDescription } = action;
      const current = state.draft;
      const nextDraft: CreateRealmPersonaDraftInput = {
        ...current,
        handle: current.handle.trim() ? current.handle : result.seed.handle,
        displayName: current.displayName.trim() ? current.displayName : result.seed.displayName,
        concept: current.concept.trim() ? current.concept : result.seed.concept,
        description: current.description.trim() ? current.description : result.seed.description,
        ruleText: current.ruleText.trim() ? current.ruleText : result.seed.ruleText,
        personaArchetype: current.personaArchetype.trim() ? current.personaArchetype : result.seed.personaArchetype,
        personaTraits: current.personaTraits.length > 0 ? current.personaTraits : result.seed.personaTraits,
        originalDescription: seedDescription,
        speechSupplement: current.speechSupplement?.trim() ? current.speechSupplement : result.seed.speechStyle,
        boundarySupplement: current.boundarySupplement?.trim() ? current.boundarySupplement : result.seed.behaviorBoundary,
      };
      return {
        ...state,
        draft: {
          ...nextDraft,
          referenceImagePrompt: current.referenceImagePrompt.trim()
            || initialReferenceImagePromptFromDraft(nextDraft),
        },
        edited: true,
        seedResult: result,
        seedOriginalDisplayName: result.seed.displayName,
        stage: 'review',
      };
    }
    case 'set-seed-result':
      return { ...state, seedResult: action.result };
    case 'enter-manual-review':
      return resetCreateOutcome({
        ...state,
        sourceMode: 'manual',
        graphAcceptedFingerprint: null,
        seedResult: null,
        seedOriginalDisplayName: '',
        edited: true,
        referenceImageLoadFailed: false,
        draft: {
          ...state.draft,
          referenceImagePrompt: state.draft.referenceImagePrompt.trim()
            || initialReferenceImagePromptFromDraft(state.draft),
        },
        stage: 'review',
      });
    case 'return-to-describe':
      return resetCreateOutcome({
        ...state,
        stage: 'describe',
        graphAcceptedFingerprint: null,
      });
    case 'set-graph-fingerprint':
      return { ...state, graphAcceptedFingerprint: action.fingerprint };
    case 'set-field-errors':
      return { ...state, fieldErrors: action.errors };
    case 'set-created-context':
      return { ...state, createdContext: action.context };
    case 'set-reference-source-mode':
      return { ...state, referenceImageSourceMode: action.mode, referenceSourceFailure: null };
    case 'set-reference-editor-open':
      return { ...state, referenceImageEditorOpen: action.open };
    case 'set-reference-image-load-failed':
      return { ...state, referenceImageLoadFailed: action.failed };
    case 'set-reference-assets-loading':
      return { ...state, referenceAssets: { ...state.referenceAssets, loadState: 'loading' } };
    case 'set-reference-assets':
      return {
        ...state,
        referenceAssets: {
          loadState: action.assets.failed && action.assets.entries.length === 0 ? 'failed' : 'ready',
          entries: action.assets.entries,
          unavailableCount: action.assets.unavailableCount,
          sourceUnavailable: action.assets.sourceUnavailable,
        },
      };
    case 'set-reference-source-failure':
      return { ...state, referenceSourceFailure: action.message };
    case 'set-autosave':
      return { ...state, autosaveState: action.state, autosaveFailureMessage: action.failureMessage };
    default:
      return state;
  }
}

export function useCreationDraft(initialDraftKey: string) {
  const [state, dispatch] = useReducer(creationDraftReducer, initialDraftKey, createInitialState);

  const actions = useMemo(() => ({
    updateDraft(patch: CreateRealmPersonaDraftPatchInput) {
      dispatch({ type: 'patch', patch });
    },
    setStageReviewViaSeed(result: Extract<PersonaSeedGenerationResult, { ok: true }>, seedDescription: string) {
      dispatch({ type: 'apply-seed', result, seedDescription });
    },
    setSeedResult(result: PersonaSeedGenerationResult | null) {
      dispatch({ type: 'set-seed-result', result });
    },
    prepareSeedRun() {
      dispatch({ type: 'prepare-seed-run' });
    },
    skipSeedAndCreateManually() {
      dispatch({ type: 'enter-manual-review' });
    },
    returnToDescribeStage() {
      dispatch({ type: 'return-to-describe' });
    },
    setGraphAcceptedFingerprint(fingerprint: string | null) {
      dispatch({ type: 'set-graph-fingerprint', fingerprint });
    },
    setFieldErrors(errors: CreateFieldErrors) {
      dispatch({ type: 'set-field-errors', errors });
    },
    setCreatedContext(context: CreatedRealmPersonaContext | null) {
      dispatch({ type: 'set-created-context', context });
    },
    setReferenceImageSourceMode(mode: ReferenceImageSourceMode | null) {
      dispatch({ type: 'set-reference-source-mode', mode });
    },
    setReferenceImageEditorOpen(open: boolean) {
      dispatch({ type: 'set-reference-editor-open', open });
    },
    setReferenceImageLoadFailed(failed: boolean) {
      dispatch({ type: 'set-reference-image-load-failed', failed });
    },
    setReferenceAssetsLoading() {
      dispatch({ type: 'set-reference-assets-loading' });
    },
    setReferenceAssets(assets: Omit<ReferenceAssetsState, 'loadState'> & { failed: boolean }) {
      dispatch({ type: 'set-reference-assets', assets });
    },
    setReferenceSourceFailure(message: string | null) {
      dispatch({ type: 'set-reference-source-failure', message });
    },
    setAutosave(state: AutosaveState, failureMessage: string | null) {
      dispatch({ type: 'set-autosave', state, failureMessage });
    },
  }), []);

  return { state, dispatch, actions };
}
