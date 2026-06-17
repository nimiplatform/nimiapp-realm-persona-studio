import { resolveBrowserStorage } from '@nimiplatform/kit/core/storage-json';
import type {
  SharedAIConfigService,
  SharedAIConfigSubscribeListener,
  SharedAIConfigUnsubscribe,
} from '@nimiplatform/kit/features/model-config';
import {
  createNimiAIConfigStore,
  createNimiAIConfigSubscriptionRegistry,
  createNimiAIHostSurface,
  createNimiAISnapshotStore,
  createNimiAppAIScopeRef,
  encodeNimiAIScopeRef,
  parseNimiAIProfile,
  validateNimiAIConfig,
  validateNimiAIProfile,
  versionNimiAIConfig,
  type NimiAIConfig,
  type NimiAIConfigTargetRef,
  type NimiAIHostStorage,
  type NimiAIProfile,
  type NimiAIScopeRef,
  type NimiAISnapshot,
} from '@nimiplatform/sdk/ai';
import { STUDIO_RUNTIME_APP_ID } from '@renderer/app-shell/studio-platform.js';

export const STUDIO_AI_CONFIG_SURFACE_ID = 'owner-workbench';
export const STUDIO_AI_CONFIG_STORAGE_INDEX_KEY = 'realm-persona-studio:ai-config:index:v1';
export const STUDIO_AI_CONFIG_STORAGE_PREFIX = 'realm-persona-studio:ai-config:';
export const STUDIO_AI_SNAPSHOT_INDEX_KEY = 'realm-persona-studio:ai-snapshot:index:v1';
export const STUDIO_AI_SNAPSHOT_STORAGE_PREFIX = 'realm-persona-studio:ai-snapshot:';
export const STUDIO_AI_PROFILE_LIBRARY_STORAGE_KEY = 'realm-persona-studio:ai-profiles:v1';
export const STUDIO_AI_PROFILE_LIBRARY_SCHEMA_VERSION = 1;

type StudioAIProfileLibraryStore = {
  schemaVersion: typeof STUDIO_AI_PROFILE_LIBRARY_SCHEMA_VERSION;
  profiles: NimiAIProfile[];
};

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
let ephemeralProfiles: NimiAIProfile[] = [];

function isStorageLike(value: unknown): value is NimiAIHostStorage {
  return Boolean(value)
    && typeof (value as NimiAIHostStorage).getItem === 'function'
    && typeof (value as NimiAIHostStorage).setItem === 'function';
}

function getStorage(): NimiAIHostStorage | null {
  const storage = resolveBrowserStorage('local');
  return isStorageLike(storage) ? storage : null;
}

function isNonBrowserAIConfigHarness(): boolean {
  return typeof window === 'undefined' || import.meta.env.MODE === 'test';
}

export function createStudioAIScopeRef(): NimiAIScopeRef {
  return createNimiAppAIScopeRef(STUDIO_RUNTIME_APP_ID, STUDIO_AI_CONFIG_SURFACE_ID);
}

function studioAIConfigStorageKeyForScopeKey(scopeKey: string): string {
  return `${STUDIO_AI_CONFIG_STORAGE_PREFIX}${scopeKey}:v1`;
}

const aiConfigStore = createNimiAIConfigStore({
  storage: () => getStorage(),
  indexKey: STUDIO_AI_CONFIG_STORAGE_INDEX_KEY,
  configKeyForScope: studioAIConfigStorageKeyForScopeKey,
  enableEphemeralStore: isNonBrowserAIConfigHarness(),
});

const aiSnapshotStore = createNimiAISnapshotStore({
  storage: () => getStorage(),
  indexKey: STUDIO_AI_SNAPSHOT_INDEX_KEY,
  snapshotKeyForExecution: (executionId) => `${STUDIO_AI_SNAPSHOT_STORAGE_PREFIX}${executionId}`,
  latestKeyForScope: (encodedScopeRef) => `${STUDIO_AI_SNAPSHOT_STORAGE_PREFIX}latest:${encodedScopeRef}`,
  enableEphemeralStore: isNonBrowserAIConfigHarness(),
});

function defaultProfileStore(): StudioAIProfileLibraryStore {
  return {
    schemaVersion: STUDIO_AI_PROFILE_LIBRARY_SCHEMA_VERSION,
    profiles: [],
  };
}

