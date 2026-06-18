import {
  createNimiRuntimeAIModel,
  runNimiTextGenerate,
  type NimiGenerateTextRequest,
} from '@nimiplatform/sdk/ai';
import type { NimiJsonObject, NimiMessage } from '@nimiplatform/sdk/contracts';
import {
  createNimiRuntimeLocalModelCenterClient,
  createNimiRuntimeRouteOptionsHostDeps,
  isNimiRuntimeLocalEnvironmentDependencyJobActiveState,
  isNimiRuntimeLocalEnvironmentDependencyReadyState,
  isNimiRuntimeLocalEnvironmentDependencyStartableState,
  listNimiRuntimeLocalAssetEntries,
  listNimiRuntimeRouteOptionsWithHost,
  resolveNimiRuntimeLocalImageNativeEnvironmentPlan,
  runNimiRuntimeScenarioJob,
  toNimiRuntimeProtoStruct,
  toNimiRuntimeVoiceReference,
  type NimiRuntimeLocalAssetEntry,
  type NimiRuntimeLocalEnvironmentDependencyJob,
  type NimiRuntimeLocalEnvironmentPlan,
  type NimiRuntimeLocalEnvironmentPlanDependency,
  type NimiRuntimeRouteBinding,
  type NimiRuntimeRouteOptionsSnapshot,
  type NimiRuntimeSpeechVoiceReference,
  type Runtime,
} from '@nimiplatform/sdk/runtime';
import type { NimiAIConfigTargetRef } from '@nimiplatform/sdk/ai';
import { COMPANION_SLOTS } from '@nimiplatform/kit/features/model-config/headless';
import {
  ExecutionMode,
  FallbackPolicy,
  FinishReason,
  RoutePolicy,
  ScenarioType,
  SpeechTimingMode,
  type ExecuteScenarioRequest,
  type ExecuteScenarioResponse,
  type ImageGenerateScenarioSpec,
  type SpeechSynthesizeScenarioSpec,
} from '@nimiplatform/sdk/runtime/generated';
import type { CoreMetadata } from '@nimiplatform/sdk/types';
import {
  readStudioAIConfigSelectedParams,
  readStudioAIConfigTargetRef,
} from '@renderer/features/ai-config/studio-ai-config-store.js';

/**
 * Studio AI runtime route resolver. No env model ids, no Runtime implicit
 * "auto" dispatch: every call is rebound to a concrete Runtime route before it
 * reaches ScenarioService.
 */

export const STUDIO_APP_ID = 'nimi.realm-persona-studio' as const;

export type StudioAISurfaceId =
  | 'realm-persona-studio.persona-seed'
  | 'realm-persona-studio.persona-reference-image'
  | 'realm-persona-studio.settings-proposal'
  | 'realm-persona-studio.post-copy'
  | 'realm-persona-studio.visual-image-candidate'
  | 'realm-persona-studio.avatar-package-candidate'
  | 'realm-persona-studio.voice-demo-candidate'
  | 'realm-persona-studio.world-context-projection';

/**
 * Call metadata stamped on every runtime call so the Runtime broker can
 * attribute traces + apply per-surface routing rules.
 */
export function buildStudioRuntimeMetadata(surfaceId: StudioAISurfaceId) {
  return {
    callerKind: 'third-party-app' as const,
    callerId: STUDIO_APP_ID,
    surfaceId,
  };
}

function toStudioCoreMetadata(
  surfaceId: StudioAISurfaceId,
  metadata: NimiJsonObject | undefined,
): CoreMetadata {
  const projected: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (typeof value === 'string') {
      projected[key] = value;
    }
  }
  return {
    ...buildStudioRuntimeMetadata(surfaceId),
    ...projected,
  };
}

function toRuntimeRoutePolicy(route: 'local' | 'cloud' | undefined): RoutePolicy {
  if (route === 'local') return RoutePolicy.LOCAL;
  if (route === 'cloud') return RoutePolicy.CLOUD;
  return RoutePolicy.UNSPECIFIED;
}

export function studioTextMessage(role: NimiMessage['role'], text: string): NimiMessage {
  return {
    role,
    content: [{ type: 'text', text }],
  };
}

export type StudioTextCallDefaults = {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type StudioTextCallParams = {
  model: string;
  route?: 'local' | 'cloud';
  connectorId?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: readonly string[];
  timeoutMs?: number;
};

export type StudioTextGeneratePayload = {
  readonly surfaceId: StudioAISurfaceId;
  readonly params: StudioTextCallParams;
  readonly request: NimiGenerateTextRequest;
};

export function buildStudioTextRequestParameters(
  params: StudioTextCallParams,
  metadata: NimiJsonObject,
): NonNullable<NimiGenerateTextRequest['parameters']> {
  return {
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params.topP !== undefined ? { topP: params.topP } : {}),
    ...(params.topK !== undefined ? { topK: params.topK } : {}),
    ...(params.maxTokens !== undefined ? { maxTokens: params.maxTokens } : {}),
    ...(params.presencePenalty !== undefined ? { presencePenalty: params.presencePenalty } : {}),
    ...(params.frequencyPenalty !== undefined ? { frequencyPenalty: params.frequencyPenalty } : {}),
    ...(params.stop && params.stop.length > 0 ? { stop: params.stop } : {}),
    metadata,
  };
}

export type StudioRuntimeAIClient = Runtime;

export type StudioTextGenerationOutput = {
  readonly text: string;
  readonly submitted: StudioTextGeneratePayload;
  readonly finishReason?: string;
  readonly trace?: {
    readonly traceId?: string;
    readonly modelResolved?: string;
  };
};

export function resolveStudioTextCallParams(
  _surfaceId: StudioAISurfaceId,
  defaults: StudioTextCallDefaults = {},
): StudioTextCallParams {
  const selected = readStudioAIConfigSelectedParams('text.generate');
  const stop = readStringArrayParam(selected, 'stopSequences');
  return {
    model: 'auto',
    ...numberField('temperature', selected, defaults.temperature),
    ...numberField('topP', selected, defaults.topP),
    ...numberField('topK', selected, undefined),
    ...numberField('maxTokens', selected, defaults.maxTokens),
    ...numberField('presencePenalty', selected, undefined),
    ...numberField('frequencyPenalty', selected, undefined),
    ...(stop.length > 0 ? { stop } : {}),
    ...numberField('timeoutMs', selected, defaults.timeoutMs),
  };
}

