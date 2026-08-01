import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, FieldShell, InlineAlert, nimiToast, SelectField, StatusBadge, Surface, TextareaField, TextField } from '@nimiplatform/kit/ui';
import {
  PERSONA_ARCHETYPES,
  PERSONA_TRAIT_MAX_RECOMMENDED,
  PERSONA_TRAITS,
  normalizeCreateRealmPersonaDraft,
  selectOasisDefaultWorld,
  validateCreateRealmPersonaReadiness,
  type CreateRealmPersonaDraftInput,
  type PersonaArchetype,
  type PersonaTrait,
  type NormalizedRealmPersonaHandleAvailability,
  type ReviewedCreateRealmPersonaPayload,
  type SelectableRealmWorld,
} from './create-persona-draft.js';
import {
  checkCreateRealmPersonaHandleAvailability,
  createReviewedRealmPersonaWithProfileSettings,
  getCreateRealmPersonaWorldPreview,
  listCreateRealmPersonaSelectableWorlds,
  type RealmPersonaHandleAvailabilityResult,
  type RealmPersonaCreateWithProfileSettingsResult,
} from './portfolio-client.js';
import {
  generatePersonaSeedFromDescription,
  type PersonaSeedGenerationResult,
} from './persona-seed-generator.js';
import {
  acceptPersonaCreationGraphForRealmCreate,
  personaCreationGraphSourceModeLabel,
  buildPersonaCreationGraphFromDraft,
  validatePersonaCreationGraphForRealmCreate,
  type PersonaCreationGraph,
  type PersonaCreationGraphCreateReview,
  type PersonaCreationGraphSectionKey,
  type PersonaCreationGraphSourceMode,
} from './persona-creation-graph.js';
import {
  defaultReferenceImagePromptFromDraft,
  generatePersonaReferenceImage,
} from './persona-reference-image.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import type { StudioTranslateOptions } from '../../i18n/studio-i18n.js';

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

const GRAPH_SOURCE_MODE_KEYS: Record<PersonaCreationGraphSourceMode, StudioCopyKey> = {
  description: 'create.graph.sourceMode.description',
  manual: 'create.graph.sourceMode.manual',
};

const GRAPH_FIELD_STATUS_KEYS: Record<PersonaCreationGraph['sourcePackage']['fields'][number]['status'], StudioCopyKey> = {
  mapped: 'create.graph.fieldStatus.mapped',
  candidateOnly: 'create.graph.fieldStatus.candidateOnly',
  unmapped: 'create.graph.fieldStatus.unmapped',
  rejected: 'create.graph.fieldStatus.rejected',
};

