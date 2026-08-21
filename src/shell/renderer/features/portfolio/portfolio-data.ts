import type {
  NimiLocalAppPersonaCharacter,
  NimiLocalAppPersonaCharacterFailureReason,
  NimiLocalAppPersonaCharacterVisibility,
} from '@nimiplatform/sdk/app';
import { normalizeDisplaySafeHttpsUrl } from './persona-external-ref.js';

export type OwnerPersonaCharacter = NimiLocalAppPersonaCharacter;

export type PortfolioPersonaOwnerScope = 'owner-created';
export type PortfolioPersonaListSource = 'Nimi App Access realm.personaCharacter.listOwned';
export type PortfolioPersonaDetailSource = 'Nimi App Access realm.personaCharacter.getOwned';

export type FriendCountMetric =
  | { status: 'available'; value: number }
  | { status: 'source-unavailable'; label: 'friendCount source unavailable' };

export type OwnerPortfolioPersona = {
  id: string;
  displayName: string;
  handle: string | null;
  coverUrl: string | null;
  avatarUrl: string | null;
  ownerScope: PortfolioPersonaOwnerScope;
  source: PortfolioPersonaListSource;
  visibility: NimiLocalAppPersonaCharacterVisibility;
  worldName: string | null;
  updatedAt: string | null;
  friendCount: FriendCountMetric;
};

export type OwnerPortfolioFilter = 'all' | 'friend-count-available' | 'friend-count-unavailable';
export type OwnerPortfolioSort = 'realm-order' | 'display-name-asc' | 'updated-desc' | 'friend-count-desc' | 'friend-count-asc';

export type OwnerPortfolioViewControls = {
  query: string;
  filter: OwnerPortfolioFilter;
  sort: OwnerPortfolioSort;
};

export type SettingFieldKey =
  | 'displayName'
  | 'handle'
  | 'bio'
  | 'greeting'
  | 'profileCoverUrl'
  | 'ownership'
  | 'world'
  | 'visibility';

export type SettingField = {
  key: SettingFieldKey;
  label: string;
  value: string;
  status: 'available' | 'available-empty' | 'source-unavailable';
  source: PortfolioPersonaDetailSource;
  readOnly: true;
  unavailableLabel?: 'setting source unavailable';
  emptyLabel?: 'not set';
};

export type PortfolioPersonaVoiceConfig = {
  voiceId: string;
  description: string;
  emotionEnabled: boolean | null;
  speed: number | null;
  pitch: number | null;
  speechModelId: string;
  speechRoutePolicy: 'local' | 'cloud' | null;
};

export type OwnerPortfolioPersonaDetail = {
  id: string;
  displayName: SettingField;
  handle: SettingField;
  bio: SettingField;
  greeting: SettingField;
  profileCoverUrl: SettingField;
  ownership: SettingField;
  world: SettingField;
  visibility: SettingField;
  avatarUrl: string | null;
  contentHash: string;
  contentRevision: number;
  homeWorldId: string;
  voice?: PortfolioPersonaVoiceConfig;
  friendCount: FriendCountMetric;
  ownerScope: PortfolioPersonaOwnerScope;
  source: PortfolioPersonaDetailSource;
  canonical?: NimiLocalAppPersonaCharacter;
};

export type PortfolioFailureKind = NimiLocalAppPersonaCharacterFailureReason;

export type PortfolioFailure = {
  kind: PortfolioFailureKind;
};

function readOptionalRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

type StringFieldRead = { present: true; value: string } | { present: false };

function readStringField(record: Record<string, unknown> | null, key: string): StringFieldRead {
  if (!record || !Object.prototype.hasOwnProperty.call(record, key)) {
    return { present: false };
  }
  const value = record[key];
  return typeof value === 'string'
    ? { present: true, value: value.trim() }
    : { present: false };
}

function readFirstStringField(
  record: Record<string, unknown> | null,
  keys: readonly string[],
): StringFieldRead {
  for (const key of keys) {
    const field = readStringField(record, key);
    if (field.present) {
      return field;
    }
  }
  return { present: false };
}

function stringFieldFromValue(value: string | null): StringFieldRead {
  return value === null ? { present: false } : { present: true, value };
}

