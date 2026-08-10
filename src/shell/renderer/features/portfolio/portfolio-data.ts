import type {
  RealmModel,
} from '@nimiplatform/sdk/realm/generated';

export type MyRealmPersonaDto = RealmModel<'PersonaCharacterCoreDto'>;
export type MyRealmPersonaDetailDto = RealmModel<'PersonaCharacterCoreDto'>;

export type PortfolioPersonaOwnerScope = 'owner-created';
export type PortfolioPersonaListSource = 'Realm WorldCoreController.listRealmPersonas';
export type PortfolioPersonaDetailSource = 'Realm WorldCoreController.getRealmPersona';

export type FriendCountMetric =
  | { status: 'available'; value: number }
  | { status: 'source-unavailable'; label: 'friendCount source unavailable' };

export type OwnerPortfolioPersona = {
  id: string;
  displayName: string;
  handle: string;
  coverUrl: string | null;
  avatarUrl: string | null;
  ownerScope: PortfolioPersonaOwnerScope;
  source: PortfolioPersonaListSource;
  realmState: string | null;
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
  | 'state';

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
  state: SettingField;
  avatarUrl: string | null;
  contentHash: string;
  contentRevision: number;
  homeWorldId: string;
  voice?: PortfolioPersonaVoiceConfig;
  friendCount: FriendCountMetric;
  ownerScope: PortfolioPersonaOwnerScope;
  source: PortfolioPersonaDetailSource;
};

export type PortfolioFailureKind =
  | 'capability-unavailable'
  | 'realm-unavailable'
  | 'access-denied'
  | 'owner-authority-missing'
  | 'setting-read-unavailable'
  | 'unknown';

export type PortfolioFailure = {
  kind: PortfolioFailureKind;
  title: 'Capability unavailable' | 'Realm unavailable' | 'Access unavailable' | 'owner authority missing' | 'Setting read unavailable' | 'Portfolio unavailable';
  detail: string;
};

function readOptionalRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readHttpStatus(error: unknown): number | null {
  const errorRecord = readOptionalRecord(error);
  const details = readOptionalRecord(errorRecord?.details);
  return readNumber(errorRecord?.status) || readNumber(details?.httpStatus);
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

function readPersonaCore(persona: MyRealmPersonaDto | MyRealmPersonaDetailDto): Record<string, unknown> {
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
    if (readString(record?.kind) === kind) {
      return readString(record?.uri);
    }
  }
  return null;
}

export function normalizeFriendCount(_persona: MyRealmPersonaDto | MyRealmPersonaDetailDto): FriendCountMetric {
  return { status: 'source-unavailable', label: 'friendCount source unavailable' };
}

export function normalizeOwnerPortfolioPersona(
  persona: MyRealmPersonaDto,
): OwnerPortfolioPersona {
  const core = readPersonaCore(persona);
  const identity = readCoreSection(core, 'identity');
  const presentation = readCoreSection(core, 'presentation');
  const displayName = readString(presentation?.displayName) || readString(identity?.name) || persona.id;
  const handle = readString(identity?.handle) || persona.id;

  return {
    id: persona.id,
    displayName,
    handle,
    coverUrl: readString(presentation?.profileCoverResourceRef) || readExternalAssetUri(core, 'profileCover'),
    avatarUrl: readString(presentation?.avatarResourceRef)
      || readExternalAssetUri(core, 'avatar')
      || readExternalAssetUri(core, 'referenceImage'),
    ownerScope: 'owner-created',
    source: 'Realm WorldCoreController.listRealmPersonas',
    realmState: null,
    worldName: persona.worldId,
    updatedAt: persona.updatedAt,
    friendCount: normalizeFriendCount(persona),
  };
}

