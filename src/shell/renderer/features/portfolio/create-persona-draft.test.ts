import { describe, expect, it } from 'vitest';
import {
  REALM_PERSONA_CREATE_PATH,
  REALM_PERSONA_CREATE_SOURCE,
  normalizeRealmPersonaHandleAvailability,
  normalizeCreateRealmPersonaDraft,
  normalizeSelectableWorlds,
  normalizeSelectedWorldPreview,
  selectOasisDefaultWorld,
  validateCreateRealmPersonaReadiness,
  type CreateRealmPersonaDraftInput,
  type RealmPersonaCreationWorldDetailDto,
  type RealmPersonaCreationWorldDto,
} from './create-persona-draft.js';

const oasisWorld: RealmPersonaCreationWorldDto = {
  id: 'world-oasis',
  schemaVersion: 'world-core/v1',
  contentRevision: 1,
  contentHash: 'hash-world-oasis',
  origin: { kind: 'system', sourceId: 'OASIS' },
  creatorId: null,
  visibility: 'system',
  core: {
    name: 'OASIS',
    type: 'OASIS',
    status: 'ACTIVE',
    contentRating: 'PG13',
    nativeCreationState: 'OPEN',
    characterCount: 2,
    themes: [],
  },
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
};

const creatorWorld: RealmPersonaCreationWorldDto = {
  ...oasisWorld,
  id: 'world-creator',
  contentHash: 'hash-world-creator',
  core: {
    ...oasisWorld.core,
    name: 'Creator Workshop',
    type: 'CREATOR',
  },
};

const baseInput: CreateRealmPersonaDraftInput = {
  handle: ' @Mira.Persona ',
  displayName: ' Mira Persona ',
  concept: ' Durable public Realm Persona ',
  description: ' Owner-created public identity ',
  ruleText: 'Stay visible and owner-reviewed.',
  selectedWorldId: ' world-oasis ',
  dnaPrimary: 'CARING',
  dnaSecondary: ['GENTLE', 'WISE'],
  referenceImageUrl: '',
  originalDescription: '',
};

describe('create Realm Persona draft normalization', () => {
  it('normalizes public identity and selected world fields for preview', () => {
    expect(normalizeCreateRealmPersonaDraft(baseInput)).toEqual({
      handle: 'mira.persona',
      displayName: 'Mira Persona',
      concept: 'Durable public Realm Persona',
      description: 'Owner-created public identity',
      ruleText: 'Stay visible and owner-reviewed.',
      selectedWorldId: 'world-oasis',
      dnaPrimary: 'CARING',
      dnaSecondary: ['GENTLE', 'WISE'],
      referenceImageUrl: '',
      originalDescription: '',
    });
  });

  it('selects OASIS from the source-backed Realm world list', () => {
    const worlds = normalizeSelectableWorlds([creatorWorld, oasisWorld]);

    expect(selectOasisDefaultWorld(worlds)?.id).toBe('world-oasis');
    expect(worlds[0]?.source).toBe('Realm WorldCoreController.listWorldCores');
  });

  it('falls back to id/name when OASIS type is unavailable', () => {
    const worlds = normalizeSelectableWorlds([{
      ...creatorWorld,
      id: 'oasis',
      core: { ...creatorWorld.core, name: 'Main World', type: 'CREATOR' },
    }]);

    expect(selectOasisDefaultWorld(worlds)?.id).toBe('oasis');
  });
});

describe('selected world preview normalization', () => {
  it('keeps basic setting fields from WorldCore detail', () => {
    const preview = normalizeSelectedWorldPreview({
      ...oasisWorld,
      core: {
        ...oasisWorld.core,
        tagline: 'The main world',
        overview: 'Shared source world.',
        themes: ['social', 'realm-persona'],
        characterCount: 2,
      },
    } satisfies RealmPersonaCreationWorldDetailDto);

    expect(preview).toMatchObject({
      id: 'world-oasis',
      name: 'OASIS',
      type: 'OASIS',
      status: 'system',
      contentRating: 'PG13',
      tagline: 'The main world',
      overview: 'Shared source world.',
      themes: ['social', 'realm-persona'],
      personaCount: 2,
      nativeCreationState: 'OPEN',
      source: 'Realm WorldCoreController.getWorldCore',
    });
  });
});

