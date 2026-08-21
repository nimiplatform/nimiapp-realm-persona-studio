import { describe, expect, it } from 'vitest';
import type { OwnerPortfolioPersonaDetail, SettingField } from './portfolio-data.js';
import {
  assertNoForbiddenMediaCandidateFields,
  buildReviewedAvatarPackageCandidatePayload,
  buildReviewedAvatarPackageImageGenerationPayload,
  buildReviewedVisualImageCandidatePayload,
  buildReviewedVisualImageGenerationPayload,
  buildReviewedVoiceDemoCandidatePayload,
  buildReviewedVoiceSynthesisPayload,
  isAllowedMediaCandidateBindingPoint,
  isAllowedMediaCandidateResourceType,
  normalizeVisualMediaCandidateInput,
  normalizeVoiceDemoCandidateInput,
  normalizeAvatarPackageTarget,
} from './media-voice-candidate.js';

function settingField(key: SettingField['key'], label: string, value: string): SettingField {
  const hasValue = value.length > 0;

  return {
    key,
    label,
    value,
    status: hasValue ? 'available' : 'available-empty',
    source: 'Nimi App Access realm.personaCharacter.getOwned',
    readOnly: true,
    emptyLabel: hasValue ? undefined : 'not set',
  };
}

const persona: OwnerPortfolioPersonaDetail = {
  id: 'persona-1',
  contentHash: 'hash-persona-1',
  contentRevision: 1,
  homeWorldId: 'world-oasis',
  displayName: settingField('displayName', 'Display name', 'Mira'),
  handle: settingField('handle', 'Handle', 'mira'),
  bio: settingField('bio', 'Profile description', 'Public strategist bio'),
  greeting: settingField('greeting', 'Greeting', 'Welcome in.'),
  profileCoverUrl: settingField('profileCoverUrl', 'Profile cover URL', 'https://cdn.example.test/cover.png'),
  ownership: settingField('ownership', 'Ownership evidence', 'MASTER_OWNED'),
  world: settingField('world', 'World evidence', 'OASIS'),
  visibility: settingField('visibility', 'Visibility', 'public'),
  avatarUrl: 'https://cdn.example.test/avatar.png',
  friendCount: { status: 'available', value: 7 },
  ownerScope: 'owner-created',
  source: 'Nimi App Access realm.personaCharacter.getOwned',
};

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (!value || typeof value !== 'object') {
    return keys;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
}

describe('media and voice candidate normalization', () => {
  it('validates supported resource types and binding points', () => {
    expect(isAllowedMediaCandidateResourceType('IMAGE')).toBe(true);
    expect(isAllowedMediaCandidateResourceType('VIDEO')).toBe(true);
    expect(isAllowedMediaCandidateResourceType('AUDIO')).toBe(true);
    expect(isAllowedMediaCandidateResourceType('VOICE')).toBe(false);
    expect(isAllowedMediaCandidateBindingPoint('PERSONA_AVATAR')).toBe(true);
    expect(isAllowedMediaCandidateBindingPoint('PERSONA_VOICE_SAMPLE')).toBe(true);
    expect(isAllowedMediaCandidateBindingPoint('WORLD_SCENE')).toBe(false);
  });

  it('normalizes visual input and falls back to local candidate defaults', () => {
    expect(normalizeVisualMediaCandidateInput({
      resourceType: 'VIDEO',
      bindingPoint: 'WORLD_SCENE',
      prompt: '  cinematic portrait\r\nsoft light  ',
      notes: '  owner reviewed only  ',
    })).toEqual({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_CANDIDATE',
      prompt: 'cinematic portrait\nsoft light',
      notes: 'owner reviewed only',
    });
  });

  it('normalizes voice input to Resource(AUDIO) and PERSONA_VOICE_SAMPLE', () => {
    expect(normalizeVoiceDemoCandidateInput({
      scriptText: '  Hello\r\nfrom the public demo.  ',
    })).toEqual({
      resourceType: 'AUDIO',
      bindingPoint: 'PERSONA_VOICE_SAMPLE',
      scriptText: 'Hello\nfrom the public demo.',
    });
  });

  it('normalizes avatar package targets to supported presentation families', () => {
    expect(normalizeAvatarPackageTarget('LIVE2D')).toBe('LIVE2D');
    expect(normalizeAvatarPackageTarget('VRM')).toBe('VRM');
    expect(normalizeAvatarPackageTarget('unknown')).toBe('LIVE2D');
  });
});

