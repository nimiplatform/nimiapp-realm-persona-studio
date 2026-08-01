import type {
  SharedAIConfigService,
  SharedAIConfigSubscribeListener,
  SharedAIConfigUnsubscribe,
} from '@nimiplatform/kit/features/model-config';
import {
  applyNimiAIProfileToConfig,
  createEmptyNimiAIConfig,
  createNimiAIConfigSubscriptionRegistry,
  createNimiAppAIScopeRef,
  encodeNimiAIScopeRef,
  formatNimiAIValidationIssues,
  parseNimiAIProfile,
  previewNimiAIProfileApply,
  validateNimiAIConfig,
  validateNimiAIProfile,
  versionNimiAIConfig,
  type NimiAIConfig,
  type NimiAIConfigTargetRef,
  type NimiAIProfile,
  type NimiAIProfileApplyOptions,
  type NimiAIProfileApplyResult,
  type NimiAIProfilePreviewOptions,
  type NimiAIProfilePreviewResult,
  type NimiAIScopeRef,
  type NimiAISnapshot,
} from '@nimiplatform/sdk/ai';
import {
  createStudioProtectedOperationUnavailableError,
  STUDIO_RUNTIME_APP_ID,
} from '@renderer/app-shell/studio-platform.js';

export const STUDIO_AI_CONFIG_SURFACE_ID = 'owner-workbench';

export type StudioAIProfileImportResult =
  | {
    ok: true;
    profile: NimiAIProfile;
    profileCount: number;
    message: string;
  }
  | {
    ok: false;
    errors: string[];
    message: string;
  };

const configSubscriptions = createNimiAIConfigSubscriptionRegistry();
const configCache = new Map<string, NimiAIConfig>();
const snapshotByExecution = new Map<string, NimiAISnapshot>();
const latestSnapshotByScope = new Map<string, string>();
let profileLibrary: NimiAIProfile[] = [];

export function createStudioAIScopeRef(): NimiAIScopeRef {
  return createNimiAppAIScopeRef(STUDIO_RUNTIME_APP_ID, STUDIO_AI_CONFIG_SURFACE_ID);
}

export async function hydrateStudioAIConfigFromProtectedBridge(
  scopeRef: NimiAIScopeRef = createStudioAIScopeRef(),
): Promise<NimiAIConfig> {
  throw createStudioProtectedOperationUnavailableError(
    `AI configuration for ${encodeNimiAIScopeRef(scopeRef)}`,
  );
}

export async function persistStudioAIConfigToProtectedBridge(
  config: NimiAIConfig,
): Promise<NimiAIConfig> {
  const validation = validateNimiAIConfig(config);
  if (!validation.valid) {
    throw new Error(`NimiAIConfig validation failed: ${formatNimiAIValidationIssues(validation.issues)}`);
  }
  throw createStudioProtectedOperationUnavailableError(
    `AI configuration for ${encodeNimiAIScopeRef(config.scopeRef)}`,
  );
}

export function listStudioAIProfiles(): NimiAIProfile[] {
  return [...profileLibrary];
}

export function importStudioAIProfileJson(rawJson: string): StudioAIProfileImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : String(error || 'Invalid JSON.')],
      message: 'AIProfile JSON could not be parsed.',
    };
  }

  let profile: NimiAIProfile;
  try {
    profile = parseNimiAIProfile(parsed);
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
      message: 'AIProfile validation failed.',
    };
  }

  const validation = validateNimiAIProfile(profile);
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.issues.map((issue) => `${issue.code}:${issue.path}`),
      message: 'AIProfile validation failed.',
    };
  }

  profileLibrary = [
    profile,
    ...profileLibrary.filter((existing) => existing.profileId !== profile.profileId),
  ];
  return {
    ok: true,
    profile,
    profileCount: profileLibrary.length,
    message: `Imported AIProfile ${profile.title || profile.profileId}.`,
  };
}

export function loadStudioAIConfig(scopeRef: NimiAIScopeRef = createStudioAIScopeRef()): NimiAIConfig {
  return configCache.get(encodeNimiAIScopeRef(scopeRef)) ?? createEmptyNimiAIConfig(scopeRef);
}

export function saveStudioAIConfig(
  next: NimiAIConfig,
  scopeRef: NimiAIScopeRef = createStudioAIScopeRef(),
  options?: { readonly expectedBaseVersion?: string },
): NimiAIConfig {
  const normalized = validateNextStudioAIConfig(next, scopeRef, options);
  cacheStudioAIConfig(normalized);
  return normalized;
}

export async function commitStudioAIConfigToProtectedBridge(
  next: NimiAIConfig,
  scopeRef: NimiAIScopeRef = createStudioAIScopeRef(),
  options?: { readonly expectedBaseVersion?: string },
): Promise<NimiAIConfig> {
  return persistStudioAIConfigToProtectedBridge(validateNextStudioAIConfig(next, scopeRef, options));
}

