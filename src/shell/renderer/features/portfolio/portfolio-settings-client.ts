import type {
  RealmModel,
} from '@nimiplatform/sdk/realm/generated';
import { createStudioRealmClient, type StudioRealmSurface } from '@renderer/data/realm-client.js';
import { createStudioRuntimeClient } from '@renderer/data/runtime-client.js';
import {
  isStudioAIRouteBindingFailure,
  runStudioTextGenerate,
  type StudioRuntimeAIClient,
  type StudioTextGeneratePayload,
} from './studio-ai-runtime.js';
import type { OwnerPortfolioPersonaDetail, SettingField } from './portfolio-data.js';
import {
  OWNER_SETTINGS_SAVE_SOURCE,
  SETTINGS_AI_PROPOSAL_SOURCE,
  buildRealmOwnerPersonaSettingsUpdateInput,
  buildRuntimeOwnerSettingsProposalPrompt,
  normalizeRuntimeOwnerSettingsProposal,
  type OwnerPersonaSettingsProposalContext,
  type OwnerPersonaSettingsDraft,
  type OwnerPersonaSettingsSnapshot,
  type OwnerPersonaSettingsUpdateInput,
  type RuntimeOwnerSettingsProposal,
} from './setting-proposal.js';

type StudioRealmClient = StudioRealmSurface;

type RealmPersonaCharacterDto = RealmModel<'PersonaCharacterCoreDto'>;
type ReplacePersonaCharacterInput = RealmModel<'ReplacePersonaCharacterCoreDto'>;

type RuntimeTextClient = StudioRuntimeAIClient;

export type RealmPersonaVisibilitySettings = Record<PersonaVisibilityField, PersonaVisibilityValue>;
type RealmPersonaVisibilityUpdateInput = Partial<Record<PersonaVisibilityField, PersonaVisibilityValue>>;
export type RealmOwnerPersonaSettings = OwnerPersonaSettingsSnapshot & {
  id: string;
  contentHash: string;
  homeWorldId: string;
  visibility: RealmPersonaCharacterDto['visibility'];
  origin: RealmPersonaCharacterDto['origin'];
  core: Record<string, unknown>;
};
type RealmOwnerPersonaSettingsUpdateInput = ReplacePersonaCharacterInput;
type RealmRuntimeProjectionInput = {
  intendedRuntimeAudience: string;
  sourceRef: {
    kind: 'realmPersona';
    worldId: string;
    sourceId: string;
    sourceContentHash: string;
  };
};
type RealmRuntimeProjectionResponse = unknown;
type PersonaChatReadinessSubmittedInput = RealmRuntimeProjectionInput;

const STUDIO_RUNTIME_MATERIALIZATION_AUDIENCE = 'desktop.runtime';
export const REALM_RUNTIME_PROJECTION_SOURCE = 'Realm WorldCoreController.createSourceMaterializationPacket';
export const REALM_PERSONA_VISIBILITY_SOURCE = 'Realm WorldCoreController.replaceRealmPersona';
export const PERSONA_VISIBILITY_VALUES = ['PUBLIC', 'FRIENDS', 'PRIVATE'] as const;
export const PERSONA_VISIBILITY_FIELDS = [
  'defaultPostVisibility',
  'dmVisibility',
  'profileVisibility',
] as const;

export type RuntimeProjectionSummary = {
  source: typeof REALM_RUNTIME_PROJECTION_SOURCE;
  consumerSurface: 'RUNTIME_PAYLOAD';
  worldId: string;
  checksum: string;
  selectedInputCount: number;
  suppressedInputCount: number;
  worldRuleCount: number;
  rawRuleContentExposed: false;
};

export type PersonaChatReadinessProjectionSummary = RuntimeProjectionSummary & {
  personaId: string;
  personaRuleCount: number;
  selectedOwnerSettingFields: string[];
};