type StudioResolvedRuntimeRouteBinding = {
  readonly model: string;
  readonly route: 'local' | 'cloud';
  readonly connectorId?: string;
  readonly localModelId?: string;
  readonly provider?: string;
  readonly targetRef: NimiAIConfigTargetRef;
  readonly selectedParams: Readonly<Record<string, unknown>>;
  readonly snapshot: NimiRuntimeRouteOptionsSnapshot;
};

type StudioRuntimeRouteCapability = 'text.generate' | 'image.generate' | 'audio.synthesize';
type StudioScenarioExtension = ExecuteScenarioRequest['extensions'][number];

const STUDIO_BOUND_ROUTE_SYMBOL: unique symbol = Symbol('realm-persona-studio.bound-route');

type StudioBoundRouteEvidence = {
  readonly capability: StudioRuntimeRouteCapability;
  readonly targetRef: NimiAIConfigTargetRef;
  readonly model: string;
  readonly route: 'local' | 'cloud';
  readonly connectorId?: string;
};

type StudioBoundPayload<TPayload> = TPayload & {
  readonly [STUDIO_BOUND_ROUTE_SYMBOL]: StudioBoundRouteEvidence;
};

export type StudioBoundTextGeneratePayload = StudioBoundPayload<StudioTextGeneratePayload>;
export type StudioBoundImageGeneratePayload = StudioBoundPayload<StudioImageGeneratePayload>;
export type StudioBoundSpeechSynthesizePayload = StudioBoundPayload<StudioSpeechSynthesizePayload>;

function normalizeStudioRouteText(value: unknown): string {
  return String(value || '').trim();
}