export function normalizeOwnerPortfolio(personas: readonly MyRealmPersonaDto[]): OwnerPortfolioPersona[] {
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
    persona.handle,
    persona.worldName || '',
    persona.realmState || '',
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

function readPersonaVoiceConfig(core: Record<string, unknown>): PortfolioPersonaVoiceConfig {
  const narrative = readCoreSection(core, 'narrative');
  return {
    voiceId: '',
    description: readString(narrative?.archetype) || '',
    emotionEnabled: null,
    speed: null,
    pitch: null,
    speechModelId: '',
    speechRoutePolicy: null,
  };
}

export function normalizeOwnerPortfolioPersonaDetail(
  persona: MyRealmPersonaDetailDto,
): OwnerPortfolioPersonaDetail {
  const core = readPersonaCore(persona);
  const identity = readCoreSection(core, 'identity');
  const presentation = readCoreSection(core, 'presentation');
  const interactionProfile = readCoreSection(core, 'interactionProfile');
  const bio = readFirstStringField(identity, ['summary', 'concept']);
  const source: PortfolioPersonaDetailSource = 'Realm WorldCoreController.getRealmPersona';
  return {
    id: persona.id,
    displayName: settingField('displayName', 'Display name', readStringField(presentation, 'displayName'), source),
    handle: settingField('handle', 'Handle', readStringField(identity, 'handle'), source),
    bio: settingField('bio', 'Profile description', bio, source),
    greeting: settingField('greeting', 'Greeting', readStringField(interactionProfile, 'greeting'), source),
    profileCoverUrl: settingField(
      'profileCoverUrl',
      'Profile cover URL',
      stringFieldFromValue(readString(presentation?.profileCoverResourceRef) || readExternalAssetUri(core, 'profileCover')),
      source,
    ),
    ownership: settingField('ownership', 'Ownership evidence', { present: true, value: 'owner-created RealmPersona' }, source),
    world: settingField('world', 'World evidence', { present: true, value: persona.worldId }, source),
    state: settingField('state', 'State evidence', { present: false }, source),
    avatarUrl: readString(presentation?.avatarResourceRef)
      || readExternalAssetUri(core, 'avatar')
      || readExternalAssetUri(core, 'referenceImage'),
    contentHash: persona.contentHash,
    contentRevision: persona.contentRevision,
    homeWorldId: persona.worldId,
    voice: readPersonaVoiceConfig(core),
    friendCount: normalizeFriendCount(persona),
    ownerScope: 'owner-created',
    source,
  };
}

export function classifyRealmPersonaReadFailure(error: unknown, read: 'portfolio' | 'detail'): PortfolioFailure {
  const errorRecord = readOptionalRecord(error);
  const errorDetails = readOptionalRecord(errorRecord?.details);
  const reasonCode = readString(errorRecord?.reasonCode) || readString(errorDetails?.reasonCode);
  if (reasonCode === 'capability-unavailable') {
    return {
      kind: 'capability-unavailable',
      title: 'Capability unavailable',
      detail: read === 'detail'
        ? 'This Persona detail is unavailable because Nimi App Access does not expose its source yet.'
        : 'The owner Persona portfolio is unavailable because Nimi App Access does not expose its source yet.',
    };
  }

  const status = readHttpStatus(error);
  if (status === 401 || status === 403) {
    return {
      kind: 'access-denied',
      title: 'Access unavailable',
      detail: read === 'detail'
        ? 'This Runtime account session cannot read that Realm Persona.'
        : 'This Runtime account session cannot read your Realm Persona portfolio.',
    };
  }

  const message = error instanceof Error ? error.message : '';
  if (/owner|MASTER_OWNED|authority/i.test(message)) {
    return {
      kind: 'owner-authority-missing',
      title: 'owner authority missing',
      detail: read === 'detail'
        ? 'Realm did not prove current-user owner-created authority for this Realm Persona detail.'
        : 'Realm did not prove current-user owner-created authority for this portfolio.',
    };
  }

  if (/fetch|network|timeout|realm/i.test(message)) {
    return {
      kind: 'realm-unavailable',
      title: 'Realm unavailable',
      detail: read === 'detail' ? 'Realm Persona detail could not reach Realm.' : 'Owner portfolio could not reach Realm.',
    };
  }

  if (/setting|field|read|shape|schema|parse/i.test(message)) {
    return {
      kind: 'setting-read-unavailable',
      title: 'Setting read unavailable',
      detail: read === 'detail'
        ? 'Realm did not return usable read-only setting fields for this persona.'
        : 'Realm did not return usable portfolio fields.',
    };
  }

  return {
    kind: read === 'detail' ? 'setting-read-unavailable' : 'unknown',
    title: read === 'detail' ? 'Setting read unavailable' : 'Portfolio unavailable',
    detail: read === 'detail'
      ? 'Realm did not return a usable user-owned Realm Persona detail.'
      : 'Realm did not return a usable owner portfolio.',
  };
}

export function classifyPortfolioFailure(error: unknown): PortfolioFailure {
  return classifyRealmPersonaReadFailure(error, 'portfolio');
}

export function classifyPersonaDetailFailure(error: unknown): PortfolioFailure {
  return classifyRealmPersonaReadFailure(error, 'detail');
}
