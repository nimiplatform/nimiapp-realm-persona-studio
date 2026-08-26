import type { OwnerPersonaCharacter, OwnerPortfolioPersonaDetail, SettingField } from './portfolio-data.js';
import {
  REALM_PERSONA_CREATE_SOURCE,
  type RealmPersonaCreationWorldDto,
  type ReviewedCreateRealmPersonaPayload,
} from './create-persona-draft.js';
import type { CandidatePostPayload } from './post-draft.js';

export const persona: OwnerPersonaCharacter = {
  id: 'persona-1',
  schemaVersion: 'realm.persona-character-core/v1',
  contentRevision: 1,
  contentHash: 'a'.repeat(64),
  origin: { kind: 'manual', sourceId: 'test' },
  worldId: 'world-oasis',
  visibility: 'public',
  lorebookDeclaration: {
    identity: 'Mira Persona is an owner-reviewed public persona.',
    behavior: ['Stay visible and owner-reviewed.'],
    speaking: ['Speak gently and clearly.'],
    immutableBoundaries: ['Never claim to be a model.'],
    relationshipPostures: [],
  },
  sourceHash: 'b'.repeat(64),
  materializationReadiness: { status: 'ready', blockers: [] },
  validity: { status: 'valid', issues: [] },
  profile: {
    profileSchemaVersion: 'realm.character-profile-core/v1',
    profileHash: 'c'.repeat(64),
    profileCoverage: {
      manifestSchemaVersion: 'realm.character-profile-coverage/v1',
      aggregateStatus: 'complete',
      requiredSections: [],
      optionalSections: [],
      requiredRefs: [],
      optionalRefs: [],
      diagnostics: [],
      profileCoverageHash: 'd'.repeat(64),
    },
    identity: {
      handle: 'mira',
      name: 'Mira',
      summary: 'Quiet strategist',
    },
    presentation: {
      displayName: 'Mira',
      profileLine: 'Quiet strategist',
    },
    narrative: {
      summary: 'Quiet strategist',
      archetype: 'CARING',
      traits: ['GENTLE'],
    },
    interactionProfile: {
      interactionModes: ['conversation'],
      greeting: 'Welcome in.',
    },
    assets: {
      resourceRefs: [],
      intents: [],
    },
    authoring: {
      source: 'test',
      notes: [],
    },
  },
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
};

export const world: RealmPersonaCreationWorldDto = {
  id: 'world-oasis',
  schemaVersion: 'realm.world-core/v1',
  contentRevision: 1,
  contentHash: 'hash-world-oasis',
  origin: { kind: 'system', sourceId: 'OASIS' },
  creatorId: null,
  visibility: 'system',
  lorebookDeclaration: {
    identityBaseSetting: 'OASIS is the default system world.',
    worldRules: [],
    rolePlacements: [],
  },
  core: {
    identity: {
      name: 'OASIS',
      summary: 'Default system world.',
      worldType: 'system-default',
    },
    presentation: {
      title: 'OASIS',
      displayName: 'OASIS',
      tagline: 'Default entry world.',
    },
    ontology: {
      entityKinds: [],
      relationshipTypes: [],
    },
    timeModel: {
      anchor: {
        realStartedAt: '2026-05-21T00:00:00.000Z',
        worldStartedAt: '2026-05-21T00:00:00.000Z',
        worldStartedAtDisplay: '2026-05-21 00:00',
      },
      calendar: null,
      displayFormat: null,
      mode: 'wallClockAnchored',
      flowRatio: 1,
      isPaused: false,
      pausedWorldTime: null,
    },
    timeline: {
      events: [],
    },
    entities: [],
    relationships: [],
    systems: [],
    scenes: [],
    assets: {
      resourceRefs: [],
      intents: [],
    },
    authoring: {
      source: 'test',
    },
  },
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
};

export function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') {
    return keys;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectKeys(nested, keys);
  }

  return keys;
}

export function detailField(key: SettingField['key'], label: string, value: string): SettingField {
  if (!value) {
    return {
      key,
      label,
      value,
      status: 'available-empty',
      source: 'Nimi App Access realm.personaCharacter.getOwned',
      readOnly: true,
      emptyLabel: 'not set',
    };
  }
  return {
    key,
    label,
    value,
    status: 'available',
    source: 'Nimi App Access realm.personaCharacter.getOwned',
    readOnly: true,
  };
}

