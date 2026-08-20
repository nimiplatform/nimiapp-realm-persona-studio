import { describe, expect, it } from 'vitest';
import {
  buildPersonaReferenceImagePayload,
  defaultReferenceImagePromptFromDraft,
  generatePersonaReferenceImage,
  initialReferenceImagePromptFromDraft,
} from './persona-reference-image.js';

describe('persona reference image generation', () => {
  it('builds a local image candidate input preview from a reviewed prompt', () => {
    const result = buildPersonaReferenceImagePayload({
      prompt: 'A calm public Realm Persona portrait',
      aspectRatio: '1:1',
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({
      surfaceId: 'realm-persona-studio.persona-reference-image',
      capability: 'image.generate',
      prompt: 'A calm public Realm Persona portrait',
      aspectRatio: '1:1',
      count: 1,
    });
  });

  it('fails closed when the prompt is empty', async () => {
    const invalid = buildPersonaReferenceImagePayload({ prompt: ' ' });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toEqual(['reference image prompt empty']);

    const result = await generatePersonaReferenceImage({ prompt: ' ' });
    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-reference-image-payload-invalid',
      source: 'Runtime ScenarioService.submitScenarioJob image.generate',
      submitted: null,
    });
  });

  it('accepts only one-at-a-time reference image generation', () => {
    const invalid = buildPersonaReferenceImagePayload({
      prompt: 'A precise portrait',
      count: 4,
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toEqual(['reference image generation count must be 1']);
  });

  it('uses a reviewed Nimi image candidate only when Runtime returns a public http(s) URI', async () => {
    const result = await generatePersonaReferenceImage({
      prompt: 'A reviewed public Realm Persona portrait',
      aspectRatio: '16:9',
    }, async () => ({
      ok: true,
      jobId: 'image-job-1',
      traceId: 'trace-1',
      artifacts: [{
        artifactId: 'artifact-1',
        publicUri: 'https://cdn.example.test/reference.png',
        previewUrl: 'data:image/png;base64,AQID',
      }],
    }));

    expect(result).toMatchObject({
      ok: true,
      source: 'Runtime ScenarioService.submitScenarioJob image.generate',
      referenceImageUrl: 'https://cdn.example.test/reference.png',
      previewUrl: 'data:image/png;base64,AQID',
      artifactIds: ['artifact-1'],
      runtime: { traceId: 'trace-1' },
      submitted: {
        surfaceId: 'realm-persona-studio.persona-reference-image',
        capability: 'image.generate',
        prompt: 'A reviewed public Realm Persona portrait',
        aspectRatio: '16:9',
        count: 1,
      },
    });
  });

  it('keeps a local-only generated artifact out of the Realm public reference field', async () => {
    const result = await generatePersonaReferenceImage({
      prompt: 'A reviewed public Realm Persona portrait',
    }, async () => ({
      ok: true,
      jobId: 'image-job-2',
      artifacts: [{ artifactId: 'artifact-2', previewUrl: 'data:image/png;base64,AQID' }],
    }));

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-reference-image-public-uri-unavailable',
      submitted: { prompt: 'A reviewed public Realm Persona portrait' },
    });
  });

  it('creates an editable default prompt from current create fields', () => {
    expect(defaultReferenceImagePromptFromDraft({
      description: 'A precise visual identity',
      displayName: 'Mira',
      concept: 'Public guide',
      personaArchetype: 'CARING',
    })).toBe('A precise visual identity — CARING, Mira — character portrait, cinematic lighting, full body, high detail, neutral background');
  });

  it('initializes the image prompt from the prior describe-stage owner text', () => {
    expect(initialReferenceImagePromptFromDraft({
      originalDescription: '  A night-shift archivist who protects forgotten stories.  ',
      description: 'Runtime-generated public description.',
      displayName: 'Mira',
      concept: 'Public guide',
      personaArchetype: 'CARING',
    })).toBe('A night-shift archivist who protects forgotten stories.');
  });
});
