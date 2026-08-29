import type { StudioCopyKey } from '../../i18n/studio-copy.js';

export type CreateValidationField =
  | 'displayName'
  | 'handle'
  | 'concept'
  | 'personaArchetype'
  | 'personaTraits'
  | 'selectedWorldId'
  | 'visibility'
  | 'referenceImage';

/**
 * Typed failure kinds for the create-flow call graph: reviewed create
 * readiness, creation draft + history protected storage, AI seed/description
 * candidates, reference image candidates, and the Persona Creation Graph
 * create review. Modules return these instead of English-sentences-as-protocol.
 */
export type CreateFlowFailureKind =
  // Reviewed create readiness (create-persona-draft).
  | 'handle-missing'
  | 'display-name-missing'
  | 'concept-missing'
  | 'rule-text-missing'
  | 'speech-supplement-missing'
  | 'boundary-supplement-missing'
  | 'selected-world-missing'
  | 'visibility-missing'
  | 'persona-archetype-missing'
  | 'persona-archetype-outside-closed-set'
  | 'persona-traits-outside-closed-set'
  | 'persona-traits-too-many'
  | 'reference-selection-invalid'
  | 'selected-world-not-source-backed'
  | 'handle-availability-missing'
  | 'handle-availability-stale'
  | 'handle-unavailable'
  // Creation draft protected storage (creation-draft-store).
  | 'draft-key-invalid'
  | 'draft-fields-invalid'
  | 'draft-storage-unavailable'
  | 'draft-read-failed'
  | 'draft-stored-invalid'
  | 'draft-persist-failed'
  | 'draft-candidate-invalid'
  | 'draft-candidate-slot-conflict'
  // Creation draft history protected storage (creation-draft-history).
  | 'draft-history-unavailable'
  // AI seed candidate (persona-seed-generator).
  | 'seed-generate-failed'
  | 'seed-output-invalid'
  | 'seed-required-output-missing'
  | 'seed-archetype-invalid'
  | 'seed-traits-invalid'
  // AI description candidate (persona-description-generator).
  | 'description-generate-failed'
  | 'description-invalid-output'
  // AI image prompt candidate (persona-image-prompt-optimizer).
  | 'image-prompt-optimize-failed'
  | 'image-prompt-invalid-output'
  // Reference image candidate (persona-reference-image, studio-media-candidate).
  | 'reference-prompt-empty'
  | 'reference-count-invalid'
  | 'reference-payload-invalid'
  | 'reference-local-artifact-no-url'
  | 'runtime-payload-invalid'
  | 'runtime-capability-unavailable'
  | 'runtime-route-unbound'
  | 'runtime-transport-unavailable'
  | 'runtime-output-malformed'
  | 'runtime-call-failed'
  // Persona Creation Graph create review (persona-creation-graph).
  | 'graph-missing'
  | 'graph-section-missing'
  | 'graph-write-plan-missing'
  | 'graph-write-plan-blocked'
  | 'graph-section-blocked'
  | 'graph-review-stale';

/**
 * Typed create-flow failure carrier. `detail` is the original English
 * diagnostic; it is for renderer logs only and must never be rendered.
 */
export type CreateFlowFailure = {
  kind: CreateFlowFailureKind;
  /** Create form field this failure attaches to, when one exists. */
  field?: CreateValidationField;
  /** Persona Creation Graph section key for section-scoped graph failures. */
  section?: string;
  /** English diagnostic detail for logs only; never rendered. */
  detail?: string;
};

export function createFlowFailure(
  kind: CreateFlowFailureKind,
  init: { field?: CreateValidationField; section?: string; detail?: string } = {},
): CreateFlowFailure {
  return {
    kind,
    ...(init.field ? { field: init.field } : {}),
    ...(init.section ? { section: init.section } : {}),
    ...(init.detail ? { detail: init.detail } : {}),
  };
}

/** Thrown inside create-flow modules; caught and folded into result objects. */
export class CreateFlowFailureError extends Error {
  readonly failure: CreateFlowFailure;

  constructor(failure: CreateFlowFailure) {
    super(failure.detail ?? failure.kind);
    this.name = 'CreateFlowFailureError';
    this.failure = failure;
  }
}

export function isCreateFlowFailureError(error: unknown): error is CreateFlowFailureError {
  return error instanceof CreateFlowFailureError;
}

export function createFlowFailureFromUnknown(
  kind: CreateFlowFailureKind,
  error: unknown,
  init: { field?: CreateValidationField; section?: string } = {},
): CreateFlowFailure {
  return createFlowFailure(kind, {
    ...init,
    detail: error instanceof Error ? error.message : String(error || kind),
  });
}