const GRAPH_SOURCE_FIELD_KEYS: Record<string, StudioCopyKey> = {
  ownerDescription: 'create.graph.sourceField.ownerDescription',
  displayName: 'create.graph.sourceField.displayName',
  handle: 'create.graph.sourceField.handle',
  concept: 'create.graph.sourceField.concept',
  description: 'create.graph.sourceField.description',
  ruleText: 'create.graph.sourceField.ruleText',
  referenceImageUrl: 'create.graph.sourceField.referenceImageUrl',
  runtimeRationale: 'create.graph.sourceField.runtimeRationale',
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

const GRAPH_SECTION_SUMMARY_KEYS: Record<string, StudioCopyKey> = {
  'Public identity fields are ready for owner review.': 'create.graph.section.identity.ready',
  'Public identity fields are not ready.': 'create.graph.section.identity.missing',
  'Persona style archetype is selected.': 'create.graph.section.personaStyle.ready',
  'Persona style archetype is missing.': 'create.graph.section.personaStyle.missing',
  'Visible behavior notes will stay owner-reviewed.': 'create.graph.section.behavior.ready',
  'No behavior notes were supplied.': 'create.graph.section.behavior.missing',
  'Concept can anchor the public persona worldview.': 'create.graph.section.worldview.ready',
  'Concept is missing.': 'create.graph.section.worldview.missing',
  'Greeting remains a follow-up owner settings candidate after create.': 'create.graph.section.greeting.summary',
  'Voice can be inferred for review from concept and behavior notes.': 'create.graph.section.communicationVoice.ready',
  'Voice needs owner input.': 'create.graph.section.communicationVoice.missing',
  'Content voice is retained as a post-studio candidate, not a create write.': 'create.graph.section.contentVoice.summary',
  'A reviewed reference image URL is ready as create input.': 'create.graph.section.visualBrief.ready',
  'Visual brief remains optional candidate material.': 'create.graph.section.visualBrief.missing',
  'Voice demo belongs to Identity Studio and remains candidate-only in create.': 'create.graph.section.voiceBrief.summary',
  'Post ideas belong to Content Studio and remain candidate-only in create.': 'create.graph.section.postBrief.summary',
  'Unresolved decisions are explicit and do not block create unless they are required Realm create fields.': 'create.graph.section.missingDecisions.summary',
  'No hidden provider, model, lifecycle, private memory, or raw rule-content fields are admitted.': 'create.graph.section.riskNotes.summary',
  'Accepted fields map to admitted Realm write paths; blocked and deferred fields remain explicit.': 'create.graph.section.writePlan.summary',
};

const GRAPH_MISSING_KEYS: Record<string, StudioCopyKey> = {
  'display name': 'create.graph.missing.displayName',
  handle: 'create.graph.missing.handle',
  'Persona archetype': 'create.graph.missing.personaArchetype',
  'behavior boundaries': 'create.graph.missing.behaviorBoundaries',
  concept: 'create.graph.missing.concept',
  'greeting candidate': 'create.graph.missing.greetingCandidate',
  'communication voice': 'create.graph.missing.communicationVoice',
  'content voice examples': 'create.graph.missing.contentVoiceExamples',
  'avatar/profile cover visual brief': 'create.graph.missing.avatarProfileCoverVisualBrief',
  'voice brief': 'create.graph.missing.voiceBrief',
  'first post brief': 'create.graph.missing.firstPostBrief',
  'profile description': 'create.graph.missing.profileDescription',
  'visual reference': 'create.graph.missing.visualReference',
  greeting: 'create.graph.missing.greeting',
  'Realm create required fields': 'create.graph.missing.realmCreateRequiredFields',
};

const CREATE_FIXED_MESSAGE_KEYS: Record<string, StudioCopyKey> = {
  'handle missing': 'create.error.handleMissing',
  'display name missing': 'create.error.displayNameMissing',
  'concept missing': 'create.error.conceptMissing',
  'selected world missing': 'create.error.selectedWorldMissing',
  'persona archetype missing': 'create.error.personaArchetypeMissing',
  'selected world not source-backed by WorldCoreController.listWorldCores': 'create.error.selectedWorldNotSourceBacked',
  'handle availability not checked by WorldCoreController.listRealmPersonas': 'create.error.handleAvailabilityMissing',
  'handle availability not checked for the current normalized handle': 'create.error.handleAvailabilityStale',
  'Persona handle check requires a non-empty normalized handle.': 'create.error.handleAvailabilityEmpty',
  'Realm handle availability check did not return an availability boolean.': 'create.error.handleAvailabilityMissingBoolean',
  'Realm handle availability check failed.': 'create.error.handleAvailabilityFailed',
  'Realm create RealmPersona returned no persona object.': 'create.error.realmCreateNoPersona',
  'Realm create RealmPersona returned no canonical persona id.': 'create.error.realmCreateNoId',
  'Realm create RealmPersona failed.': 'create.error.realmCreateFailed',
  'Realm owner settings read failed after create.': 'create.error.ownerSettingsReadFailed',
  'reference image prompt empty': 'create.error.referencePromptEmpty',
  'Reference image payload invalid.': 'create.error.referencePayloadInvalid',
  'Runtime imageGenerate scenario transport unavailable: Tauri IPC runtime transport is required.': 'create.error.referenceTransportUnavailable',
  'Runtime imageGenerate scenario returned no readable artifact.': 'create.error.referenceNoArtifact',
  'Runtime imageGenerate produced a local artifact but no http(s) URL that Realm can store as a public reference image.': 'create.error.referenceLocalArtifactNoUrl',
};

function translateGraphSourceMode(mode: PersonaCreationGraphSourceMode, t: StudioTranslator): string {
  return t(GRAPH_SOURCE_MODE_KEYS[mode]);
}

function translateGraphSourceLabel(label: string, t: StudioTranslator): string {
  const rawSourceLabels: Record<string, StudioCopyKey> = {
    'Owner description': 'create.graph.sourceMode.description',
    'Manual advanced entry': 'create.graph.sourceMode.manual',
  };
  const key = rawSourceLabels[label];
  return key ? t(key) : label;
}

function translateGraphSourceField(
  field: PersonaCreationGraph['sourcePackage']['fields'][number],
  t: StudioTranslator,
): string {
  const key = GRAPH_SOURCE_FIELD_KEYS[field.key];
  return key ? t(key) : field.label;
}

function translateGraphSectionTitle(sectionKey: PersonaCreationGraphSectionKey, t: StudioTranslator): string {
  return t(GRAPH_SECTION_TITLE_KEYS[sectionKey]);
}

function translateGraphSectionSummary(
  section: PersonaCreationGraph['normalizedGraph']['sections'][number],
  graph: PersonaCreationGraph,
  t: StudioTranslator,
): string {
  if (section.key === 'sourceProvenance') {
    return t('create.graph.section.sourceProvenance.summary', {
      source: translateGraphSourceLabel(graph.sourcePackage.label, t),
    });
  }
  const key = GRAPH_SECTION_SUMMARY_KEYS[section.summary];
  return key ? t(key) : section.summary;
}

function translateGraphMissingItem(item: string, t: StudioTranslator): string {
  const key = GRAPH_MISSING_KEYS[item];
  return key ? t(key) : item;
}

function translateGraphReviewError(error: string, t: StudioTranslator): string {
  if (error === 'Persona Creation Graph missing (R-RPS-GRAPH-003).') return t('create.graph.error.graphMissing');
  if (error === 'Persona Creation Graph write plan missing Realm create target (R-RPS-GRAPH-017).') return t('create.graph.error.writePlanMissing');
  if (error === 'Persona Creation Graph write plan is blocked for Realm create (R-RPS-GRAPH-017).') return t('create.graph.error.writePlanBlocked');
  if (error === 'Persona Creation Graph review missing or stale (R-RPS-GRAPH-019).') return t('create.graph.error.reviewMissing');

  const missingSection = error.match(/^Persona Creation Graph section missing: (.+) \(R-RPS-GRAPH-016\)\.$/);
  if (missingSection) {
    return t('create.graph.error.sectionMissing', { section: missingSection[1] });
  }

  const blockedSection = error.match(/^Persona Creation Graph (.+) section is blocked \(R-RPS-GRAPH-027\)\.$/);
  if (blockedSection) {
    return t('create.graph.error.sectionBlocked', { section: blockedSection[1] });
  }

  return error;
}

function translateGraphReviewErrors(errors: string[], t: StudioTranslator): string {
  return errors.map((error) => translateGraphReviewError(error, t)).join('; ');
}

function translateCreateFixedMessage(message: string, t: StudioTranslator): string {
  const handleUnavailable = message.match(/^handle unavailable: (.+)$/);
  if (handleUnavailable) {
    return t('create.error.handleUnavailable', { message: handleUnavailable[1] });
  }
  const key = CREATE_FIXED_MESSAGE_KEYS[message];
  return key ? t(key) : message;
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
    originalDescription: '',
  };
}

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

