import { studioTestScope, deferred } from '../../../../test/studio-scope.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const personaCharacter = vi.hoisted(() => ({
  getOwned: vi.fn(),
  replace: vi.fn(),
  toProfileInput: vi.fn(),
}));

vi.mock('@renderer/app-shell/studio-platform.js', () => ({
  getStudioClient: () => ({ realm: { personaCharacter } }),
}));
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
  beforeEach(() => {
    vi.clearAllMocks();
    personaCharacter.getOwned.mockResolvedValue(personaFixture);
    const { profileHash: _profileHash, profileCoverage: _profileCoverage, ...input } = personaFixture.profile;
    personaCharacter.toProfileInput.mockReturnValue(input);
    personaCharacter.replace.mockImplementation(async (request) => ({
      ...personaFixture,
      contentHash: 'e'.repeat(64),
      contentRevision: 2,
      profile: {
        ...request.profile,
        profileHash: 'f'.repeat(64),
        profileCoverage: personaFixture.profile.profileCoverage,
      },
    }));
  });

  it('selects an HTTPS avatar through a complete PersonaCharacter replace', async () => {
    const detail = ownerPersonaDetail();
    const result = await selectReviewedPersonaAvatarUrl(studioTestScope, detail, 'https://cdn.example.test/avatar.png');

    expect(result).toMatchObject({ ok: true, publicTruth: true });
    expect(personaCharacter.getOwned).toHaveBeenCalledWith(personaFixture.id);
    expect(personaCharacter.toProfileInput).toHaveBeenCalledWith(personaFixture.profile);
    expect(personaCharacter.replace).toHaveBeenCalledWith(expect.objectContaining({
      personaCharacterId: personaFixture.id,
      baseContentHash: personaFixture.contentHash,
    }));
  });

  it('does not replace a Persona after its connection ended during the owner read', async () => {
    const read = deferred<typeof personaFixture>();
    personaCharacter.getOwned.mockReturnValueOnce(read.promise);
    const controller = new AbortController();
    const scope = { ...studioTestScope, signal: controller.signal };
    const pending = selectReviewedPersonaAvatarUrl(scope, ownerPersonaDetail(), 'https://cdn.example.test/avatar.png');
    expect(personaCharacter.getOwned).toHaveBeenCalledOnce();
    controller.abort(); read.resolve(personaFixture);
    expect(await pending).toMatchObject({ ok: false });
    expect(personaCharacter.replace).not.toHaveBeenCalled();
  });

  it('preserves the reviewed avatar on a changed Persona hash without replacing a stale profile', async () => {
    personaCharacter.getOwned.mockResolvedValueOnce({ ...personaFixture, contentHash: 'changed-hash' });
    expect(await selectReviewedPersonaAvatarUrl(studioTestScope, ownerPersonaDetail(), 'https://cdn.example.test/avatar.png'))
      .toMatchObject({ ok: false, failure: 'content-conflict', publicTruth: false });
    expect(personaCharacter.replace).not.toHaveBeenCalled();
  });

  it('builds avatar selection data from a narrow URL allowlist', () => {
    expect(buildRealmSelectAvatarInput(' https://cdn.example.test/avatar.png ')).toEqual({
      avatarUrl: 'https://cdn.example.test/avatar.png',
    });
    expect(buildRealmSelectAvatarInput('ftp://cdn.example.test/avatar.png')).toBeNull();
    expect(buildRealmSelectAvatarInput('http://cdn.example.test/avatar.png')).toBeNull();
    expect(buildRealmSelectAvatarInput('https://cdn.example.test/avatar.png?token=secret')).toBeNull();
    expect(buildRealmSelectAvatarInput('https://user:secret@cdn.example.test/avatar.png')).toBeNull();
    expect(buildRealmSelectAvatarInput('https://cdn.example.test/avatar.png#fragment')).toBeNull();
    expect(buildRealmSelectAvatarInput('')).toBeNull();
  });

  it('rejects avatar replacement when detail identity and canonical identity diverge', async () => {
    const result = await selectReviewedPersonaAvatarUrl(studioTestScope,
      { ...ownerPersonaDetail(), id: 'persona-2' },
      'https://cdn.example.test/avatar.png',
    );

    expect(result).toMatchObject({ ok: false, failure: 'contract-invalid' });
    expect(personaCharacter.replace).not.toHaveBeenCalled();
  });

  it('sanitizes avatar profile roundtrip failures before replace transport', async () => {
    personaCharacter.toProfileInput.mockImplementationOnce(() => {
      throw Object.assign(new Error('private profile detail'), { reasonCode: 'contract-invalid' });
    });

    const result = await selectReviewedPersonaAvatarUrl(studioTestScope,
      ownerPersonaDetail(),
      'https://cdn.example.test/avatar.png',
    );

    expect(result).toMatchObject({ ok: false, failure: 'contract-invalid', message: 'contract-invalid' });
    expect(personaCharacter.replace).not.toHaveBeenCalled();
  });

  it('builds a reviewed avatar profile without removing unrelated assets', () => {
    const profile = withSelectedAvatarExternalRef(
      personaCharacter.toProfileInput(personaFixture.profile),
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
      failure: 'contract-invalid',
      submitted,
    });
  });

  it('runs reviewed visual and voice candidates through the Nimi AI consumption runner', async () => {
    const visual = await generateReviewedVisualImageCandidate(studioTestScope, {
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
    const voice = await synthesizeReviewedVoiceDemo(studioTestScope, {
      scriptText: 'Welcome in.',
      presetVoiceId: 'catalogue-voice',
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
    const result = await generateReviewedVisualImageCandidate(studioTestScope, {
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
    const visual = await generateReviewedVisualImageCandidate(studioTestScope, {
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_CANDIDATE',
      prompt: ' ',
      notes: '',
      aspectRatio: '1:1',
    }, ownerPersonaDetail());
    const voice = await synthesizeReviewedVoiceDemo(studioTestScope, {
      scriptText: ' ',
      presetVoiceId: 'catalogue-voice',
    }, ownerPersonaDetail());

    expect(visual).toMatchObject({ ok: false, failure: 'runtime-payload-invalid', draft: null });
    expect(voice).toMatchObject({ ok: false, failure: 'runtime-payload-invalid', draft: null });
  });
});
