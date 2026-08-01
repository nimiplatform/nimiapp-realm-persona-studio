import type { StudioRealmSurface } from '@renderer/data/realm-client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFinalizeDirectMediaResourceInput,
  buildRealmCreatePersonaInput,
  buildRealmCreatePostInput,
  buildRealmPostTextResourceInput,
  buildRealmSelectAvatarInput,
  buildRealmUpdateVisibilityInput,
  buildRuntimeProjectionInput,
  checkCreateRealmPersonaHandleAvailability,
  createPersonaVisibilityDraft,
  createReviewedPostTextResource,
  createReviewedRealmPersona,
  createReviewedRealmPersonaWithProfileSettings,
  generateReviewedVisualImageCandidate,
  getPersonaVisibilitySettings,
  getCreateRealmPersonaWorldPreview,
  getOwnerPersonaSettings,
  getOwnerPortfolioPersonaDetail,
  getPortfolioPersonaSettings,
  listCreateRealmPersonaSelectableWorlds,
  listOwnerPortfolioPersonas,
  listReadyPostAttachmentResources,
  normalizeFinalizedDirectMediaResource,
  normalizePostAttachmentResourceOptions,
  normalizeRealmPersonaAvatarSelectResult,
  normalizeRealmPersonaCreateResult,
  normalizeRealmPostPublishResult,
  normalizeRealmTextResourceCreateResult,
  normalizeRuntimeProjectionSummary,
  projectPersonaRuntimeContextSummary,
  proposeReviewedOwnerPersonaSettings,
  proposeReviewedPostCopy,
  publishReviewedPostDraft,
  selectReviewedPersonaAvatarUrl,
  synthesizeReviewedVoiceDemo,
  updateReviewedPersonaVisibility,
  updateReviewedOwnerPersonaSettings,
  updateReviewedPortfolioPersonaSettings,
  uploadReviewedIdentityMediaResource,
  uploadReviewedPostMediaResource,
  type PersonaVisibilityDraft,
  type RealmPersonaVisibilitySettings,
} from './portfolio-client.js';
import { REALM_PERSONA_CREATE_SOURCE, type ReviewedCreateRealmPersonaPayload } from './create-persona-draft.js';
import { createOwnerPersonaSettingsDraft } from './setting-proposal.js';
import {
  candidatePayload,
  collectKeys,
  createPayload,
  detailField,
  mockRealm,
  ownerPersonaDetail,
  ownerPersonaDetailWithWorldId,
  resetStudioAIConfigForTest,
} from './portfolio-client.test-helpers.js';

beforeEach(() => {
  resetStudioAIConfigForTest();
});

