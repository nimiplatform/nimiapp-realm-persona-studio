import { RoutePolicy } from '@nimiplatform/sdk/runtime/generated';
import { fromNimiRuntimeProtoStruct } from '@nimiplatform/sdk/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bindStudioImageGeneratePayload,
  bindStudioSpeechSynthesizePayload,
  bindStudioTextGeneratePayload,
  createStudioImageGeneratePayload,
  createStudioSpeechSynthesizePayload,
  executeStudioImageGenerate,
  executeStudioSpeechSynthesize,
  type StudioImageGeneratePayload,
  type StudioSpeechSynthesizePayload,
  type StudioTextGeneratePayload,
} from './studio-ai-runtime.js';
import {
  configureStudioAIConfigTargetRefsForTest,
  mockRuntimeWithRoutes,
  resetStudioAIConfigForTest,
} from './portfolio-client.test-helpers.js';

beforeEach(() => {
  resetStudioAIConfigForTest();
});

function textPayload(model = 'auto'): StudioTextGeneratePayload {
  return {
    surfaceId: 'realm-persona-studio.post-copy',
    params: { model },
    request: {
      model: { modelId: model },
      messages: [],
      parameters: {},
    },
  };
}

function imagePayload(model = 'auto'): StudioImageGeneratePayload {
  return createStudioImageGeneratePayload({
    surfaceId: 'realm-persona-studio.visual-image-candidate',
    params: { model, aspectRatio: '1:1', responseFormat: 'url' },
    spec: {
      prompt: 'Warm profile portrait.',
      negativePrompt: '',
      n: 1,
      size: '',
      aspectRatio: '1:1',
      quality: '',
      style: '',
      seed: '',
      referenceImages: [],
      mask: '',
      responseFormat: 'url',
    },
  });
}

function speechPayload(model = 'auto'): StudioSpeechSynthesizePayload {
  return createStudioSpeechSynthesizePayload({
    surfaceId: 'realm-persona-studio.voice-demo-candidate',
    params: { model },
    spec: {
      text: 'Welcome in.',
      language: '',
      audioFormat: '',
      sampleRateHz: 0,
      speed: 0,
      pitch: 0,
      volume: 0,
      emotion: '',
      timingMode: 0,
    },
  });
}