const CREATE_FLOW_FAILURE_COPY_KEYS: Record<CreateFlowFailureKind, StudioCopyKey> = {
  'handle-missing': 'create.error.handleMissing',
  'display-name-missing': 'create.error.displayNameMissing',
  'concept-missing': 'create.error.conceptMissing',
  'rule-text-missing': 'create.error.ruleTextMissing',
  'speech-supplement-missing': 'create.error.speechSupplementMissing',
  'boundary-supplement-missing': 'create.error.boundarySupplementMissing',
  'selected-world-missing': 'create.error.selectedWorldMissing',
  'visibility-missing': 'create.error.visibilityMissing',
  'persona-archetype-missing': 'create.error.personaArchetypeMissing',
  'persona-archetype-outside-closed-set': 'create.error.personaArchetypeOutsideClosedSet',
  'persona-traits-outside-closed-set': 'create.error.personaTraitsOutsideClosedSet',
  'persona-traits-too-many': 'create.error.personaTraitsTooMany',
  'reference-selection-invalid': 'create.error.referenceSelectionInvalid',
  'selected-world-not-source-backed': 'create.error.selectedWorldNotSourceBacked',
  'handle-availability-missing': 'create.error.handleAvailabilityMissing',
  'handle-availability-stale': 'create.error.handleAvailabilityStale',
  'handle-unavailable': 'create.error.handleAlreadyExists',
  'draft-key-invalid': 'create.error.draftKeyInvalid',
  'draft-fields-invalid': 'create.error.draftFieldsInvalid',
  'draft-storage-unavailable': 'create.error.draftStorageUnavailable',
  'draft-read-failed': 'create.error.draftStorageUnavailable',
  'draft-stored-invalid': 'create.error.draftStorageUnavailable',
  'draft-persist-failed': 'create.error.draftPersistFailed',
  'draft-candidate-invalid': 'create.error.draftCandidateInvalid',
  'draft-candidate-slot-conflict': 'create.error.draftCandidateInvalid',
  'draft-history-unavailable': 'create.error.draftHistoryPersistFailed',
  'seed-generate-failed': 'create.error.seedGenerationTransportFailed',
  'seed-output-invalid': 'create.error.seedOutputInvalid',
  'seed-required-output-missing': 'create.error.seedRequiredOutputMissing',
  'seed-archetype-invalid': 'create.error.seedArchetypeInvalid',
  'seed-traits-invalid': 'create.error.seedTraitsInvalid',
  'description-generate-failed': 'create.error.seedGenerationTransportFailed',
  'description-invalid-output': 'create.error.descriptionOutputInvalid',
  'image-prompt-optimize-failed': 'create.error.imagePromptOptimizeFailed',
  'image-prompt-invalid-output': 'create.error.imagePromptInvalidOutput',
  'reference-prompt-empty': 'create.error.referencePromptEmpty',
  'reference-count-invalid': 'create.error.referenceCountInvalid',
  'reference-payload-invalid': 'create.error.referencePayloadInvalid',
  'reference-local-artifact-no-url': 'create.error.referenceLocalArtifactNoUrl',
  'runtime-payload-invalid': 'create.error.referencePayloadInvalid',
  'runtime-capability-unavailable': 'create.error.referenceCandidateUnavailable',
  'runtime-route-unbound': 'create.error.referenceCandidateUnavailable',
  'runtime-transport-unavailable': 'create.error.referenceTransportUnavailable',
  'runtime-output-malformed': 'create.error.referenceNoArtifact',
  'runtime-call-failed': 'create.error.referenceGenerateFailed',
  'graph-missing': 'create.graph.error.graphMissing',
  'graph-section-missing': 'create.graph.error.sectionMissing',
  'graph-write-plan-missing': 'create.graph.error.writePlanMissing',
  'graph-write-plan-blocked': 'create.graph.error.writePlanBlocked',
  'graph-section-blocked': 'create.graph.error.sectionBlocked',
  'graph-review-stale': 'create.graph.error.reviewMissing',
};

/**
 * Maps a typed create-flow failure to its owner-readable copy key. The raw
 * `detail` must never be rendered; it is logged through renderer-log instead.
 */
export function createFlowFailureCopyKey(failure: CreateFlowFailure): StudioCopyKey {
  return CREATE_FLOW_FAILURE_COPY_KEYS[failure.kind] ?? 'common.operationFailed';
}