describe('owner portfolio core client', () => {
    it('uses WorldCoreController.listRealmPersonas only for portfolio list data', async () => {
      const realm = mockRealm();
      const personas = await listOwnerPortfolioPersonas(realm);

      expect(realm.worldCoreControllerListPersonaCharacters).toHaveBeenCalledTimes(1);
      expect(realm.worldCoreControllerGetPersonaCharacter).not.toHaveBeenCalled();
      expect(personas[0]?.source).toBe('Realm WorldCoreController.listRealmPersonas');
    });

    it('does not fall through from owner detail reads when owner authority is missing', async () => {
      const realm = mockRealm();
      vi.mocked(realm.worldCoreControllerGetPersonaCharacter).mockRejectedValueOnce(new Error('owner authority missing'));

      await expect(getOwnerPortfolioPersonaDetail('persona-not-owned', realm)).rejects.toThrow(
        'owner authority missing',
      );

      expect(realm.worldCoreControllerGetPersonaCharacter).toHaveBeenCalledWith({ path: { personaCharacterId: 'persona-not-owned' } });
    });

    it('fetches selected detail through WorldCoreController.getRealmPersona', async () => {
      const realm = mockRealm();
      const detail = await getOwnerPortfolioPersonaDetail('persona-detail-1', realm);

      expect(realm.worldCoreControllerGetPersonaCharacter).toHaveBeenCalledWith({ path: { personaCharacterId: 'persona-detail-1' } });
      expect(detail.id).toBe('persona-detail-1');
      expect(detail.bio.value).toBe('Quiet strategist');
      expect(detail.source).toBe('Realm WorldCoreController.getRealmPersona');
    });

    it('uses WorldCoreController only for create readiness world list reads', async () => {
      const realm = mockRealm();
      const worlds = await listCreateRealmPersonaSelectableWorlds(realm);

      expect(realm.worldCoreControllerListWorldCores).toHaveBeenCalledTimes(1);
      expect(realm.worldCoreControllerCreatePersonaCharacter).not.toHaveBeenCalled();
      expect(worlds[0]).toMatchObject({
        id: 'world-oasis',
        source: 'Realm WorldCoreController.listWorldCores',
      });
    });

    it('uses WorldCoreController.getWorldCore for selected world preview', async () => {
      const realm = mockRealm();
      const preview = await getCreateRealmPersonaWorldPreview('world-oasis', realm);

      expect(realm.worldCoreControllerGetWorldCore).toHaveBeenCalledWith({
        path: { worldId: 'world-oasis' },
      });
      expect(realm.worldCoreControllerCreatePersonaCharacter).not.toHaveBeenCalled();
      expect(preview.source).toBe('Realm WorldCoreController.getWorldCore');
    });

    it('checks create handle availability through WorldCoreController.listRealmPersonas before create', async () => {
      const realm = mockRealm();
      const available = await checkCreateRealmPersonaHandleAvailability(' @Mira.Persona ', realm);
      const unavailable = await checkCreateRealmPersonaHandleAvailability('taken.persona', realm);

      expect(realm.worldCoreControllerListPersonaCharacters).toHaveBeenCalledTimes(2);
      expect(available).toMatchObject({
        ok: true,
        truthWrite: false,
        availability: {
          source: 'Realm WorldCoreController.listRealmPersonas',
          handle: 'mira.persona',
          normalized: 'mira.persona',
          available: true,
        },
      });
      expect(unavailable).toMatchObject({
        ok: true,
        truthWrite: false,
        availability: {
          handle: 'taken.persona',
          available: false,
          message: 'A RealmPersona with this handle already exists in the owner portfolio.',
        },
      });
      expect(realm.worldCoreControllerCreatePersonaCharacter).not.toHaveBeenCalled();
    });

    it('creates a RealmPersona through WorldCoreController.createRealmPersona with core allowlist only', async () => {
      const realm = mockRealm();
      const result = await createReviewedRealmPersona(createPayload, realm);
      const createPersona = realm.worldCoreControllerCreatePersonaCharacter;
      const submittedPayload = vi.mocked(createPersona).mock.calls[0]?.[0]?.body;

      expect(createPersona).toHaveBeenCalledTimes(1);
      expect(submittedPayload).toEqual(createPayload.body);
      expect(Object.keys(submittedPayload || {}).sort()).toEqual([
        'origin',
        'profile',
        'worldId',
      ]);
      expect(collectKeys(submittedPayload).has('publicBio')).toBe(false);
      expect(collectKeys(submittedPayload).has('id')).toBe(false);
      expect(collectKeys(submittedPayload).has('authorId')).toBe(false);
      expect(collectKeys(submittedPayload).has('ownerId')).toBe(false);
      expect(collectKeys(submittedPayload).has('creatorId')).toBe(false);
      expect(collectKeys(submittedPayload).has('maintainerId')).toBe(false);
      expect(collectKeys(submittedPayload).has('state')).toBe(false);
      expect(collectKeys(submittedPayload).has('lifecycle')).toBe(false);
      expect(collectKeys(submittedPayload).has('provider')).toBe(false);
      expect(collectKeys(submittedPayload).has('model')).toBe(false);
      expect(collectKeys(submittedPayload).has('LocalAgent')).toBe(false);
      expect(collectKeys(submittedPayload).has('dna')).toBe(false);
      expect(collectKeys(submittedPayload).has('personaArchetype')).toBe(false);
      expect(collectKeys(submittedPayload).has('personaTraits')).toBe(false);
      expect(submittedPayload?.profile).toMatchObject({
        identity: { handle: 'mira.persona' },
        presentation: { displayName: 'Mira Persona' },
        narrative: { archetype: 'CARING', traits: ['GENTLE', 'WISE'] },
      });
      expect(result).toMatchObject({
        ok: true,
        source: REALM_PERSONA_CREATE_SOURCE,
        canonical: {
          id: 'persona-created-1',
        },
      });
    });

    it('completes reviewed profile description through owner settings after create', async () => {
      const realm = mockRealm();
      const result = await createReviewedRealmPersonaWithProfileSettings(createPayload, realm);
      const settingsUpdate = realm.worldCoreControllerReplacePersonaCharacter;

      expect(result).toMatchObject({
        ok: true,
        canonical: { id: 'persona-created-1' },
        profileSettings: {
          status: 'updated',
          source: 'Realm WorldCoreController.replaceRealmPersona',
          truthWrite: true,
          description: 'Owner-created public identity',
        },
      });
      expect(realm.worldCoreControllerGetPersonaCharacter).toHaveBeenCalledWith({ path: { personaCharacterId: 'persona-created-1' } });
      expect(settingsUpdate).toHaveBeenCalledWith({
        path: { personaCharacterId: 'persona-created-1' },
        body: expect.objectContaining({
          baseContentHash: 'hash-persona-created-1',
          profile: expect.objectContaining({
            identity: expect.objectContaining({
              summary: 'Owner-created public identity',
            }),
            presentation: expect.objectContaining({
              profileLine: 'Owner-created public identity',
            }),
          }),
        }),
      });
    });

    it('does not require or call a Creator service for create reads or writes', async () => {
      const realm = mockRealm();

      await listCreateRealmPersonaSelectableWorlds(realm);
      await getCreateRealmPersonaWorldPreview('world-oasis', realm);
      await createReviewedRealmPersona(createPayload, realm);

      expect(realm.worldCoreControllerCreatePersonaCharacter).toHaveBeenCalledTimes(1);
    });

    it('keeps reviewed audio as a local ingress candidate until Runtime admission', async () => {
      const realm = mockRealm();
      const storageUpload = vi.fn(async () => undefined);
      const result = await uploadReviewedPostMediaResource({
        resourceType: 'AUDIO',
        file: { name: 'voice.mp3', type: 'audio/mpeg', size: 4096 },
        persona: ownerPersonaDetailWithWorldId(),
      }, realm, storageUpload);

      expect(storageUpload).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        failure: 'persona-media-publication-not-admitted',
        attachmentTruth: false,
        publicTruth: false,
        submitted: {
        mimeType: 'audio/mpeg',
          sizeBytes: 4096,
          sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1:reviewed-post-media-resource',
        },
      });
    });

    it('normalizes Create Persona responses without canonical id as create failure', () => {
      const result = normalizeRealmPersonaCreateResult({} as Awaited<ReturnType<StudioRealmSurface['worldCoreControllerCreatePersonaCharacter']>>);

      expect(result).toMatchObject({
        ok: false,
        source: REALM_PERSONA_CREATE_SOURCE,
        failure: 'realm-create-persona-missing-canonical-id',
      });
    });

    it('normalizes Create Persona responses without canonical source fields as create failure', () => {
      const missingHash = normalizeRealmPersonaCreateResult({
        id: 'persona-created-1',
        worldId: 'world-oasis',
      } as Awaited<ReturnType<StudioRealmSurface['worldCoreControllerCreatePersonaCharacter']>>);
      const missingHomeWorld = normalizeRealmPersonaCreateResult({
        id: 'persona-created-1',
        contentHash: 'hash-persona-created-1',
      } as Awaited<ReturnType<StudioRealmSurface['worldCoreControllerCreatePersonaCharacter']>>);

      expect(missingHash).toMatchObject({
        ok: false,
        source: REALM_PERSONA_CREATE_SOURCE,
        failure: 'realm-create-persona-missing-canonical-id',
        message: 'Realm create RealmPersona returned incomplete canonical source fields.',
      });
      expect(missingHomeWorld).toMatchObject({
        ok: false,
        source: REALM_PERSONA_CREATE_SOURCE,
        failure: 'realm-create-persona-missing-canonical-id',
        message: 'Realm create RealmPersona returned incomplete canonical source fields.',
      });
    });

    it('builds CreatePersonaDto shape from reviewed payload body only', () => {
      const input = buildRealmCreatePersonaInput(createPayload);

      expect(input).toEqual(createPayload.body);
      expect(collectKeys(input).has('publicFields')).toBe(false);
      expect(collectKeys(input).has('path')).toBe(false);
      expect(Object.keys(input).includes('source')).toBe(false);
    });

    it('passes the reviewed RealmPersona profile package without restoring old create fields', () => {
      const dirtyPayload = {
        ...createPayload,
        body: {
          ...createPayload.body,
          homeWorldId: 'world-oasis',
          ownershipType: 'WORLD_OWNED',
          dna: { hidden: true },
          lifecycle: 'ACTIVE',
          provider: 'forbidden',
          model: 'forbidden',
          ownerId: 'owner-1',
        },
      } as unknown as ReviewedCreateRealmPersonaPayload;
      const input = buildRealmCreatePersonaInput(dirtyPayload);

      expect(input).toEqual(createPayload.body);
      expect(collectKeys(input).has('homeWorldId')).toBe(false);
      expect(input.profile).toEqual(createPayload.body.profile);
      expect(collectKeys(input).has('dna')).toBe(false);
      expect(collectKeys(input).has('lifecycle')).toBe(false);
      expect(collectKeys(input).has('provider')).toBe(false);
      expect(collectKeys(input).has('model')).toBe(false);
      expect(collectKeys(input).has('ownerId')).toBe(false);
      expect(collectKeys(input.profile).has('personaArchetype')).toBe(false);
      expect(collectKeys(input.profile).has('personaTraits')).toBe(false);
      expect(input.profile).toMatchObject({
        identity: { handle: 'mira.persona' },
        narrative: { archetype: 'CARING', traits: ['GENTLE', 'WISE'] },
      });
    });

    it('admits reviewed reference image as a canonical external asset ref', () => {
      const payloadWithReference: ReviewedCreateRealmPersonaPayload = {
        ...createPayload,
        body: {
          ...createPayload.body,
          profile: {
            ...createPayload.body.profile,
            assets: {
              resourceRefs: [],
              externalRefs: [{
                refId: 'reference-image-1',
                kind: 'referenceImage',
                uri: 'https://cdn.example.test/reviewed-reference.png',
                purpose: 'visual-reference',
              }],
              intents: [],
            },
          },
        },
      };
      const input = buildRealmCreatePersonaInput(payloadWithReference);

      expect(input.profile).toMatchObject({
        assets: {
          externalRefs: [{
            kind: 'referenceImage',
            uri: 'https://cdn.example.test/reviewed-reference.png',
          }],
        },
      });
      expect(collectKeys(input).has('bindingPoint')).toBe(false);
      expect(collectKeys(input).has('assetId')).toBe(false);
      expect(collectKeys(input).has('resourceId')).toBe(false);
    });

    it('fails closed when Runtime Tauri IPC transport is unavailable', async () => {
      const result = await synthesizeReviewedVoiceDemo({
        scriptText: 'Welcome in.',
      }, ownerPersonaDetail(), null);

      expect(result).toMatchObject({
        ok: false,
        source: 'Runtime ScenarioService.executeScenario audio.synthesize',
        failure: 'runtime-transport-unavailable',
        message: 'Runtime speechSynthesize scenario transport unavailable: Tauri IPC runtime transport is required.',
      });
      expect(result.draft).toMatchObject({
        candidate: true,
        publicTruth: false,
      });
    });
});
