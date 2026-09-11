import { describe, expect, it } from 'vitest';
import {
  PERSONA_TRAIT_MAX,
  REALM_PERSONA_CREATE_SOURCE,
  adoptImportedReferenceImageCandidate,
  normalizeRealmPersonaHandleAvailability,
  normalizeCreateRealmPersonaDraft,
  normalizeSelectableWorlds,
  normalizeSelectedWorldPreview,
  groupSelectableRealmWorldsForPicker,
  selectOasisDefaultWorld,
  validateCreateRealmPersonaReadiness,
  type CreateRealmPersonaDraftInput,
  type RealmPersonaCreationWorldDetailDto,
  type RealmPersonaCreationWorldDto,
} from './create-persona-draft.js';

const oasisWorld: RealmPersonaCreationWorldDto = {
  id: 'world-oasis',
  schemaVersion: 'realm.world-core/v1',
  contentRevision: 1,
  contentHash: 'hash-world-oasis',
  origin: { kind: 'system', sourceId: 'OASIS' },
  creatorId: null,
  visibility: 'system',
  lorebookDeclaration: {
    identityBaseSetting: 'OASIS is the shared source world.',
    worldRules: [],
    rolePlacements: [],
  },
  core: {
    assets: { intents: [], resourceRefs: [] },
    authoring: { source: 'test' },
    identity: {
      name: 'OASIS',
      summary: 'Shared source world.',
      worldType: 'OASIS',
      themes: ['social', 'realm-persona'],
    },
    presentation: {
      title: 'OASIS',
      tagline: 'The main world',
    },
    ontology: { entityKinds: ['character'], relationshipTypes: [] },
    entities: [{ entityId: 'character-1', kind: 'character' }, { entityId: 'character-2', kind: 'character' }],
    relationships: [],
    scenes: [],
    systems: [],
    timeModel: {
      anchor: {
        realStartedAt: '2026-05-21T00:00:00.000Z',
        worldStartedAt: '2026-05-21T00:00:00.000Z',
        worldStartedAtDisplay: '2026-05-21 00:00',
      },
      calendar: null,
      displayFormat: null,
      flowRatio: 1,
      isPaused: false,
      mode: 'wallClockAnchored',
      pausedWorldTime: null,
    },
    timeline: { events: [] },
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
    identity: {
      name: 'Creator Workshop',
      summary: 'Creator workshop.',
      worldType: 'CREATOR',
      themes: [],
    },
    presentation: {
      title: 'Creator Workshop',
      tagline: 'Creator workshop.',
    },
  },
};

const baseInput: CreateRealmPersonaDraftInput = {
  handle: ' @Mira.Persona ',
  displayName: ' Mira Persona ',
  concept: ' Durable public Realm Persona ',
  description: ' Owner-created public identity ',
  ruleText: 'Stay visible and owner-reviewed.',
  selectedWorldId: ' world-oasis ',
  visibility: 'public',
  personaArchetype: 'CARING',
  personaTraits: ['GENTLE', 'WISE'],
  referenceImageUrl: '',
  referenceImagePrompt: 'A precise Persona portrait.',
  originalDescription: '',
  speechSupplement: 'Speak gently and clearly.',
  boundarySupplement: 'Never claim to be a model.',
};

