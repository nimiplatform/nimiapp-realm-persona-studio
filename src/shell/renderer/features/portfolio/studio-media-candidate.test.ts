import { describe, expect, it, vi } from 'vitest';
import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { createNimiError } from '@nimiplatform/sdk/types';
import {
  createStudioMediaCandidateRunners,
  type StudioMediaCandidateRunnerDependencies,
} from './studio-media-candidate.js';

function fakeClient(
  read = vi.fn(async () => ({
    bytes: Uint8Array.from([1, 2, 3]),
    mimeType: 'image/png',
    sizeBytes: 3,
  })),
): Pick<NimiLocalAppClient, 'ai'> {
  return {
    ai: {
      artifacts: { read },
    } as unknown as NimiLocalAppClient['ai'],
  };
}

const fakeScenarioClientFactory = (() => ({})) as unknown as NonNullable<
  StudioMediaCandidateRunnerDependencies['createScenarioJobClient']
>;

describe('Studio media candidate Nimi AI consumption', () => {
  it('submits image.generate through the typed Nimi runner and reads its owned artifact', async () => {
    const read = vi.fn(async () => ({
      bytes: Uint8Array.from([1, 2, 3]),
      mimeType: 'image/png',
      sizeBytes: 3,
    }));
    const imageGenerate = vi.fn(async () => ({
      ok: true as const,
      capabilityId: 'image.generate' as const,
      message: 'completed',
      output: {
        kind: 'image-artifacts' as const,
        jobId: 'job-image-1',
        jobStatus: 'COMPLETED',
        artifactCount: 1,
        artifacts: [{
          artifactId: 'artifact-image-1',
          mimeType: 'image/png',
          previewSource: 'metadata-only' as const,
        }],
      },
      trace: { traceId: 'trace-image-1' },
    }));
    const runners = createStudioMediaCandidateRunners({
      client: fakeClient(read),
      createScenarioJobClient: fakeScenarioClientFactory,
      imageGenerate,
    });

    await expect(runners.image({
      surfaceId: 'realm-persona-studio.test-image',
      capability: 'image.generate',
      prompt: 'A reviewed portrait.',
      aspectRatio: '1:1',
      count: 1,
    })).resolves.toEqual({
      ok: true,
      jobId: 'job-image-1',
      traceId: 'trace-image-1',
      artifacts: [{
        artifactId: 'artifact-image-1',
        mimeType: 'image/png',
        previewUrl: 'data:image/png;base64,AQID',
        sizeBytes: '3',
      }],
    });
    expect(imageGenerate).toHaveBeenCalledWith(expect.objectContaining({
      appId: 'nimi.realm-persona-studio',
      prompt: 'A reviewed portrait.',
      count: 1,
      aspectRatio: '1:1',
      scenarioId: 'realm-persona-studio.test-image',
      surfaceId: 'realm-persona-studio.test-image',
    }));
    expect(read).toHaveBeenCalledWith('artifact-image-1');
  });

  it('submits audio.synthesize without provider, model, route, or credential inputs', async () => {
    const speechSynthesize = vi.fn(async () => ({
      ok: true as const,
      capabilityId: 'audio.synthesize' as const,
      message: 'completed',
      output: {
        kind: 'audio-artifacts' as const,
        jobId: 'job-voice-1',
        jobStatus: 'COMPLETED',
        artifactCount: 1,
        artifacts: [{
          artifactId: 'artifact-voice-1',
          mimeType: 'audio/mpeg',
          previewUrl: 'https://cdn.example.test/voice.mp3',
          previewSource: 'hosted-uri' as const,
        }],
      },
      trace: { traceId: 'trace-voice-1' },
    }));
    const runners = createStudioMediaCandidateRunners({
      client: fakeClient(),
      createScenarioJobClient: fakeScenarioClientFactory,
      speechSynthesize,
    });

    const result = await runners.voice({
      surfaceId: 'realm-persona-studio.test-voice',
      capability: 'audio.synthesize',
      text: 'Welcome in.',
    });

    expect(result).toMatchObject({
      ok: true,
      jobId: 'job-voice-1',
      artifacts: [{
        artifactId: 'artifact-voice-1',
        previewUrl: 'https://cdn.example.test/voice.mp3',
      }],
    });
    expect(speechSynthesize).toHaveBeenCalledWith(expect.not.objectContaining({
      provider: expect.anything(),
      model: expect.anything(),
      route: expect.anything(),
      credential: expect.anything(),
    }));
  });

  it('maps structured Nimi configuration failures to an explicit route-unbound result', async () => {
    const runners = createStudioMediaCandidateRunners({
      client: fakeClient(),
      createScenarioJobClient: fakeScenarioClientFactory,
      imageGenerate: async () => ({
        ok: false,
        capabilityId: 'image.generate',
        reason: 'runtime-call-failed',
        message: 'App AIConfig is missing.',
        error: createNimiError({
          message: 'App AIConfig is missing.',
          reasonCode: 'AI_CONFIG_NOT_FOUND',
          actionHint: 'configure_app_ai',
          source: 'runtime',
        }),
      }),
    });

    await expect(runners.image({
      surfaceId: 'realm-persona-studio.test-image',
      capability: 'image.generate',
      prompt: 'A reviewed portrait.',
      aspectRatio: '1:1',
    })).resolves.toEqual({
      ok: false,
      failure: 'runtime-route-unbound',
      message: 'App AIConfig is missing.',
    });
  });

  it.each([
    'AI_LOCAL_SELECTION_NOT_FOUND',
    'AI_LOADOUT_NOT_FOUND',
    'AI_LOCAL_CAPABILITY_MISMATCH',
  ])('maps current Local admission reason %s to route-unbound', async (reasonCode) => {
    const runners = createStudioMediaCandidateRunners({
      client: fakeClient(),
      createScenarioJobClient: fakeScenarioClientFactory,
      imageGenerate: async () => ({
        ok: false,
        capabilityId: 'image.generate',
        reason: 'runtime-call-failed',
        message: 'The current on-device model cannot admit this request.',
        error: createNimiError({
          message: 'The current on-device model cannot admit this request.',
          reasonCode,
          actionHint: 'configure_machine_local_model',
          source: 'runtime',
        }),
      }),
    });

    await expect(runners.image({
      surfaceId: 'realm-persona-studio.test-image',
      capability: 'image.generate',
      prompt: 'A reviewed portrait.',
      aspectRatio: '1:1',
    })).resolves.toMatchObject({ ok: false, failure: 'runtime-route-unbound' });
  });

  it.each([
    'AI_LOADOUT_DRIVER_UNAVAILABLE',
    'AI_LOADOUT_MODEL_ASSET_NOT_FOUND',
    'AI_LOADOUT_MODEL_ASSET_CONTENT_MISMATCH',
    'AI_LOADOUT_MODEL_CONTRACT_FAILED',
  ])('maps blocked Local Loadout reason %s to route-unbound for image and voice', async (reasonCode) => {
    const blocked = {
      ok: false as const,
      capabilityId: 'image.generate' as const,
      reason: 'runtime-call-failed' as const,
      message: 'The current on-device model is blocked.',
      error: createNimiError({
        message: 'The current on-device model is blocked.',
        reasonCode,
        actionHint: 'repair_machine_local_model',
        source: 'runtime',
      }),
    };
    const runners = createStudioMediaCandidateRunners({
      client: fakeClient(),
      createScenarioJobClient: fakeScenarioClientFactory,
      imageGenerate: async () => blocked,
      speechSynthesize: async () => ({ ...blocked, capabilityId: 'audio.synthesize' as const }),
    });

    await expect(runners.image({
      surfaceId: 'realm-persona-studio.test-image',
      capability: 'image.generate',
      prompt: 'A reviewed portrait.',
      aspectRatio: '1:1',
    })).resolves.toMatchObject({ ok: false, failure: 'runtime-route-unbound' });
    await expect(runners.voice({
      surfaceId: 'realm-persona-studio.test-voice',
      capability: 'audio.synthesize',
      text: 'Welcome in.',
    })).resolves.toMatchObject({ ok: false, failure: 'runtime-route-unbound' });
  });

  it('keeps Kit input rejection distinct from malformed Runtime output', async () => {
    const runners = createStudioMediaCandidateRunners({
      client: fakeClient(),
      createScenarioJobClient: fakeScenarioClientFactory,
      speechSynthesize: async () => ({
        ok: false,
        capabilityId: 'audio.synthesize',
        reason: 'input-invalid',
        message: 'Speech input is invalid.',
        error: createNimiError({
          message: 'Speech input is invalid.',
          reasonCode: 'SDK_AI_INPUT_INVALID',
          actionHint: 'fix_input',
          source: 'sdk',
        }),
      }),
    });

    await expect(runners.voice({
      surfaceId: 'realm-persona-studio.test-voice',
      capability: 'audio.synthesize',
      text: 'Welcome in.',
    })).resolves.toEqual({
      ok: false,
      failure: 'runtime-payload-invalid',
      message: 'Speech input is invalid.',
    });
  });
});
