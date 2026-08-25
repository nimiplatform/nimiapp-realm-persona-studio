import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createReviewedPostTextResource,
  listReadyPostAttachmentResources,
  proposeReviewedPostCopy,
  publishReviewedPostDraft,
  uploadReviewedIdentityMediaResource,
  uploadReviewedPostMediaResource,
} from './portfolio-client.js';
import {
  candidatePayload,
  ownerPersonaDetail,
  ownerPersonaDetailWithWorldId,
  persona,
} from './portfolio-client.test-helpers.js';
import type { StudioTextCandidateRunner } from './studio-text-candidate.js';

describe('owner portfolio publication hardcut', () => {
  it('fails closed for post publication without a Realm injection seam', async () => {
    const result = await publishReviewedPostDraft(candidatePayload);

    expect(result).toMatchObject({
      ok: false,
      source: 'Nimi App Access Persona post publication (unavailable)',
      failure: 'persona-post-publication-unavailable',
    });
  });

  it('fails closed before renderer-side Resource listing', async () => {
    await expect(listReadyPostAttachmentResources()).rejects.toThrow('Nimi App Access does not provide Persona post or media publication yet.');
  });

  it('keeps reviewed media as a local ingress candidate without upload credentials or network', async () => {
    const result = await uploadReviewedPostMediaResource({
      resourceType: 'IMAGE',
      file: { name: 'portrait.png', type: 'image/png', size: 2048 },
      persona: ownerPersonaDetailWithWorldId(),
    });

    expect(result).toMatchObject({
      ok: false,
      source: 'Nimi App Access Persona media publication (unavailable)',
      failure: 'persona-media-publication-unavailable',
      attachmentTruth: false,
      publicTruth: false,
      submitted: {
        mimeType: 'image/png',
        sizeBytes: 2048,
        sourceRef: `personaCharacter:world-oasis:persona-1:${persona.contentHash}:reviewed-post-media-resource`,
      },
    });
  });

  it('preserves local media validation before the unavailable result', async () => {
    const result = await uploadReviewedPostMediaResource({
      resourceType: 'VIDEO',
      file: { name: 'not-video.png', type: 'image/png', size: 10 },
      persona: ownerPersonaDetail(),
    });

    expect(result).toMatchObject({
      ok: false,
      failure: 'media-upload-file-invalid',
      submitted: null,
    });
  });

  it('fails closed for reviewed identity media without claiming binding truth', async () => {
    const result = await uploadReviewedIdentityMediaResource({
      resourceType: 'IMAGE',
      file: { name: 'identity.png', type: 'image/png', size: 3072 },
      persona: ownerPersonaDetailWithWorldId(),
      tags: ['realm-persona-studio', 'identity-candidate'],
    });

    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-media-publication-unavailable',
      attachmentTruth: false,
      publicTruth: false,
      submitted: {
        sourceRef: `personaCharacter:world-oasis:persona-1:${persona.contentHash}:reviewed-identity-media-resource`,
      },
    });
  });

  it('fails closed before reviewed text attachment publication', async () => {
    const result = await createReviewedPostTextResource(candidatePayload);

    expect(result).toMatchObject({
      ok: false,
      source: 'Nimi App Access Persona text resource publication (unavailable)',
      failure: 'persona-text-resource-publication-unavailable',
      attachmentTruth: false,
      submitted: {
        content: 'Published caption',
        sourceRef: `personaCharacter:world-oasis:persona-1:${persona.sourceHash}`,
      },
    });
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

  it('uses the injected text candidate runner only for local candidate copy', async () => {
    const runner = vi.fn(async (prompt: Parameters<StudioTextCandidateRunner>[0]) => ({
      text: JSON.stringify({
        caption: 'Mira shares a concise artifact update.',
        tagsText: ['artifact', 'studio'],
        rationale: 'Owner asked for a concise update.',
      }),
      finishReason: 'stop' as const,
      traceId: 'trace-post-copy',
      submitted: prompt,
    }));

    const result = await proposeReviewedPostCopy(ownerPersonaDetail(), {
      caption: '',
      tagsText: '',
      humanReviewed: false,
      attachmentEnabled: false,
      attachmentTargetType: 'RESOURCE',
      attachmentTargetId: '',
    }, 'Draft a short launch post.', runner);

    expect(runner).toHaveBeenCalledTimes(1);
    const submitted = runner.mock.calls[0]?.[0];
    expect(submitted).toMatchObject({
      surfaceId: 'realm-persona-studio.post-copy',
      params: { maxTokens: 700, temperature: 0.5, topP: 1 },
    });
    expect(submitted?.userText).not.toContain('LocalAgent');
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
      runtime: {
        traceId: 'trace-post-copy',
        finishReason: 'stop',
      },
    });
  });

  it('fails closed before calling the runner when the post copy intent is missing', async () => {
    const runner = vi.fn(async (prompt: Parameters<StudioTextCandidateRunner>[0]) => ({
      text: '{}',
      finishReason: 'stop' as const,
      traceId: '',
      submitted: prompt,
    }));

    const result = await proposeReviewedPostCopy(ownerPersonaDetail(), {
      caption: '',
      tagsText: '',
      humanReviewed: false,
      attachmentEnabled: false,
      attachmentTargetType: 'RESOURCE',
      attachmentTargetId: '',
    }, '   ', runner);

    expect(runner).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      failure: 'runtime-post-copy-payload-invalid',
      submitted: null,
    });
  });

  it('maps runner failures to runtime-post-copy-failed without a submitted prompt', async () => {
    const runner: StudioTextCandidateRunner = async () => {
      throw new Error('local app surface unavailable');
    };

    const result = await proposeReviewedPostCopy(ownerPersonaDetail(), {
      caption: '',
      tagsText: '',
      humanReviewed: false,
      attachmentEnabled: false,
      attachmentTargetType: 'RESOURCE',
      attachmentTargetId: '',
    }, 'Draft a short launch post.', runner);

    expect(result).toMatchObject({
      ok: false,
      candidate: false,
      truthWrite: false,
      failure: 'runtime-post-copy-failed',
      submitted: null,
    });
  });

  it('maps unparseable candidate text to runtime-post-copy-invalid-output', async () => {
    const runner: StudioTextCandidateRunner = async (prompt) => ({
      text: 'not json at all',
      finishReason: 'stop',
      traceId: 'trace-post-copy',
      submitted: prompt,
    });

    const result = await proposeReviewedPostCopy(ownerPersonaDetail(), {
      caption: '',
      tagsText: '',
      humanReviewed: false,
      attachmentEnabled: false,
      attachmentTargetType: 'RESOURCE',
      attachmentTargetId: '',
    }, 'Draft a short launch post.', runner);

    expect(result).toMatchObject({
      ok: false,
      failure: 'runtime-post-copy-invalid-output',
    });
  });
});