describe('create Realm Persona draft normalization', () => {
  it('normalizes public identity and selected world fields for preview', () => {
    expect(normalizeCreateRealmPersonaDraft(baseInput)).toEqual({
      handle: 'mira.persona',
      greeting: '',
      displayName: 'Mira Persona',
      concept: 'Durable public Realm Persona',
      description: 'Owner-created public identity',
      ruleText: 'Stay visible and owner-reviewed.',
      selectedWorldId: 'world-oasis',
      visibility: 'public',
      personaArchetype: 'CARING',
      personaTraits: ['GENTLE', 'WISE'],
      referenceImageUrl: '',
      referenceImagePrompt: 'A precise Persona portrait.',
      originalDescription: '',
      speechSupplement: 'Speak gently and clearly.',
      boundarySupplement: 'Never claim to be a model.',
      visualSupplement: '',
      referenceImageCandidates: [],
    });
  });

  it('keeps at most one actual candidate per ordered image slot', () => {
    const sharedCandidate = {
      draftKey: '01J00000000000000000000001',
      prompt: 'Owner visible image prompt',
      createdAt: '2026-08-04T12:00:00.000Z',
      sourceKind: 'generated' as const,
      reviewState: 'candidate-only' as const,
    };
    const normalized = normalizeCreateRealmPersonaDraft({
      ...baseInput,
      referenceImageCandidates: [
        { ...sharedCandidate, slot: 2, url: 'https://cdn.example.test/slot-3.png' },
        { ...sharedCandidate, slot: 0, url: 'https://cdn.example.test/slot-1.png' },
        { ...sharedCandidate, slot: 2, url: 'https://cdn.example.test/duplicate-slot-3.png' },
      ],
    });

    expect(normalized.referenceImageCandidates.map(({ slot, url }) => ({ slot, url }))).toEqual([
      { slot: 0, url: 'https://cdn.example.test/slot-1.png' },
      { slot: 2, url: 'https://cdn.example.test/slot-3.png' },
    ]);
  });

  it('adopts one imported or existing image into an empty slot and selects it', () => {
    const result = adoptImportedReferenceImageCandidate(
      {
        ...baseInput,
        referenceImageCandidates: [{
          draftKey: '01J00000000000000000000001',
          slot: 0,
          url: 'https://cdn.example.test/generated.png',
          prompt: 'Owner visible image prompt',
          createdAt: '2026-08-04T12:00:00.000Z',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
        }],
      },
      '01J00000000000000000000001',
      'https://cdn.example.test/imported.png',
      '2026-08-04T12:30:00.000Z',
    );

    expect(result).toMatchObject({
      ok: true,
      targetSlot: 1,
      referenceImageUrl: 'https://cdn.example.test/imported.png',
      referenceImageCandidates: [
        { slot: 0, reviewState: 'candidate-only', sourceKind: 'generated' },
        { slot: 1, reviewState: 'owner-selected', sourceKind: 'imported', prompt: '' },
      ],
    });
  });

  it('rejects imported candidates without ISO 8601 provenance time', () => {
    expect(adoptImportedReferenceImageCandidate(
      baseInput,
      '01J00000000000000000000001',
      'https://cdn.example.test/imported.png',
      'not-a-timestamp',
    )).toEqual({ ok: false, failure: 'candidate-timestamp-invalid' });
  });

  it('requires an owner-selected replacement target when all four image slots are full', () => {
    const fullCandidates = [0, 1, 2, 3].map((slot) => ({
      draftKey: '01J00000000000000000000001',
      slot: slot as 0 | 1 | 2 | 3,
      url: `https://cdn.example.test/generated-${slot}.png`,
      prompt: 'Owner visible image prompt',
      createdAt: '2026-08-04T12:00:00.000Z',
      sourceKind: 'generated' as const,
      reviewState: 'candidate-only' as const,
    }));
    expect(adoptImportedReferenceImageCandidate(
      { ...baseInput, referenceImageCandidates: fullCandidates },
      '01J00000000000000000000001',
      'https://cdn.example.test/imported.png',
    )).toEqual({ ok: false, failure: 'candidate-slots-full' });
  });

  it('selects OASIS from the source-backed Realm world list', () => {
    const worlds = normalizeSelectableWorlds([creatorWorld, oasisWorld]);

    expect(selectOasisDefaultWorld(worlds)?.id).toBe('world-oasis');
    expect(worlds[0]?.source).toBe('Nimi App Access realm.worldCore.list');
  });

  it('groups only the source-backed OASIS default ahead of all other worlds', () => {
    const worlds = normalizeSelectableWorlds([creatorWorld, oasisWorld]);
    const groups = groupSelectableRealmWorldsForPicker(worlds);

    expect(groups.recommended.map((world) => world.id)).toEqual(['world-oasis']);
    expect(groups.others.map((world) => world.id)).toEqual(['world-creator']);
  });

  it('falls back to id/name when OASIS type is unavailable', () => {
    const worlds = normalizeSelectableWorlds([{
      ...creatorWorld,
      id: 'oasis',
      core: {
        ...creatorWorld.core,
        identity: {
          name: 'Main World',
          summary: 'Main world.',
          worldType: 'CREATOR',
        },
      },
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
        identity: {
          name: 'OASIS',
          summary: 'Shared source world.',
          worldType: 'OASIS',
          themes: ['social', 'realm-persona'],
        },
        presentation: {
          title: 'OASIS',
          tagline: 'The main world',
        },
        entities: [{ entityId: 'character-1', kind: 'character' }, { entityId: 'character-2', kind: 'character' }],
      },
    } satisfies RealmPersonaCreationWorldDetailDto);

    expect(preview).toMatchObject({
      id: 'world-oasis',
      name: 'OASIS',
      type: 'OASIS',
      status: 'system',
      contentRating: null,
      tagline: 'The main world',
      description: 'Shared source world.',
      overview: 'Shared source world.',
      themes: ['social', 'realm-persona'],
      personaCount: 2,
      nativeCreationState: null,
      source: 'Nimi App Access realm.worldCore.list',
    });
  });
});

