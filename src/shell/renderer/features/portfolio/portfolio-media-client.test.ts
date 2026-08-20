import { describe, expect, it } from 'vitest';
import {
  buildRealmSelectAvatarInput,
  generateReviewedVisualImageCandidate,
  normalizeRealmPersonaAvatarSelectResult,
  selectReviewedPersonaAvatarUrl,
  synthesizeReviewedVoiceDemo,
  withSelectedAvatarExternalRef,
} from './portfolio-media-client.js';
import {
  ownerPersonaDetail,
  persona as personaFixture,
} from './portfolio-client.test-helpers.js';

describe('owner portfolio media client', () => {
  it('fails closed before Persona avatar selection', async () => {
    await expect(selectReviewedPersonaAvatarUrl(
      'persona-1',
      'https://cdn.example.test/avatar.png',
    )).rejects.toMatchObject({
      reasonCode: 'capability-unavailable',
      actionHint: 'retry_when_platform_surface_available',
    });
  });

  it('builds avatar selection data from a narrow URL allowlist', () => {
    expect(buildRealmSelectAvatarInput(' https://cdn.example.test/avatar.png ')).toEqual({
      avatarUrl: 'https://cdn.example.test/avatar.png',
    });
    expect(buildRealmSelectAvatarInput('ftp://cdn.example.test/avatar.png')).toBeNull();
    expect(buildRealmSelectAvatarInput('')).toBeNull();
  });

  it('builds a reviewed avatar profile without removing unrelated assets', () => {
    const profile = withSelectedAvatarExternalRef(
      personaFixture.profile,
      'https://cdn.example.test/avatar.png',
    );

    expect(profile.assets.externalRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'avatar',
        uri: 'https://cdn.example.test/avatar.png',
        purpose: 'profile-avatar',
      }),
    ]));
  });

  it('fails closed when the normalized response does not persist the reviewed avatar', () => {
    const submitted = { avatarUrl: 'https://cdn.example.test/avatar.png' };
    const result = normalizeRealmPersonaAvatarSelectResult({
      ...personaFixture,
      profile: {
        ...personaFixture.profile,
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
      failure: 'realm-select-avatar-rejected',
      submitted,
    });
  });

  it('runs reviewed visual and voice candidates through the Nimi AI consumption runner', async () => {
    const visual = await generateReviewedVisualImageCandidate({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_CANDIDATE',
      prompt: 'Warm profile portrait.',
      notes: 'Use public bio only.',
      aspectRatio: '1:1',
    }, ownerPersonaDetail(), async (input) => ({
      ok: true,
      jobId: 'image-job-1',
      traceId: 'image-trace-1',
      artifacts: [{
        artifactId: 'image-artifact-1',
        mimeType: 'image/png',
        publicUri: 'https://cdn.example.test/image.png',
        previewUrl: 'data:image/png;base64,AQID',
        sizeBytes: '3',
      }],
    }));
    const voice = await synthesizeReviewedVoiceDemo({
      scriptText: 'Welcome in.',
    }, ownerPersonaDetail(), async (input) => ({
      ok: true,
      jobId: 'voice-job-1',
      traceId: 'voice-trace-1',
      artifacts: [{
        artifactId: 'voice-artifact-1',
        mimeType: 'audio/mpeg',
        previewUrl: 'data:audio/mpeg;base64,AQID',
        sizeBytes: '3',
      }],
    }));

    expect(visual).toMatchObject({
      ok: true,
      candidate: true,
      publicTruth: false,
      runtime: {
        jobId: 'image-job-1',
        artifactIds: ['image-artifact-1'],
        artifactUris: ['https://cdn.example.test/image.png'],
        previewUrls: ['data:image/png;base64,AQID'],
        traceId: 'image-trace-1',
      },
    });
    expect(voice).toMatchObject({
      ok: true,
      candidate: true,
      publicTruth: false,
      runtime: {
        jobId: 'voice-job-1',
        artifactIds: ['voice-artifact-1'],
        previewUrls: ['data:audio/mpeg;base64,AQID'],
        traceId: 'voice-trace-1',
      },
    });
  });

  it('preserves structured Nimi AI capability failures without candidate success', async () => {
    const result = await generateReviewedVisualImageCandidate({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_CANDIDATE',
      prompt: 'Warm profile portrait.',
      notes: '',
      aspectRatio: '1:1',
    }, ownerPersonaDetail(), async () => ({
      ok: false,
      failure: 'runtime-route-unbound',
      message: 'AI_CONFIG_NOT_FOUND',
    }));

    expect(result).toMatchObject({
      ok: false,
      failure: 'runtime-route-unbound',
      message: 'AI_CONFIG_NOT_FOUND',
    });
  });

  it('validates missing media inputs before the unavailable result', async () => {
    const visual = await generateReviewedVisualImageCandidate({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_CANDIDATE',
      prompt: ' ',
      notes: '',
      aspectRatio: '1:1',
    }, ownerPersonaDetail());
    const voice = await synthesizeReviewedVoiceDemo({
      scriptText: ' ',
    }, ownerPersonaDetail());

    expect(visual).toMatchObject({ ok: false, failure: 'runtime-payload-invalid', draft: null });
    expect(voice).toMatchObject({ ok: false, failure: 'runtime-payload-invalid', draft: null });
  });
});
