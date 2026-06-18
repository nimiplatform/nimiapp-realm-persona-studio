import type { StudioRealmSurface } from '@renderer/data/realm-client.js';
import {
  ExecutionMode,
  FinishReason,
  ReasonCode,
  RoutePolicy,
  ScenarioJobEventType,
  ScenarioJobStatus,
  ScenarioType,
} from '@nimiplatform/sdk/runtime/generated';
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
  persona as personaFixture,
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

describe('owner portfolio media client', () => {
     it('selects a reviewed avatar URL through WorldCoreController.replaceRealmPersona only', async () => {
      const realm = mockRealm();
      const result = await selectReviewedPersonaAvatarUrl('persona-1', ' https://cdn.example.test/avatar.png ', realm);
      const selectAvatar = realm.worldCoreControllerReplaceRealmPersona;
      const submittedPayload = vi.mocked(selectAvatar).mock.calls[0]?.[0]?.body;

      expect(selectAvatar).toHaveBeenCalledWith({
        path: { personaId: 'persona-1' },
        body: expect.objectContaining({
          baseContentHash: 'hash-persona-1',
          core: expect.objectContaining({
            assets: expect.objectContaining({
              externalRefs: expect.arrayContaining([
                expect.objectContaining({
                  kind: 'avatar',
                  uri: 'https://cdn.example.test/avatar.png',
                  purpose: 'profile-avatar',
                }),
              ]),
            }),
          }),
        }),
      });
      expect(Object.keys(submittedPayload || {}).sort()).toEqual(['baseContentHash', 'core', 'homeWorldId', 'origin']);
      expect(collectKeys(submittedPayload).has('profileCoverUrl')).toBe(false);
      expect(collectKeys(submittedPayload).has('resourceId')).toBe(false);
      expect(collectKeys(submittedPayload).has('bindingId')).toBe(false);
      expect(collectKeys(submittedPayload).has('provider')).toBe(false);
      expect(collectKeys(submittedPayload).has('model')).toBe(false);
      expect(result).toMatchObject({
        ok: true,
        source: 'Realm WorldCoreController.replaceRealmPersona',
        publicTruth: true,
        realm: {
          success: true,
        },
      });
    });

     it('rejects invalid avatar URLs before calling Realm', async () => {
      const realm = mockRealm();
      const result = await selectReviewedPersonaAvatarUrl('persona-1', 'data:text/plain,avatar', realm);

      expect(realm.worldCoreControllerReplaceRealmPersona).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        source: 'Realm WorldCoreController.replaceRealmPersona',
        publicTruth: false,
        failure: 'avatar-url-invalid',
        submitted: null,
      });
    });

     it('fails closed when Realm rejects avatar selection success confirmation', () => {
      const submitted = {
        avatarUrl: 'https://cdn.example.test/avatar.png',
      };
      const result = normalizeRealmPersonaAvatarSelectResult({
        ...personaFixture,
        core: {
          ...personaFixture.core,
          assets: {
            resourceRefs: [],
            externalRefs: [{
              refId: 'selected-avatar',
              kind: 'avatar',
              uri: 'https://cdn.example.test/other.png',
              purpose: 'profile-avatar',
            }],
            intents: [],
          },
        },
      }, submitted);

      expect(result).toMatchObject({
        ok: false,
        source: 'Realm WorldCoreController.replaceRealmPersona',
        publicTruth: false,
        failure: 'realm-select-avatar-rejected',
        submitted,
      });
    });

     it('builds SelectAvatarDto from a narrow URL allowlist', () => {
      expect(buildRealmSelectAvatarInput(' https://cdn.example.test/avatar.png ')).toEqual({
        avatarUrl: 'https://cdn.example.test/avatar.png',
      });
      expect(buildRealmSelectAvatarInput('ftp://cdn.example.test/avatar.png')).toBeNull();
      expect(buildRealmSelectAvatarInput('')).toBeNull();
    });

     it('calls Runtime imageGenerate scenario job for visual candidates only', async () => {
      const imageJob = {
        jobId: 'job-image-1',
        scenarioType: ScenarioType.IMAGE_GENERATE,
        executionMode: ExecutionMode.ASYNC_JOB,
        routeDecision: RoutePolicy.UNSPECIFIED,
        modelResolved: 'runtime-image-model',
        status: ScenarioJobStatus.COMPLETED,
        providerJobId: '',
        reasonCode: ReasonCode.REASON_CODE_UNSPECIFIED,
        reasonDetail: '',
        retryCount: 0,
        artifacts: [],
        traceId: 'trace-image-output',
        ignoredExtensions: [],
        progressPercent: 100,
        progressCurrentStep: 0,
        progressTotalSteps: 0,
      };
      const runtime = mockRuntimeWithRoutes({
        executeScenario: vi.fn(),
        submitScenarioJob: vi.fn(async (request: unknown) => ({
          job: {
            ...imageJob,
            head: (request as { readonly head?: unknown }).head,
          },
        })),
        subscribeScenarioJobEvents: vi.fn(async function* () {
          yield {
            eventType: ScenarioJobEventType.SCENARIO_JOB_EVENT_COMPLETED,
            sequence: 1,
            jobId: imageJob.jobId,
            message: '',
            job: imageJob,
          };
        }),
        getScenarioArtifacts: vi.fn(async () => ({
          artifacts: [{
            artifactId: 'artifact-image-1',
            mimeType: 'image/png',
            uri: 'runtime://artifact-image-1',
          }],
          traceId: 'trace-image-output',
        })),
        routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
      });
      configureStudioAIConfigTargetRefsForTest({
        targetRefs: {
          'image.generate': 'runtime-image-model',
        },
      });

      const result = await generateReviewedVisualImageCandidate({
        resourceType: 'IMAGE',
        bindingPoint: 'PERSONA_CANDIDATE',
        prompt: 'Warm profile portrait.',
        notes: 'Use public bio only.',
        aspectRatio: '1:1',
      }, ownerPersonaDetail(), runtime as unknown as Parameters<typeof generateReviewedVisualImageCandidate>[2]);

      const submitScenarioJob = vi.mocked(runtime.ai.submitScenarioJob);
      const submittedPayload = submitScenarioJob.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(runtime.ai.executeScenario).not.toHaveBeenCalled();
      expect(submitScenarioJob).toHaveBeenCalledTimes(1);
      expect(submittedPayload).toMatchObject({
        head: {
          modelId: 'runtime-image-model',
        },
        scenarioType: ScenarioType.IMAGE_GENERATE,
        executionMode: ExecutionMode.ASYNC_JOB,
        spec: {
          spec: {
            oneofKind: 'imageGenerate',
            imageGenerate: {
              n: 1,
              aspectRatio: '1:1',
              responseFormat: 'url',
            },
          },
        },
      });
      expect(collectKeys(submittedPayload).has('provider')).toBe(false);
      expect(collectKeys(submittedPayload).has('localAgent')).toBe(false);
      expect(collectKeys(submittedPayload).has('worldId')).toBe(false);
      expect(result).toMatchObject({
        ok: true,
        source: 'Runtime ScenarioService.submitScenarioJob image.generate',
        candidate: true,
        publicTruth: false,
        runtime: {
          artifactIds: ['artifact-image-1'],
          artifactUris: [],
          previewUrls: [],
          traceId: 'trace-image-output',
          modelResolved: 'runtime-image-model',
        },
      });
    });

     it('fails closed when Runtime imageGenerate scenario job returns no artifact', async () => {
      const imageJob = {
        jobId: 'job-image-empty',
        scenarioType: ScenarioType.IMAGE_GENERATE,
        executionMode: ExecutionMode.ASYNC_JOB,
        routeDecision: RoutePolicy.UNSPECIFIED,
        modelResolved: '',
        status: ScenarioJobStatus.COMPLETED,
        providerJobId: '',
        reasonCode: ReasonCode.REASON_CODE_UNSPECIFIED,
        reasonDetail: '',
        retryCount: 0,
        artifacts: [],
        traceId: '',
        ignoredExtensions: [],
        progressPercent: 100,
        progressCurrentStep: 0,
        progressTotalSteps: 0,
      };
      const runtime = mockRuntimeWithRoutes({
        executeScenario: vi.fn(),
        submitScenarioJob: vi.fn(async () => ({ job: imageJob })),
        subscribeScenarioJobEvents: vi.fn(async function* () {
          yield {
            eventType: ScenarioJobEventType.SCENARIO_JOB_EVENT_COMPLETED,
            sequence: 1,
            jobId: imageJob.jobId,
            message: '',
            job: imageJob,
          };
        }),
        getScenarioArtifacts: vi.fn(async () => ({
          artifacts: [],
          traceId: '',
        })),
        routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
      });
      configureStudioAIConfigTargetRefsForTest({
        targetRefs: {
          'image.generate': 'runtime-image-model',
        },
      });

      const result = await generateReviewedVisualImageCandidate({
        resourceType: 'IMAGE',
        bindingPoint: 'PERSONA_CANDIDATE',
        prompt: 'Warm profile portrait.',
        notes: '',
        aspectRatio: '1:1',
      }, ownerPersonaDetail(), runtime as unknown as Parameters<typeof generateReviewedVisualImageCandidate>[2]);

      expect(runtime.ai.executeScenario).not.toHaveBeenCalled();
      expect(runtime.ai.submitScenarioJob).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        ok: false,
        source: 'Runtime ScenarioService.submitScenarioJob image.generate',
        failure: 'runtime-output-missing',
        message: 'Runtime imageGenerate scenario output missing readable artifact.',
      });
    });

     it('calls Runtime speechSynthesize scenario with the allowlisted reviewed voice body', async () => {
      const executeScenario = vi.fn(async (_input: unknown) => ({
        output: {
          output: {
            oneofKind: 'speechSynthesize' as const,
            speechSynthesize: {
              artifacts: [{
                artifactId: 'artifact-audio-1',
                mimeType: 'audio/wav',
              }],
            },
          },
        },
        finishReason: FinishReason.STOP,
        routeDecision: RoutePolicy.UNSPECIFIED,
        modelResolved: 'runtime-tts-model',
        traceId: 'trace-output-1',
        ignoredExtensions: [],
      }));
      const runtime = mockRuntimeWithRoutes({
        executeScenario,
        routes: [{ capability: 'audio.synthesize', model: 'runtime-tts-model' }],
      });
      configureStudioAIConfigTargetRefsForTest({
        targetRefs: {
          'audio.synthesize': 'runtime-tts-model',
        },
      });

      const result = await synthesizeReviewedVoiceDemo({
        scriptText: '  Welcome in.  ',
      }, ownerPersonaDetail(), runtime as unknown as Parameters<typeof synthesizeReviewedVoiceDemo>[2]);

      const submittedPayload = executeScenario.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(executeScenario).toHaveBeenCalledTimes(1);
      expect(submittedPayload).toMatchObject({
        head: {
          modelId: 'runtime-tts-model',
        },
        spec: {
          spec: {
            oneofKind: 'speechSynthesize',
            speechSynthesize: {
              text: 'Welcome in.',
            },
          },
        },
      });
      expect(collectKeys(submittedPayload).has('provider')).toBe(false);
      expect(collectKeys(submittedPayload).has('localAgent')).toBe(false);
      expect(result).toMatchObject({
        ok: true,
        source: 'Runtime ScenarioService.executeScenario audio.synthesize',
        candidate: true,
        publicTruth: false,
        runtime: {
          artifactIds: ['artifact-audio-1'],
          traceId: 'trace-output-1',
          modelResolved: 'runtime-tts-model',
        },
      });
    });

     it('fails closed when Runtime speechSynthesize AIConfig targetRef is missing', async () => {
      const runtime = mockRuntimeWithRoutes({
        executeScenario: vi.fn(),
        routes: [{ capability: 'audio.synthesize', model: 'runtime-tts-model' }],
      });
      const result = await synthesizeReviewedVoiceDemo({
        scriptText: 'Welcome in.',
      }, ownerPersonaDetail(), runtime as unknown as Parameters<typeof synthesizeReviewedVoiceDemo>[2]);

      expect(runtime.ai.executeScenario).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        source: 'Runtime ScenarioService.executeScenario audio.synthesize',
        failure: 'runtime-route-unbound',
        message: 'NimiAIConfig targetRef missing for audio.synthesize. Configure AI models before running Studio AI.',
      });
    });

     it('fails closed when Runtime speechSynthesize scenario output has no artifact id', async () => {
      const executeScenario = vi.fn(async () => ({
        output: {
          output: {
            oneofKind: 'speechSynthesize' as const,
            speechSynthesize: {
              artifacts: [],
            },
          },
        },
        finishReason: FinishReason.STOP,
        routeDecision: RoutePolicy.UNSPECIFIED,
        modelResolved: '',
        traceId: '',
        ignoredExtensions: [],
      }));
      const runtime = mockRuntimeWithRoutes({
        executeScenario,
        routes: [{ capability: 'audio.synthesize', model: 'runtime-tts-model' }],
      });
      configureStudioAIConfigTargetRefsForTest({
        targetRefs: {
          'audio.synthesize': 'runtime-tts-model',
        },
      });
      const result = await synthesizeReviewedVoiceDemo({
        scriptText: 'Welcome in.',
      }, ownerPersonaDetail(), runtime as unknown as Parameters<typeof synthesizeReviewedVoiceDemo>[2]);

      expect(result).toMatchObject({
        ok: false,
        source: 'Runtime ScenarioService.executeScenario audio.synthesize',
        failure: 'runtime-output-missing',
        message: 'Runtime speechSynthesize scenario output missing artifact id.',
      });
    });

     it('fails closed and preserves draft when Runtime speechSynthesize scenario throws', async () => {
      const executeScenario = vi.fn(async () => {
        throw new Error('runtime unavailable');
      });
      const runtime = mockRuntimeWithRoutes({
        executeScenario,
        routes: [{ capability: 'audio.synthesize', model: 'runtime-tts-model' }],
      });
      configureStudioAIConfigTargetRefsForTest({
        targetRefs: {
          'audio.synthesize': 'runtime-tts-model',
        },
      });
      const result = await synthesizeReviewedVoiceDemo({
        scriptText: 'Welcome in.',
      }, ownerPersonaDetail(), runtime as unknown as Parameters<typeof synthesizeReviewedVoiceDemo>[2]);

      expect(executeScenario).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        ok: false,
        source: 'Runtime ScenarioService.executeScenario audio.synthesize',
        failure: 'runtime-synthesize-failed',
        message: 'Runtime speechSynthesize scenario failed: runtime unavailable',
        draft: {
          candidate: true,
          publicTruth: false,
        },
      });
    });
});