describe('create Realm Persona readiness', () => {
  it('returns a reviewed owner-scoped CreatePersonaDto input payload', () => {
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
      publicFields: {
        handle: 'mira.persona',
        displayName: 'Mira Persona',
        concept: 'Durable public Realm Persona',
        description: 'Owner-created public identity',
        rulesText: 'Stay visible and owner-reviewed.',
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
          identity: 'Durable public Realm Persona',
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
    });
  });

  it('passes only normalized reviewed reference image URLs into CreatePersonaDto', () => {
    const result = validateCreateRealmPersonaReadiness({
      ...baseInput,
      referenceImageUrl: ' https://cdn.example.test/reference.png ',
      referenceImageCandidates: [{
        draftKey: '01J00000000000000000000001',
        slot: 0,
        url: 'https://cdn.example.test/reference.png',
        prompt: 'Owner reviewed reference image',
        createdAt: '2026-08-04T12:00:00.000Z',
        sourceKind: 'generated',
        reviewState: 'owner-selected',
      }],
    }, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });

    expect(result.ready).toBe(true);
    expect(result.payload?.body.profile).toMatchObject({
      assets: {
        externalRefs: [{
          refId: 'reference-image-1',
          kind: 'referenceImage',
          uri: 'https://cdn.example.test/reference.png',
          purpose: 'visual-reference',
        }],
      },
    });

    const rejected = validateCreateRealmPersonaReadiness({
      ...baseInput,
      referenceImageUrl: 'file:///tmp/reference.png',
    }, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });
    expect((rejected.payload?.body.profile.assets as { externalRefs?: unknown[] }).externalRefs).toBeUndefined();
  });

  it('keeps credential-bearing or fragment-bearing HTTPS references out of create input', () => {
    for (const referenceImageUrl of [
      'https://cdn.example.test/reference.png?token=secret',
      'https://user:secret@cdn.example.test/reference.png',
      'https://cdn.example.test/reference.png#private-fragment',
    ]) {
      const normalized = normalizeCreateRealmPersonaDraft({ ...baseInput, referenceImageUrl });
      expect(normalized.referenceImageUrl).toBe('');
    }
  });

  it('rejects an automatically populated image URL until the owner selects its candidate', () => {
    const result = validateCreateRealmPersonaReadiness({
      ...baseInput,
      referenceImageUrl: 'https://cdn.example.test/reference.png',
      referenceImageCandidates: [{
        draftKey: '01J00000000000000000000001',
        slot: 0,
        url: 'https://cdn.example.test/reference.png',
        prompt: 'Unreviewed generated reference image',
        createdAt: '2026-08-04T12:00:00.000Z',
        sourceKind: 'generated',
        reviewState: 'candidate-only',
      }],
    }, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });

    expect(result.ready).toBe(false);
    expect(result.errors.map((error) => error.kind)).toContain('reference-selection-invalid');
  });

  it('fails readiness when required local draft fields are missing', () => {
    const result = validateCreateRealmPersonaReadiness({ ...baseInput, handle: ' ', concept: ' ', selectedWorldId: '', visibility: '' });

    expect(result.ready).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ kind: 'handle-missing', field: 'handle' }),
      expect.objectContaining({ kind: 'concept-missing', field: 'concept' }),
      expect.objectContaining({ kind: 'selected-world-missing', field: 'selectedWorldId' }),
      expect.objectContaining({ kind: 'visibility-missing', field: 'visibility' }),
    ]);
    expect(result.source).toBe(REALM_PERSONA_CREATE_SOURCE);
    expect(result.payload).toBeNull();
  });

  it('hard-fails when more than the closed trait maximum is selected', () => {
    const result = validateCreateRealmPersonaReadiness({
      ...baseInput,
      personaTraits: ['GENTLE', 'WISE', 'DIRECT', 'REALISTIC'],
    }, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });

    expect(PERSONA_TRAIT_MAX).toBe(3);
    expect(result.ready).toBe(false);
    expect(result.errors.map((error) => error.kind)).toEqual(['persona-traits-too-many']);
    expect(result.payload).toBeNull();
  });

  it('hard-fails when the archetype is outside the closed vocabulary', () => {
    const result = validateCreateRealmPersonaReadiness({
      ...baseInput,
      personaArchetype: 'NOT_AN_ARCHETYPE' as never,
    }, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });

    expect(result.ready).toBe(false);
    expect(result.errors.map((error) => error.kind)).toEqual(['persona-archetype-outside-closed-set']);
  });

  it('hard-fails when a selected trait is outside the closed vocabulary', () => {
    const result = validateCreateRealmPersonaReadiness({
      ...baseInput,
      personaTraits: ['GENTLE', 'NOT_A_TRAIT' as never],
    }, {
      handleAvailability: normalizeRealmPersonaHandleAvailability('mira.persona', {
        available: true,
        normalized: 'mira.persona',
      }),
    });

    expect(result.ready).toBe(false);
    expect(result.errors.map((error) => error.kind)).toEqual(['persona-traits-outside-closed-set']);
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
    expect(result.errors.map((error) => error.kind)).toEqual(['selected-world-not-source-backed']);
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
    expect(unchecked.errors.map((error) => error.kind)).toEqual(['handle-availability-missing']);
    expect(unavailable.ready).toBe(false);
    expect(unavailable.errors.map((error) => error.kind)).toEqual(['handle-unavailable']);
    expect(unavailable.errors[0]?.field).toBe('handle');
    expect(unavailable.errors[0]?.detail).toBe('Handle already taken.');
    expect(stale.ready).toBe(false);
    expect(stale.errors.map((error) => error.kind)).toEqual(['handle-availability-stale']);
  });
});
