import type { StudioRealmSurface } from '@renderer/data/realm-client.js';
import { FinishReason, RoutePolicy } from '@nimiplatform/sdk/runtime/generated';
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
  generateReviewedVisualImageCandidate,
  getPersonaVisibilitySettings,
  getCreateRealmPersonaWorldPreview,
  getOwnerPersonaSettings,
  getOwnerPortfolioPersonaDetail,
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
  configureStudioAIConfigTargetRefsForTest,
  createPayload,
  detailField,
  mockRealm,
  mockRuntimeWithRoutes,
  ownerPersonaDetail,
  ownerPersonaDetailWithWorldId,
  resetStudioAIConfigForTest,
} from './portfolio-client.test-helpers.js';

beforeEach(() => {
  resetStudioAIConfigForTest();
});

describe('owner portfolio posts client', () => {
     it('publishes a reviewed post draft through PostsService.createPost without forbidden caller-owned keys', async () => {
      const realm = mockRealm();
      const result = await publishReviewedPostDraft(candidatePayload, realm);
      const createPost = realm.createPost;
      const submittedRequest = vi.mocked(createPost).mock.calls[0]?.[0];
      const submittedPayload = submittedRequest?.body;

      expect(createPost).toHaveBeenCalledTimes(1);
      expect(submittedRequest?.path).toEqual({});
      expect(submittedPayload).toEqual({
        attachments: [{
          targetType: 'RESOURCE',
          targetId: 'resource-1',
        }],
        caption: 'Published caption',
        tags: ['studio'],
      });
      expect(collectKeys(submittedPayload).has('id')).toBe(false);
      expect(collectKeys(submittedPayload).has('authorId')).toBe(false);
      expect(collectKeys(submittedPayload).has('worldId')).toBe(false);
      expect(collectKeys(submittedPayload).has('scheduledAt')).toBe(false);
      expect(result).toMatchObject({
        ok: true,
        canonical: {
          id: 'post-1',
          worldId: 'world-from-realm',
          moderationStatus: 'PENDING',
          visibility: 'PUBLIC',
        },
      });
    });

     it('creates a reviewed post text Resource through ResourcesService.createTextResource only', async () => {
      const realm = mockRealm();
      const result = await createReviewedPostTextResource(candidatePayload, realm);
      const createTextResource = realm.createTextResource;
      const submittedRequest = vi.mocked(createTextResource).mock.calls[0]?.[0];
      const submittedPayload = submittedRequest?.body;

      expect(createTextResource).toHaveBeenCalledTimes(1);
      expect(submittedRequest?.path).toEqual({});
      expect(submittedPayload).toEqual({
        content: 'Published caption',
        deliveryAccess: 'SIGNED',
        label: 'Reviewed post text for @mira',
        mimeType: 'text/plain; charset=utf-8',
        sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1',
        title: 'Published caption',
        tags: ['studio'],
        metadata: {
          source: 'realm-persona-studio.reviewed-post-text-resource',
          sourceKind: 'realmPersona',
          sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1',
          attachmentPurpose: 'post',
          humanReviewed: true,
        },
      });
      expect(Object.keys(submittedPayload || {}).sort()).toEqual([
        'content',
        'deliveryAccess',
        'label',
        'metadata',
        'mimeType',
        'sourceRef',
        'tags',
        'title',
      ]);
      expect(collectKeys(submittedPayload).has('worldId')).toBe(false);
      expect(collectKeys(submittedPayload).has('authorId')).toBe(false);
      expect(collectKeys(submittedPayload).has('postId')).toBe(false);
      expect(collectKeys(submittedPayload).has('id')).toBe(false);
      expect(collectKeys(submittedPayload).has('provider')).toBe(false);
      expect(collectKeys(submittedPayload).has('model')).toBe(false);
      expect(result).toMatchObject({
        ok: true,
        source: 'Realm ResourcesService.createTextResource',
        attachmentTruth: true,
        canonical: {
          id: 'resource-text-1',
          resourceType: 'TEXT',
          status: 'READY',
          deliveryAccess: 'SIGNED',
        },
      });
    });

     it('lists READY Resource attachment options without treating non-ready resources as publishable', async () => {
      const realm = mockRealm();
      const resources = await listReadyPostAttachmentResources(realm);

      expect(realm.listResources).toHaveBeenCalledTimes(1);
      expect(resources).toEqual([{
        id: 'resource-text-1',
        resourceType: 'TEXT',
        status: 'READY',
        label: 'Published caption',
        deliveryAccess: 'SIGNED',
        source: 'Realm ResourcesService.listResources',
      }]);
    });

     it('normalizes Resource attachment options from READY resources only', () => {
      expect(normalizePostAttachmentResourceOptions({
        items: [
          { id: 'resource-ready-image', resourceType: 'IMAGE', status: 'READY', title: 'Ready portrait' },
          { id: 'resource-ready-video', resourceType: 'VIDEO', status: 'READY', label: 'Ready trailer' },
          { id: 'resource-ready-audio', resourceType: 'AUDIO', status: 'READY', storageRef: 'audio/user-1/ready.mp3' },
          { id: 'resource-pending-video', resourceType: 'VIDEO', status: 'PENDING', title: 'Pending video' },
          { id: 'resource-deleted-audio', resourceType: 'AUDIO', status: 'DELETED', title: 'Deleted audio' },
          { id: 'resource-unknown', resourceType: 'VOICE', status: 'READY', title: 'Unknown type' },
        ],
      } as unknown as Awaited<ReturnType<StudioRealmSurface['listResources']>>)).toEqual([{
        id: 'resource-ready-image',
        resourceType: 'IMAGE',
        status: 'READY',
        label: 'Ready portrait',
        source: 'Realm ResourcesService.listResources',
      }, {
        id: 'resource-ready-video',
        resourceType: 'VIDEO',
        status: 'READY',
        label: 'Ready trailer',
        source: 'Realm ResourcesService.listResources',
      }, {
        id: 'resource-ready-audio',
        resourceType: 'AUDIO',
        status: 'READY',
        label: 'audio/user-1/ready.mp3',
        source: 'Realm ResourcesService.listResources',
      }]);
    });

     it('uploads reviewed image Resource through direct upload and finalize only', async () => {
      const realm = mockRealm();
      const storageUpload = vi.fn(async () => undefined);
      const result = await uploadReviewedPostMediaResource({
        resourceType: 'IMAGE',
        file: { name: 'portrait.png', type: 'image/png', size: 2048 },
        persona: ownerPersonaDetailWithWorldId(),
      }, realm, storageUpload);
      const finalizeResource = realm.finalizeResource;
      const finalizeRequest = vi.mocked(finalizeResource).mock.calls[0]?.[0];
      const finalizePayload = finalizeRequest?.body;

      expect(realm.createImageDirectUpload).toHaveBeenCalledWith({
        path: {},
        query: { requireSignedUrls: 'true' },
      });
      expect(storageUpload).toHaveBeenCalledWith({
        uploadUrl: 'https://upload.example.test/image',
        resourceType: 'IMAGE',
        file: { name: 'portrait.png', type: 'image/png', size: 2048 },
      });
      expect(finalizeResource).toHaveBeenCalledWith({
        path: { resourceId: 'resource-image-upload' },
        body: {
        deliveryAccess: 'SIGNED',
        label: 'Reviewed post image upload for @mira',
        mimeType: 'image/png',
        sizeBytes: 2048,
        sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1:reviewed-post-media-resource',
        title: 'portrait.png',
        metadata: {
          source: 'realmPersona:world-oasis:persona-1:hash-persona-1:reviewed-post-media-resource',
          sourceKind: 'realmPersona',
          sourceId: 'persona-1',
          sourceWorldId: 'world-oasis',
          sourceContentHash: 'hash-persona-1',
          attachmentPurpose: 'post',
          resourceType: 'IMAGE',
          humanReviewed: true,
        },
        },
      });
      expect(collectKeys(finalizePayload).has('worldId')).toBe(false);
      expect(collectKeys(finalizePayload).has('authorId')).toBe(false);
      expect(collectKeys(finalizePayload).has('id')).toBe(false);
      expect(collectKeys(finalizePayload).has('provider')).toBe(false);
      expect(collectKeys(finalizePayload).has('model')).toBe(false);
      expect(result).toMatchObject({
        ok: true,
        source: 'Realm ResourcesService direct upload + finalizeResource',
        attachmentTruth: true,
        publicTruth: false,
        canonical: {
          id: 'resource-image-upload',
          resourceType: 'IMAGE',
          status: 'READY',
        },
      });
    });

     it('uploads reviewed identity image Resource without claiming profile binding truth', async () => {
      const realm = mockRealm();
      const storageUpload = vi.fn(async () => undefined);
      const result = await uploadReviewedIdentityMediaResource({
        resourceType: 'IMAGE',
        file: { name: 'identity.png', type: 'image/png', size: 3072 },
        persona: ownerPersonaDetailWithWorldId(),
        tags: ['realm-persona-studio', 'identity-candidate'],
      }, realm, storageUpload);
      const finalizeResource = realm.finalizeResource;
      const finalizeRequest = vi.mocked(finalizeResource).mock.calls[0]?.[0];
      const finalizePayload = finalizeRequest?.body;

      expect(finalizeResource).toHaveBeenCalledWith({
        path: { resourceId: 'resource-image-upload' },
        body: expect.objectContaining({
          label: 'Reviewed identity image upload for @mira',
          sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1:reviewed-identity-media-resource',
          metadata: expect.objectContaining({
            source: 'realmPersona:world-oasis:persona-1:hash-persona-1:reviewed-identity-media-resource',
            sourceKind: 'realmPersona',
            sourceId: 'persona-1',
            attachmentPurpose: 'identity',
            humanReviewed: true,
          }),
          tags: ['realm-persona-studio', 'identity-candidate'],
        }),
      });
      expect(collectKeys(finalizePayload).has('WorldControlService')).toBe(false);
      expect(collectKeys(finalizePayload).has('bindingSuccess')).toBe(false);
      expect(result).toMatchObject({
        ok: true,
        source: 'Realm ResourcesService direct upload + finalizeResource',
        attachmentTruth: true,
        publicTruth: false,
        canonical: {
          id: 'resource-image-upload',
          resourceType: 'IMAGE',
          status: 'READY',
        },
      });
    });

     it('fails closed before direct upload for mismatched media file types', async () => {
      const realm = mockRealm();
      const result = await uploadReviewedPostMediaResource({
        resourceType: 'VIDEO',
        file: { name: 'not-video.png', type: 'image/png', size: 10 },
        persona: ownerPersonaDetail(),
      }, realm, vi.fn(async () => undefined));

      expect(realm.createVideoDirectUpload).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        failure: 'media-upload-file-invalid',
        submitted: null,
      });
    });

     it('fails closed when Realm direct upload session creation throws', async () => {
      const realm = mockRealm();
      vi.mocked(realm.createImageDirectUpload).mockRejectedValueOnce(new Error('Cloudflare unavailable'));

      const result = await uploadReviewedPostMediaResource({
        resourceType: 'IMAGE',
        file: { name: 'portrait.png', type: 'image/png', size: 2048 },
        persona: ownerPersonaDetail(),
      }, realm, vi.fn(async () => undefined));

      expect(realm.finalizeResource).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        failure: 'realm-direct-upload-session-failed',
        message: 'Cloudflare unavailable',
      });
    });

     it('fails closed when Realm direct upload session is not a PENDING matching Resource', async () => {
      const realm = mockRealm();
      vi.mocked(realm.createImageDirectUpload).mockResolvedValueOnce({
        resourceId: 'resource-wrong',
        resourceType: 'VIDEO',
        provider: 'CF_STREAM',
        storageRef: 'wrong',
        uploadUrl: 'https://upload.example.test/wrong',
        status: 'PENDING',
        deliveryAccess: 'SIGNED',
      });

      const result = await uploadReviewedPostMediaResource({
        resourceType: 'IMAGE',
        file: { name: 'portrait.png', type: 'image/png', size: 2048 },
        persona: ownerPersonaDetail(),
      }, realm, vi.fn(async () => undefined));

      expect(realm.finalizeResource).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        failure: 'realm-direct-upload-session-invalid',
      });
    });

     it('fails closed when storage direct upload fails before finalize', async () => {
      const realm = mockRealm();
      const storageUpload = vi.fn(async () => {
        throw new Error('storage rejected upload');
      });

      const result = await uploadReviewedPostMediaResource({
        resourceType: 'IMAGE',
        file: { name: 'portrait.png', type: 'image/png', size: 2048 },
        persona: ownerPersonaDetail(),
      }, realm, storageUpload);

      expect(realm.finalizeResource).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        failure: 'storage-direct-upload-failed',
        message: 'storage rejected upload',
      });
    });

     it('fails closed when finalizeResource throws after storage upload', async () => {
      const realm = mockRealm();
      vi.mocked(realm.finalizeResource).mockRejectedValueOnce(new Error('finalize rejected'));

      const result = await uploadReviewedPostMediaResource({
        resourceType: 'IMAGE',
        file: { name: 'portrait.png', type: 'image/png', size: 2048 },
        persona: ownerPersonaDetail(),
      }, realm, vi.fn(async () => undefined));

      expect(result).toMatchObject({
        ok: false,
        failure: 'realm-finalize-resource-failed',
        message: 'finalize rejected',
      });
    });

     it('fails closed when finalizeResource returns a non-ready media Resource', async () => {
      const realm = mockRealm();
      vi.mocked(realm.finalizeResource).mockResolvedValueOnce({
        id: 'resource-image-upload',
        resourceType: 'IMAGE',
        provider: 'CF_IMAGE',
        status: 'PENDING',
        storageRef: 'resource-image-upload',
        provenance: 'UPLOADED',
        uploaderAccountId: 'user-1',
        controllerKind: 'ACCOUNT',
        controllerId: 'user-1',
        deliveryAccess: 'SIGNED',
        tags: [],
        createdAt: '2026-05-21T00:00:00.000Z',
        updatedAt: '2026-05-21T00:00:00.000Z',
      });

      const result = await uploadReviewedPostMediaResource({
        resourceType: 'IMAGE',
        file: { name: 'portrait.png', type: 'image/png', size: 2048 },
        persona: ownerPersonaDetail(),
      }, realm, vi.fn(async () => undefined));

      expect(result).toMatchObject({
        ok: false,
        failure: 'realm-finalize-resource-not-ready',
      });
    });

     it('fails closed when finalized direct media Resource is not READY', () => {
      expect(buildFinalizeDirectMediaResourceInput({
        resourceType: 'VIDEO',
        file: { name: 'clip.mp4', type: 'video/mp4', size: 1024 },
        persona: ownerPersonaDetail(),
      })).toMatchObject({
        mimeType: 'video/mp4',
        sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1:reviewed-post-media-resource',
      });
      expect(normalizeFinalizedDirectMediaResource({
        id: 'resource-video-upload',
        resourceType: 'VIDEO',
        status: 'PENDING',
      } as Awaited<ReturnType<StudioRealmSurface['finalizeResource']>>, 'VIDEO')).toBeNull();
    });

     it('fails closed before text Resource creation when reviewed caption content is missing', async () => {
      const realm = mockRealm();
      const result = await createReviewedPostTextResource({
        ...candidatePayload,
        realmCreatePost: {
          attachments: [],
        },
      }, realm);

      expect(realm.createTextResource).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        source: 'Realm ResourcesService.createTextResource',
        attachmentTruth: false,
        failure: 'post-text-resource-payload-invalid',
        submitted: null,
      });
    });

     it('fails closed when text Resource creation does not return a READY TEXT resource', () => {
      const submitted = buildRealmPostTextResourceInput(candidatePayload);
      expect(submitted).not.toBeNull();

      const result = normalizeRealmTextResourceCreateResult({
        id: 'resource-image-1',
        resourceType: 'IMAGE',
        status: 'PENDING',
      } as Awaited<ReturnType<StudioRealmSurface['createTextResource']>>, submitted!);

      expect(result).toMatchObject({
        ok: false,
        source: 'Realm ResourcesService.createTextResource',
        attachmentTruth: false,
        failure: 'realm-create-text-resource-not-ready',
        submitted,
      });
    });

     it('normalizes Create Post responses without canonical id as publish failure', () => {
      const result = normalizeRealmPostPublishResult({} as Awaited<ReturnType<StudioRealmSurface['createPost']>>);

      expect(result).toMatchObject({
        ok: false,
        failure: 'realm-create-post-missing-canonical-id',
      });
    });

     it('builds CreatePostDto shape from reviewed payload only', () => {
      const input = buildRealmCreatePostInput(candidatePayload);

      expect(input).toEqual(candidatePayload.realmCreatePost);
      expect(collectKeys(input).has('personaRef')).toBe(false);
      expect(collectKeys(input).has('review')).toBe(false);
    });

     it('uses Runtime text.generate for candidate post copy only', async () => {
      // Studio resolves a concrete Runtime route before dispatch; `auto` never
      // reaches ScenarioService.
      const executeScenario = vi.fn(async (_input: unknown) => ({
        output: {
          output: {
            oneofKind: 'textGenerate' as const,
            textGenerate: {
              text: JSON.stringify({
                caption: 'Mira shares a concise artifact update.',
                tagsText: ['artifact', 'studio'],
                rationale: 'Owner asked for a concise update.',
              }),
            },
          },
        },
        finishReason: FinishReason.STOP,
        routeDecision: RoutePolicy.UNSPECIFIED,
        modelResolved: 'runtime-default-text',
        traceId: 'trace-post-copy',
        ignoredExtensions: [],
      }));
      const runtime = mockRuntimeWithRoutes({
        executeScenario,
        routes: [{ capability: 'text.generate', model: 'runtime-default-text' }],
      });
      configureStudioAIConfigTargetRefsForTest({
        targetRefs: {
          'text.generate': 'runtime-default-text',
        },
      });

      const result = await proposeReviewedPostCopy(ownerPersonaDetail(), {
        caption: '',
        tagsText: '',
        humanReviewed: false,
        attachmentEnabled: false,
        attachmentTargetType: 'RESOURCE',
        attachmentTargetId: '',
      }, 'Draft a short launch post.', runtime);
      const submittedPayload = executeScenario.mock.calls[0]?.[0] as Record<string, unknown> | undefined;

      expect(executeScenario).toHaveBeenCalledTimes(1);
      expect(submittedPayload).toMatchObject({
        head: {
          modelId: 'runtime-default-text',
        },
        spec: {
          spec: {
            oneofKind: 'textGenerate',
          },
        },
      });
      expect(collectKeys(submittedPayload).has('provider')).toBe(false);
      const textGenerate = (submittedPayload?.spec as { spec?: { textGenerate?: { input?: unknown } } } | undefined)
        ?.spec?.textGenerate;
      const submittedUserInput = JSON.stringify(textGenerate?.input ?? []);
      expect(submittedUserInput).not.toContain('LocalAgent');
      expect(submittedUserInput).not.toContain('worldId');
      expect(result).toMatchObject({
        ok: true,
        source: 'Runtime runtime.ai.text.generate',
        candidate: true,
        truthWrite: false,
        proposal: {
          draftPatch: {
            caption: 'Mira shares a concise artifact update.',
            tagsText: 'artifact, studio',
          },
        },
        runtime: {
          traceId: 'trace-post-copy',
        },
      });
    });
});