function validateNextStudioAIConfig(
  next: NimiAIConfig,
  scopeRef: NimiAIScopeRef,
  options?: { readonly expectedBaseVersion?: string },
): NimiAIConfig {
  const normalized = { ...next, scopeRef };
  const expectedBaseVersion = options?.expectedBaseVersion?.trim();
  if (expectedBaseVersion) {
    const currentVersion = versionNimiAIConfig(loadStudioAIConfig(scopeRef));
    if (currentVersion !== expectedBaseVersion) {
      throw new Error('NimiAIConfig CAS conflict: baseVersion is stale');
    }
  }
  const validation = validateNimiAIConfig(normalized);
  if (!validation.valid) {
    throw new Error(`NimiAIConfig validation failed: ${formatNimiAIValidationIssues(validation.issues)}`);
  }
  return normalized;
}

export function readStudioAIConfigTargetRef(
  capability: string,
  scopeRef: NimiAIScopeRef = createStudioAIScopeRef(),
): NimiAIConfigTargetRef | null {
  return loadStudioAIConfig(scopeRef).capabilities.targetRefs[capability] || null;
}

export function readStudioAIConfigSelectedParams(
  capability: string,
  scopeRef: NimiAIScopeRef = createStudioAIScopeRef(),
): Readonly<Record<string, unknown>> {
  const raw = loadStudioAIConfig(scopeRef).capabilities.selectedParams[capability];
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Readonly<Record<string, unknown>>
    : {};
}

export function recordStudioAISnapshot(snapshot: NimiAISnapshot): NimiAISnapshot {
  snapshotByExecution.set(snapshot.executionId, snapshot);
  latestSnapshotByScope.set(encodeNimiAIScopeRef(snapshot.scopeRef), snapshot.executionId);
  return snapshot;
}

export function getLatestStudioAISnapshot(
  scopeRef: NimiAIScopeRef = createStudioAIScopeRef(),
): NimiAISnapshot | null {
  const executionId = latestSnapshotByScope.get(encodeNimiAIScopeRef(scopeRef));
  return executionId ? snapshotByExecution.get(executionId) ?? null : null;
}

export function createStudioAIConfigService(): SharedAIConfigService {
  return {
    aiConfig: {
      get(scopeRef: NimiAIScopeRef) {
        return loadStudioAIConfig(scopeRef);
      },
      async update(scopeRef: NimiAIScopeRef, next: NimiAIConfig) {
        await commitStudioAIConfigToProtectedBridge(next, scopeRef);
      },
      subscribe(scopeRef: NimiAIScopeRef, listener: SharedAIConfigSubscribeListener): SharedAIConfigUnsubscribe {
        return configSubscriptions.subscribe(scopeRef, listener);
      },
    },
    aiProfile: {
      async list() {
        return listStudioAIProfiles();
      },
      async previewApply(
        scopeRef: NimiAIScopeRef,
        profileId: string,
        options: NimiAIProfilePreviewOptions,
      ): Promise<NimiAIProfilePreviewResult> {
        const profile = profileById(profileId);
        if (!profile) {
          throw new Error(`AIProfile not found: ${profileId}`);
        }
        return previewNimiAIProfileApply({
          before: loadStudioAIConfig(scopeRef),
          scopeRef,
          profile,
          requirementDeclarations: options.requirementDeclarations,
        });
      },
      async apply(
        scopeRef: NimiAIScopeRef,
        profileId: string,
        options: NimiAIProfileApplyOptions,
      ): Promise<NimiAIProfileApplyResult> {
        const preview = await this.previewApply(scopeRef, profileId, options);
        if (preview.outcome !== 'ready_to_apply' || !preview.after) {
          return {
            success: false,
            config: null,
            failureReason: preview.outcome,
            outcome: preview.outcome,
            setupProjection: preview.setupProjection,
            probeWarnings: preview.probeWarnings,
          };
        }
        if (options.expectedBaseVersion && options.expectedBaseVersion !== preview.baseVersion) {
          return {
            success: false,
            config: null,
            failureReason: 'stale_base',
            outcome: 'stale_base',
            setupProjection: preview.setupProjection,
            probeWarnings: preview.probeWarnings,
          };
        }
        const profile = profileById(profileId);
        if (!profile) {
          throw new Error(`AIProfile not found: ${profileId}`);
        }
        const next = applyNimiAIProfileToConfig({
          config: loadStudioAIConfig(scopeRef),
          profile,
          requirementDeclarations: options.requirementDeclarations,
        });
        const saved = await commitStudioAIConfigToProtectedBridge(next, scopeRef, { expectedBaseVersion: preview.baseVersion });
        return {
          success: true,
          config: saved,
          failureReason: null,
          outcome: 'ready_to_apply',
          setupProjection: null,
          probeWarnings: preview.probeWarnings,
        };
      },
    },
  };
}

export function studioAIConfigScopeKey(scopeRef: NimiAIScopeRef = createStudioAIScopeRef()): string {
  return encodeNimiAIScopeRef(scopeRef);
}

function profileById(profileId: string): NimiAIProfile | null {
  return profileLibrary.find((profile) => profile.profileId === profileId) ?? null;
}

function cacheStudioAIConfig(config: NimiAIConfig): void {
  configCache.set(encodeNimiAIScopeRef(config.scopeRef), config);
  configSubscriptions.notify(config);
}