function readPersonaCore(persona: OwnerPersonaCharacter): Record<string, unknown> {
  return readOptionalRecord(persona.profile) ?? {};
}

function readCoreSection(core: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return readOptionalRecord(core[key]);
}

function readExternalAssetUri(core: Record<string, unknown>, kind: string): string | null {
  const assets = readCoreSection(core, 'assets');
  const refs = Array.isArray(assets?.externalRefs) ? assets.externalRefs : [];
  for (const ref of refs) {
    const record = readOptionalRecord(ref);
    const uri = normalizeDisplaySafeHttpsUrl(readString(record?.uri));
    if (readString(record?.kind) === kind && uri) {
      return uri;
    }
  }
  return null;
}

export function normalizeFriendCount(_persona: OwnerPersonaCharacter): FriendCountMetric {
  return { status: 'source-unavailable', label: 'friendCount source unavailable' };
}

export function normalizeOwnerPortfolioPersona(
  persona: OwnerPersonaCharacter,
): OwnerPortfolioPersona {
  const core = readPersonaCore(persona);
  const identity = readCoreSection(core, 'identity');
  const displayName = persona.profile.presentation.displayName;
  const handle = Object.prototype.hasOwnProperty.call(identity ?? {}, 'handle')
    ? persona.profile.identity.handle ?? ''
    : null;

  return {
    id: persona.id,
    displayName,
    handle,
    coverUrl: readExternalAssetUri(core, 'profileCover'),
    avatarUrl: readExternalAssetUri(core, 'avatar')
      || readExternalAssetUri(core, 'referenceImage'),
    ownerScope: 'owner-created',
    source: 'Nimi App Access realm.personaCharacter.listOwned',
    visibility: persona.visibility,
    worldName: persona.worldId,
    updatedAt: persona.updatedAt,
    friendCount: normalizeFriendCount(persona),
  };
}

export function normalizeOwnerPortfolio(personas: readonly OwnerPersonaCharacter[]): OwnerPortfolioPersona[] {
  return personas.map((persona) => normalizeOwnerPortfolioPersona(persona));
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
}

function compareUpdatedDesc(left: OwnerPortfolioPersona, right: OwnerPortfolioPersona): number {
  if (left.updatedAt && right.updatedAt) {
    return right.updatedAt.localeCompare(left.updatedAt) || compareText(left.displayName, right.displayName);
  }
  if (left.updatedAt) {
    return -1;
  }
  if (right.updatedAt) {
    return 1;
  }
  return compareText(left.displayName, right.displayName);
}

function compareFriendCount(left: OwnerPortfolioPersona, right: OwnerPortfolioPersona, direction: 'asc' | 'desc'): number {
  const leftMetric = left.friendCount;
  const rightMetric = right.friendCount;
  const leftAvailable = leftMetric.status === 'available';
  const rightAvailable = rightMetric.status === 'available';
  if (leftAvailable && rightAvailable) {
    const valueComparison = direction === 'desc'
      ? rightMetric.value - leftMetric.value
      : leftMetric.value - rightMetric.value;
    return valueComparison || compareText(left.displayName, right.displayName);
  }
  if (leftAvailable) {
    return -1;
  }
  if (rightAvailable) {
    return 1;
  }
  return compareText(left.displayName, right.displayName);
}