function worldOptionLabel(world: SelectableRealmWorld): string {
  const type = world.type ? ` · ${world.type}` : '';
  return `${world.name}${type}`;
}

function TechnicalReviewDetails({ children }: { children: ReactNode }) {
  const { t } = useStudioI18n();
  return (
    <details className="ras-technical-details">
      <summary>{t('create.technicalDetails')}</summary>
      <div className="mt-3">
        {children}
      </div>
    </details>
  );
}

function ReadinessPreview({
  draft,
  selectableWorldIds,
  handleAvailability,
}: {
  draft: CreateRealmPersonaDraftInput;
  selectableWorldIds: string[];
  handleAvailability: NormalizedRealmPersonaHandleAvailability | null;
}) {
  const { t } = useStudioI18n();
  const normalizedDraft = normalizeCreateRealmPersonaDraft(draft);
  const readiness = validateCreateRealmPersonaReadiness(draft, { selectableWorldIds, handleAvailability });

  return (
    <div className="grid gap-4">
      <Surface tone="card" padding="md">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-medium">{t('create.visiblePublicFields')}</div>
          <StatusBadge tone="info">{t('create.localDraft')}</StatusBadge>
        </div>
        <dl className="mt-3 grid gap-2 text-[length:var(--nimi-type-body-sm-size)]">
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="text-[var(--nimi-text-muted)]">{t('create.handleField')}</dt>
            <dd className="ras-break-anywhere m-0">@{normalizedDraft.handle || t('common.notSet')}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="text-[var(--nimi-text-muted)]">{t('create.displayNameLabel')}</dt>
            <dd className="ras-break-anywhere m-0">{normalizedDraft.displayName || t('common.notSet')}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="text-[var(--nimi-text-muted)]">{t('create.profileDescriptionLabel')}</dt>
            <dd className="ras-break-anywhere m-0">{normalizedDraft.description || t('common.notSet')}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="text-[var(--nimi-text-muted)]">{t('create.worldIdField')}</dt>
            <dd className="ras-break-anywhere m-0">{normalizedDraft.selectedWorldId || t('common.notSet')}</dd>
          </div>
        </dl>
      </Surface>

      {readiness.ready ? null : (
        <InlineAlert tone="warning">{translateCreateFixedMessages(readiness.errors, t)}</InlineAlert>
      )}
      <TechnicalReviewDetails>
        <pre className="ras-json-preview m-0 min-h-56 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs">
          {readiness.payload ? JSON.stringify(readiness.payload, null, 2) : t('create.completeForPreview')}
        </pre>
      </TechnicalReviewDetails>
    </div>
  );
}

const SOURCE_MODE_OPTIONS: Array<{
  mode: PersonaCreationGraphSourceMode;
  titleKey: StudioCopyKey;
  descriptionKey: StudioCopyKey;
  enabled: boolean;
  badge: string;
}> = [
  {
    mode: 'description',
    titleKey: 'create.source.description.title',
    descriptionKey: 'create.source.description.description',
    enabled: true,
    badge: 'W2',
  },
  {
    mode: 'manual',
    titleKey: 'create.source.manual.title',
    descriptionKey: 'create.source.manual.description',
    enabled: true,
    badge: 'W2',
  },
];

