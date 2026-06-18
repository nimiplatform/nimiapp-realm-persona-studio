import {
  ExecutionMode,
  ReasonCode,
  RoutePolicy,
  ScenarioJobEventType,
  ScenarioJobStatus,
  ScenarioType,
} from '@nimiplatform/sdk/runtime/generated';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPersonaReferenceImagePayload,
  defaultReferenceImagePromptFromDraft,
  generatePersonaReferenceImage,
} from './persona-reference-image.js';
import {
  configureStudioAIConfigTargetRefsForTest,
  mockRuntimeWithRoutes,
  resetStudioAIConfigForTest,
} from './portfolio-client.test-helpers.js';

beforeEach(() => {
  resetStudioAIConfigForTest();
});

describe('persona reference image generation', () => {
  it('builds an image.generate payload from a reviewed prompt', () => {
    const result = buildPersonaReferenceImagePayload({
      prompt: 'A calm public Realm Persona portrait',
      aspectRatio: '1:1',
    });

    expect(result.ok).toBe(true);
    expect(result.payload?.surfaceId).toBe('realm-persona-studio.persona-reference-image');
    const spec = result.payload?.request.spec?.spec;
    expect(spec?.oneofKind).toBe('imageGenerate');
    expect(spec?.oneofKind === 'imageGenerate' ? spec.imageGenerate.prompt : '').toBe('A calm public Realm Persona portrait');
    expect(spec?.oneofKind === 'imageGenerate' ? spec.imageGenerate.aspectRatio : '').toBe('1:1');
  });

  it('fails closed when the prompt is empty or Runtime transport is unavailable', async () => {
    const invalid = buildPersonaReferenceImagePayload({ prompt: ' ' });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toEqual(['reference image prompt empty']);

    const result = await generatePersonaReferenceImage({ prompt: 'A reviewed image prompt' }, null);
    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-reference-image-transport-unavailable',
      source: 'Runtime ScenarioService.submitScenarioJob image.generate',
    });
  });

  it('runs reference image generation through Runtime scenario jobs and keeps only public URLs', async () => {
    const imageJob = {
      jobId: 'job-reference-image-1',
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
      traceId: 'trace-reference-image',
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
          artifactId: 'artifact-reference-1',
          mimeType: 'image/png',
          uri: 'https://cdn.example.test/reference.png',
        }],
        traceId: 'trace-reference-image',
      })),
      routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': 'runtime-image-model',
      },
    });

    const result = await generatePersonaReferenceImage({
      prompt: 'A reviewed public Realm Persona portrait',
      aspectRatio: '1:1',
    }, runtime);

    const submittedPayload = vi.mocked(runtime.ai.submitScenarioJob).mock.calls[0]?.[0];
    expect(runtime.ai.executeScenario).not.toHaveBeenCalled();
    expect(submittedPayload).toMatchObject({
      scenarioType: ScenarioType.IMAGE_GENERATE,
      executionMode: ExecutionMode.ASYNC_JOB,
      head: {
        modelId: 'runtime-image-model',
      },
    });
    expect(result).toMatchObject({
      ok: true,
      referenceImageUrl: 'https://cdn.example.test/reference.png',
      previewUrl: 'https://cdn.example.test/reference.png',
      artifactIds: ['artifact-reference-1'],
      artifactUris: ['https://cdn.example.test/reference.png'],
      runtime: {
        traceId: 'trace-reference-image',
        modelResolved: 'runtime-image-model',
      },
    });
  });

  it('reports local image model activation failures without leaking Runtime provider JSON', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      submitScenarioJob: vi.fn(async () => {
        throw new Error('{"reasonCode":"AI_LOCAL_MODEL_UNAVAILABLE","actionHint":"inspect_local_runtime_model_health","retryable":false,"message":"local environment activation blocked: python.tool.uv:uv state=needs_confirmation"}');
      }),
      routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': 'runtime-image-model',
      },
    });

    const result = await generatePersonaReferenceImage({
      prompt: 'A reviewed public Realm Persona portrait',
      aspectRatio: '1:1',
    }, runtime);

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-reference-image-generate-failed',
      message: 'Runtime imageGenerate scenario failed: Runtime local image environment is not ready. Studio requested local dependency activation; retry after Runtime finishes preparing the image environment.',
    });
    if (result.ok) {
      throw new Error('expected reference image generation to fail');
    }
    expect(result.message).not.toContain('python.tool.uv');
  });

  it('creates an editable default prompt from current create fields', () => {
    expect(defaultReferenceImagePromptFromDraft({
      description: 'A precise visual identity',
      displayName: 'Mira',
      concept: 'Public guide',
      dnaPrimary: 'CARING',
    })).toBe('A precise visual identity — CARING, Mira — character portrait, cinematic lighting, full body, high detail, neutral background');
  });
});