function personaMatchesQuery(persona: OwnerPortfolioPersona, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  return [
    persona.id,
    persona.displayName,
    persona.handle || '',
    persona.worldName || '',
    persona.visibility,
  ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

function personaMatchesFilter(persona: OwnerPortfolioPersona, filter: OwnerPortfolioFilter): boolean {
  if (filter === 'friend-count-available') {
    return persona.friendCount.status === 'available';
  }
  if (filter === 'friend-count-unavailable') {
    return persona.friendCount.status === 'source-unavailable';
  }
  return true;
}

export function applyOwnerPortfolioView(
  personas: OwnerPortfolioPersona[],
  controls: OwnerPortfolioViewControls,
): OwnerPortfolioPersona[] {
  const normalizedQuery = controls.query.trim().toLocaleLowerCase();
  const visiblePersonas = personas.filter((persona) => (
    personaMatchesQuery(persona, normalizedQuery) && personaMatchesFilter(persona, controls.filter)
  ));

  if (controls.sort === 'realm-order') {
    return visiblePersonas;
  }

  return [...visiblePersonas].sort((left, right) => {
    if (controls.sort === 'updated-desc') {
      return compareUpdatedDesc(left, right);
    }
    if (controls.sort === 'friend-count-desc') {
      return compareFriendCount(left, right, 'desc');
    }
    if (controls.sort === 'friend-count-asc') {
      return compareFriendCount(left, right, 'asc');
    }
    return compareText(left.displayName, right.displayName);
  });
}

function settingField(
  key: SettingFieldKey,
  label: string,
  field: StringFieldRead,
  source: PortfolioPersonaDetailSource,
): SettingField {
  if (!field.present) {
    return {
      key,
      label,
      value: '',
      status: 'source-unavailable',
      source,
      readOnly: true,
      unavailableLabel: 'setting source unavailable',
    };
  }

  if (!field.value) {
    return {
      key,
      label,
      value: '',
      status: 'available-empty',
      source,
      readOnly: true,
      emptyLabel: 'not set',
    };
  }

  return {
    key,
    label,
    value: field.value,
    status: 'available',
    source,
    readOnly: true,
  };
}

export function normalizeOwnerPortfolioPersonaDetail(
  persona: OwnerPersonaCharacter,
): OwnerPortfolioPersonaDetail {
  const core = readPersonaCore(persona);
  const identity = readCoreSection(core, 'identity');
  const presentation = readCoreSection(core, 'presentation');
  const interactionProfile = readCoreSection(core, 'interactionProfile');
  const bio = readFirstStringField(identity, ['summary', 'concept']);
  const source: PortfolioPersonaDetailSource = 'Nimi App Access realm.personaCharacter.getOwned';
  return {
    id: persona.id,
    displayName: settingField('displayName', 'Display name', readStringField(presentation, 'displayName'), source),
    handle: settingField('handle', 'Handle', readStringField(identity, 'handle'), source),
    bio: settingField('bio', 'Profile description', bio, source),
    greeting: settingField('greeting', 'Greeting', readStringField(interactionProfile, 'greeting'), source),
    profileCoverUrl: settingField(
      'profileCoverUrl',
      'Profile cover URL',
      stringFieldFromValue(readExternalAssetUri(core, 'profileCover')),
      source,
    ),
    ownership: settingField('ownership', 'Ownership evidence', { present: true, value: 'owner-scoped PersonaCharacter' }, source),
    world: settingField('world', 'World evidence', { present: true, value: persona.worldId }, source),
    visibility: settingField('visibility', 'Visibility', { present: true, value: persona.visibility }, source),
    avatarUrl: readExternalAssetUri(core, 'avatar')
      || readExternalAssetUri(core, 'referenceImage'),
    contentHash: persona.contentHash,
    contentRevision: persona.contentRevision,
    homeWorldId: persona.worldId,
    friendCount: normalizeFriendCount(persona),
    ownerScope: 'owner-created',
    source,
    canonical: persona,
  };
}

const PERSONA_FAILURE_REASONS = new Set<PortfolioFailureKind>([
  'capability-unavailable',
  'invalid-input',
  'session-invalid',
  'access-denied',
  'owner-authority-missing',
  'not-found',
  'content-conflict',
  'realm-unavailable',
  'rate-limited',
  'upstream-failed',
  'contract-invalid',
  'request-too-large',
  'response-too-large',
]);

export function personaCharacterFailureReason(error: unknown): PortfolioFailureKind {
  const errorRecord = readOptionalRecord(error);
  const errorDetails = readOptionalRecord(errorRecord?.details);
  const reasonCode = readString(errorRecord?.reasonCode) || readString(errorDetails?.reasonCode);
  return reasonCode && PERSONA_FAILURE_REASONS.has(reasonCode as PortfolioFailureKind)
    ? reasonCode as PortfolioFailureKind
    : 'contract-invalid';
}

export function classifyRealmPersonaReadFailure(error: unknown): PortfolioFailure {
  return { kind: personaCharacterFailureReason(error) };
}

export function classifyPortfolioFailure(error: unknown): PortfolioFailure {
  return classifyRealmPersonaReadFailure(error);
}

export function classifyPersonaDetailFailure(error: unknown): PortfolioFailure {
  return classifyRealmPersonaReadFailure(error);
}