describe('studio ai runtime route hard boundary', () => {
  it('normalizes empty image seed to the Runtime int64 zero value', () => {
    const payload = imagePayload();
    const imageGenerate = payload.request.spec?.spec.oneofKind === 'imageGenerate'
      ? payload.request.spec.spec.imageGenerate
      : null;

    expect(imageGenerate?.seed).toBe('0');
  });

  it('rejects non-integer image seed before Runtime execution', () => {
    expect(() => createStudioImageGeneratePayload({
      surfaceId: 'realm-agent-studio.visual-image-candidate',
      params: { model: 'auto' },
      spec: {
        prompt: 'Warm profile portrait.',
        negativePrompt: '',
        n: 1,
        size: '',
        aspectRatio: '1:1',
        quality: '',
        style: '',
        seed: 'not-an-int',
        referenceImages: [],
        mask: '',
        responseFormat: 'url',
      },
    })).toThrow('Runtime image.generate seed must be an integer string');
  });

  it('fails closed when targetRef is missing even if caller supplies a concrete model', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'text.generate', model: 'runtime-text-model' }],
    });

    await expect(bindStudioTextGeneratePayload(textPayload('runtime-text-model'), runtime))
      .rejects.toThrow('NimiAIConfig targetRef missing for text.generate');
  });

  it('rejects profile-slice targetRef before Runtime execution', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'text.generate', model: 'runtime-text-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'text.generate': {
          kind: 'profile-slice',
          sourceProfileId: 'owner-profile',
          sliceId: 'text-defaults',
        },
      },
    });

    await expect(bindStudioTextGeneratePayload(textPayload(), runtime))
      .rejects.toThrow('profile-slice and cannot be executed');
  });

  it('requires local targetRef engine tokens to match the Runtime route', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': {
          kind: 'local-runtime',
          profileId: 'runtime-image-model',
          targetId: 'other-engine',
          readinessRef: 'runtime-route:local:other-engine:runtime-image-model',
        },
      },
    });

    await expect(bindStudioImageGeneratePayload(imagePayload(), runtime))
      .rejects.toThrow('configured NimiAIConfig target');
  });

  it('requires cloud targetRef connectorId to match the Runtime connector route', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'text.generate', model: 'runtime-text-model', connectorId: 'openai' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'text.generate': {
          kind: 'cloud-connector',
          connectorId: 'anthropic',
          providerModelId: 'runtime-text-model',
        },
      },
    });

    await expect(bindStudioTextGeneratePayload(textPayload(), runtime))
      .rejects.toThrow('configured NimiAIConfig target');
  });

  it('rejects image execution unless the payload was bound through NimiAIConfig targetRef', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
    });

    await expect(executeStudioImageGenerate(
      imagePayload('runtime-image-model') as Parameters<typeof executeStudioImageGenerate>[0],
      runtime,
    )).rejects.toThrow('payload must be bound through NimiAIConfig targetRef');
    expect(runtime.ai.executeScenario).not.toHaveBeenCalled();
  });

  it('rejects speech execution unless the payload was bound through NimiAIConfig targetRef', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'audio.synthesize', model: 'runtime-tts-model' }],
    });

    await expect(executeStudioSpeechSynthesize(
      speechPayload('runtime-tts-model') as Parameters<typeof executeStudioSpeechSynthesize>[0],
      runtime,
    )).rejects.toThrow('payload must be bound through NimiAIConfig targetRef');
    expect(runtime.ai.executeScenario).not.toHaveBeenCalled();
  });

  it('rejects execution when a bound image request head is tampered after binding', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(async () => ({})),
      routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': 'runtime-image-model',
      },
    });
    const bound = await bindStudioImageGeneratePayload(imagePayload(), runtime);
    const tampered = bound as unknown as { request: typeof bound.request };
    const head = bound.request.head;
    expect(head).toBeDefined();
    tampered.request = {
      ...bound.request,
      head: {
        ...head!,
        modelId: 'other-model',
      },
    };

    await expect(executeStudioImageGenerate(
      bound,
      runtime,
    )).rejects.toThrow('request head.modelId does not match');
    expect(runtime.ai.executeScenario).not.toHaveBeenCalled();
  });

  it('rejects execution when a bound cloud request connector head is tampered after binding', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(async () => ({})),
      routes: [{ capability: 'image.generate', model: 'runtime-image-model', connectorId: 'openai' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': {
          kind: 'cloud-connector',
          connectorId: 'openai',
          providerModelId: 'runtime-image-model',
        },
      },
    });
    const bound = await bindStudioImageGeneratePayload(imagePayload(), runtime);
    const tampered = bound as unknown as { request: typeof bound.request };
    const head = bound.request.head;
    expect(head).toBeDefined();
    tampered.request = {
      ...bound.request,
      head: {
        ...head!,
        connectorId: '',
        routePolicy: RoutePolicy.LOCAL,
      },
    };

    await expect(executeStudioImageGenerate(
      bound,
      runtime,
    )).rejects.toThrow('request head.routePolicy does not match');
    expect(runtime.ai.executeScenario).not.toHaveBeenCalled();
  });

  it('binds image selected companion slots into Runtime Scenario extensions', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [
        { capability: 'image.generate', model: 'runtime-image-model' },
        { capability: 'image.generate', model: 'runtime-vae-model' },
      ],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': 'runtime-image-model',
      },
      selectedParams: {
        'image.generate': {
          companionSlots: {
            vae_path: 'runtime-vae-model',
          },
          steps: '28',
          cfgScale: '7',
          sampler: 'euler',
        },
      },
    });

    const bound = await bindStudioImageGeneratePayload(imagePayload(), runtime);
    const extension = bound.request.extensions[0];
    const payload = fromNimiRuntimeProtoStruct(extension?.payload);

    expect(extension?.namespace).toBe('nimi.scenario.image.request');
    expect(payload).toMatchObject({
      steps: '28',
      cfgScale: '7',
      sampler: 'euler',
    });
    expect(payload.profile_entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entry_id: 'main-image',
        asset_id: 'runtime-image-model',
        required: true,
      }),
      expect.objectContaining({
        entry_id: 'companion-vae',
        asset_id: 'runtime-vae-model',
        engine_slot: 'vae_path',
      }),
    ]));
    expect(payload.entry_overrides).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entry_id: 'companion-vae',
        local_asset_id: 'image:runtime-vae-model',
      }),
    ]));
  });

  it('activates required local image environment dependencies before submitting image jobs', async () => {
    const startLocalEnvironmentDependencyJob = vi.fn(async (request: {
      readonly environmentKey?: string;
      readonly dependencyFamily?: string;
      readonly dependencyId?: string;
      readonly consumerScope?: string;
      readonly sourceKind?: string;
      readonly confirmed?: boolean;
    }) => ({
      job: {
        jobId: 'local-environment-dependency-job-1',
        environmentKey: request.environmentKey || '',
        dependencyFamily: request.dependencyFamily || '',
        dependencyId: request.dependencyId || '',
        consumerScope: request.consumerScope || '',
        state: 'queued',
        sourceKind: request.sourceKind || '',
        canonicalRoot: '',
        selectedSourceRecordId: '',
        failureDetail: '',
        retryable: false,
        createdAt: '2026-05-21T00:00:00.000Z',
        updatedAt: '2026-05-21T00:00:00.000Z',
        reasonCode: '',
        recoveryDisposition: '',
        bytesReceived: 0,
        bytesTotal: 0,
        percent: 0,
        speedBytesPerSec: 0,
        etaSeconds: 0,
      },
    }));
    const resolveLocalEnvironmentPlan = vi
      .fn()
      .mockResolvedValueOnce({
        plan: {
          planId: 'local-image-native-plan-blocked',
          packId: 'local-image-native',
          productLabel: 'Local image native',
          hostProfileId: 'test-host',
          platformTuple: 'test-platform',
          runtimeDataRoot: '',
          consumerScope: 'local-image-native',
          cloudOnlyImpact: '',
          state: 'needs_confirmation',
          reasonCode: '',
          dependencies: [{
            dependencyFamily: 'python.tool.uv',
            dependencyId: 'uv',
            consumerScope: 'local-image-native',
            required: true,
            state: 'needs_confirmation',
            sourceKind: 'runtime_managed',
            confirmationRequired: true,
            selectedSourceRecordId: '',
            environmentKey: 'local-image-native',
            canonicalRoot: '',
            reasonCode: '',
            detail: '',
          }],
        },
      })
      .mockResolvedValue({
        plan: {
          planId: 'local-image-native-plan-ready',
          packId: 'local-image-native',
          productLabel: 'Local image native',
          hostProfileId: 'test-host',
          platformTuple: 'test-platform',
          runtimeDataRoot: '',
          consumerScope: 'local-image-native',
          cloudOnlyImpact: '',
          state: 'ready',
          reasonCode: '',
          dependencies: [{
            dependencyFamily: 'python.tool.uv',
            dependencyId: 'uv',
            consumerScope: 'local-image-native',
            required: true,
            state: 'ready_managed',
            sourceKind: 'runtime_managed',
            confirmationRequired: false,
            selectedSourceRecordId: '',
            environmentKey: 'local-image-native',
            canonicalRoot: '',
            reasonCode: '',
            detail: '',
          }],
        },
      });
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      resolveLocalEnvironmentPlan,
      listLocalEnvironmentDependencyJobs: vi.fn(async () => ({ jobs: [] })),
      startLocalEnvironmentDependencyJob,
      routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': 'runtime-image-model',
      },
    });

    const bound = await bindStudioImageGeneratePayload(imagePayload(), runtime);
    await executeStudioImageGenerate(bound, runtime);

    expect(startLocalEnvironmentDependencyJob).toHaveBeenCalledWith(expect.objectContaining({
      environmentKey: 'local-image-native',
      dependencyFamily: 'python.tool.uv',
      dependencyId: 'uv',
      confirmed: true,
      consumerScope: 'local-image-native',
    }), undefined);
    expect(runtime.ai.submitScenarioJob).toHaveBeenCalledTimes(1);
  });

  it('rejects image profile_entries when they try to override the targetRef resolved model', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': 'runtime-image-model',
      },
      selectedParams: {
        'image.generate': {
          profile_entries: [{
            entry_id: 'main-image',
            kind: 'asset',
            title: 'Malicious override',
            capability: 'image.generate',
            asset_id: 'other-runtime-image-model',
            asset_kind: 'image',
            engine: 'mock-runtime',
            required: true,
          }],
        },
      },
    });

    await expect(bindStudioImageGeneratePayload(imagePayload(), runtime))
      .rejects.toThrow('profile_entries main model other-runtime-image-model does not match');
  });

  it('keeps matching image profile_entries as extensions without changing the bound request head', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': 'runtime-image-model',
      },
      selectedParams: {
        'image.generate': {
          profile_entries: [{
            entry_id: 'main-image',
            kind: 'asset',
            title: 'Main image model',
            capability: 'image.generate',
            asset_id: 'runtime-image-model',
            asset_kind: 'image',
            engine: 'mock-runtime',
            required: true,
          }],
        },
      },
    });

    const bound = await bindStudioImageGeneratePayload(imagePayload(), runtime);
    const extension = bound.request.extensions[0];
    const payload = fromNimiRuntimeProtoStruct(extension?.payload);

    expect(bound.request.head?.modelId).toBe('runtime-image-model');
    expect(payload.profile_entries).toEqual([
      expect.objectContaining({
        entry_id: 'main-image',
        asset_id: 'runtime-image-model',
      }),
    ]);
  });

  it('fails closed when image selected companion slot references a missing Runtime asset', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'image.generate', model: 'runtime-image-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'image.generate': 'runtime-image-model',
      },
      selectedParams: {
        'image.generate': {
          companionSlots: {
            vae_path: 'missing-vae',
          },
        },
      },
    });

    await expect(bindStudioImageGeneratePayload(imagePayload(), runtime))
      .rejects.toThrow('companion slot vae_path references missing Runtime local asset missing-vae');
  });

  it('binds audio voiceRef selected params into Runtime speech spec', async () => {
    const runtime = mockRuntimeWithRoutes({
      executeScenario: vi.fn(),
      routes: [{ capability: 'audio.synthesize', model: 'runtime-tts-model' }],
    });
    configureStudioAIConfigTargetRefsForTest({
      targetRefs: {
        'audio.synthesize': 'runtime-tts-model',
      },
      selectedParams: {
        'audio.synthesize': {
          voiceRef: {
            kind: 'provider_voice_ref',
            providerVoiceRef: 'studio-voice-main',
          },
          speakingRate: 1.15,
          pitchSemitones: 2,
          responseFormat: 'wav',
        },
      },
    });

    const bound = await bindStudioSpeechSynthesizePayload(speechPayload(), runtime);
    const speech = bound.request.spec?.spec.oneofKind === 'speechSynthesize'
      ? bound.request.spec.spec.speechSynthesize
      : null;

    expect(speech).toMatchObject({
      voiceRef: {
        reference: {
          oneofKind: 'providerVoiceRef',
          providerVoiceRef: 'studio-voice-main',
        },
      },
    });
  });
});
