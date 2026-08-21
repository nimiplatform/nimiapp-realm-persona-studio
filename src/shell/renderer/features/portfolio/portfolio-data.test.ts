import { describe, expect, it } from 'vitest';
import {
  classifyPersonaDetailFailure,
  classifyPortfolioFailure,
  normalizeOwnerPortfolioPersona,
  normalizeOwnerPortfolioPersonaDetail,
  type MyRealmPersonaDto,
} from './portfolio-data.js';

const basePersona: MyRealmPersonaDto = {
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

describe('owner portfolio normalization', () => {
  it('keeps friendCount source-unavailable for RealmPersona list data', () => {
    const persona = normalizeOwnerPortfolioPersona(basePersona);

    expect(persona.friendCount).toEqual({
      status: 'source-unavailable',
      label: 'friendCount source unavailable',
    });
    expect(persona.source).toBe('Realm WorldCoreController.listRealmPersonas');
  });

  it('does not coerce absent friendCount to zero', () => {
    const persona = normalizeOwnerPortfolioPersona(basePersona);

    expect(persona.friendCount).toEqual({
      status: 'source-unavailable',
      label: 'friendCount source unavailable',
    });
  });

  it('names owner authority missing failures', () => {
    expect(classifyPortfolioFailure(new Error('MASTER_OWNED owner authority rejected')).title).toBe('owner authority missing');
  });

  it('classifies SDK httpStatus access failures without retired vocabulary', () => {
    expect(classifyPortfolioFailure({ details: { httpStatus: 403 } })).toMatchObject({
      kind: 'access-denied',
      title: 'Access unavailable',
    });
  });

  it('classifies missing App Access Persona surfaces as informational unavailability', () => {
    expect(classifyPortfolioFailure({ reasonCode: 'capability-unavailable' })).toMatchObject({
      kind: 'capability-unavailable',
      title: 'Capability unavailable',
    });
  });
});

describe('owner portfolio detail normalization', () => {
  it('maps settings and evidence from RealmPersona profile as read-only fields', () => {
    const detail = normalizeOwnerPortfolioPersonaDetail({
      ...basePersona,
      profile: {
        ...basePersona.profile,
        interactionProfile: {
          interactionModes: ['conversation'],
          greeting: 'Welcome in.',
        },
        assets: {
          resourceRefs: [],
          externalRefs: [{
            refId: 'cover-1',
            kind: 'profileCover',
            uri: 'https://cdn.example.test/cover.png',
          }],
          intents: [],
        },
      },
    });

    expect(detail.source).toBe('Realm WorldCoreController.getRealmPersona');
    expect(detail.displayName).toMatchObject({ value: 'Mira', readOnly: true, status: 'available' });
    expect(detail.handle.value).toBe('mira');
    expect(detail.bio.value).toBe('Quiet strategist');
    expect(detail.greeting.value).toBe('Welcome in.');
    expect(detail.profileCoverUrl.value).toBe('https://cdn.example.test/cover.png');
    expect(detail.ownership.value).toBe('owner-created RealmPersona');
    expect(detail.world.value).toBe('world-oasis');
    expect(detail.state.status).toBe('source-unavailable');
    expect(detail.voice).toEqual({
      voiceId: '',
      description: 'CARING',
      emotionEnabled: null,
      speed: null,
      pitch: null,
      speechModelId: '',
      speechRoutePolicy: null,
    });
    expect(detail.friendCount).toEqual({
      status: 'source-unavailable',
      label: 'friendCount source unavailable',
    });
  });

  it('keeps optional settings missing while using canonical summary as bio', () => {
    const detail = normalizeOwnerPortfolioPersonaDetail(basePersona);

    expect(detail.bio).toMatchObject({
      status: 'available',
      value: 'Quiet strategist',
    });
    expect(detail.greeting.status).toBe('source-unavailable');
    expect(detail.profileCoverUrl.status).toBe('source-unavailable');
    expect(detail.ownership.status).toBe('available');
    expect(detail.world.status).toBe('available');
    expect(detail.state.status).toBe('source-unavailable');
    expect(detail.voice).toEqual({
      voiceId: '',
      description: 'CARING',
      emotionEnabled: null,
      speed: null,
      pitch: null,
      speechModelId: '',
      speechRoutePolicy: null,
    });
    expect(detail.friendCount).toEqual({
      status: 'source-unavailable',
      label: 'friendCount source unavailable',
    });
  });

  it('does not treat present empty setting fields as source unavailable', () => {
    const detail = normalizeOwnerPortfolioPersonaDetail({
      ...basePersona,
      profile: {
        ...basePersona.profile,
        identity: {
          handle: '',
          name: '',
          summary: '',
        },
        presentation: {
          displayName: '',
          profileLine: '',
        },
        interactionProfile: {
          interactionModes: ['conversation'],
          greeting: '',
        },
      },
    });

    expect(detail.displayName.status).toBe('available-empty');
    expect(detail.handle.status).toBe('available-empty');
    expect(detail.bio).toMatchObject({
      status: 'available-empty',
      value: '',
      emptyLabel: 'not set',
    });
    expect(detail.greeting.status).toBe('available-empty');
    expect(detail.profileCoverUrl.status).toBe('source-unavailable');
    expect(detail.world.status).toBe('available');
    expect(detail.ownership.status).toBe('available');
    expect(detail.state.status).toBe('source-unavailable');
    expect(detail.bio).not.toHaveProperty('unavailableLabel');
  });

  it('does not treat world display names as write-safe world id evidence', () => {
    const detail = normalizeOwnerPortfolioPersonaDetail({
      ...basePersona,
      profile: basePersona.profile,
    });

    expect(detail.world.status).toBe('available');
    expect(detail.world.value).toBe('world-oasis');
  });

  it('classifies detail setting read failures separately', () => {
    const failure = classifyPersonaDetailFailure(new Error('schema parse failed for setting fields'));

    expect(failure.kind).toBe('setting-read-unavailable');
    expect(failure.title).toBe('Setting read unavailable');
    expect(failure.detail).toContain('read-only setting fields');
  });
});