function readNumberParam(
  params: Readonly<Record<string, unknown>>,
  key: string,
): number | undefined {
  const raw = params[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readStringParam(
  params: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const raw = params[key];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const normalized = raw.trim();
  return normalized || undefined;
}

function readStringArrayParam(
  params: Readonly<Record<string, unknown>>,
  key: string,
): string[] {
  const raw = params[key];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => typeof entry === 'string' ? entry.trim() : '')
    .filter(Boolean);
}

function readFirstNumberParam(
  params: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = readNumberParam(params, key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function readFirstStringParam(
  params: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = readStringParam(params, key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function numberField<K extends string>(
  key: K,
  params: Readonly<Record<string, unknown>>,
  fallback: number | undefined,
): Partial<Record<K, number>> {
  const configured = readNumberParam(params, key);
  const value = configured ?? fallback;
  return value === undefined ? {} : { [key]: value } as Partial<Record<K, number>>;
}

function isAutoStudioRouteModel(value: unknown): boolean {
  const normalized = normalizeStudioRouteText(value).toLowerCase();
  return !normalized || normalized === 'auto';
}

function bindingModel(binding: NimiRuntimeRouteBinding): string {
  return normalizeStudioRouteText(binding.modelId || binding.model);
}

function bindingToResolved(
  binding: NimiRuntimeRouteBinding,
  snapshot: NimiRuntimeRouteOptionsSnapshot,
  targetRef: NimiAIConfigTargetRef,
  selectedParams: Readonly<Record<string, unknown>>,
): StudioResolvedRuntimeRouteBinding | null {
  const model = bindingModel(binding);
  if (!model) return null;
  if (binding.source === 'cloud') {
    const connectorId = normalizeStudioRouteText(binding.connectorId);
    if (!connectorId) return null;
    return {
      model,
      route: 'cloud',
      connectorId,
      provider: normalizeStudioRouteText(binding.provider) || undefined,
      targetRef,
      selectedParams,
      snapshot,
    };
  }
  const localModelId = normalizeStudioRouteText(binding.localModelId || binding.goRuntimeLocalModelId);
  return {
    model,
    route: 'local',
    ...(localModelId ? { localModelId } : {}),
    provider: normalizeStudioRouteText(binding.provider || binding.engine) || undefined,
    targetRef,
    selectedParams,
    snapshot,
  };
}

function routeCandidates(snapshot: NimiRuntimeRouteOptionsSnapshot): NimiRuntimeRouteBinding[] {
  return [
    ...snapshot.local.models.map((model): NimiRuntimeRouteBinding => ({
      source: 'local',
      connectorId: '',
      model: normalizeStudioRouteText(model.modelId || model.model),
      modelId: normalizeStudioRouteText(model.modelId || model.model) || undefined,
      provider: normalizeStudioRouteText(model.provider || model.engine) || undefined,
      localModelId: normalizeStudioRouteText(model.localModelId) || undefined,
      engine: normalizeStudioRouteText(model.engine) || undefined,
      endpoint: normalizeStudioRouteText(model.endpoint || snapshot.local.defaultEndpoint) || undefined,
      goRuntimeLocalModelId: normalizeStudioRouteText(model.goRuntimeLocalModelId) || undefined,
      goRuntimeStatus: normalizeStudioRouteText(model.goRuntimeStatus || model.status) || undefined,
    })),
    ...snapshot.connectors.flatMap((connector) =>
      connector.models.map((model): NimiRuntimeRouteBinding => ({
        source: 'cloud',
        connectorId: connector.id,
        model,
        modelId: model,
        provider: normalizeStudioRouteText(connector.provider) || undefined,
      }))),
  ].filter((binding) => bindingModel(binding));
}

function localTargetRefReadinessParts(
  targetRef: Extract<NimiAIConfigTargetRef, { readonly kind: 'local-runtime' }>,
): string[] {
  const readinessParts = normalizeStudioRouteText(targetRef.readinessRef).split(':').map(normalizeStudioRouteText);
  return readinessParts.length >= 4
    && readinessParts[0] === 'runtime-route'
    && readinessParts[1] === 'local'
    ? readinessParts
    : [];
}

function localTargetRefModelCandidates(targetRef: Extract<NimiAIConfigTargetRef, { readonly kind: 'local-runtime' }>): string[] {
  const readinessParts = localTargetRefReadinessParts(targetRef);
  return [
    normalizeStudioRouteText(targetRef.profileId),
    normalizeStudioRouteText(readinessParts[3]),
  ].filter(Boolean);
}

function localTargetRefEngineCandidates(targetRef: Extract<NimiAIConfigTargetRef, { readonly kind: 'local-runtime' }>): string[] {
  const readinessParts = localTargetRefReadinessParts(targetRef);
  return [
    normalizeStudioRouteText(targetRef.targetId),
    normalizeStudioRouteText(readinessParts[2]),
  ].filter((value) => value && value !== 'local-runtime');
}

function findTargetRefRouteCandidate(
  candidates: readonly NimiRuntimeRouteBinding[],
  targetRef: NimiAIConfigTargetRef,
): NimiRuntimeRouteBinding | null {
  if (targetRef.kind === 'profile-slice') {
    return null;
  }

  if (targetRef.kind === 'cloud-connector') {
    const connectorId = normalizeStudioRouteText(targetRef.connectorId).toLowerCase();
    const providerModelId = normalizeStudioRouteText(targetRef.providerModelId).toLowerCase();
    const matches = candidates.filter((candidate) => {
      if (candidate.source !== 'cloud') {
        return false;
      }
      const candidateConnectorId = normalizeStudioRouteText(candidate.connectorId).toLowerCase();
      const modelTokens = [
        candidate.model,
        candidate.modelId,
      ].map((value) => normalizeStudioRouteText(value).toLowerCase()).filter(Boolean);
      return candidateConnectorId === connectorId && modelTokens.includes(providerModelId);
    });
    return matches.length === 1 ? matches[0]! : null;
  }

  const targetModelTokens = new Set(localTargetRefModelCandidates(targetRef).map((value) => value.toLowerCase()));
  if (targetModelTokens.size === 0) {
    return null;
  }
  const targetEngineTokens = new Set(localTargetRefEngineCandidates(targetRef).map((value) => value.toLowerCase()));
  const modelMatches = candidates.filter((candidate) => {
    if (candidate.source !== 'local') {
      return false;
    }
    const candidateModelTokens = [
      candidate.model,
      candidate.modelId,
      candidate.localModelId,
      candidate.goRuntimeLocalModelId,
    ].map((value) => normalizeStudioRouteText(value).toLowerCase()).filter(Boolean);
    return candidateModelTokens.some((token) => targetModelTokens.has(token));
  });
  const engineMatches = targetEngineTokens.size === 0
    ? modelMatches
    : modelMatches.filter((candidate) => [
      candidate.engine,
      candidate.provider,
    ].map((value) => normalizeStudioRouteText(value).toLowerCase()).some((token) => targetEngineTokens.has(token)));
  const matches = targetEngineTokens.size === 0 ? modelMatches : engineMatches;
  return matches.length === 1 ? matches[0]! : null;
}

function targetRefFailureMessage(
  capability: StudioRuntimeRouteCapability,
  targetRef: NimiAIConfigTargetRef | null,
  snapshot: NimiRuntimeRouteOptionsSnapshot,
): string {
  if (!targetRef) {
    return `NimiAIConfig targetRef missing for ${capability}. Configure AI models before running Studio AI.`;
  }
  if (targetRef.kind === 'profile-slice') {
    return `NimiAIConfig targetRef for ${capability} is a profile-slice and cannot be executed until applied to a concrete Runtime target.`;
  }
  const candidates = routeCandidates(snapshot);
  if (candidates.length === 0) {
    return `Runtime ${capability} route binding unavailable for configured NimiAIConfig target.`;
  }
  return `Runtime ${capability} route binding is missing or ambiguous for configured NimiAIConfig target.`;
}

export async function resolveStudioRuntimeRouteBinding(input: {
  readonly runtime: Runtime;
  readonly capability: StudioRuntimeRouteCapability;
  readonly targetRef?: NimiAIConfigTargetRef | null;
}): Promise<StudioResolvedRuntimeRouteBinding> {
  const targetRef = input.targetRef === undefined
    ? readStudioAIConfigTargetRef(input.capability)
    : input.targetRef;
  const selectedParams = readStudioAIConfigSelectedParams(input.capability);
  const snapshot = await listNimiRuntimeRouteOptionsWithHost(
    { capability: input.capability },
    createNimiRuntimeRouteOptionsHostDeps(input.runtime),
  );
  if (targetRef) {
    const configured = findTargetRefRouteCandidate(routeCandidates(snapshot), targetRef);
    const resolved = configured ? bindingToResolved(configured, snapshot, targetRef, selectedParams) : null;
    if (!resolved) {
      throw new Error(targetRefFailureMessage(input.capability, targetRef, snapshot));
    }
    return resolved;
  }
  throw new Error(targetRefFailureMessage(input.capability, null, snapshot));
}

function attachBoundRouteEvidence<TPayload>(
  payload: TPayload,
  capability: StudioRuntimeRouteCapability,
  binding: StudioResolvedRuntimeRouteBinding,
): StudioBoundPayload<TPayload> {
  return Object.defineProperty(payload, STUDIO_BOUND_ROUTE_SYMBOL, {
    value: {
      capability,
      targetRef: binding.targetRef,
      model: binding.model,
      route: binding.route,
      ...(binding.connectorId ? { connectorId: binding.connectorId } : {}),
    } satisfies StudioBoundRouteEvidence,
    enumerable: false,
  }) as StudioBoundPayload<TPayload>;
}

function bindTextPayloadToRoute(
  payload: StudioTextGeneratePayload,
  binding: StudioResolvedRuntimeRouteBinding,
): StudioBoundTextGeneratePayload {
  return attachBoundRouteEvidence({
    ...payload,
    params: {
      ...payload.params,
      model: binding.model,
      route: binding.route,
      ...(binding.connectorId ? { connectorId: binding.connectorId } : {}),
    },
    request: {
      ...payload.request,
      model: {
        modelId: binding.model,
        ...(binding.connectorId ? { providerId: binding.connectorId } : {}),
      },
    },
  }, 'text.generate', binding);
}

export async function bindStudioTextGeneratePayload(
  payload: StudioTextGeneratePayload,
  runtime: Runtime,
): Promise<StudioBoundTextGeneratePayload> {
  const binding = await resolveStudioRuntimeRouteBinding({
    runtime,
    capability: 'text.generate',
  });
  return bindTextPayloadToRoute(payload, binding);
}

export async function runStudioTextGenerate(
  payload: StudioTextGeneratePayload,
  runtime: StudioRuntimeAIClient,
): Promise<StudioTextGenerationOutput> {
  const boundPayload = await bindStudioTextGeneratePayload(payload, runtime);
  assertBoundStudioTextPayload(boundPayload);
  const model = createNimiRuntimeAIModel({
    runtime,
    appId: STUDIO_APP_ID,
    model: boundPayload.request.model,
    routePolicy: boundPayload.params.route,
    connectorId: boundPayload.params.connectorId,
    timeoutMs: boundPayload.params.timeoutMs,
    metadata: toStudioCoreMetadata(boundPayload.surfaceId, boundPayload.request.parameters?.metadata),
  });
  const result = await runNimiTextGenerate({
    runtime: { model },
    request: boundPayload.request,
  });
  if (!result.ok) {
    throw result.error.cause instanceof Error
      ? result.error.cause
      : new Error(result.error.message);
  }
  const raw = result.result.raw && typeof result.result.raw === 'object' && !Array.isArray(result.result.raw)
    ? result.result.raw as { readonly traceId?: unknown; readonly modelResolved?: unknown }
    : {};
  return {
    text: result.text,
    submitted: boundPayload,
    finishReason: result.result.finishReason,
    trace: {
      ...(typeof raw.traceId === 'string' && raw.traceId ? { traceId: raw.traceId } : {}),
      ...(typeof raw.modelResolved === 'string' && raw.modelResolved ? { modelResolved: raw.modelResolved } : {}),
    },
  };
}

type StudioImageProfileEntry = NimiJsonObject;
type StudioImageEntryOverride = NimiJsonObject & {
  readonly entry_id: string;
  readonly local_asset_id: string;
};

type StudioImageRuntimeBinding = {
  readonly binding: StudioResolvedRuntimeRouteBinding;
  readonly profileEntries: readonly StudioImageProfileEntry[];
  readonly entryOverrides?: readonly StudioImageEntryOverride[];
};

const STUDIO_LOCAL_IMAGE_ENVIRONMENT_PREPARE_TIMEOUT_MS = 90_000;
const STUDIO_LOCAL_IMAGE_ENVIRONMENT_POLL_MS = 1_500;

function optionalStudioParamText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function selectedCompanionSlots(params: Readonly<Record<string, unknown>>): Record<string, string> {
  const raw = params.companionSlots;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [slot, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalized = optionalStudioParamText(value);
    if (slot.trim() && normalized) {
      out[slot.trim()] = normalized;
    }
  }
  return out;
}

function isJsonRecord(value: unknown): value is NimiJsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function configuredImageProfileEntries(params: Readonly<Record<string, unknown>>): StudioImageProfileEntry[] | null {
  const configuredEntries = Array.isArray(params.profile_entries)
    ? params.profile_entries
    : Array.isArray(params.profileEntries) ? params.profileEntries : null;
  if (!configuredEntries || configuredEntries.length === 0) return null;
  const entries = configuredEntries.filter(isJsonRecord);
  if (entries.length !== configuredEntries.length) {
    throw new Error('image.generate profile_entries must contain only JSON object entries.');
  }
  return entries;
}

function imageEntryAssetId(entry: unknown): string {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return '';
  const record = entry as Record<string, unknown>;
  const slot = optionalStudioParamText(record.engine_slot ?? record.engineSlot);
  if (slot) return '';
  const kind = optionalStudioParamText(record.asset_kind ?? record.assetKind).toLowerCase();
  if (kind && kind !== 'image' && kind !== 'local_asset_kind_image') return '';
  return optionalStudioParamText(record.asset_id ?? record.assetId);
}

function imageModelAssetIdFromConfiguredEntries(entries: readonly unknown[]): string {
  for (const entry of entries) {
    const assetId = imageEntryAssetId(entry);
    if (assetId) return assetId;
  }
  return '';
}

function assetMatchesId(asset: NimiRuntimeLocalAssetEntry, id: string): boolean {
  const normalized = optionalStudioParamText(id);
  return Boolean(normalized) && (
    optionalStudioParamText(asset.localAssetId) === normalized
    || optionalStudioParamText(asset.assetId) === normalized
  );
}

function findLocalAssetById(
  assets: readonly NimiRuntimeLocalAssetEntry[],
  id: string,
): NimiRuntimeLocalAssetEntry | null {
  return assets.find((asset) => assetMatchesId(asset, id)) ?? null;
}

function imageProfileEntryForAsset(input: {
  readonly entryId: string;
  readonly title: string;
  readonly capability: string;
  readonly asset: NimiRuntimeLocalAssetEntry;
  readonly engineSlot?: string;
  readonly required?: boolean;
}): StudioImageProfileEntry {
  return {
    entry_id: input.entryId,
    kind: 'asset',
    title: input.title,
    capability: input.capability,
    asset_id: input.asset.assetId || input.asset.localAssetId,
    asset_kind: input.asset.kind,
    engine: input.asset.engine,
    ...(input.engineSlot ? { engine_slot: input.engineSlot } : {}),
    ...(typeof input.required === 'boolean' ? { required: input.required } : {}),
  };
}

function runtimeDependencyBlocksImageEnvironment(
  dependency: NimiRuntimeLocalEnvironmentPlanDependency,
): boolean {
  return dependency.required && !isNimiRuntimeLocalEnvironmentDependencyReadyState(dependency.state);
}

function runtimeDependencyJobMatchesDependency(
  job: NimiRuntimeLocalEnvironmentDependencyJob,
  dependency: NimiRuntimeLocalEnvironmentPlanDependency,
): boolean {
  return (
    job.environmentKey === dependency.environmentKey
    && job.dependencyFamily === dependency.dependencyFamily
    && job.dependencyId === dependency.dependencyId
  );
}

function runtimeDependencyStartable(
  dependency: NimiRuntimeLocalEnvironmentPlanDependency,
  jobs: readonly NimiRuntimeLocalEnvironmentDependencyJob[],
): boolean {
  if (!dependency.required || !dependency.environmentKey) return false;
  if (!isNimiRuntimeLocalEnvironmentDependencyStartableState(dependency.state)) return false;
  return !jobs.some((job) => (
    runtimeDependencyJobMatchesDependency(job, dependency)
    && isNimiRuntimeLocalEnvironmentDependencyJobActiveState(job.state)
  ));
}

function summarizeLocalImageEnvironmentDependencies(
  dependencies: readonly NimiRuntimeLocalEnvironmentPlanDependency[],
): string {
  return dependencies
    .slice(0, 4)
    .map((dependency) => `${dependency.dependencyFamily}:${dependency.dependencyId}=${dependency.state}`)
    .join(', ');
}

function localImageEnvironmentAssetInput(asset: NimiRuntimeLocalAssetEntry) {
  return {
    assetId: asset.assetId,
    localAssetId: asset.localAssetId,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

async function listLocalImageEnvironmentJobs(
  localModelCenter: ReturnType<typeof createNimiRuntimeLocalModelCenterClient>,
  dependencies: readonly NimiRuntimeLocalEnvironmentPlanDependency[],
): Promise<NimiRuntimeLocalEnvironmentDependencyJob[]> {
  const environmentKeys = [...new Set(dependencies.map((dependency) => dependency.environmentKey).filter(Boolean))];
  if (environmentKeys.length === 0) return [];
  const jobGroups = await Promise.all(environmentKeys.map((environmentKey) =>
    localModelCenter.listEnvironmentDependencyJobs({ environmentKey })));
  return jobGroups.flat();
}

async function resolveLocalImageEnvironmentPlan(
  localModelCenter: ReturnType<typeof createNimiRuntimeLocalModelCenterClient>,
  asset: NimiRuntimeLocalAssetEntry,
): Promise<NimiRuntimeLocalEnvironmentPlan> {
  return resolveNimiRuntimeLocalImageNativeEnvironmentPlan({
    runtime: localModelCenter,
    asset: localImageEnvironmentAssetInput(asset),
  });
}

async function waitForLocalImageEnvironmentReady(
  localModelCenter: ReturnType<typeof createNimiRuntimeLocalModelCenterClient>,
  asset: NimiRuntimeLocalAssetEntry,
  timeoutMs: number,
): Promise<NimiRuntimeLocalEnvironmentPlan> {
  const deadline = Date.now() + timeoutMs;
  let plan = await resolveLocalImageEnvironmentPlan(localModelCenter, asset);
  while (plan.dependencies.some(runtimeDependencyBlocksImageEnvironment) && Date.now() < deadline) {
    await sleep(STUDIO_LOCAL_IMAGE_ENVIRONMENT_POLL_MS);
    plan = await resolveLocalImageEnvironmentPlan(localModelCenter, asset);
  }
  return plan;
}

async function prepareStudioLocalImageRuntimeEnvironment(
  runtime: Runtime,
  asset: NimiRuntimeLocalAssetEntry,
): Promise<void> {
  const localModelCenter = createNimiRuntimeLocalModelCenterClient({ local: runtime.local });
  let plan = await resolveLocalImageEnvironmentPlan(localModelCenter, asset);
  let blockingDependencies = plan.dependencies.filter(runtimeDependencyBlocksImageEnvironment);
  if (blockingDependencies.length === 0) return;

  const jobs = await listLocalImageEnvironmentJobs(localModelCenter, blockingDependencies);
  const startableDependencies = blockingDependencies.filter((dependency) =>
    runtimeDependencyStartable(dependency, jobs));
  if (startableDependencies.length > 0) {
    await Promise.all(startableDependencies.map((dependency) =>
      localModelCenter.startEnvironmentDependencyJob({
        environmentKey: dependency.environmentKey,
        dependencyFamily: dependency.dependencyFamily,
        dependencyId: dependency.dependencyId,
        sourceKind: dependency.sourceKind,
        confirmed: true,
        consumerScope: dependency.consumerScope,
      }, { caller: 'core' })));
    plan = await resolveLocalImageEnvironmentPlan(localModelCenter, asset);
    blockingDependencies = plan.dependencies.filter(runtimeDependencyBlocksImageEnvironment);
  }

  if (blockingDependencies.length === 0) return;

  plan = await waitForLocalImageEnvironmentReady(
    localModelCenter,
    asset,
    STUDIO_LOCAL_IMAGE_ENVIRONMENT_PREPARE_TIMEOUT_MS,
  );
  blockingDependencies = plan.dependencies.filter(runtimeDependencyBlocksImageEnvironment);
  if (blockingDependencies.length === 0) return;

  const summary = summarizeLocalImageEnvironmentDependencies(blockingDependencies);
  throw new Error(
    `Runtime local image environment is still preparing (${summary}). Studio started required local dependency activation; retry after Runtime finishes preparing the image environment.`,
  );
}

async function resolveStudioImageRuntimeBinding(
  runtime: Runtime,
  binding: StudioResolvedRuntimeRouteBinding,
): Promise<StudioImageRuntimeBinding> {
  const configuredEntries = configuredImageProfileEntries(binding.selectedParams);
  if (configuredEntries) {
    const configuredModel = imageModelAssetIdFromConfiguredEntries(configuredEntries);
    if (configuredModel && !(
      optionalStudioParamText(configuredModel) === optionalStudioParamText(binding.model)
      || optionalStudioParamText(configuredModel) === optionalStudioParamText(binding.localModelId)
    )) {
      throw new Error(`image.generate profile_entries main model ${configuredModel} does not match the NimiAIConfig targetRef resolved model ${binding.model}.`);
    }
    if (binding.route === 'local') {
      const assets = await listNimiRuntimeLocalAssetEntries(runtime);
      const mainAsset = findLocalAssetById(assets, binding.model);
      if (!mainAsset) {
        throw new Error(`image.generate active model ${binding.model} is not present in Runtime local assets; reselect the Image active model.`);
      }
      if (configuredModel && !assetMatchesId(mainAsset, configuredModel)) {
        throw new Error(`image.generate profile_entries main model ${configuredModel} is not the Runtime local asset selected by NimiAIConfig targetRef.`);
      }
      await prepareStudioLocalImageRuntimeEnvironment(runtime, mainAsset);
      return {
        binding: {
          ...binding,
          model: mainAsset.assetId || binding.model,
          localModelId: mainAsset.localAssetId || binding.localModelId,
          provider: mainAsset.engine || binding.provider,
        },
        profileEntries: configuredEntries,
      };
    }
    return {
      binding,
      profileEntries: configuredEntries,
    };
  }

  if (binding.route !== 'local') {
    return {
      binding,
      profileEntries: [{
        entry_id: 'main-image',
        kind: 'asset',
        title: 'Main image model',
        capability: 'image.generate',
        asset_id: binding.model,
        asset_kind: 'image',
        engine: binding.provider || 'media',
        required: true,
      }],
    };
  }

  const assets = await listNimiRuntimeLocalAssetEntries(runtime);
  const mainAsset = findLocalAssetById(assets, binding.model);
  if (!mainAsset) {
    throw new Error(`image.generate active model ${binding.model} is not present in Runtime local assets; reselect the Image active model.`);
  }
  await prepareStudioLocalImageRuntimeEnvironment(runtime, mainAsset);

  const companionSlots = selectedCompanionSlots(binding.selectedParams);
  const profileEntries: StudioImageProfileEntry[] = [
    imageProfileEntryForAsset({
      entryId: 'main-image',
      title: 'Main image model',
      capability: 'image.generate',
      asset: mainAsset,
      required: true,
    }),
  ];
  const entryOverrides: StudioImageEntryOverride[] = [{
    entry_id: 'main-image',
    local_asset_id: mainAsset.localAssetId,
  }];

  for (const slot of COMPANION_SLOTS) {
    const selected = companionSlots[slot.slot];
    if (!selected) continue;
    const asset = findLocalAssetById(assets, selected);
    if (!asset) {
      throw new Error(`image.generate companion slot ${slot.slot} references missing Runtime local asset ${selected}; reselect the companion model.`);
    }
    const entryId = `companion-${slot.slot.replace(/_path$/u, '').replace(/[^a-zA-Z0-9._:-]+/gu, '-')}`;
    profileEntries.push(imageProfileEntryForAsset({
      entryId,
      title: `${slot.label} companion`,
      capability: 'image.generate',
      asset,
      engineSlot: slot.slot,
    }));
    entryOverrides.push({
      entry_id: entryId,
      local_asset_id: asset.localAssetId,
    });
  }

  return {
    binding: {
      ...binding,
      model: mainAsset.assetId || binding.model,
      localModelId: mainAsset.localAssetId || binding.localModelId,
      provider: mainAsset.engine || binding.provider,
    },
    profileEntries,
    entryOverrides,
  };
}

function imageProfileExtensions(binding: StudioImageRuntimeBinding): StudioScenarioExtension[] {
  const {
    companionSlots: _companionSlots,
    profileEntries: _profileEntries,
    profile_entries: _profileEntriesSnake,
    entry_overrides: _entryOverridesSnake,
    entryOverrides: _entryOverrides,
    ...forwardedParams
  } = binding.binding.selectedParams;
  return [{
    namespace: 'nimi.scenario.image.request',
    payload: toNimiRuntimeProtoStruct({
      ...forwardedParams,
      profile_entries: binding.profileEntries,
      ...(binding.entryOverrides && binding.entryOverrides.length > 0 ? { entry_overrides: binding.entryOverrides } : {}),
    }),
  }];
}

function parseVoiceReference(value: unknown): NimiRuntimeSpeechVoiceReference | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const kind = optionalStudioParamText(record.kind);
    if (kind === 'preset_voice_id') {
      return { kind, presetVoiceId: optionalStudioParamText(record.presetVoiceId ?? record.preset_voice_id) };
    }
    if (kind === 'voice_asset_id') {
      return { kind, voiceAssetId: optionalStudioParamText(record.voiceAssetId ?? record.voice_asset_id) };
    }
    if (kind === 'provider_voice_ref') {
      return { kind, providerVoiceRef: optionalStudioParamText(record.providerVoiceRef ?? record.provider_voice_ref) };
    }
    const providerVoiceRef = optionalStudioParamText(record.providerVoiceRef ?? record.provider_voice_ref);
    if (providerVoiceRef) return { kind: 'provider_voice_ref', providerVoiceRef };
    const presetVoiceId = optionalStudioParamText(record.presetVoiceId ?? record.preset_voice_id);
    if (presetVoiceId) return { kind: 'preset_voice_id', presetVoiceId };
    const voiceAssetId = optionalStudioParamText(record.voiceAssetId ?? record.voice_asset_id);
    if (voiceAssetId) return { kind: 'voice_asset_id', voiceAssetId };
    return undefined;
  }
  const text = optionalStudioParamText(value);
  if (!text) return undefined;
  const [prefix, ...rest] = text.split(':');
  const payload = rest.join(':').trim();
  if (prefix === 'preset_voice_id' && payload) return { kind: 'preset_voice_id', presetVoiceId: payload };
  if (prefix === 'voice_asset_id' && payload) return { kind: 'voice_asset_id', voiceAssetId: payload };
  if (prefix === 'provider_voice_ref' && payload) return { kind: 'provider_voice_ref', providerVoiceRef: payload };
  return { kind: 'provider_voice_ref', providerVoiceRef: text };
}

function voiceReferenceFromParams(params: Readonly<Record<string, unknown>>) {
  return toNimiRuntimeVoiceReference(parseVoiceReference(
    params.voiceRef
    ?? params.voice_ref
    ?? params.providerVoiceRef
    ?? params.provider_voice_ref
    ?? params.presetVoiceId
    ?? params.preset_voice_id
    ?? params.voiceAssetId
    ?? params.voice_asset_id,
  ));
}

export type StudioImageCallDefaults = {
  aspectRatio?: string;
  timeoutMs?: number;
};

export type StudioImageCallParams = {
  model: string;
  route?: 'local' | 'cloud';
  connectorId?: string;
  size?: string;
  aspectRatio?: string;
  seed?: string;
  responseFormat?: string;
  timeoutMs?: number;
};

export type StudioImageGeneratePayload = {
  readonly surfaceId: StudioAISurfaceId;
  readonly params: StudioImageCallParams;
  readonly request: ExecuteScenarioRequest;
};

export function resolveStudioImageCallParams(
  _surfaceId: StudioAISurfaceId,
  defaults: StudioImageCallDefaults = {},
): StudioImageCallParams {
  const selected = readStudioAIConfigSelectedParams('image.generate');
  const responseFormat = readStringParam(selected, 'responseFormat');
  return {
    model: 'auto',
    ...(readStringParam(selected, 'size') ? { size: readStringParam(selected, 'size') } : {}),
    ...(defaults.aspectRatio !== undefined ? { aspectRatio: defaults.aspectRatio } : {}),
    ...(readStringParam(selected, 'seed') ? { seed: readStringParam(selected, 'seed') } : {}),
    ...(responseFormat && responseFormat !== 'auto' ? { responseFormat } : {}),
    ...numberField('timeoutMs', selected, defaults.timeoutMs),
  };
}

function normalizeStudioScenarioInt64(value: string | number | bigint | null | undefined): string {
  if (value === undefined || value === null || value === '') {
    return '0';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  const text = String(value).trim();
  if (!/^-?\d+$/u.test(text)) {
    throw new Error(`Runtime image.generate seed must be an integer string, got ${text}.`);
  }
  return text;
}

function createScenarioRequestHead(params: {
  readonly model: string;
  readonly route?: 'local' | 'cloud';
  readonly connectorId?: string;
  readonly timeoutMs?: number;
}) {
  return {
    appId: STUDIO_APP_ID,
    subjectUserId: '',
    modelId: params.model,
    routePolicy: toRuntimeRoutePolicy(params.route),
    fallback: FallbackPolicy.DENY,
    timeoutMs: Number(params.timeoutMs ?? 0),
    connectorId: String(params.connectorId || ''),
  };
}

export function createStudioImageGeneratePayload(input: {
  readonly surfaceId: StudioAISurfaceId;
  readonly params: StudioImageCallParams;
  readonly spec: ImageGenerateScenarioSpec;
}): StudioImageGeneratePayload {
  const imageGenerateSpec: ImageGenerateScenarioSpec = {
    ...input.spec,
    seed: normalizeStudioScenarioInt64(input.spec.seed),
  };
  return {
    surfaceId: input.surfaceId,
    params: input.params,
    request: {
      head: createScenarioRequestHead(input.params),
      scenarioType: ScenarioType.IMAGE_GENERATE,
      executionMode: ExecutionMode.SYNC,
      spec: {
        spec: {
          oneofKind: 'imageGenerate',
          imageGenerate: imageGenerateSpec,
        },
      },
      extensions: [],
    },
  };
}

function bindScenarioPayloadToRoute<TPayload extends StudioImageGeneratePayload | StudioSpeechSynthesizePayload>(
  payload: TPayload,
  binding: StudioResolvedRuntimeRouteBinding,
  capability: 'image.generate' | 'audio.synthesize',
  options: {
    readonly extensions?: readonly StudioScenarioExtension[];
    readonly spec?: ExecuteScenarioRequest['spec'];
  } = {},
): StudioBoundPayload<TPayload> {
  return attachBoundRouteEvidence({
    ...payload,
    params: {
      ...payload.params,
      model: binding.model,
      route: binding.route,
      ...(binding.connectorId ? { connectorId: binding.connectorId } : {}),
    },
    request: {
      ...payload.request,
      head: createScenarioRequestHead({
        ...payload.params,
        model: binding.model,
        route: binding.route,
        connectorId: binding.connectorId,
      }),
      ...(options.spec ? { spec: options.spec } : {}),
      extensions: options.extensions ? [...options.extensions] : payload.request.extensions,
    },
  }, capability, binding);
}

export async function bindStudioImageGeneratePayload(
  payload: StudioImageGeneratePayload,
  runtime: Runtime,
): Promise<StudioBoundImageGeneratePayload> {
  const binding = await resolveStudioRuntimeRouteBinding({
    runtime,
    capability: 'image.generate',
  });
  const imageBinding = await resolveStudioImageRuntimeBinding(runtime, binding);
  return bindScenarioPayloadToRoute(payload, imageBinding.binding, 'image.generate', {
    extensions: imageProfileExtensions(imageBinding),
  });
}

export async function executeStudioImageGenerate(
  payload: StudioBoundImageGeneratePayload,
  runtime: Runtime,
): Promise<ExecuteScenarioResponse> {
  assertBoundStudioScenarioPayload('image.generate', payload);
  const jobResult = await runNimiRuntimeScenarioJob({
    ai: runtime.ai,
    request: {
      head: payload.request.head,
      scenarioType: payload.request.scenarioType,
      executionMode: ExecutionMode.ASYNC_JOB,
      spec: payload.request.spec,
      requestId: '',
      idempotencyKey: '',
      labels: {
        surfaceId: payload.surfaceId,
        capability: 'image.generate',
      },
      extensions: payload.request.extensions,
    },
    callOptions: {
      timeoutMs: payload.params.timeoutMs,
      metadata: toStudioCoreMetadata(payload.surfaceId, undefined),
    },
  });
  return {
    output: jobResult.output ?? {
      output: {
        oneofKind: 'imageGenerate',
        imageGenerate: {
          artifacts: [...jobResult.artifacts],
        },
      },
    },
    finishReason: FinishReason.STOP,
    routeDecision: jobResult.job.routeDecision,
    modelResolved: jobResult.job.modelResolved,
    traceId: jobResult.traceId || jobResult.job.traceId,
    ignoredExtensions: jobResult.job.ignoredExtensions,
    ...(jobResult.job.usage ? { usage: jobResult.job.usage } : {}),
  };
}

export function normalizeStudioImageGenerateFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'runtime transport call failed.';
  try {
    const parsed = JSON.parse(message) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const reasonCode = String(record.reasonCode || '');
      const actionHint = String(record.actionHint || '');
      const nestedMessage = String(record.message || '');
      if (
        reasonCode === 'AI_LOCAL_MODEL_UNAVAILABLE'
        || actionHint === 'inspect_local_runtime_model_health'
        || nestedMessage.includes('local environment activation blocked')
      ) {
        return 'Runtime local image environment is not ready. Studio requested local dependency activation; retry after Runtime finishes preparing the image environment.';
      }
    }
  } catch {
    // Non-JSON Runtime errors keep their original message.
  }
  return message;
}

export async function executeStudioImageRouteDescribe(
  payload: StudioBoundImageGeneratePayload,
  runtime: Runtime,
): Promise<ExecuteScenarioResponse> {
  assertBoundStudioScenarioPayload('image.generate', payload);
  return runtime.ai.executeScenario(payload.request, {
    timeoutMs: payload.params.timeoutMs,
    metadata: toStudioCoreMetadata(payload.surfaceId, undefined),
  });
}

export type StudioSpeechCallDefaults = {
  voice?: string;
  speed?: number;
  timeoutMs?: number;
};

export type StudioSpeechCallParams = {
  model: string;
  route?: 'local' | 'cloud';
  connectorId?: string;
  voice?: string;
  speed?: number;
  language?: string;
  audioFormat?: string;
  volume?: number;
  pitch?: number;
  timeoutMs?: number;
};

export type StudioSpeechSynthesizePayload = {
  readonly surfaceId: StudioAISurfaceId;
  readonly params: StudioSpeechCallParams;
  readonly request: ExecuteScenarioRequest;
};

export function resolveStudioSpeechCallParams(
  _surfaceId: StudioAISurfaceId,
  defaults: StudioSpeechCallDefaults = {},
): StudioSpeechCallParams {
  const selected = readStudioAIConfigSelectedParams('audio.synthesize');
  const audioFormat = readFirstStringParam(selected, ['responseFormat', 'response_format', 'audioFormat', 'audio_format']);
  const speed = readFirstNumberParam(selected, ['speakingRate', 'speaking_rate', 'speed']) ?? defaults.speed;
  const language = readFirstStringParam(selected, ['languageHint', 'language_hint', 'language']);
  const volume = readFirstNumberParam(selected, ['volume']);
  const pitch = readFirstNumberParam(selected, ['pitchSemitones', 'pitch_semitones', 'pitch']);
  const timeoutMs = readFirstNumberParam(selected, ['timeoutMs', 'timeout_ms']) ?? defaults.timeoutMs;
  return {
    model: 'auto',
    ...(defaults.voice !== undefined ? { voice: defaults.voice } : {}),
    ...(speed !== undefined ? { speed } : {}),
    ...(language ? { language } : {}),
    ...(audioFormat ? { audioFormat } : {}),
    ...(volume !== undefined ? { volume } : {}),
    ...(pitch !== undefined ? { pitch } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
}

export function createStudioSpeechSynthesizePayload(input: {
  readonly surfaceId: StudioAISurfaceId;
  readonly params: StudioSpeechCallParams;
  readonly spec: SpeechSynthesizeScenarioSpec;
}): StudioSpeechSynthesizePayload {
  return {
    surfaceId: input.surfaceId,
    params: input.params,
    request: {
      head: createScenarioRequestHead(input.params),
      scenarioType: ScenarioType.SPEECH_SYNTHESIZE,
      executionMode: ExecutionMode.SYNC,
      spec: {
        spec: {
          oneofKind: 'speechSynthesize',
          speechSynthesize: input.spec,
        },
      },
      extensions: [],
    },
  };
}

export async function bindStudioSpeechSynthesizePayload(
  payload: StudioSpeechSynthesizePayload,
  runtime: Runtime,
): Promise<StudioBoundSpeechSynthesizePayload> {
  const binding = await resolveStudioRuntimeRouteBinding({
    runtime,
    capability: 'audio.synthesize',
  });
  const scenarioSpec = payload.request.spec?.spec;
  const voiceRef = voiceReferenceFromParams(binding.selectedParams);
  const nextSpec = scenarioSpec?.oneofKind === 'speechSynthesize'
    ? {
      spec: {
        oneofKind: 'speechSynthesize' as const,
        speechSynthesize: {
          ...scenarioSpec.speechSynthesize,
          ...(voiceRef ? { voiceRef } : {}),
        },
      },
    }
    : payload.request.spec;
  return bindScenarioPayloadToRoute(payload, binding, 'audio.synthesize', {
    spec: nextSpec,
  });
}

export async function executeStudioSpeechSynthesize(
  payload: StudioBoundSpeechSynthesizePayload,
  runtime: Runtime,
): Promise<ExecuteScenarioResponse> {
  assertBoundStudioScenarioPayload('audio.synthesize', payload);
  return runtime.ai.executeScenario(payload.request, {
    timeoutMs: payload.params.timeoutMs,
    metadata: toStudioCoreMetadata(payload.surfaceId, undefined),
  });
}

export const STUDIO_DEFAULT_SPEECH_TIMING_MODE = SpeechTimingMode.UNSPECIFIED;

export function isStudioAIRouteBindingFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.startsWith('NimiAIConfig targetRef ')
    || message.includes(' configured NimiAIConfig target')
    || message.includes(' route binding is missing or ambiguous')
    || message.includes(' route binding unavailable')
    || message.includes(' payload must be bound through NimiAIConfig targetRef');
}

function readBoundRouteEvidence(payload: unknown): StudioBoundRouteEvidence | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const evidence = (payload as Partial<StudioBoundPayload<unknown>>)[STUDIO_BOUND_ROUTE_SYMBOL];
  return evidence || null;
}

function assertBoundRouteEvidence(
  capability: StudioRuntimeRouteCapability,
  payload: unknown,
): StudioBoundRouteEvidence {
  const evidence = readBoundRouteEvidence(payload);
  if (!evidence || evidence.capability !== capability) {
    throw new Error(`Runtime ${capability} payload must be bound through NimiAIConfig targetRef before execution.`);
  }
  return evidence;
}

function assertRouteHeadConsistency(input: {
  readonly capability: StudioRuntimeRouteCapability;
  readonly evidence: StudioBoundRouteEvidence;
  readonly params: {
    readonly model: string;
    readonly route?: 'local' | 'cloud';
    readonly connectorId?: string;
  };
  readonly head: ExecuteScenarioRequest['head'];
}): void {
  const { capability, evidence, params, head } = input;
  if (!head) {
    throw new Error(`Runtime ${capability} request head missing from the bound NimiAIConfig route.`);
  }
  if (isAutoStudioRouteModel(params.model)) {
    throw new Error(`Runtime ${capability} payload must be bound through NimiAIConfig targetRef before execution.`);
  }
  if (params.model !== evidence.model) {
    throw new Error(`Runtime ${capability} payload model does not match its NimiAIConfig targetRef binding.`);
  }
  if (params.route !== evidence.route) {
    throw new Error(`Runtime ${capability} payload route does not match its NimiAIConfig targetRef binding.`);
  }
  if (String(params.connectorId || '') !== String(evidence.connectorId || '')) {
    throw new Error(`Runtime ${capability} payload connectorId does not match its NimiAIConfig targetRef binding.`);
  }
  if (String(head.modelId || '') !== params.model) {
    throw new Error(`Runtime ${capability} request head.modelId does not match the bound NimiAIConfig route.`);
  }
  if (head.routePolicy !== toRuntimeRoutePolicy(params.route)) {
    throw new Error(`Runtime ${capability} request head.routePolicy does not match the bound NimiAIConfig route.`);
  }
  if (String(head.connectorId || '') !== String(params.connectorId || '')) {
    throw new Error(`Runtime ${capability} request head.connectorId does not match the bound NimiAIConfig route.`);
  }
}

function assertBoundStudioTextPayload(payload: StudioBoundTextGeneratePayload): void {
  const evidence = assertBoundRouteEvidence('text.generate', payload);
  if (isAutoStudioRouteModel(payload.params.model)) {
    throw new Error('Runtime text.generate payload must be bound through NimiAIConfig targetRef before execution.');
  }
  if (payload.params.model !== evidence.model) {
    throw new Error('Runtime text.generate payload model does not match its NimiAIConfig targetRef binding.');
  }
  if (payload.params.route !== evidence.route) {
    throw new Error('Runtime text.generate payload route does not match its NimiAIConfig targetRef binding.');
  }
  if (String(payload.params.connectorId || '') !== String(evidence.connectorId || '')) {
    throw new Error('Runtime text.generate payload connectorId does not match its NimiAIConfig targetRef binding.');
  }
  if (payload.request.model.modelId !== payload.params.model) {
    throw new Error('Runtime text.generate request modelId does not match the bound NimiAIConfig route.');
  }
  if (String(payload.request.model.providerId || '') !== String(payload.params.connectorId || '')) {
    throw new Error('Runtime text.generate request providerId does not match the bound NimiAIConfig route.');
  }
}

function assertBoundStudioScenarioPayload(
  capability: 'image.generate',
  payload: StudioBoundImageGeneratePayload,
): void;
function assertBoundStudioScenarioPayload(
  capability: 'audio.synthesize',
  payload: StudioBoundSpeechSynthesizePayload,
): void;
function assertBoundStudioScenarioPayload(
  capability: 'image.generate' | 'audio.synthesize',
  payload: StudioBoundImageGeneratePayload | StudioBoundSpeechSynthesizePayload,
): void {
  const evidence = assertBoundRouteEvidence(capability, payload);
  assertRouteHeadConsistency({
    capability,
    evidence,
    params: payload.params,
    head: payload.request.head,
  });
}