export function ownerPersonaDetail(): OwnerPortfolioPersonaDetail {
  return {
    id: 'persona-1',
    displayName: detailField('displayName', 'Display name', 'Mira'),
    handle: detailField('handle', 'Handle', 'mira'),
    bio: detailField('bio', 'Profile description', ''),
    greeting: detailField('greeting', 'Greeting', ''),
    profileCoverUrl: detailField('profileCoverUrl', 'Profile cover URL', ''),
    ownership: detailField('ownership', 'Ownership evidence', 'owner-scoped PersonaCharacter'),
    world: detailField('world', 'World evidence', 'OASIS'),
    visibility: detailField('visibility', 'Visibility', 'public'),
    avatarUrl: null,
    contentHash: persona.contentHash,
    sourceHash: persona.sourceHash,
    contentRevision: 1,
    homeWorldId: 'world-oasis',
    voice: {
      voiceId: '',
      description: '',
      emotionEnabled: null,
      speed: null,
      pitch: null,
      speechModelId: '',
      speechRoutePolicy: null,
    },
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
    ownerScope: 'owner-created',
    source: 'Nimi App Access realm.personaCharacter.getOwned',
    canonical: persona,
  };
}

export function ownerPersonaDetailWithWorldId(worldId = 'world-oasis'): OwnerPortfolioPersonaDetail {
  return {
    ...ownerPersonaDetail(),
    world: detailField('world', 'World id evidence', worldId),
  };
}

export const candidatePayload: CandidatePostPayload = {
  candidate: true,
  source: 'realm-persona-studio.local-post-draft',
  personaRef: {
    source: 'Nimi App Access realm.personaCharacter.getOwned',
    sourceKind: 'personaCharacter',
    sourceRef: {
      kind: 'personaCharacter',
      worldId: 'world-oasis',
      id: 'persona-1',
      sourceHash: persona.sourceHash,
    },
    sourceRefKey: `personaCharacter:world-oasis:persona-1:${persona.sourceHash}`,
    handle: 'mira',
    displayName: 'Mira',
  },
  realmCreatePost: {
    attachments: [{
      targetType: 'RESOURCE',
      targetId: 'resource-1',
    }],
    caption: 'Published caption',
    tags: ['studio'],
  },
  review: {
    humanReviewed: true,
  },
};

export const createPayload: ReviewedCreateRealmPersonaPayload = {
  source: REALM_PERSONA_CREATE_SOURCE,
  publicFields: {
    handle: 'mira.persona',
    displayName: 'Mira Persona',
    concept: 'Durable public Realm Persona',
    description: 'Owner-created public identity',
    rulesText: 'Stay visible.\nStay owner-reviewed.',
  },
  body: {
    worldId: 'world-oasis',
    visibility: 'public',
    origin: {
      kind: 'manual',
      sourceId: 'realm-persona-studio:mira.persona',
      sourceVersion: 'owner-reviewed-v1',
    },
    lorebookDeclaration: {
      identity: 'Mira Persona is an owner-reviewed public persona.',
      behavior: ['Stay visible and owner-reviewed.'],
      speaking: ['Speak gently and clearly.'],
      immutableBoundaries: ['Never claim to be a model.'],
      relationshipPostures: [],
    },
    profile: {
      profileSchemaVersion: 'realm.character-profile-core/v1',
      identity: {
        handle: 'mira.persona',
        name: 'Mira Persona',
        summary: 'Owner-created public identity',
      },
      presentation: {
        displayName: 'Mira Persona',
        profileLine: 'Owner-created public identity',
      },
      narrative: {
        summary: 'Durable public Realm Persona',
        archetype: 'CARING',
        traits: ['GENTLE', 'WISE'],
      },
      interactionProfile: {
        interactionModes: ['conversation'],
      },
      assets: {
        resourceRefs: [],
        intents: [],
      },
      authoring: {
        source: 'realm-persona-studio',
        notes: [],
      },
    },
  },
};