export type RuntimeProjectionSummaryResult =
  | {
    ok: true;
    source: typeof REALM_RUNTIME_PROJECTION_SOURCE;
    truthWrite: false;
    summary: RuntimeProjectionSummary | PersonaChatReadinessProjectionSummary;
    submitted: RealmRuntimeProjectionInput;
  }
  | {
    ok: false;
    source: typeof REALM_RUNTIME_PROJECTION_SOURCE;
    truthWrite: false;
    failure:
      | 'runtime-projection-world-unavailable'
      | 'runtime-projection-not-admitted'
      | 'runtime-projection-failed'
      | 'runtime-projection-invalid-response';
    message: string;
    submitted: RealmRuntimeProjectionInput | null;
  };

export type PersonaChatReadinessSummaryResult =
  | {
    ok: true;
    source: typeof REALM_RUNTIME_PROJECTION_SOURCE;
    truthWrite: false;
    summary: PersonaChatReadinessProjectionSummary;
    submitted: PersonaChatReadinessSubmittedInput;
  }
  | {
    ok: false;
    source: typeof REALM_RUNTIME_PROJECTION_SOURCE;
    truthWrite: false;
    failure:
      | 'runtime-projection-world-unavailable'
      | 'runtime-projection-not-admitted'
      | 'runtime-projection-failed'
      | 'runtime-projection-invalid-response';
    message: string;
    submitted: PersonaChatReadinessSubmittedInput | null;
  };
export type PersonaVisibilityValue = typeof PERSONA_VISIBILITY_VALUES[number];
export type PersonaVisibilityField = typeof PERSONA_VISIBILITY_FIELDS[number];
export type PersonaVisibilityDraft = Record<PersonaVisibilityField, string>;

export type RealmPersonaVisibilityUpdateResult =
  | {
    ok: true;
    source: typeof REALM_PERSONA_VISIBILITY_SOURCE;
    lifecycleTruth: false;
    submitted: RealmPersonaVisibilityUpdateInput;
    settings: RealmPersonaVisibilitySettings;
  }
  | {
    ok: false;
    source: typeof REALM_PERSONA_VISIBILITY_SOURCE;
    lifecycleTruth: false;
    failure: 'visibility-payload-invalid' | 'visibility-no-changes' | 'realm-update-visibility-failed';
    message: string;
    submitted: RealmPersonaVisibilityUpdateInput | null;
    draft: PersonaVisibilityDraft;
  };

export type RealmOwnerPersonaSettingsUpdateResult =
  | {
    ok: true;
    source: typeof OWNER_SETTINGS_SAVE_SOURCE;
    truthWrite: true;
    submitted: RealmOwnerPersonaSettingsUpdateInput;
    settings: RealmOwnerPersonaSettings;
  }
  | {
    ok: false;
    source: typeof OWNER_SETTINGS_SAVE_SOURCE;
    truthWrite: false;
    failure: 'owner-settings-payload-invalid' | 'owner-settings-no-changes' | 'realm-update-owner-settings-failed';
    message: string;
    submitted: RealmOwnerPersonaSettingsUpdateInput | null;
    draft: OwnerPersonaSettingsDraft;
  };

export type RuntimeOwnerSettingsProposalResult =
  | {
    ok: true;
    source: typeof SETTINGS_AI_PROPOSAL_SOURCE;
    candidate: true;
    truthWrite: false;
    proposal: RuntimeOwnerSettingsProposal;
    submitted: StudioTextGeneratePayload;
    runtime: {
      traceId?: string;
      modelResolved?: string;
      finishReason?: string;
    };
  }
  | {
    ok: false;
    source: typeof SETTINGS_AI_PROPOSAL_SOURCE;
    candidate: false;
    truthWrite: false;
    failure:
      | 'runtime-settings-proposal-payload-invalid'
      | 'runtime-settings-proposal-transport-unavailable'
      | 'runtime-settings-proposal-route-unbound'
      | 'runtime-settings-proposal-failed'
      | 'runtime-settings-proposal-invalid-output';
    message: string;
    submitted: StudioTextGeneratePayload | null;
  };

function proposalContextText(field: SettingField): string | null {
  if (field.status === 'available') {
    return field.value;
  }
  return null;
}

