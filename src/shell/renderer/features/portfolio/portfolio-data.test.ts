import { describe, expect, it } from 'vitest';
import {
  applyOwnerPortfolioView,
  classifyPersonaDetailFailure,
  classifyPortfolioFailure,
  normalizeOwnerPortfolioPersona,
  normalizeOwnerPortfolioPersonaDetail,
  type OwnerPersonaCharacter,
} from './portfolio-data.js';

const basePersona: OwnerPersonaCharacter = {
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
  it('keeps friendCount source-unavailable for PersonaCharacter list data', () => {
    const persona = normalizeOwnerPortfolioPersona(basePersona);

    expect(persona.friendCount).toEqual({
      status: 'source-unavailable',
      label: 'friendCount source unavailable',
    });
    expect(persona.source).toBe('Nimi App Access realm.personaCharacter.listOwned');
  });

  it('does not coerce absent friendCount to zero', () => {
    const persona = normalizeOwnerPortfolioPersona(basePersona);

    expect(persona.friendCount).toEqual({
      status: 'source-unavailable',
      label: 'friendCount source unavailable',
    });
  });

  it('does not synthesize an absent handle from the persona id', () => {
    const persona = normalizeOwnerPortfolioPersona({
      ...basePersona,
      profile: {
        ...basePersona.profile,
        identity: { name: 'Mira', summary: 'Quiet strategist' },
      },
    });

    expect(persona.handle).toBeNull();
  });

  it('preserves a source-backed empty handle distinctly from an absent handle', () => {
    const persona = normalizeOwnerPortfolioPersona({
      ...basePersona,
      profile: {
        ...basePersona.profile,
        identity: { ...basePersona.profile.identity, handle: '' },
      },
    });

    expect(persona.handle).toBe('');
  });

  it('classifies the sanitized owner authority reason', () => {
    expect(classifyPortfolioFailure({ reasonCode: 'owner-authority-missing' })).toEqual({ kind: 'owner-authority-missing' });
  });

  it('does not infer failure taxonomy from a raw HTTP status', () => {
    expect(classifyPortfolioFailure({ details: { httpStatus: 403 } })).toEqual({ kind: 'contract-invalid' });
  });

  it('classifies missing App Access Persona surfaces as informational unavailability', () => {
    expect(classifyPortfolioFailure({ reasonCode: 'capability-unavailable' })).toEqual({ kind: 'capability-unavailable' });
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
      worldId: 'workshop',
      contentHash: 'hash-persona-2',
      profile: {
        ...basePersona.profile,
        identity: {
          handle: 'zed',
          name: 'Zed',
          summary: 'Workshop persona',
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
      profile: {
        ...basePersona.profile,
        identity: {
          handle: 'aster',
          name: 'Aster',
          summary: 'OASIS persona',
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
  it('maps settings and evidence from PersonaCharacter profile as read-only fields', () => {
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

    expect(detail.source).toBe('Nimi App Access realm.personaCharacter.getOwned');
    expect(detail.displayName).toMatchObject({ value: 'Mira', readOnly: true, status: 'available' });
    expect(detail.handle.value).toBe('mira');
    expect(detail.bio.value).toBe('Quiet strategist');
    expect(detail.greeting.value).toBe('Welcome in.');
    expect(detail.profileCoverUrl.value).toBe('https://cdn.example.test/cover.png');
    expect(detail.ownership.value).toBe('owner-scoped PersonaCharacter');
    expect(detail.world.value).toBe('world-oasis');
    expect(detail.visibility.value).toBe('public');
    expect(detail.voice).toBeUndefined();
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
    expect(detail.profileCoverUrl.status).toBe('available-empty');
    expect(detail.ownership.status).toBe('available');
    expect(detail.world.status).toBe('available');
    expect(detail.visibility.value).toBe('public');
    expect(detail.voice).toBeUndefined();
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
    expect(detail.profileCoverUrl.status).toBe('available-empty');
    expect(detail.world.status).toBe('available');
    expect(detail.ownership.status).toBe('available');
    expect(detail.visibility.value).toBe('public');
    expect(detail.bio).not.toHaveProperty('unavailableLabel');
  });

  it('keeps an unusable profile cover ref fail-closed as source unavailable', () => {
    const detail = normalizeOwnerPortfolioPersonaDetail({
      ...basePersona,
      profile: {
        ...basePersona.profile,
        assets: {
          resourceRefs: [],
          externalRefs: [{
            refId: 'cover-1',
            kind: 'profileCover',
            uri: 'http://cdn.example.test/cover.png?token=secret',
          }],
          intents: [],
        },
      },
    });

    expect(detail.profileCoverUrl.status).toBe('source-unavailable');
  });

  it('does not treat world display names as write-safe world id evidence', () => {
    const detail = normalizeOwnerPortfolioPersonaDetail({
      ...basePersona,
      profile: basePersona.profile,
    });

    expect(detail.world.status).toBe('available');
    expect(detail.world.value).toBe('world-oasis');
  });

  it('fails unknown detail errors closed as contract-invalid', () => {
    expect(classifyPersonaDetailFailure(new Error('private transport detail'))).toEqual({ kind: 'contract-invalid' });
  });
});
