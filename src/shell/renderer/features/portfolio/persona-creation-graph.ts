import {
  normalizeCreateRealmPersonaDraft,
  type CreateRealmPersonaDraftInput,
} from './create-persona-draft.js';

export type PersonaCreationGraphSourceMode =
  | 'description'
  | 'manual';

export type PersonaCreationGraphFieldStatus = 'mapped' | 'candidateOnly' | 'unmapped' | 'rejected';

export type PersonaCreationGraphSectionKey =
  | 'identity'
  | 'personaStyle'
  | 'behavior'
  | 'worldview'
  | 'greeting'
  | 'communicationVoice'
  | 'contentVoice'
  | 'visualBrief'
  | 'voiceBrief'
  | 'postBrief'
  | 'sourceProvenance'
  | 'missingDecisions'
  | 'riskNotes'
  | 'writePlan';

export type PersonaCreationGraphSourceField = {
  key: string;
  label: string;
  value: string;
  status: PersonaCreationGraphFieldStatus;
  targetSection?: PersonaCreationGraphSectionKey;
  note?: string;
};

export type PersonaCreationGraphSection = {
  key: PersonaCreationGraphSectionKey;
  title: string;
  status: 'ready' | 'needs-decision' | 'blocked';
  summary: string;
  fields: Array<{ label: string; value: string }>;
  missing: string[];
  risks: string[];
  ruleIds: string[];
};

export type PersonaCreationGraphWritePlanItem = {
  target:
    | 'realm-create'
    | 'owner-settings'
    | 'asset-candidate'
    | 'post-candidate'
    | 'blocked'
    | 'deferred';
  label: string;
  status: 'ready' | 'blocked' | 'deferred';
  reason: string;
  ruleIds: string[];
};

export type PersonaCreationGraph = {
  fingerprint: string;
  sourcePackage: {
    mode: PersonaCreationGraphSourceMode;
    label: string;
    ownerReviewedForRuntime: boolean;
    fields: PersonaCreationGraphSourceField[];
  };
  normalizedGraph: {
    sections: PersonaCreationGraphSection[];
  };
  reviewState: {
    acceptedSectionKeys: PersonaCreationGraphSectionKey[];
    acceptedForCreateFingerprint: string | null;
  };
  writePlan: {
    items: PersonaCreationGraphWritePlanItem[];
  };
  provenance: {
    ruleIds: string[];
    sourceLabel: string;
  };
};

export type PersonaCreationGraphCreateReview = {
  canAccept: boolean;
  ready: boolean;
  errors: string[];
  shapeErrors: string[];
  reviewErrors: string[];
};

export type BuildPersonaCreationGraphOptions = {
  sourceMode: PersonaCreationGraphSourceMode;
  sourceLabel?: string;
  runtimeRationale?: string;
  extraSourceFields?: PersonaCreationGraphSourceField[];
  acceptedForCreateFingerprint?: string | null;
};

const GRAPH_RULE_IDS = [
  'R-RPS-GRAPH-001',
  'R-RPS-GRAPH-002',
  'R-RPS-GRAPH-003',
  'R-RPS-GRAPH-004',
  'R-RPS-GRAPH-013',
  'R-RPS-GRAPH-016',
  'R-RPS-GRAPH-017',
  'R-RPS-GRAPH-019',
  'R-RPS-GRAPH-020',
  'R-RPS-GRAPH-021',
] as const;

const REQUIRED_CREATE_SECTIONS: PersonaCreationGraphSectionKey[] = [
  'identity',
  'personaStyle',
  'worldview',
  'sourceProvenance',
  'writePlan',
];

function stableFingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function present(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sourceModeLabel(mode: PersonaCreationGraphSourceMode): string {
  if (mode === 'description') return 'Owner description';
  return 'Manual advanced entry';
}

function buildSection(input: Omit<PersonaCreationGraphSection, 'status'>): PersonaCreationGraphSection {
  return {
    ...input,
    status: input.risks.length > 0 ? 'blocked' : input.missing.length > 0 ? 'needs-decision' : 'ready',
  };
}

function field(label: string, value: string | null): Array<{ label: string; value: string }> {
  return value ? [{ label, value }] : [];
}

function sourceField(
  key: string,
  label: string,
  value: string | null,
  status: PersonaCreationGraphFieldStatus,
  targetSection?: PersonaCreationGraphSectionKey,
  note?: string,
): PersonaCreationGraphSourceField | null {
  if (!value) return null;
  return {
    key,
    label,
    value,
    status,
    ...(targetSection ? { targetSection } : {}),
    ...(note ? { note } : {}),
  };
}

function compactFields(fields: Array<PersonaCreationGraphSourceField | null>): PersonaCreationGraphSourceField[] {
  return fields.filter((item): item is PersonaCreationGraphSourceField => Boolean(item));
}

export function buildPersonaCreationGraphFromDraft(
  draftInput: CreateRealmPersonaDraftInput,
  options: BuildPersonaCreationGraphOptions,
): PersonaCreationGraph {
  const draft = normalizeCreateRealmPersonaDraft(draftInput);
  const sourceLabel = options.sourceLabel?.trim() || sourceModeLabel(options.sourceMode);
  const fingerprint = stableFingerprint({
    sourceMode: options.sourceMode,
    sourceLabel,
    handle: draft.handle,
    displayName: draft.displayName,
    concept: draft.concept,
    description: draft.description,
    ruleText: draft.ruleText,
    selectedWorldId: draft.selectedWorldId,
    personaArchetype: draft.personaArchetype,
    personaTraits: draft.personaTraits,
    speechSupplement: draft.speechSupplement,
    boundarySupplement: draft.boundarySupplement,
    visualSupplement: draft.visualSupplement,
    referenceImageUrl: draft.referenceImageUrl,
    referenceImageCandidates: draft.referenceImageCandidates,
    originalDescription: draft.originalDescription,
  });

  const sourceFields = [
    ...(options.extraSourceFields || []),
    ...compactFields([
    sourceField('ownerDescription', 'Owner description', present(draft.originalDescription), 'mapped', 'sourceProvenance'),
    sourceField('displayName', 'Display name', present(draft.displayName), 'mapped', 'identity'),
    sourceField('handle', 'Handle', present(draft.handle), 'mapped', 'identity'),
    sourceField('concept', 'Concept', present(draft.concept), 'mapped', 'worldview'),
    sourceField('description', 'Profile description', present(draft.description), 'mapped', 'identity'),
    sourceField('personaArchetype', 'Persona archetype', present(draft.personaArchetype), 'mapped', 'personaStyle'),
    sourceField('personaTraits', 'Persona traits', draft.personaTraits.length > 0 ? draft.personaTraits.join(', ') : null, 'mapped', 'personaStyle'),
    sourceField('speechSupplement', 'Speech style supplement', present(draft.speechSupplement), 'candidateOnly', 'communicationVoice'),
    sourceField('boundarySupplement', 'Behavior boundary supplement', present(draft.boundarySupplement), 'candidateOnly', 'behavior'),
    sourceField('visualSupplement', 'Visual style supplement', present(draft.visualSupplement), 'candidateOnly', 'visualBrief'),
    sourceField('ruleText', 'Visible behavior rules', present(draft.ruleText), 'candidateOnly', 'behavior'),
    sourceField('referenceImageUrl', 'Reference image URL', present(draft.referenceImageUrl), 'candidateOnly', 'visualBrief'),
    sourceField('runtimeRationale', 'Runtime draft rationale', present(options.runtimeRationale || ''), 'candidateOnly', 'riskNotes'),
    ]),
  ];

  const sections: PersonaCreationGraphSection[] = [
    buildSection({
      key: 'identity',
      title: 'Identity',
      summary: draft.displayName || draft.handle ? 'Public identity fields are ready for owner review.' : 'Public identity fields are not ready.',
      fields: [
        ...field('Display name', present(draft.displayName)),
        ...field('Handle', present(draft.handle) ? `@${draft.handle}` : null),
        ...field('Profile description', present(draft.description)),
      ],
      missing: [
        ...(draft.displayName ? [] : ['display name']),
        ...(draft.handle ? [] : ['handle']),
      ],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-016', 'R-RPS-GRAPH-019'],
    }),
    buildSection({
      key: 'personaStyle',
      title: 'Persona Style',
      summary: draft.personaArchetype ? 'Persona style archetype is selected.' : 'Persona style archetype is missing.',
      fields: [
        ...field('Archetype', present(draft.personaArchetype)),
        ...field('Traits', draft.personaTraits.length > 0 ? draft.personaTraits.join(', ') : null),
      ],
      missing: draft.personaArchetype ? [] : ['Persona archetype'],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-016', 'R-RPS-GRAPH-018'],
    }),
    buildSection({
      key: 'behavior',
      title: 'Behavior',
      summary: draft.ruleText ? 'Visible behavior notes will stay owner-reviewed.' : 'No behavior notes were supplied.',
      fields: field('Visible rules', present(draft.ruleText)),
      missing: draft.ruleText ? [] : ['behavior boundaries'],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-016', 'R-RPS-GRAPH-018'],
    }),
    buildSection({
      key: 'worldview',
      title: 'Worldview',
      summary: draft.concept ? 'Concept can anchor the public persona worldview.' : 'Concept is missing.',
      fields: field('Concept', present(draft.concept)),
      missing: draft.concept ? [] : ['concept'],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-016', 'R-RPS-GRAPH-019'],
    }),
    buildSection({
      key: 'greeting',
      title: 'Greeting',
      summary: 'Greeting remains a follow-up owner settings candidate after create.',
      fields: [],
      missing: ['greeting candidate'],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-017', 'R-RPS-GRAPH-020'],
    }),
    buildSection({
      key: 'communicationVoice',
      title: 'Communication Voice',
      summary: draft.ruleText || draft.concept ? 'Voice can be inferred for review from concept and behavior notes.' : 'Voice needs owner input.',
      fields: [
        ...field('Voice source', present(draft.ruleText || draft.concept)),
      ],
      missing: draft.ruleText || draft.concept ? [] : ['communication voice'],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-016'],
    }),
    buildSection({
      key: 'contentVoice',
      title: 'Content Voice',
      summary: 'Content voice is retained as a post-studio candidate, not a create write.',
      fields: [],
      missing: ['content voice examples'],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-025'],
    }),
    buildSection({
      key: 'visualBrief',
      title: 'Visual Brief',
      summary: draft.referenceImageUrl ? 'A reviewed reference image URL is ready as create input.' : 'Visual brief remains optional candidate material.',
      fields: field('Reference image URL', present(draft.referenceImageUrl)),
      missing: draft.referenceImageUrl ? [] : ['avatar/profile cover visual brief'],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-024'],
    }),
    buildSection({
      key: 'voiceBrief',
      title: 'Voice Brief',
      summary: 'Voice demo belongs to Identity Studio and remains candidate-only in create.',
      fields: [],
      missing: ['voice brief'],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-024'],
    }),
    buildSection({
      key: 'postBrief',
      title: 'Post Brief',
      summary: 'Post ideas belong to Content Studio and remain candidate-only in create.',
      fields: [],
      missing: ['first post brief'],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-025'],
    }),
    buildSection({
      key: 'sourceProvenance',
      title: 'Source Provenance',
      summary: `${sourceLabel} is visible as local creation evidence.`,
      fields: [
        { label: 'Source mode', value: sourceModeLabel(options.sourceMode) },
        { label: 'Source label', value: sourceLabel },
      ],
      missing: [],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-003', 'R-RPS-GRAPH-006', 'R-RPS-GRAPH-014'],
    }),
    buildSection({
      key: 'missingDecisions',
      title: 'Missing Decisions',
      summary: 'Unresolved decisions are explicit and do not block create unless they are required Realm create fields.',
      fields: [],
      missing: [
        ...(draft.description ? [] : ['profile description']),
        ...(draft.ruleText ? [] : ['behavior boundaries']),
        ...(draft.referenceImageUrl ? [] : ['visual reference']),
        'greeting',
        'content voice examples',
        'voice brief',
        'first post brief',
      ],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-013', 'R-RPS-GRAPH-029'],
    }),
    buildSection({
      key: 'riskNotes',
      title: 'Risk Notes',
      summary: 'Hidden provider, model, lifecycle, private memory, and raw rule-content fields are excluded.',
      fields: [
        ...field('Runtime rationale', present(options.runtimeRationale || '')),
      ],
      missing: [],
      risks: [],
      ruleIds: ['R-RPS-GRAPH-018', 'R-RPS-GRAPH-028'],
    }),
  ];

  const writePlanItems: PersonaCreationGraphWritePlanItem[] = [
    {
      target: 'realm-create',
      label: 'Create Realm Persona',
      status: draft.handle && draft.displayName && draft.concept && draft.selectedWorldId && draft.personaArchetype ? 'ready' : 'blocked',
      reason: 'Uses the owner-scoped Realm create path after handle and world gates pass.',
      ruleIds: ['R-RPS-GRAPH-017', 'R-RPS-GRAPH-021'],
    },
    {
      target: 'owner-settings',
      label: 'Save profile description after create',
      status: draft.description ? 'ready' : 'deferred',
      reason: draft.description ? 'Description can be saved when owner settings become available.' : 'No profile description candidate was supplied.',
      ruleIds: ['R-RPS-GRAPH-017', 'R-RPS-GRAPH-020'],
    },
    {
      target: 'asset-candidate',
      label: 'Reference image',
      status: draft.referenceImageUrl ? 'ready' : 'deferred',
      reason: draft.referenceImageUrl ? 'Reference image URL remains reviewed create input.' : 'Identity assets move to Identity Studio.',
      ruleIds: ['R-RPS-GRAPH-024'],
    },
    {
      target: 'post-candidate',
      label: 'First post',
      status: 'deferred',
      reason: 'Post generation belongs to Content Studio and requires human review before publish.',
      ruleIds: ['R-RPS-GRAPH-025'],
    },
  ];

  const writePlanSection = buildSection({
    key: 'writePlan',
    title: 'Write Plan',
    summary: 'Accepted fields map to supported Realm write paths; unavailable and deferred fields remain explicit.',
    fields: writePlanItems.map((item) => ({
      label: item.label,
      value: `${item.status}: ${item.reason}`,
    })),
    missing: writePlanItems.some((item) => item.target === 'realm-create' && item.status === 'blocked')
      ? ['Realm create required fields']
      : [],
    risks: [],
    ruleIds: ['R-RPS-GRAPH-017', 'R-RPS-GRAPH-020', 'R-RPS-GRAPH-021'],
  });

  const allSections = [...sections, writePlanSection];
  return {
    fingerprint,
    sourcePackage: {
      mode: options.sourceMode,
      label: sourceLabel,
      ownerReviewedForRuntime: options.sourceMode === 'description',
      fields: sourceFields,
    },
    normalizedGraph: {
      sections: allSections,
    },
    reviewState: {
      acceptedSectionKeys: allSections
        .filter((section) => section.status !== 'blocked')
        .map((section) => section.key),
      acceptedForCreateFingerprint: options.acceptedForCreateFingerprint || null,
    },
    writePlan: {
      items: writePlanItems,
    },
    provenance: {
      ruleIds: [...GRAPH_RULE_IDS],
      sourceLabel,
    },
  };
}

export function acceptPersonaCreationGraphForRealmCreate(graph: PersonaCreationGraph): string {
  return graph.fingerprint;
}

export function validatePersonaCreationGraphForRealmCreate(
  graph: PersonaCreationGraph | null,
  acceptedForCreateFingerprint: string | null,
): PersonaCreationGraphCreateReview {
  const shapeErrors: string[] = [];
  const reviewErrors: string[] = [];
  if (!graph) {
    shapeErrors.push('Persona Creation Graph missing (R-RPS-GRAPH-003).');
    return {
      canAccept: false,
      ready: false,
      errors: [...shapeErrors],
      shapeErrors,
      reviewErrors,
    };
  }

  const sections = new Map(graph.normalizedGraph.sections.map((section) => [section.key, section]));
  for (const sectionKey of REQUIRED_CREATE_SECTIONS) {
    if (!sections.has(sectionKey)) {
      shapeErrors.push(`Persona Creation Graph section missing: ${sectionKey} (R-RPS-GRAPH-016).`);
    }
  }

  const createPlan = graph.writePlan.items.find((item) => item.target === 'realm-create');
  if (!createPlan) {
    shapeErrors.push('Persona Creation Graph write plan missing Realm create target (R-RPS-GRAPH-017).');
  } else if (createPlan.status !== 'ready') {
    shapeErrors.push('Persona Creation Graph write plan is blocked for Realm create (R-RPS-GRAPH-017).');
  }

  for (const sectionKey of ['identity', 'personaStyle', 'worldview'] as const) {
    const section = sections.get(sectionKey);
    if (section?.status === 'blocked') {
      shapeErrors.push(`Persona Creation Graph ${section.title} section is blocked (R-RPS-GRAPH-027).`);
    }
  }

  if (acceptedForCreateFingerprint !== graph.fingerprint) {
    reviewErrors.push('Persona Creation Graph review missing or stale (R-RPS-GRAPH-019).');
  }

  return {
    canAccept: shapeErrors.length === 0,
    ready: shapeErrors.length === 0 && reviewErrors.length === 0,
    errors: [...shapeErrors, ...reviewErrors],
    shapeErrors,
    reviewErrors,
  };
}

export function personaCreationGraphSourceModeLabel(mode: PersonaCreationGraphSourceMode): string {
  return sourceModeLabel(mode);
}