describe('create Realm Persona readiness', () => {
  it('returns a reviewed owner-scoped CreatePersonaDto request payload', () => {
    const result = validateCreateRealmPersonaReadiness(baseInput, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });

    expect(result.ready).toBe(true);
    expect(result.source).toBe(REALM_PERSONA_CREATE_SOURCE);
    expect(result.payload).toEqual({
      source: REALM_PERSONA_CREATE_SOURCE,
      path: REALM_PERSONA_CREATE_PATH,
      publicFields: {
        handle: 'mira.persona',
        displayName: 'Mira Persona',
        concept: 'Durable public Realm Persona',
        description: 'Owner-created public identity',
        rulesText: 'Stay visible and owner-reviewed.',
      },
      body: {
        homeWorldId: 'world-oasis',
        origin: {
          kind: 'manual',
          sourceId: 'realm-persona-studio:mira.persona',
          sourceVersion: 'owner-reviewed-v1',
        },
        core: {
          handle: 'mira.persona',
          displayName: 'Mira Persona',
          concept: 'Durable public Realm Persona',
          homeWorldId: 'world-oasis',
          description: 'Owner-created public identity',
          dnaPrimary: 'CARING',
          dnaSecondary: ['GENTLE', 'WISE'],
          ownerReviewedGuidelines: {
            format: 'line-list-v1',
            lines: ['Stay visible and owner-reviewed.'],
            text: 'Stay visible and owner-reviewed.',
          },
        },
      },
    });
  });

  it('passes only normalized reviewed reference image URLs into CreatePersonaDto', () => {
    const result = validateCreateRealmPersonaReadiness({
      ...baseInput,
      referenceImageUrl: ' https://cdn.example.test/reference.png ',
    }, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });

    expect(result.ready).toBe(true);
    expect(result.payload?.body.core.referenceImageUrl).toBe('https://cdn.example.test/reference.png');

    const rejected = validateCreateRealmPersonaReadiness({
      ...baseInput,
      referenceImageUrl: 'file:///tmp/reference.png',
    }, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });
    expect(rejected.payload?.body.core.referenceImageUrl).toBeUndefined();
  });

  it('fails readiness when required local draft fields are missing', () => {
    const result = validateCreateRealmPersonaReadiness({ ...baseInput, handle: ' ', concept: ' ', selectedWorldId: '' });

    expect(result.ready).toBe(false);
    expect(result.errors).toEqual(['handle missing', 'concept missing', 'selected world missing']);
    expect(result.source).toBe(REALM_PERSONA_CREATE_SOURCE);
    expect(result.payload).toBeNull();
  });

  it('fails readiness when selected world is not source-backed by the current world list', () => {
    const result = validateCreateRealmPersonaReadiness(baseInput, {
      selectableWorldIds: ['world-creator'],
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });

    expect(result.ready).toBe(false);
    expect(result.errors).toEqual(['selected world not source-backed by WorldCoreController.listWorldCores']);
    expect(result.payload).toBeNull();
  });

  it('fails readiness when handle availability is missing, unavailable, or stale', () => {
    const unchecked = validateCreateRealmPersonaReadiness(baseInput);
    const unavailable = validateCreateRealmPersonaReadiness(baseInput, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: false,
        normalized: 'mira.persona',
        message: 'Handle already taken.',
      }),
    });
    const stale = validateCreateRealmPersonaReadiness(baseInput, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('other.persona', {
        available: true,
        normalized: 'other.persona',
      }),
    });

    expect(unchecked.ready).toBe(false);
    expect(unchecked.errors).toEqual(['handle availability not checked against WorldCoreController.listRealmPersonas']);
    expect(unavailable.ready).toBe(false);
    expect(unavailable.errors).toEqual(['handle unavailable: Handle already taken.']);
    expect(stale.ready).toBe(false);
    expect(stale.errors).toEqual(['handle availability not checked for the current normalized handle']);
  });
});
