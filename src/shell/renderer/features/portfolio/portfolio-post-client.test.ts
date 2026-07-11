import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StudioRealmSurface } from '@renderer/data/realm-client.js';
import { FinishReason, RoutePolicy } from '@nimiplatform/sdk/runtime/generated';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRealmCreatePostInput,
  createReviewedPostTextResource,
  listReadyPostAttachmentResources,
  proposeReviewedPostCopy,
  publishReviewedPostDraft,
  uploadReviewedIdentityMediaResource,
  uploadReviewedPostMediaResource,
} from './portfolio-client.js';
import {
  candidatePayload,
  collectKeys,
  configureStudioAIConfigTargetRefsForTest,
  mockRuntimeWithRoutes,
  ownerPersonaDetail,
  ownerPersonaDetailWithWorldId,
  resetStudioAIConfigForTest,
} from './portfolio-client.test-helpers.js';

function forbiddenPublicationRealm() {
  return {
    createPost: vi.fn(),
    listResources: vi.fn(),
    createImageDirectUpload: vi.fn(),
    createVideoDirectUpload: vi.fn(),
    createAudioDirectUpload: vi.fn(),
    finalizeResource: vi.fn(),
    createTextResource: vi.fn(),
  };
}

beforeEach(() => {
  resetStudioAIConfigForTest();
});

describe('owner portfolio publication hardcut', () => {
  it('fails closed before post publication touches Realm', async () => {
    const forbiddenRealm = forbiddenPublicationRealm();
    const result = await publishReviewedPostDraft(
      candidatePayload,
      forbiddenRealm as unknown as StudioRealmSurface,
    );

    expect(result).toMatchObject({
      ok: false,
      source: 'Runtime-mediated Realm post publication (not admitted)',
      failure: 'persona-post-publication-not-admitted',
    });
    expect(forbiddenRealm.createPost).not.toHaveBeenCalled();
  });

  it('fails closed before renderer-side Resource listing', async () => {
    const forbiddenRealm = forbiddenPublicationRealm();

    await expect(listReadyPostAttachmentResources(
      forbiddenRealm as unknown as StudioRealmSurface,
    )).rejects.toThrow('Publication is unavailable');
    expect(forbiddenRealm.listResources).not.toHaveBeenCalled();
  });

  it('keeps reviewed media as a local ingress candidate without upload credentials or network', async () => {
    const forbiddenRealm = forbiddenPublicationRealm();
    const storageUpload = vi.fn();
    const result = await uploadReviewedPostMediaResource({
      resourceType: 'IMAGE',
      file: { name: 'portrait.png', type: 'image/png', size: 2048 },
      persona: ownerPersonaDetailWithWorldId(),
    }, forbiddenRealm as unknown as StudioRealmSurface, storageUpload);

    expect(result).toMatchObject({
      ok: false,
      source: 'Runtime-owned media ingress (not admitted)',
      failure: 'persona-media-publication-not-admitted',
      attachmentTruth: false,
      publicTruth: false,
      submitted: {
        mimeType: 'image/png',
        sizeBytes: 2048,
        sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1:reviewed-post-media-resource',
      },
    });
    expect(storageUpload).not.toHaveBeenCalled();
    expect(forbiddenRealm.createImageDirectUpload).not.toHaveBeenCalled();
    expect(forbiddenRealm.finalizeResource).not.toHaveBeenCalled();
  });

  it('preserves local media validation before the not-admitted result', async () => {
    const forbiddenRealm = forbiddenPublicationRealm();
    const result = await uploadReviewedPostMediaResource({
      resourceType: 'VIDEO',
      file: { name: 'not-video.png', type: 'image/png', size: 10 },
      persona: ownerPersonaDetail(),
    }, forbiddenRealm as unknown as StudioRealmSurface, vi.fn());

    expect(result).toMatchObject({
      ok: false,
      failure: 'media-upload-file-invalid',
      submitted: null,
    });
    expect(forbiddenRealm.createVideoDirectUpload).not.toHaveBeenCalled();
  });

  it('fails closed for reviewed identity media without claiming binding truth', async () => {
    const forbiddenRealm = forbiddenPublicationRealm();
    const result = await uploadReviewedIdentityMediaResource({
      resourceType: 'IMAGE',
      file: { name: 'identity.png', type: 'image/png', size: 3072 },
      persona: ownerPersonaDetailWithWorldId(),
      tags: ['realm-persona-studio', 'identity-candidate'],
    }, forbiddenRealm as unknown as StudioRealmSurface, vi.fn());

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-media-publication-not-admitted',
      attachmentTruth: false,
      publicTruth: false,
      submitted: {
        sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1:reviewed-identity-media-resource',
      },
    });
    expect(forbiddenRealm.createImageDirectUpload).not.toHaveBeenCalled();
    expect(forbiddenRealm.finalizeResource).not.toHaveBeenCalled();
  });

  it('fails closed before reviewed text attachment publication', async () => {
    const forbiddenRealm = forbiddenPublicationRealm();
    const result = await createReviewedPostTextResource(
      candidatePayload,
      forbiddenRealm as unknown as StudioRealmSurface,
    );

    expect(result).toMatchObject({
      ok: false,
      source: 'Runtime-mediated Realm text resource publication (not admitted)',
      failure: 'persona-text-resource-publication-not-admitted',
      attachmentTruth: false,
      submitted: {
        content: 'Published caption',
        sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1',
      },
    });
    expect(forbiddenRealm.createTextResource).not.toHaveBeenCalled();
  });

  it('keeps reviewed post payload construction free of caller-owned authority', () => {
    const input = buildRealmCreatePostInput(candidatePayload);

    expect(input).toEqual({
      ...candidatePayload.realmCreatePost,
      sourceRef: {
        kind: 'realmPersona',
        worldId: 'world-oasis',
        sourceId: 'persona-1',
        sourceContentHash: 'hash-persona-1',
      },
    });
    expect(collectKeys(input).has('authorId')).toBe(false);
    expect(collectKeys(input).has('accessToken')).toBe(false);
  });

  it('contains no renderer direct-upload, signed-upload, or Realm publication call', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/shell/renderer/features/portfolio/portfolio-post-client.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/\.createPost\(|\.createTextResource\(|\.create(Image|Video|Audio)DirectUpload\(|\.finalizeResource\(/);
    expect(source).not.toContain('uploadUrl');
    expect(source).not.toContain('fetch(');
  });

  it('uses Runtime text generation only for local candidate copy', async () => {
    const executeScenario = vi.fn(async () => ({
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
      targetRefs: { 'text.generate': 'runtime-default-text' },
    });

    const result = await proposeReviewedPostCopy(ownerPersonaDetail(), {
      caption: '',
      tagsText: '',
      humanReviewed: false,
      attachmentEnabled: false,
      attachmentTargetType: 'RESOURCE',
      attachmentTargetId: '',
    }, 'Draft a short launch post.', runtime);

    expect(executeScenario).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      candidate: true,
      truthWrite: false,
      proposal: {
        draftPatch: {
          caption: 'Mira shares a concise artifact update.',
          tagsText: 'artifact, studio',
        },
      },
    });
  });
});