export function buildPortfolioSettingsProposalContext(persona: OwnerPortfolioPersonaDetail): OwnerPersonaSettingsProposalContext {
  return {
    ownerScope: persona.ownerScope,
    displayName: proposalContextText(persona.displayName),
    handle: proposalContextText(persona.handle),
    worldId: proposalContextText(persona.world),
    worldName: proposalContextText(persona.world),
  };
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readAuthoringExtensions(core: Record<string, unknown>): Record<string, unknown> {
  return readRecord(readRecord(core.authoring).extensions);
}

function readOwnerSettingsExtension(core: Record<string, unknown>): Record<string, unknown> {
  return readRecord(readAuthoringExtensions(core).ownerSettings);
}

function writeRecordSection(
  core: Record<string, unknown>,
  key: string,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...core,
    [key]: {
      ...readRecord(core[key]),
      ...patch,
    },
  };
}

function deleteUndefinedValues(record: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

function writeAuthoringExtension(
  core: Record<string, unknown>,
  key: string,
  value: Record<string, unknown>,
): Record<string, unknown> {
  const authoring = readRecord(core.authoring);
  const extensions = readRecord(authoring.extensions);
  return {
    ...core,
    authoring: {
      ...authoring,
      extensions: {
        ...extensions,
        [key]: value,
      },
    },
  };
}

function readPersonaSocialVisibility(persona: RealmPersonaCharacterDto): RealmPersonaVisibilitySettings {
  const core = readRecord(persona.profile);
  const socialVisibility = readRecord(readAuthoringExtensions(core).socialVisibility);
  return {
    defaultPostVisibility: isPersonaVisibilityValue(String(socialVisibility.defaultPostVisibility || ''))
      ? socialVisibility.defaultPostVisibility as PersonaVisibilityValue
      : 'PRIVATE',
    dmVisibility: isPersonaVisibilityValue(String(socialVisibility.dmVisibility || ''))
      ? socialVisibility.dmVisibility as PersonaVisibilityValue
      : 'PRIVATE',
    profileVisibility: isPersonaVisibilityValue(String(socialVisibility.profileVisibility || ''))
      ? socialVisibility.profileVisibility as PersonaVisibilityValue
      : coreVisibilityToPersonaVisibility(persona.visibility),
  };
}

function readPersonaSettings(persona: RealmPersonaCharacterDto): RealmOwnerPersonaSettings {
  const core = readRecord(persona.profile);
  const identity = readRecord(core.identity);
  const presentation = readRecord(core.presentation);
  const interactionProfile = readRecord(core.interactionProfile);
  const ownerSettings = readOwnerSettingsExtension(core);
  return {
    id: persona.id,
    contentHash: persona.contentHash,
    homeWorldId: persona.worldId,
    visibility: persona.visibility,
    origin: persona.origin,
    core,
    displayName: readOptionalString(presentation, 'displayName') ?? readOptionalString(identity, 'name') ?? null,
    description: readOptionalString(ownerSettings, 'description')
      ?? readOptionalString(identity, 'summary')
      ?? readOptionalString(presentation, 'profileLine')
      ?? null,
    greeting: readOptionalString(interactionProfile, 'greeting') ?? null,
    naturalLanguageIntent: readOptionalString(ownerSettings, 'naturalLanguageIntent') ?? null,
    identity: readRecord(ownerSettings.identity),
    personality: readRecord(ownerSettings.personality),
    communication: readRecord(ownerSettings.communication),
    boundaries: readRecord(ownerSettings.boundaries),
    positioning: readRecord(ownerSettings.positioning),
  };
}

function mergeOwnerSettingsCore(
  current: RealmOwnerPersonaSettings,
  patch: OwnerPersonaSettingsUpdateInput,
): Record<string, unknown> {
  let next: Record<string, unknown> = { ...current.core };
  const ownerSettings = { ...readOwnerSettingsExtension(next) };

  if (Object.prototype.hasOwnProperty.call(patch, 'displayName') && patch.displayName) {
    next = writeRecordSection(next, 'identity', { name: patch.displayName });
    next = writeRecordSection(next, 'presentation', { displayName: patch.displayName });
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
    ownerSettings.description = patch.description ?? null;
    if (patch.description) {
      next = writeRecordSection(next, 'identity', { summary: patch.description });
      next = writeRecordSection(next, 'presentation', { profileLine: patch.description });
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'greeting')) {
    next = writeRecordSection(next, 'interactionProfile', deleteUndefinedValues({
      greeting: patch.greeting ?? undefined,
    }));
    ownerSettings.greeting = patch.greeting ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'naturalLanguageIntent')) {
    ownerSettings.naturalLanguageIntent = patch.naturalLanguageIntent ?? null;
  }

  for (const key of ['identity', 'personality', 'communication', 'boundaries', 'positioning'] as const) {
    if (patch[key]) {
      ownerSettings[key] = {
        ...readRecord(ownerSettings[key]),
        ...patch[key],
      };
    }
  }

  return writeAuthoringExtension(next, 'ownerSettings', ownerSettings);
}

