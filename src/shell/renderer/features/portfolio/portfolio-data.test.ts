import { describe, expect, it } from 'vitest';
import {
  applyOwnerPortfolioView,
  classifyPersonaDetailFailure,
  classifyPortfolioFailure,
  normalizeOwnerPortfolioPersona,
  normalizeOwnerPortfolioPersonaDetail,
  type MyRealmPersonaDto,
} from './portfolio-data.js';

const basePersona: MyRealmPersonaDto = {
  id: 'persona-1',
  schemaVersion: 'realm-persona-core/v1',
  contentRevision: 1,
  contentHash: 'hash-persona-1',
  origin: { kind: 'manual', sourceId: 'test' },
  ownerId: 'user-1',
  homeWorldId: 'world-oasis',
  core: {
    identity: {
      handle: 'mira',
      name: 'Mira',
      summary: 'Quiet strategist',
      concept: 'Quiet strategist',
    },
    presentation: {
      displayName: 'Mira',
      profileLine: 'Quiet strategist',
    },
    personaStyle: {
      archetype: 'CARING',
      traits: ['GENTLE'],
      voice: 'clear',
      pacing: 'responsive',
    },
    contentProfile: {
      topics: ['strategy'],
      boundaries: [],
      guidelines: [],
    },
    interactionProfile: {
      homeWorldId: 'world-oasis',
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

  it('classifies SDK httpStatus permission failures', () => {
    expect(classifyPortfolioFailure({ details: { httpStatus: 403 } }).title).toBe('Permission missing');
  });
});

describe('owner portfolio local view controls', () => {
  const personas = [
    normalizeOwnerPortfolioPersona({
      ...basePersona,
      id: 'persona-1',
    }),
    normalizeOwnerPortfolioPersona({
      ...basePersona,
      id: 'persona-2',
      homeWorldId: 'workshop',
      contentHash: 'hash-persona-2',
      core: {
        ...basePersona.core,
        identity: {
          handle: 'zed',
          name: 'Zed',
          summary: 'Workshop persona',
          concept: 'Workshop persona',
        },
        presentation: {
          displayName: 'Zed',
          profileLine: 'Workshop persona',
        },
      },
    }),
    normalizeOwnerPortfolioPersona({
      ...basePersona,
      id: 'persona-3',
      contentHash: 'hash-persona-3',
      core: {
        ...basePersona.core,
        identity: {
          handle: 'aster',
          name: 'Aster',
          summary: 'OASIS persona',
          concept: 'OASIS persona',
        },
        presentation: {
          displayName: 'Aster',
          profileLine: 'OASIS persona',
        },
      },
    }),
  ];

  it('searches local display, handle, world, and state fields without mutating the source list', () => {
    const result = applyOwnerPortfolioView(personas, {
      query: 'oasis',
      filter: 'all',
      sort: 'display-name-asc',
    });

    expect(result.map((persona) => persona.id)).toEqual(['persona-3', 'persona-1']);
    expect(personas.map((persona) => persona.id)).toEqual(['persona-1', 'persona-2', 'persona-3']);
  });

  it('searches canonical persona id for manual lookup', () => {
    const result = applyOwnerPortfolioView(personas, {
      query: 'persona-2',
      filter: 'all',
      sort: 'display-name-asc',
    });

    expect(result.map((persona) => persona.id)).toEqual(['persona-2']);
  });

  it('preserves Realm list order until an owner selects a local sort', () => {
    const result = applyOwnerPortfolioView(personas, {
      query: '',
      filter: 'all',
      sort: 'realm-order',
    });

    expect(result.map((persona) => persona.id)).toEqual(['persona-1', 'persona-2', 'persona-3']);
  });

  it('filters source unavailable friendCount as unavailable rather than zero', () => {
    const result = applyOwnerPortfolioView(personas, {
      query: '',
      filter: 'friend-count-unavailable',
      sort: 'display-name-asc',
    });

    expect(result.map((persona) => persona.id)).toEqual(['persona-3', 'persona-1', 'persona-2']);
    expect(result[0]?.friendCount).toEqual({
      status: 'source-unavailable',
      label: 'friendCount source unavailable',
    });
  });

  it('keeps friendCount sorting deterministic when all values are unavailable', () => {
    const descending = applyOwnerPortfolioView(personas, {
      query: '',
      filter: 'all',
      sort: 'friend-count-desc',
    });
    const ascending = applyOwnerPortfolioView(personas, {
      query: '',
      filter: 'all',
      sort: 'friend-count-asc',
    });

    expect(descending.map((persona) => persona.id)).toEqual(['persona-3', 'persona-1', 'persona-2']);
    expect(ascending.map((persona) => persona.id)).toEqual(['persona-3', 'persona-1', 'persona-2']);
  });
});

describe('owner portfolio detail normalization', () => {
  it('maps settings and evidence from RealmPersona core as read-only fields', () => {
    const detail = normalizeOwnerPortfolioPersonaDetail({
      ...basePersona,
      core: {
        ...basePersona.core,
        interactionProfile: {
          homeWorldId: 'world-oasis',
          interactionModes: ['conversation'],
          greeting: 'Welcome in.',
        },
        personaStyle: {
          archetype: 'CARING',
          traits: ['GENTLE'],
          voice: 'zh_narrator',
          pacing: 'responsive',
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
      voiceId: 'zh_narrator',
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
      voiceId: 'clear',
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
      core: {
        ...basePersona.core,
        identity: {
          handle: '',
          name: '',
          summary: '',
          concept: '',
        },
        presentation: {
          displayName: '',
          profileLine: '',
        },
        interactionProfile: {
          homeWorldId: 'world-oasis',
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
      core: basePersona.core,
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
