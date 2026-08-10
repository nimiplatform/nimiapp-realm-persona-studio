import { describe, expect, it } from 'vitest';
import {
  RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE,
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

  it('returns typed unavailability for reviewed visual and voice candidates', async () => {
    const visual = await generateReviewedVisualImageCandidate({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_CANDIDATE',
      prompt: 'Warm profile portrait.',
      notes: 'Use public bio only.',
      aspectRatio: '1:1',
    }, ownerPersonaDetail());
    const voice = await synthesizeReviewedVoiceDemo({
      scriptText: 'Welcome in.',
    }, ownerPersonaDetail());

    expect(visual).toMatchObject({
      ok: false,
      failure: 'runtime-media-candidate-unavailable',
      message: RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE,
    });
    expect(voice).toMatchObject({
      ok: false,
      failure: 'runtime-media-candidate-unavailable',
      message: RUNTIME_MEDIA_CANDIDATE_UNAVAILABLE_MESSAGE,
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