function buildReplaceRealmPersonaInput(
  current: RealmOwnerPersonaSettings,
  core: Record<string, unknown>,
  visibility: RealmPersonaCharacterDto['visibility'] = current.visibility,
): ReplacePersonaCharacterInput {
  return {
    baseContentHash: current.contentHash,
    worldId: current.homeWorldId,
    visibility,
    origin: current.origin,
    // The merged core starts from the full Realm profile and only patches
    // sections, so the required profile input sections are preserved.
    profile: core as unknown as RealmModel<'CharacterProfileCoreInputDto'>,
  };
}

function personaVisibilityToCoreVisibility(value: PersonaVisibilityValue): RealmPersonaCharacterDto['visibility'] {
  if (value === 'PUBLIC') return 'public';
  if (value === 'FRIENDS') return 'unlisted';
  return 'private';
}

function coreVisibilityToPersonaVisibility(value: RealmPersonaCharacterDto['visibility']): PersonaVisibilityValue {
  if (value === 'public' || value === 'system') return 'PUBLIC';
  if (value === 'unlisted') return 'FRIENDS';
  return 'PRIVATE';
}

function isPersonaVisibilityValue(value: string): value is PersonaVisibilityValue {
  return PERSONA_VISIBILITY_VALUES.includes(value as PersonaVisibilityValue);
}

export function createPersonaVisibilityDraft(settings: RealmPersonaVisibilitySettings): PersonaVisibilityDraft {
  return {
    defaultPostVisibility: settings.defaultPostVisibility,
    dmVisibility: settings.dmVisibility,
    profileVisibility: settings.profileVisibility,
  };
}

export function buildRealmUpdateVisibilityInput(
  draft: PersonaVisibilityDraft,
  current: RealmPersonaVisibilitySettings,
): { input: RealmPersonaVisibilityUpdateInput | null; errors: string[] } {
  const input: RealmPersonaVisibilityUpdateInput = {};
  const errors: string[] = [];

  for (const field of PERSONA_VISIBILITY_FIELDS) {
    const value = draft[field];
    if (!isPersonaVisibilityValue(value)) {
      errors.push(`${field} must be PUBLIC, FRIENDS, or PRIVATE`);
      continue;
    }
    if (value !== current[field]) {
      input[field] = value;
    }
  }

  if (errors.length > 0) {
    return { input: null, errors };
  }

  if (Object.keys(input).length === 0) {
    return { input: null, errors: ['visibility settings have no reviewed changes'] };
  }

  return { input, errors: [] };
}
export function buildRuntimeProjectionInput(persona: OwnerPortfolioPersonaDetail): RealmRuntimeProjectionInput | null {
  if (!persona.id.trim() || !persona.homeWorldId.trim() || !persona.contentHash.trim()) {
    return null;
  }

  return {
    intendedRuntimeAudience: STUDIO_RUNTIME_MATERIALIZATION_AUDIENCE,
    sourceRef: {
      kind: 'realmPersona',
      worldId: persona.homeWorldId.trim(),
      sourceId: persona.id.trim(),
      sourceContentHash: persona.contentHash.trim(),
    },
  };
}

