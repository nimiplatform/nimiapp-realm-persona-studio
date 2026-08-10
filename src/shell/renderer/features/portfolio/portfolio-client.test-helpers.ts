import type { MyRealmPersonaDto, OwnerPortfolioPersonaDetail, SettingField } from './portfolio-data.js';
import {
  REALM_PERSONA_CREATE_PATH,
  REALM_PERSONA_CREATE_SOURCE,
  type RealmPersonaCreationWorldDto,
  type ReviewedCreateRealmPersonaPayload,
} from './create-persona-draft.js';
import type { CandidatePostPayload } from './post-draft.js';

export const persona: MyRealmPersonaDto = {
  id: 'persona-1',
  schemaVersion: 'realm.persona-character-core/v1',
  contentRevision: 1,
  contentHash: 'hash-persona-1',
  origin: { kind: 'manual', sourceId: 'test' },
  ownerAccountId: 'user-1',
  worldId: 'world-oasis',
  visibility: 'public',
  sourceHash: 'source-hash-persona-1',
  materializationReadiness: { status: 'ready', blockers: [] },
  validity: { status: 'valid', issues: [] },
  profile: {
    profileSchemaVersion: 'realm.character-profile-core/v1',
    profileHash: 'profile-hash-persona-1',
    profileCoverage: {
      manifestSchemaVersion: 'realm.character-profile-coverage/v1',
      aggregateStatus: 'complete',
      requiredSections: [],
      optionalSections: [],
      requiredRefs: [],
      optionalRefs: [],
      diagnostics: [],
      profileCoverageHash: 'profile-coverage-hash-persona-1',
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
      extensions: {
        ownerSettings: {
          identity: {
            publicRole: 'Guide',
          },
        },
        socialVisibility: {
          defaultPostVisibility: 'PUBLIC',
          dmVisibility: 'FRIENDS',
          profileVisibility: 'PUBLIC',
        },
      },
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
      source: 'Realm WorldCoreController.getRealmPersona',
      readOnly: true,
      emptyLabel: 'not set',
    };
  }
  return {
    key,
    label,
    value,
    status: 'available',
    source: 'Realm WorldCoreController.getRealmPersona',
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
    ownership: detailField('ownership', 'Ownership evidence', 'owner-created RealmPersona'),
    world: detailField('world', 'World evidence', 'OASIS'),
    state: detailField('state', 'State evidence', 'ACTIVE'),
    avatarUrl: null,
    contentHash: 'hash-persona-1',
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
    source: 'Realm WorldCoreController.getRealmPersona',
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
    source: 'Realm WorldCoreController.getRealmPersona',
    sourceKind: 'realmPersona',
    sourceRef: {
      kind: 'realmPersona',
      worldId: 'world-oasis',
      sourceId: 'persona-1',
      sourceContentHash: 'hash-persona-1',
    },
    sourceRefKey: 'realmPersona:world-oasis:persona-1:hash-persona-1',
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
  path: REALM_PERSONA_CREATE_PATH,
  publicFields: {
    handle: 'mira.persona',
    displayName: 'Mira Persona',
    concept: 'Durable public Realm Persona',
    description: 'Owner-created public identity',
    rulesText: 'Stay visible.\nStay owner-reviewed.',
  },
  body: {
    worldId: 'world-oasis',
    origin: {
      kind: 'manual',
      sourceId: 'realm-persona-studio:mira.persona',
      sourceVersion: 'owner-reviewed-v1',
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
        extensions: {
          review: {
            status: 'owner-reviewed',
          },
          personaStyle: {
            voice: 'owner-reviewed',
            pacing: 'responsive',
          },
          contentProfile: {
            topics: [],
            boundaries: [],
            guidelines: [
              {
                guidelineId: 'owner-reviewed-1',
                statement: 'Stay visible.',
                source: 'realm-persona-studio',
              },
              {
                guidelineId: 'owner-reviewed-2',
                statement: 'Stay owner-reviewed.',
                source: 'realm-persona-studio',
              },
            ],
          },
        },
      },
    },
  },
};