function parseProfileLibraryStore(raw: string): StudioAIProfileLibraryStore {
  const parsed = JSON.parse(raw) as Partial<StudioAIProfileLibraryStore>;
  if (
    parsed.schemaVersion !== STUDIO_AI_PROFILE_LIBRARY_SCHEMA_VERSION
    || !Array.isArray(parsed.profiles)
  ) {
    throw new Error('Stored Studio AIProfile library schema is invalid.');
  }
  const profiles: NimiAIProfile[] = [];
  for (const value of parsed.profiles) {
    const profile = parseNimiAIProfile(value);
    const validation = validateNimiAIProfile(profile);
    if (!validation.valid) {
      throw new Error(`Stored Studio AIProfile is invalid: ${validation.errors.join('; ')}`);
    }
    profiles.push(profile);
  }
  return {
    schemaVersion: STUDIO_AI_PROFILE_LIBRARY_SCHEMA_VERSION,
    profiles,
  };
}

function loadProfileLibraryStore(storage: NimiAIHostStorage | null = getStorage()): StudioAIProfileLibraryStore {
  if (!storage) {
    if (!isNonBrowserAIConfigHarness()) {
      throw new Error('Studio AIProfile library requires browser local storage.');
    }
    return {
      schemaVersion: STUDIO_AI_PROFILE_LIBRARY_SCHEMA_VERSION,
      profiles: [...ephemeralProfiles],
    };
  }
  const raw = storage.getItem(STUDIO_AI_PROFILE_LIBRARY_STORAGE_KEY);
  return raw ? parseProfileLibraryStore(raw) : defaultProfileStore();
}

function saveProfileLibraryStore(store: StudioAIProfileLibraryStore, storage: NimiAIHostStorage | null = getStorage()): void {
  if (!storage) {
    if (!isNonBrowserAIConfigHarness()) {
      throw new Error('Studio AIProfile library requires browser local storage.');
    }
    ephemeralProfiles = [...store.profiles];
    return;
  }
  storage.setItem(STUDIO_AI_PROFILE_LIBRARY_STORAGE_KEY, JSON.stringify(store));
}

export function listStudioAIProfiles(): NimiAIProfile[] {
  return [...loadProfileLibraryStore().profiles];
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
      errors: [...validation.errors],
      message: 'AIProfile validation failed.',
    };
  }

  const store = loadProfileLibraryStore();
  const profiles = [
    profile,
    ...store.profiles.filter((existing) => existing.profileId !== profile.profileId),
  ];
  saveProfileLibraryStore({
    schemaVersion: STUDIO_AI_PROFILE_LIBRARY_SCHEMA_VERSION,
    profiles,
  });
  return {
    ok: true,
    profile,
    profileCount: profiles.length,
    message: `Imported AIProfile ${profile.title || profile.profileId}.`,
  };
}

export function loadStudioAIConfig(scopeRef: NimiAIScopeRef = createStudioAIScopeRef()): NimiAIConfig {
  return aiConfigStore.load(scopeRef);
}

export function saveStudioAIConfig(
  next: NimiAIConfig,
  scopeRef: NimiAIScopeRef = createStudioAIScopeRef(),
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
    throw new Error(`NimiAIConfig validation failed: ${validation.errors.join('; ')}`);
  }
  const saved = aiConfigStore.save(normalized);
  configSubscriptions.notify(saved);
  return saved;
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
  return aiSnapshotStore.record(snapshot);
}

export function getLatestStudioAISnapshot(
  scopeRef: NimiAIScopeRef = createStudioAIScopeRef(),
): NimiAISnapshot | null {
  return aiSnapshotStore.getLatest(scopeRef);
}

export function createStudioAIConfigService(): SharedAIConfigService {
  const createSurface = () => createNimiAIHostSurface({
    profiles: listStudioAIProfiles(),
    configStore: aiConfigStore,
    snapshotStore: aiSnapshotStore,
    subscriptions: configSubscriptions,
  });
  return {
    aiConfig: {
      get(scopeRef: NimiAIScopeRef) {
        return loadStudioAIConfig(scopeRef);
      },
      update(scopeRef: NimiAIScopeRef, next: NimiAIConfig) {
        saveStudioAIConfig(next, scopeRef);
      },
      subscribe(scopeRef: NimiAIScopeRef, listener: SharedAIConfigSubscribeListener): SharedAIConfigUnsubscribe {
        return configSubscriptions.subscribe(scopeRef, listener);
      },
    },
    aiProfile: {
      async list() {
        return [...await createSurface().aiProfile.list()];
      },
      async previewApply(scopeRef: NimiAIScopeRef, profileId: string, options) {
        return createSurface().aiProfile.previewApply(scopeRef, profileId, options);
      },
      async apply(scopeRef: NimiAIScopeRef, profileId: string, options) {
        return createSurface().aiProfile.apply(scopeRef, profileId, options);
      },
    },
  };
}

export function studioAIConfigScopeKey(scopeRef: NimiAIScopeRef = createStudioAIScopeRef()): string {
  return encodeNimiAIScopeRef(scopeRef);
}