function SourceModeChooser({
  value,
  onSelect,
}: {
  value: PersonaCreationGraphSourceMode;
  onSelect: (mode: PersonaCreationGraphSourceMode) => void;
}) {
  const { t } = useStudioI18n();
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {SOURCE_MODE_OPTIONS.map((option) => {
        const active = option.mode === value;
        return (
          <button
            key={option.mode}
            type="button"
            disabled={!option.enabled}
            onClick={() => onSelect(option.mode)}
            style={{
              minHeight: 116,
              padding: 14,
              borderRadius: 8,
              border: `1px solid ${active ? 'var(--nimi-action-primary-bg)' : 'var(--nimi-border-subtle)'}`,
              background: active
                ? 'color-mix(in srgb, var(--nimi-action-primary-bg) 12%, var(--nimi-surface-card))'
                : 'var(--nimi-surface-card)',
              color: option.enabled ? 'var(--nimi-text-primary)' : 'var(--nimi-text-muted)',
              textAlign: 'left',
              cursor: option.enabled ? 'pointer' : 'not-allowed',
              opacity: option.enabled ? 1 : 0.58,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span style={{ fontWeight: 650 }}>{t(option.titleKey)}</span>
              <StatusBadge tone={option.enabled ? 'info' : 'neutral'}>{option.badge}</StatusBadge>
            </div>
            <p className="m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
              {t(option.descriptionKey)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function GraphStatusBadge({ status }: { status: PersonaCreationGraph['normalizedGraph']['sections'][number]['status'] }) {
  const { t } = useStudioI18n();
  if (status === 'ready') return <StatusBadge tone="success">{t('create.graph.status.ready')}</StatusBadge>;
  if (status === 'blocked') return <StatusBadge tone="warning">{t('create.graph.status.blocked')}</StatusBadge>;
  return <StatusBadge tone="neutral">{t('create.graph.status.needsDecision')}</StatusBadge>;
}

function GraphReviewBoard({
  graph,
  review,
  onAccept,
}: {
  graph: PersonaCreationGraph;
  review: PersonaCreationGraphCreateReview;
  onAccept: () => void;
}) {
  const { t } = useStudioI18n();
  return (
    <Surface tone="card" padding="md">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium">{t('create.graph.title')}</div>
              <StatusBadge tone={review.ready ? 'success' : review.canAccept ? 'info' : 'warning'}>
                {review.ready ? t('create.graph.accepted') : review.canAccept ? t('create.graph.reviewRequired') : t('create.graph.blocked')}
              </StatusBadge>
            </div>
            <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
              {translateGraphSourceMode(graph.sourcePackage.mode, t)} · {translateGraphSourceLabel(graph.sourcePackage.label, t)}
            </p>
          </div>
          <Button tone="secondary" size="sm" disabled={!review.canAccept || review.ready} onClick={onAccept}>
            {review.ready ? t('create.graph.graphAccepted') : t('create.graph.acceptGraph')}
          </Button>
        </div>

        {review.shapeErrors.length > 0 ? (
          <InlineAlert tone="danger">{translateGraphReviewErrors(review.shapeErrors, t)}</InlineAlert>
        ) : review.reviewErrors.length > 0 ? (
          <InlineAlert tone="warning">{translateGraphReviewErrors(review.reviewErrors, t)}</InlineAlert>
        ) : (
          <InlineAlert tone="success">{t('create.graph.acceptedAlert')}</InlineAlert>
        )}

        <div className="grid gap-2">
          <div className="font-medium">{t('create.graph.sourceMapping')}</div>
          {graph.sourcePackage.fields.length > 0 ? (
            <div className="grid gap-2">
              {graph.sourcePackage.fields.slice(0, 6).map((item) => (
                <div
                  key={item.key}
                  className="grid gap-1 rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-raised)] p-2 text-[length:var(--nimi-type-body-sm-size)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{translateGraphSourceField(item, t)}</span>
                    <StatusBadge tone={item.status === 'mapped' ? 'success' : 'neutral'}>{t(GRAPH_FIELD_STATUS_KEYS[item.status])}</StatusBadge>
                  </div>
                  <div className="ras-break-anywhere text-[var(--nimi-text-muted)]">{item.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <InlineAlert tone="warning">{t('create.graph.noSourceFields')}</InlineAlert>
          )}
        </div>

        <div className="grid gap-2">
          <div className="font-medium">{t('create.graph.reviewSections')}</div>
          <div className="grid gap-2">
            {graph.normalizedGraph.sections.map((section) => (
              <div
                key={section.key}
                className="rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-raised)] p-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{translateGraphSectionTitle(section.key, t)}</span>
                  <GraphStatusBadge status={section.status} />
                </div>
                <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                  {translateGraphSectionSummary(section, graph, t)}
                </p>
                {section.missing.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {section.missing.slice(0, 4).map((item) => (
                      <StatusBadge key={item} tone="neutral">{translateGraphMissingItem(item, t)}</StatusBadge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <TechnicalReviewDetails>
          <pre className="ras-json-preview m-0 max-h-72 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs">
            {JSON.stringify({
              sourcePackage: graph.sourcePackage,
              writePlan: graph.writePlan,
              provenance: graph.provenance,
            }, null, 2)}
          </pre>
        </TechnicalReviewDetails>
      </div>
    </Surface>
  );
}

type CreateStage = 'seed' | 'edit';

export function CreateRealmPersonaWorkspace({ onCreated, onOpenCreatedPersona }: CreateRealmPersonaWorkspaceProps) {
  const { t } = useStudioI18n();
  const [stage, setStage] = useState<CreateStage>('seed');
  const [sourceMode, setSourceMode] = useState<PersonaCreationGraphSourceMode>('description');
  const [graphAcceptedFingerprint, setGraphAcceptedFingerprint] = useState<string | null>(null);
  const [seedDescription, setSeedDescription] = useState<string>('');
  const [seedResult, setSeedResult] = useState<PersonaSeedGenerationResult | null>(null);
  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [referenceImagePrompt, setReferenceImagePrompt] = useState<string>('');
  const [isGeneratingReferenceImage, setIsGeneratingReferenceImage] = useState(false);
  const [draft, setDraft] = useState<CreateRealmPersonaDraftInput>(() => createEmptyDraft());
  const [createdContext, setCreatedContext] = useState<CreatedRealmPersonaContext | null>(null);
  const [localSubmitErrors, setLocalSubmitErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const worldsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'create-persona-worlds'],
    queryFn: () => listCreateRealmPersonaSelectableWorlds(),
  });

  const worlds = worldsQuery.data || [];
  const selectableWorldIds = useMemo(() => worlds.map((world) => world.id), [worlds]);
  const oasisWorld = useMemo(() => selectOasisDefaultWorld(worlds), [worlds]);
  const selectedWorld = worlds.find((world) => world.id === draft.selectedWorldId) || null;
  const selectedWorldId = draft.selectedWorldId;
  const normalizedDraft = useMemo(() => normalizeCreateRealmPersonaDraft(draft), [draft]);

  const worldPreviewQuery = useQuery({
    queryKey: ['realm-persona-studio', 'create-persona-world-preview', selectedWorldId],
    queryFn: () => getCreateRealmPersonaWorldPreview(selectedWorldId),
    enabled: selectedWorldId.length > 0 && Boolean(selectedWorld),
  });
  const handleAvailabilityQuery = useQuery<RealmPersonaHandleAvailabilityResult>({
    queryKey: ['realm-persona-studio', 'create-persona-handle-availability', normalizedDraft.handle],
    queryFn: () => checkCreateRealmPersonaHandleAvailability(normalizedDraft.handle),
    enabled: normalizedDraft.handle.length > 0,
  });
  const handleAvailability = handleAvailabilityQuery.data?.ok ? handleAvailabilityQuery.data.availability : null;
  const creationGraph = useMemo(() => buildPersonaCreationGraphFromDraft(draft, {
    sourceMode,
    sourceLabel: sourceMode === 'description'
      ? (draft.originalDescription || seedDescription || personaCreationGraphSourceModeLabel(sourceMode))
      : personaCreationGraphSourceModeLabel(sourceMode),
    runtimeRationale: seedResult?.ok ? seedResult.rationale : '',
    extraSourceFields: [],
    acceptedForCreateFingerprint: graphAcceptedFingerprint,
  }), [draft, graphAcceptedFingerprint, seedDescription, seedResult, sourceMode]);
  const creationGraphReview = useMemo(
    () => validatePersonaCreationGraphForRealmCreate(creationGraph, graphAcceptedFingerprint),
    [creationGraph, graphAcceptedFingerprint],
  );

  useEffect(() => {
    if (!draft.selectedWorldId && oasisWorld) {
      setDraft((current) => current.selectedWorldId ? current : { ...current, selectedWorldId: oasisWorld.id });
    }
  }, [draft.selectedWorldId, oasisWorld]);

  const handleAvailabilityData = handleAvailabilityQuery.data;
  useEffect(() => {
    if (!handleAvailabilityData) {
      return;
    }
    if (!handleAvailabilityData.ok) {
      nimiToast.danger(translateCreateFixedMessage(handleAvailabilityData.message, t));
      return;
    }
    if (handleAvailabilityData.availability.available) {
      nimiToast.success(t('create.handleAvailable', { handle: handleAvailabilityData.availability.normalized }));
    } else {
      nimiToast.danger(t('create.handleUnavailable', {
        handle: handleAvailabilityData.availability.normalized,
        message: translateCreateFixedMessage(handleAvailabilityData.availability.message, t),
      }));
    }
  }, [handleAvailabilityData, t]);

  function resetCreateOutcome() {
    setLocalSubmitErrors([]);
    setCreatedContext(null);
  }

  function updateDraft(patch: Partial<CreateRealmPersonaDraftInput>) {
    setDraft((current) => ({ ...current, ...patch }));
    setGraphAcceptedFingerprint(null);
    resetCreateOutcome();
  }

  function selectSourceMode(mode: PersonaCreationGraphSourceMode) {
    setSourceMode(mode);
    setGraphAcceptedFingerprint(null);
    resetCreateOutcome();
    if (mode !== 'description') setSeedResult(null);
  }

  const createMutation = useMutation<RealmPersonaCreateWithProfileSettingsResult, Error, ReviewedCreateRealmPersonaPayload>({
    mutationFn: (payload) => createReviewedRealmPersonaWithProfileSettings(payload),
    onSuccess: (result) => {
      if (result.ok) {
        nimiToast.success(t('create.createdSuccess', { id: result.canonical.id, status: result.profileSettings.status }));
        if (result.profileSettings.status !== 'not-requested') {
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
          created: result.createdCanonical
            ? t('create.createdPersonaId', { id: result.createdCanonical.id })
            : '',
        }));
      }
    },
  });

  function submitCreate() {
    if (!creationGraphReview.ready) {
      setLocalSubmitErrors(creationGraphReview.errors);
      return;
    }
    const readiness = validateCreateRealmPersonaReadiness(draft, { selectableWorldIds, handleAvailability });
    if (!readiness.ready) {
      setLocalSubmitErrors(readiness.errors);
      return;
    }
    setLocalSubmitErrors([]);
    createMutation.mutate(readiness.payload);
  }

  async function runSeedGeneration() {
    setIsGeneratingSeed(true);
    setSeedResult(null);
    setSourceMode('description');
    setGraphAcceptedFingerprint(null);
    resetCreateOutcome();
    try {
      const result = await generatePersonaSeedFromDescription(seedDescription);
      setSeedResult(result);
      if (result.ok) {
        // Merge generated fields into draft, preserve manually-typed defaults
        // (selectedWorldId stays empty so OASIS auto-fill effect kicks in).
        setDraft((current) => ({
          ...current,
          handle: result.seed.handle || current.handle,
          displayName: result.seed.displayName || current.displayName,
          concept: result.seed.concept || current.concept,
          description: result.seed.description || current.description,
          ruleText: result.seed.ruleText || current.ruleText,
          personaArchetype: result.seed.personaArchetype || current.personaArchetype,
          personaTraits: result.seed.personaTraits.length > 0 ? result.seed.personaTraits : current.personaTraits,
          originalDescription: seedDescription.trim(),
        }));
        // Seed the reference image prompt as well.
        setReferenceImagePrompt(defaultReferenceImagePromptFromDraft({
          description: seedDescription,
          displayName: result.seed.displayName,
          concept: result.seed.concept,
          personaArchetype: result.seed.personaArchetype || '',
        }));
        setStage('edit');
      } else {
        nimiToast.danger(t('create.seedGenerationFailed', { message: result.message }));
      }
    } finally {
      setIsGeneratingSeed(false);
    }
  }

  function skipSeedAndCreateManually() {
    setSourceMode('manual');
    setGraphAcceptedFingerprint(null);
    setSeedResult(null);
    resetCreateOutcome();
    setDraft((current) => ({
      ...current,
      originalDescription: seedDescription.trim() || current.originalDescription,
    }));
    setReferenceImagePrompt(defaultReferenceImagePromptFromDraft({
      description: seedDescription,
      displayName: draft.displayName,
      concept: draft.concept,
      personaArchetype: draft.personaArchetype,
    }));
    setStage('edit');
  }

  function returnToSeedStage() {
    setStage('seed');
    setGraphAcceptedFingerprint(null);
    resetCreateOutcome();
  }

  async function runReferenceImageGeneration() {
    setIsGeneratingReferenceImage(true);
    try {
      const prompt = referenceImagePrompt.trim()
        || defaultReferenceImagePromptFromDraft({
          description: draft.originalDescription,
          displayName: draft.displayName,
          concept: draft.concept,
          personaArchetype: draft.personaArchetype,
        });
      const result = await generatePersonaReferenceImage({ prompt });
      if (result.ok) {
        setGraphAcceptedFingerprint(null);
        resetCreateOutcome();
        setDraft((current) => ({ ...current, referenceImageUrl: result.referenceImageUrl }));
      } else {
        nimiToast.danger(t('create.referenceFailed', { message: translateCreateFixedMessage(result.message, t) }));
      }
    } finally {
      setIsGeneratingReferenceImage(false);
    }
  }

  function clearReferenceImage() {
    setGraphAcceptedFingerprint(null);
    resetCreateOutcome();
    setDraft((current) => ({ ...current, referenceImageUrl: '' }));
  }

  const readiness = validateCreateRealmPersonaReadiness(draft, { selectableWorldIds, handleAvailability });
  const handleCheckBlocking = Boolean(normalizedDraft.handle)
    && (handleAvailabilityQuery.isLoading || handleAvailabilityQuery.isError || !handleAvailability?.available);
  const createDisabled = createMutation.isPending || worldsQuery.isLoading || worlds.length === 0 || !selectedWorld || !readiness.ready || !creationGraphReview.ready || handleCheckBlocking;

  if (stage === 'seed') {
    return (
      <Surface tone="panel" padding="lg" className="min-w-0">
        <div className="grid min-w-0 gap-5">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h2 className="m-0 text-xl font-semibold">{t('create.title')}</h2>
            <StatusBadge tone="info">{t('create.creationGraph')}</StatusBadge>
            <StatusBadge tone="neutral">{t('create.sourceFirst')}</StatusBadge>
          </div>
          <p className="m-0 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {t('create.seedDescription')}
          </p>
          <SourceModeChooser value={sourceMode} onSelect={selectSourceMode} />
          {sourceMode === 'description' ? (
            <>
              <FieldShell
                label={t('create.oneLineLabel')}
                message={t('create.oneLineExample')}
              >
                <TextareaField
                  value={seedDescription}
                  placeholder={t('create.oneLinePlaceholder')}
                  onChange={(event) => setSeedDescription(event.currentTarget.value)}
                />
              </FieldShell>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Button
                  tone="primary"
                  disabled={!seedDescription.trim() || isGeneratingSeed}
                  loading={isGeneratingSeed}
                  onClick={() => void runSeedGeneration()}
                >
                  {t('create.generateFromDescription')}
                </Button>
              </div>
            </>
          ) : null}
          {sourceMode === 'manual' ? (
            <Surface tone="card" padding="md">
              <div className="grid gap-3">
                <div className="font-medium">{t('create.manualEntryTitle')}</div>
                <p className="m-0 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                  {t('create.manualEntryDescription')}
                </p>
                <div>
                  <Button tone="primary" onClick={skipSeedAndCreateManually}>
                    {t('create.startManualGraph')}
                  </Button>
                </div>
              </div>
            </Surface>
          ) : null}
          <InlineAlert tone="neutral">
            <strong>{t('create.boundaryLabel')}</strong> {t('create.boundaryDescription')}
          </InlineAlert>
        </div>
      </Surface>
    );
  }

  return (
    <Surface tone="panel" padding="lg" className="min-w-0">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h2 className="m-0 text-xl font-semibold">{t('create.title')}</h2>
            <StatusBadge tone="info">{t('create.ownerScoped')}</StatusBadge>
            <StatusBadge tone="neutral">{t('create.reviewRequired')}</StatusBadge>
            {draft.originalDescription ? (
              <StatusBadge tone="success">{t('create.aiSeeded')}</StatusBadge>
            ) : null}
            <Button tone="ghost" size="sm" onClick={returnToSeedStage}>
              {t('create.changeSource')}
            </Button>
          </div>
          <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {t('create.editDescription')}
          </p>
          {seedResult?.ok && seedResult.rationale ? (
            <InlineAlert tone="info" className="mt-3">
              <strong>{t('create.aiDraftRationale')}</strong> {seedResult.rationale}
            </InlineAlert>
          ) : null}

          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell label={t('create.handleLabel')} message={t('create.handleMessage')}>
                <TextField
                  value={draft.handle}
                  placeholder={t('create.handlePlaceholder')}
                  onChange={(event) => updateDraft({ handle: event.currentTarget.value })}
                />
              </FieldShell>
              <FieldShell label={t('create.displayNameLabel')} message={t('create.displayNameMessage')}>
                <TextField
                  value={draft.displayName}
                  placeholder={t('create.displayNamePlaceholder')}
                  onChange={(event) => updateDraft({ displayName: event.currentTarget.value })}
                />
              </FieldShell>
            </div>
            {normalizedDraft.handle && handleAvailabilityQuery.isLoading ? (
              <InlineAlert tone="info">{t('create.checkingHandle')}</InlineAlert>
            ) : null}
            {handleAvailabilityQuery.isError ? (
              <InlineAlert tone="danger">{t('create.handleCheckFailed')}</InlineAlert>
            ) : null}
            <FieldShell label={t('create.profileDescriptionLabel')} message={t('create.profileDescriptionMessage')}>
              <TextareaField
                value={draft.description}
                placeholder={t('create.profileDescriptionPlaceholder')}
                onChange={(event) => updateDraft({ description: event.currentTarget.value })}
              />
            </FieldShell>
            <FieldShell label={t('create.conceptLabel')} message={t('create.conceptMessage')}>
              <TextareaField
                value={draft.concept}
                placeholder={t('create.conceptPlaceholder')}
                onChange={(event) => updateDraft({ concept: event.currentTarget.value })}
              />
            </FieldShell>
            <FieldShell label={t('create.visibleRulesLabel')} message={t('create.visibleRulesMessage')}>
              <TextareaField
                value={draft.ruleText}
                placeholder={t('create.visibleRulesPlaceholder')}
                onChange={(event) => updateDraft({ ruleText: event.currentTarget.value })}
              />
            </FieldShell>
            <FieldShell
              label={t('create.personaArchetypeLabel')}
              message={t('create.personaArchetypeMessage')}
              messageTone={draft.personaArchetype ? 'neutral' : 'danger'}
            >
              <SelectField
                value={draft.personaArchetype}
                options={[
                  { value: '', label: t('create.personaArchetypePlaceholder') },
                  ...PERSONA_ARCHETYPES.map((archetype) => ({
                    value: archetype,
                    label: `${archetype} - ${t(PERSONA_ARCHETYPE_DESCRIPTION_KEYS[archetype])}`,
                  })),
                ]}
                onValueChange={(value) => updateDraft({ personaArchetype: value as PersonaArchetype | '' })}
              />
            </FieldShell>
            <FieldShell
              label={t('create.personaTraitsLabel', { max: PERSONA_TRAIT_MAX_RECOMMENDED })}
              message={
                draft.personaTraits.length > PERSONA_TRAIT_MAX_RECOMMENDED
                  ? t('create.personaTraitsTooMany', { count: draft.personaTraits.length, max: PERSONA_TRAIT_MAX_RECOMMENDED })
                  : t('create.personaTraitsToggle')
              }
              messageTone={draft.personaTraits.length > PERSONA_TRAIT_MAX_RECOMMENDED ? 'warning' : 'neutral'}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PERSONA_TRAITS.map((trait) => {
                  const active = draft.personaTraits.includes(trait);
                  return (
                    <button
                      key={trait}
                      type="button"
                      title={t(PERSONA_TRAIT_DESCRIPTION_KEYS[trait])}
                      onClick={() => {
                        const next = active
                          ? draft.personaTraits.filter((value) => value !== trait)
                          : [...draft.personaTraits, trait];
                        updateDraft({ personaTraits: next });
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: `1px solid ${active ? 'var(--nimi-action-primary-bg)' : 'var(--nimi-border-subtle)'}`,
                        background: active
                          ? 'color-mix(in srgb, var(--nimi-action-primary-bg) 12%, transparent)'
                          : 'var(--nimi-surface-card)',
                        color: active ? 'var(--nimi-text-primary)' : 'var(--nimi-text-secondary)',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {trait}
                    </button>
                  );
                })}
              </div>
            </FieldShell>
            <FieldShell
              label={t('create.worldLabel')}
              message={oasisWorld ? t('create.worldDefault', { name: oasisWorld.name }) : t('create.worldDefaultUnavailable')}
              messageTone={oasisWorld ? 'neutral' : 'danger'}
            >
              <SelectField
                disabled={worldsQuery.isLoading || worlds.length === 0}
                value={draft.selectedWorldId}
                options={worlds.map((world) => ({ value: world.id, label: worldOptionLabel(world) }))}
                onValueChange={(value) => updateDraft({ selectedWorldId: value })}
              />
            </FieldShell>
            {worldsQuery.isError ? (
              <InlineAlert tone="danger">{t('create.worldSelectionUnavailable')}</InlineAlert>
            ) : null}
            {!worldsQuery.isLoading && worlds.length === 0 ? (
              <InlineAlert tone="warning">{t('create.noSelectableWorlds')}</InlineAlert>
            ) : null}
            {!worldsQuery.isLoading && worlds.length > 0 && draft.selectedWorldId && !selectedWorld ? (
              <InlineAlert tone="danger">{t('create.selectedWorldUnavailable')}</InlineAlert>
            ) : null}
            {!readiness.ready ? (
              <InlineAlert tone="warning">{translateCreateFixedMessages(readiness.errors, t)}</InlineAlert>
            ) : null}
            {!creationGraphReview.ready ? (
              <InlineAlert tone={creationGraphReview.canAccept ? 'warning' : 'danger'}>
                {translateGraphReviewErrors(creationGraphReview.errors, t)}
              </InlineAlert>
            ) : null}
            {localSubmitErrors.length > 0 ? (
              <InlineAlert tone="danger">{t('create.validationFailed', { errors: translateCreateFixedMessages(localSubmitErrors, t) })}</InlineAlert>
            ) : null}
            {createdContext ? (
              <Surface tone="card" padding="md">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{t('create.createdCardTitle')}</div>
                    <div className="ras-break-anywhere mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                      @{createdContext.handle} · {createdContext.personaId}
                    </div>
                  </div>
                  <StatusBadge tone="success">{createdContext.state || t('create.createdStateFallback')}</StatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button tone="secondary" onClick={() => onOpenCreatedPersona?.(createdContext.personaId, 'detail')}>
                    {t('create.openCockpit')}
                  </Button>
                  <Button tone="ghost" onClick={() => onOpenCreatedPersona?.(createdContext.personaId, 'settings')}>
                    {t('create.openSettings')}
                  </Button>
                </div>
              </Surface>
            ) : null}
            <Surface tone="card" padding="md">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{t('create.referenceTitle')}</div>
                  <div className="ras-text-muted ras-text-size-sm" style={{ marginTop: 4 }}>
                    {t('create.referenceDescription')}
                  </div>
                </div>
                <StatusBadge tone={draft.referenceImageUrl ? 'success' : 'neutral'}>
                  {draft.referenceImageUrl ? t('create.referenceAttached') : t('create.noReferenceYet')}
                </StatusBadge>
              </div>
              <FieldShell
                label={t('create.imagePromptLabel')}
                message={t('create.imagePromptMessage')}
              >
                <TextareaField
                  value={referenceImagePrompt}
                  placeholder={defaultReferenceImagePromptFromDraft({
                    description: draft.originalDescription,
                    displayName: draft.displayName,
                    concept: draft.concept,
                    personaArchetype: draft.personaArchetype,
                  })}
                  onChange={(event) => setReferenceImagePrompt(event.currentTarget.value)}
                />
              </FieldShell>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                <Button
                  tone="secondary"
                  disabled={isGeneratingReferenceImage}
                  loading={isGeneratingReferenceImage}
                  onClick={() => void runReferenceImageGeneration()}
                >
                  {draft.referenceImageUrl ? t('create.regenerateReference') : t('create.generateReference')}
                </Button>
                {draft.referenceImageUrl ? (
                  <Button tone="ghost" onClick={clearReferenceImage}>
                    {t('create.clearReference')}
                  </Button>
                ) : null}
              </div>
              {draft.referenceImageUrl ? (
                <div style={{ marginTop: 12 }}>
                  <div className="ras-text-muted ras-text-size-sm" style={{ marginBottom: 6 }}>{t('create.preview')}</div>
                  <div
                    style={{
                      width: '100%',
                      maxHeight: 320,
                      overflow: 'hidden',
                      borderRadius: 12,
                      border: '1px solid var(--nimi-border-subtle)',
                      background: 'var(--nimi-surface-active)',
                    }}
                  >
                    <img
                      src={draft.referenceImageUrl}
                      alt={t('create.referenceAlt')}
                      style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
                    />
                  </div>
                  <div className="ras-break-anywhere ras-text-muted ras-text-size-sm" style={{ marginTop: 6 }}>
                    {draft.referenceImageUrl}
                  </div>
                </div>
              ) : null}
            </Surface>
            <Button tone="primary" disabled={createDisabled} loading={createMutation.isPending} onClick={submitCreate}>
              {t('create.submit')}
            </Button>
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <GraphReviewBoard
            graph={creationGraph}
            review={creationGraphReview}
            onAccept={() => setGraphAcceptedFingerprint(acceptPersonaCreationGraphForRealmCreate(creationGraph))}
          />
          <Surface tone="card" padding="md">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium">{t('create.worldPreview.title')}</div>
              <StatusBadge tone="neutral">{t('create.worldPreview.badge')}</StatusBadge>
            </div>
            {!selectedWorld ? (
              <EmptyState title={t('create.worldPreview.noneTitle')} description={t('create.worldPreview.noneDescription')} />
            ) : worldPreviewQuery.isLoading ? (
              <EmptyState title={t('create.worldPreview.loadingTitle')} description={t('create.worldPreview.loadingDescription')} />
            ) : worldPreviewQuery.isError ? (
              <InlineAlert tone="danger">{t('create.worldPreview.unavailable')}</InlineAlert>
            ) : worldPreviewQuery.data ? (
              <div className="mt-3 grid gap-3 text-[length:var(--nimi-type-body-sm-size)]">
                <div>
                  <div className="ras-break-anywhere font-medium">{worldPreviewQuery.data.name}</div>
                  <div className="ras-break-anywhere mt-1 text-[var(--nimi-text-muted)]">{worldPreviewQuery.data.tagline || worldPreviewQuery.data.description || t('create.worldPreview.basicUnavailable')}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone="info">{worldPreviewQuery.data.type || t('create.worldPreview.typeUnavailable')}</StatusBadge>
                  <StatusBadge tone="neutral">{worldPreviewQuery.data.status || t('create.worldPreview.statusUnavailable')}</StatusBadge>
                  <StatusBadge tone="neutral">{worldPreviewQuery.data.contentRating || t('create.worldPreview.ratingUnavailable')}</StatusBadge>
                </div>
                <div className="ras-break-anywhere text-[var(--nimi-text-secondary)]">{worldPreviewQuery.data.overview || t('create.worldPreview.overviewUnavailable')}</div>
                <div className="flex flex-wrap gap-2">
                  {worldPreviewQuery.data.themes.length > 0
                    ? worldPreviewQuery.data.themes.map((theme) => <StatusBadge key={theme} tone="neutral">{theme}</StatusBadge>)
                    : <StatusBadge tone="warning">{t('create.worldPreview.themesUnavailable')}</StatusBadge>}
                </div>
              </div>
            ) : null}
          </Surface>
          <ReadinessPreview draft={draft} selectableWorldIds={selectableWorldIds} handleAvailability={handleAvailability} />
        </div>
      </div>
    </Surface>
  );
}