export function buildPersonaChatReadinessProjectionInput(persona: OwnerPortfolioPersonaDetail): RealmRuntimeProjectionInput | null {
  return buildRuntimeProjectionInput(persona);
}

function readStructuredOwnerSettingField(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const record = input as Record<string, unknown>;
  const structured = record.structured && typeof record.structured === 'object'
    ? record.structured as Record<string, unknown>
    : null;
  const ownerSettingField = structured?.ownerSettingField;
  return typeof ownerSettingField === 'string' && ownerSettingField.trim()
    ? ownerSettingField.trim()
    : null;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function normalizeRuntimeProjectionSummary(response: RealmRuntimeProjectionResponse): RuntimeProjectionSummary | null {
  if (!response || typeof response !== 'object') {
    return null;
  }
  const record = response as unknown as Record<string, unknown>;
  const worldId = readOptionalString(record, 'sourceWorldId');
  const checksum = readOptionalString(record, 'packetHash');
  if (!worldId || !checksum) {
    return null;
  }

  const payload = record.payload && typeof record.payload === 'object' ? record.payload as Record<string, unknown> : {};

  return {
    source: REALM_RUNTIME_PROJECTION_SOURCE,
    consumerSurface: 'RUNTIME_PAYLOAD',
    worldId,
    checksum,
    selectedInputCount: 1,
    suppressedInputCount: 0,
    worldRuleCount: readArray(payload.worldRules).length,
    rawRuleContentExposed: false,
  };
}

export function normalizePersonaChatReadinessProjectionSummary(
  response: RealmRuntimeProjectionResponse,
): PersonaChatReadinessProjectionSummary | null {
  const base = normalizeRuntimeProjectionSummary(response);
  if (!base) {
    return null;
  }
  const record = response as unknown as Record<string, unknown>;
  const personaId = readOptionalString(record, 'sourceId');
  if (!personaId) {
    return null;
  }

  const payload = record.payload && typeof record.payload === 'object' ? record.payload as Record<string, unknown> : {};
  return {
    ...base,
    personaId,
    personaRuleCount: 0,
    selectedOwnerSettingFields: uniqueSorted(
      Object.keys(payload)
        .map((key) => readStructuredOwnerSettingField({ structured: { ownerSettingField: key } }))
        .filter((value): value is string => Boolean(value)),
    ),
  };
}

export async function getPersonaVisibilitySettings(
  personaId: string,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmPersonaVisibilitySettings> {
  const persona = await realm.worldCoreControllerGetPersonaCharacter({ path: { personaCharacterId: personaId } });
  return readPersonaSocialVisibility(persona);
}

export async function getOwnerPersonaSettings(
  personaId: string,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmOwnerPersonaSettings> {
  const persona = await realm.worldCoreControllerGetPersonaCharacter({ path: { personaCharacterId: personaId } });
  return readPersonaSettings(persona);
}

export async function getPortfolioPersonaSettings(
  persona: OwnerPortfolioPersonaDetail,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmOwnerPersonaSettings> {
  return getOwnerPersonaSettings(persona.id, realm);
}

export async function updateReviewedPersonaVisibility(
  personaId: string,
  draft: PersonaVisibilityDraft,
  current: RealmPersonaVisibilitySettings,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmPersonaVisibilityUpdateResult> {
  const { input, errors } = buildRealmUpdateVisibilityInput(draft, current);
  if (!input) {
    return {
      ok: false,
      source: REALM_PERSONA_VISIBILITY_SOURCE,
      lifecycleTruth: false,
      failure: errors.some((error) => error.includes('no reviewed changes'))
        ? 'visibility-no-changes'
        : 'visibility-payload-invalid',
      message: errors.join('; ') || 'visibility payload invalid',
      submitted: null,
      draft,
    };
  }

  try {
    const ownerSettings = await getOwnerPersonaSettings(personaId, realm);
    const nextProfileVisibility = input.profileVisibility ?? current.profileVisibility;
    const settings = await realm.worldCoreControllerReplacePersonaCharacter({
      path: { personaCharacterId: personaId },
      body: buildReplaceRealmPersonaInput(
        ownerSettings,
        writeAuthoringExtension(ownerSettings.core, 'socialVisibility', {
          ...readRecord(readAuthoringExtensions(ownerSettings.core).socialVisibility),
          ...input,
        }),
        personaVisibilityToCoreVisibility(nextProfileVisibility),
      ),
    });
    return {
      ok: true,
      source: REALM_PERSONA_VISIBILITY_SOURCE,
      lifecycleTruth: false,
      submitted: input,
      settings: readPersonaSocialVisibility(settings),
    };
  } catch (error) {
    return {
      ok: false,
      source: REALM_PERSONA_VISIBILITY_SOURCE,
      lifecycleTruth: false,
      failure: 'realm-update-visibility-failed',
      message: error instanceof Error ? error.message : 'Realm visibility update failed.',
      submitted: input,
      draft,
    };
  }
}

export async function proposeReviewedOwnerPersonaSettings(
  personaId: string,
  draft: OwnerPersonaSettingsDraft,
  current: RealmOwnerPersonaSettings,
  runtime?: RuntimeTextClient | null,
  personaContext?: OwnerPersonaSettingsProposalContext,
): Promise<RuntimeOwnerSettingsProposalResult> {
  // The prompt starts with the unresolved marker; studio-ai-runtime must bind a
  // concrete text.generate route before dispatch.
  const built = buildRuntimeOwnerSettingsProposalPrompt({
    personaId,
    draft,
    current,
    ...(personaContext ? { personaContext } : {}),
  });
  if (!built.ok) {
    return {
      ok: false,
      source: SETTINGS_AI_PROPOSAL_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: 'runtime-settings-proposal-payload-invalid',
      message: built.errors.join('; ') || 'Runtime settings proposal payload invalid.',
      submitted: null,
    };
  }

  const runtimeClient = runtime === undefined ? await createStudioRuntimeClient() : runtime;
  if (!runtimeClient) {
    return {
      ok: false,
      source: SETTINGS_AI_PROPOSAL_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: 'runtime-settings-proposal-transport-unavailable',
      message: 'Runtime runtime.ai.text.generate runtime transport unavailable: Tauri IPC runtime transport is required.',
      submitted: built.payload,
    };
  }

  try {
    const output = await runStudioTextGenerate(built.payload, runtimeClient);
    try {
      const proposal = normalizeRuntimeOwnerSettingsProposal(output.text, draft);
      return {
        ok: true,
        source: SETTINGS_AI_PROPOSAL_SOURCE,
        candidate: true,
        truthWrite: false,
        proposal,
        submitted: output.submitted,
        runtime: {
          ...(output.trace?.traceId ? { traceId: output.trace.traceId } : {}),
          ...(output.trace?.modelResolved ? { modelResolved: output.trace.modelResolved } : {}),
          ...(output.finishReason ? { finishReason: String(output.finishReason) } : {}),
        },
      };
    } catch (error) {
      return {
        ok: false,
        source: SETTINGS_AI_PROPOSAL_SOURCE,
        candidate: false,
        truthWrite: false,
        failure: 'runtime-settings-proposal-invalid-output',
        message: error instanceof Error ? error.message : 'Runtime settings proposal output invalid.',
        submitted: output.submitted,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'runtime transport call failed.';
    const routeUnbound = isStudioAIRouteBindingFailure(error);
    return {
      ok: false,
      source: SETTINGS_AI_PROPOSAL_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: routeUnbound ? 'runtime-settings-proposal-route-unbound' : 'runtime-settings-proposal-failed',
      message: routeUnbound ? message : `Runtime runtime.ai.text.generate failed: ${message}`,
      submitted: null,
    };
  }
}

export async function proposeReviewedPortfolioPersonaSettings(
  persona: OwnerPortfolioPersonaDetail,
  draft: OwnerPersonaSettingsDraft,
  current: RealmOwnerPersonaSettings,
  runtime?: RuntimeTextClient | null,
): Promise<RuntimeOwnerSettingsProposalResult> {
  return proposeReviewedOwnerPersonaSettings(
    persona.id,
    draft,
    current,
    runtime,
    buildPortfolioSettingsProposalContext(persona),
  );
}
export async function updateReviewedOwnerPersonaSettings(
  personaId: string,
  draft: OwnerPersonaSettingsDraft,
  current: RealmOwnerPersonaSettings,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmOwnerPersonaSettingsUpdateResult> {
  const built = buildRealmOwnerPersonaSettingsUpdateInput(draft, current);
  if (!built.ok) {
    return {
      ok: false,
      source: OWNER_SETTINGS_SAVE_SOURCE,
      truthWrite: false,
      failure: built.failure === 'owner-settings-invalid' ? 'owner-settings-payload-invalid' : 'owner-settings-no-changes',
      message: built.errors.join('; ') || 'Owner settings payload invalid.',
      submitted: null,
      draft,
    };
  }

  const nextCore = mergeOwnerSettingsCore(current, built.input);
  const submitted = buildReplaceRealmPersonaInput(current, nextCore);
  try {
    const settings = await realm.worldCoreControllerReplacePersonaCharacter({
      path: { personaCharacterId: personaId },
      body: submitted,
    });
    return {
      ok: true,
      source: OWNER_SETTINGS_SAVE_SOURCE,
      truthWrite: true,
      submitted,
      settings: readPersonaSettings(settings),
    };
  } catch (error) {
    return {
      ok: false,
      source: OWNER_SETTINGS_SAVE_SOURCE,
      truthWrite: false,
      failure: 'realm-update-owner-settings-failed',
      message: error instanceof Error ? error.message : 'Realm owner settings update failed.',
      submitted,
      draft,
    };
  }
}

export async function updateReviewedPortfolioPersonaSettings(
  persona: OwnerPortfolioPersonaDetail,
  draft: OwnerPersonaSettingsDraft,
  current: RealmOwnerPersonaSettings,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmOwnerPersonaSettingsUpdateResult> {
  return updateReviewedOwnerPersonaSettings(persona.id, draft, current, realm);
}
export async function projectPersonaRuntimeContextSummary(
  persona: OwnerPortfolioPersonaDetail,
  _realm?: StudioRealmClient,
): Promise<RuntimeProjectionSummaryResult> {
  const submitted = buildRuntimeProjectionInput(persona);
  if (!submitted) {
    return {
      ok: false,
      source: REALM_RUNTIME_PROJECTION_SOURCE,
      truthWrite: false,
      failure: 'runtime-projection-world-unavailable',
      message: 'Runtime projection requires worldId evidence from Realm WorldCoreController.getRealmPersona.',
      submitted: null,
    };
  }

  return {
    ok: false,
    source: REALM_RUNTIME_PROJECTION_SOURCE,
    truthWrite: false,
    failure: 'runtime-projection-not-admitted',
    message: 'Runtime source materialization requires a protected Runtime-issued challenge and is not admitted for Persona Studio.',
    submitted,
  };
}

export async function projectPersonaChatReadinessContextSummary(
  persona: OwnerPortfolioPersonaDetail,
  _realm?: StudioRealmClient,
): Promise<PersonaChatReadinessSummaryResult> {
  const submitted = buildPersonaChatReadinessProjectionInput(persona);
  if (!submitted) {
    return {
      ok: false,
      source: REALM_RUNTIME_PROJECTION_SOURCE,
      truthWrite: false,
      failure: 'runtime-projection-world-unavailable',
      message: 'localAgent Chat readiness projection requires RealmPersona id and worldId evidence.',
      submitted: null,
    };
  }

  return {
    ok: false,
    source: REALM_RUNTIME_PROJECTION_SOURCE,
    truthWrite: false,
    failure: 'runtime-projection-not-admitted',
    message: 'Runtime source materialization requires a protected Runtime-issued challenge and is not admitted for Persona Studio.',
    submitted,
  };
}