describe('reviewed media and voice candidate payloads', () => {
  it('builds an allowlisted image generation candidate input preview', () => {
    const result = buildReviewedVisualImageGenerationPayload({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_CANDIDATE',
      prompt: '  warm public portrait  ',
      notes: 'blue accent',
      aspectRatio: '4:5',
    }, persona);

    expect(result).toMatchObject({
      changed: true,
      errors: [],
      payload: {
        surfaceId: 'realm-persona-studio.visual-image-candidate',
        capability: 'image.generate',
        prompt: 'warm public portrait\nOwner notes: blue accent\nRealm Persona display name: Mira\nProfile description context: Public strategist bio',
        aspectRatio: '4:5',
      },
    });
    expect(collectKeys(result.payload).has('provider')).toBe(false);
    expect(collectKeys(result.payload).has('localAgent')).toBe(false);
    expect(collectKeys(result.payload).has('worldId')).toBe(false);
  });

  it('builds visual image candidate evidence without claiming public asset truth', () => {
    const result = buildReviewedVisualImageCandidatePayload({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_PORTRAIT',
      prompt: 'Reference portrait.',
      notes: '',
      aspectRatio: '1:1',
    }, persona);

    expect(result.payload).toMatchObject({
      candidate: true,
      publicTruth: false,
      source: 'realm-persona-studio.reviewed-visual-image-candidate',
      runtime: {
        capabilityToken: 'image.generate',
        runtimeScenario: 'imageGenerate',
        source: 'Runtime ScenarioService.submitScenarioJob image.generate',
      },
      futureEvidencePath: {
        resource: {
          carrier: 'Resource',
          type: 'IMAGE',
          status: 'candidate-only',
        },
        binding: {
          family: 'Binding',
          hostType: 'PERSONA',
          objectType: 'RESOURCE',
          bindingPoint: 'PERSONA_PORTRAIT',
          status: 'candidate-only',
        },
      },
    });
  });

  it('builds a Live2D avatar package candidate as a design-sheet input only', () => {
    const result = buildReviewedAvatarPackageImageGenerationPayload({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_AVATAR',
      prompt: 'Song literati portrait identity.',
      notes: 'Keep source-backed clothing details.',
      aspectRatio: '1:1',
      packageTarget: 'LIVE2D',
      motionNotes: 'Idle breathing, speaking mouth shapes, listening nod.',
      interactionNotes: 'No unsupported props.',
    }, persona);

    expect(result).toMatchObject({
      changed: true,
      errors: [],
      payload: {
        surfaceId: 'realm-persona-studio.avatar-package-candidate',
        capability: 'image.generate',
        prompt: expect.stringContaining('Avatar package target: LIVE2D.'),
        aspectRatio: '1:1',
      },
    });
    expect(collectKeys(result.payload).has('provider')).toBe(false);
    expect(collectKeys(result.payload).has('localAgent')).toBe(false);
  });

  it('builds avatar package candidate evidence without claiming published Live2D or VRM assets', () => {
    const result = buildReviewedAvatarPackageCandidatePayload({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_AVATAR',
      prompt: 'Song literati portrait identity.',
      notes: '',
      aspectRatio: '1:1',
      packageTarget: 'VRM',
      motionNotes: '',
      interactionNotes: '',
    }, persona);

    expect(result.payload).toMatchObject({
      candidate: true,
      publicTruth: false,
      source: 'realm-persona-studio.reviewed-avatar-package-candidate',
      avatarPackage: {
        target: 'VRM',
        status: 'candidate-only',
        generatedOutput: 'design-sheet-and-rigging-brief',
        publishState: 'not-published',
        requiredArtifacts: ['vrm model', 'humanoid rig metadata', 'expression preset map', 'spring bone settings'],
      },
      futureEvidencePath: {
        resource: {
          carrier: 'Resource',
          type: 'IMAGE',
          role: 'avatar-design-sheet',
          status: 'candidate-only',
        },
        binding: {
          family: 'Binding',
          hostType: 'PERSONA',
          objectType: 'RESOURCE',
          bindingPoint: 'PERSONA_AVATAR',
          status: 'candidate-only',
        },
        runtimePresentation: {
          backendKind: 'vrm',
          status: 'requires-reviewed-package-artifacts',
        },
      },
    });
    expect(collectKeys(result.payload).has('publicSuccess')).toBe(false);
    expect(collectKeys(result.payload).has('bindingSuccess')).toBe(false);
    expect(collectKeys(result.payload).has('resourceReady')).toBe(false);
    expect(collectKeys(result.payload).has('provider')).toBe(false);
    expect(collectKeys(result.payload).has('localAgent')).toBe(false);
  });

  it('fails closed when Runtime image generation prompt is missing', () => {
    const result = buildReviewedVisualImageGenerationPayload({
      resourceType: 'IMAGE',
      bindingPoint: 'PERSONA_CANDIDATE',
      prompt: ' ',
      notes: '',
      aspectRatio: '1:1',
    }, persona);

    expect(result).toEqual({
      changed: false,
      errors: ['visual prompt missing for image candidate generation'],
      payload: null,
    });
  });

  it('builds an allowlisted speechSynthesize candidate input preview', () => {
    const result = buildReviewedVoiceSynthesisPayload({
      scriptText: '  Welcome in.  ',
    });

    expect(result).toMatchObject({
      changed: true,
      errors: [],
      payload: {
        surfaceId: 'realm-persona-studio.voice-demo-candidate',
        capability: 'audio.synthesize',
        text: 'Welcome in.',
      },
    });
    expect(collectKeys(result.payload).has('provider')).toBe(false);
    expect(collectKeys(result.payload).has('localAgent')).toBe(false);
  });

  it('fails closed when Runtime speechSynthesize script text is missing', () => {
    const result = buildReviewedVoiceSynthesisPayload({
      scriptText: ' ',
    });

    expect(result).toEqual({
      changed: false,
      errors: ['voice demo script missing for voice candidate generation'],
      payload: null,
    });
  });

  it('builds a candidate-only Runtime voice payload without public Resource or Binding success', () => {
    const result = buildReviewedVoiceDemoCandidatePayload({
      scriptText: 'Welcome in.',
    }, persona);

    expect(result.changed).toBe(true);
    expect(result.payload).toMatchObject({
      candidate: true,
      publicTruth: false,
      source: 'realm-persona-studio.reviewed-voice-demo-candidate',
      personaContext: {
        source: 'Nimi App Access realm.personaCharacter.getOwned',
        personaKey: 'persona-1',
        handle: 'mira',
        displayName: 'Mira',
        bio: 'Public strategist bio',
        greeting: 'Welcome in.',
        profileCoverUrl: 'https://cdn.example.test/cover.png',
      },
      runtime: {
        capabilityToken: 'audio.synthesize',
        runtimeScenario: 'speechSynthesize',
        source: 'Runtime ScenarioService.submitScenarioJob audio.synthesize',
        input: {
          surfaceId: 'realm-persona-studio.voice-demo-candidate',
          capability: 'audio.synthesize',
          text: 'Welcome in.',
        },
        status: 'candidate-ready',
      },
      futureEvidencePath: {
        resource: {
          carrier: 'Resource',
          type: 'AUDIO',
          status: 'candidate-only',
        },
        binding: {
          family: 'Binding',
          hostType: 'PERSONA',
          objectType: 'RESOURCE',
          bindingPoint: 'PERSONA_VOICE_SAMPLE',
          status: 'candidate-only',
        },
      },
    });

    expect(collectKeys(result.payload).has('publicSuccess')).toBe(false);
    expect(collectKeys(result.payload).has('bindingSuccess')).toBe(false);
    expect(collectKeys(result.payload).has('resourceReady')).toBe(false);
    expect(collectKeys(result.payload).has('provider')).toBe(false);
    expect(collectKeys(result.payload).has('localAgent')).toBe(false);
  });

  it('detects forbidden media candidate fields recursively', () => {
    expect(assertNoForbiddenMediaCandidateFields({
      runtimePreview: {
        provider: 'forbidden',
      },
    })).toBe('provider');
    expect(assertNoForbiddenMediaCandidateFields({
      runtimePreview: {
        candidateInput: {
          model: 'runtime-tts-model',
        },
      },
    })).toBeNull();
    expect(assertNoForbiddenMediaCandidateFields({
      runtime: {
        input: {
          params: {
            model: 'runtime-tts-model',
          },
        },
      },
    })).toBeNull();
    expect(assertNoForbiddenMediaCandidateFields({
      futureEvidencePath: {
        model: 'forbidden',
      },
    })).toBe('model');
    expect(assertNoForbiddenMediaCandidateFields({
      localAgent: { model: 'forbidden' },
    })).toBe('localAgent');
    expect(assertNoForbiddenMediaCandidateFields({
      futureEvidencePath: {
        resource: {
          carrier: 'Resource',
          type: 'AUDIO',
        },
      },
    })).toBeNull();
  });
});
