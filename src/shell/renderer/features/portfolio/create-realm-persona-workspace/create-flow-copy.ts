import type { PersonaArchetype, PersonaTrait } from '../create-persona-draft.js';
import type { PersonaCreationGraphSectionKey } from '../persona-creation-graph.js';
import {
  createFlowFailureCopyKey,
  type CreateFlowFailure,
  type CreateValidationField,
} from '../create-flow-failure.js';
import type { StudioCopyKey } from '../../../i18n/studio-copy.js';
import { logRendererEvent } from '../../../infra/telemetry/renderer-log.js';
import type {
  CreateFieldErrors,
  CreateRealmPersonaDraftPatch,
  StudioTranslator,
} from './types.js';

export const CREATE_VALIDATION_FIELD_ORDER: readonly CreateValidationField[] = [
  'displayName',
  'handle',
  'concept',
  'personaArchetype',
  'personaTraits',
  'selectedWorldId',
  'visibility',
  'referenceImage',
];

export const CREATE_DRAFT_FIELD_TO_VALIDATION_FIELD: Partial<Record<keyof CreateRealmPersonaDraftPatch, CreateValidationField>> = {
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

export const PERSONA_ARCHETYPE_DESCRIPTION_KEYS: Record<PersonaArchetype, StudioCopyKey> = {
  CARING: 'create.personaStyle.archetype.CARING',
  PLAYFUL: 'create.personaStyle.archetype.PLAYFUL',
  INTELLECTUAL: 'create.personaStyle.archetype.INTELLECTUAL',
  CONFIDENT: 'create.personaStyle.archetype.CONFIDENT',
  MYSTERIOUS: 'create.personaStyle.archetype.MYSTERIOUS',
  ROMANTIC: 'create.personaStyle.archetype.ROMANTIC',
};

export const PERSONA_TRAIT_DESCRIPTION_KEYS: Record<PersonaTrait, StudioCopyKey> = {
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

export function translateGraphSectionTitle(sectionKey: string, t: StudioTranslator): string {
  const key = GRAPH_SECTION_TITLE_KEYS[sectionKey as PersonaCreationGraphSectionKey];
  return key ? t(key) : t('create.graph.section.unknown');
}

/**
 * Keeps the log-only English diagnostic of a typed create-flow failure in the
 * renderer log. The detail string is never rendered to owners.
 */
export function logCreateFlowFailure(area: string, failure: CreateFlowFailure): void {
  logRendererEvent({
    level: 'warn',
    area,
    message: `create-flow failure: ${failure.kind}`,
    details: {
      kind: failure.kind,
      ...(failure.field ? { field: failure.field } : {}),
      ...(failure.section ? { section: failure.section } : {}),
      ...(failure.detail ? { detail: failure.detail } : {}),
    },
  });
}

/**
 * Renders a typed create-flow failure through the single kind → copy-key
 * table. Graph section failures interpolate the translated section title.
 */
export function translateCreateFlowFailure(failure: CreateFlowFailure, t: StudioTranslator): string {
  if (failure.kind === 'graph-section-missing' || failure.kind === 'graph-section-blocked') {
    return t(createFlowFailureCopyKey(failure), { section: translateGraphSectionTitle(failure.section ?? '', t) });
  }
  return t(createFlowFailureCopyKey(failure));
}

export function translateCreateFlowFailures(failures: CreateFlowFailure[], t: StudioTranslator): string {
  return failures.map((failure) => translateCreateFlowFailure(failure, t)).join('; ');
}

export function createFieldErrorsFromReadiness(failures: CreateFlowFailure[]): CreateFieldErrors {
  const fieldErrors: CreateFieldErrors = {};
  for (const failure of failures) {
    if (failure.field && !fieldErrors[failure.field]) fieldErrors[failure.field] = failure;
  }
  return fieldErrors;
}

export function firstInvalidCreateField(fieldErrors: CreateFieldErrors): CreateValidationField | null {
  return CREATE_VALIDATION_FIELD_ORDER.find((field) => Boolean(fieldErrors[field])) || null;
}
