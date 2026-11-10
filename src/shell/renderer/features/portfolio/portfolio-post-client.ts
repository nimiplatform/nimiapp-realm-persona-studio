import { type StudioScope } from '@renderer/app-shell/studio-scope.js';
import {
  runStudioTextCandidate,
  type StudioTextCandidatePrompt,
  type StudioTextCandidateRunner,
} from './studio-text-candidate.js';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  POST_COPY_ASSISTANCE_SOURCE,
  buildRuntimePostCopyPrompt,
  normalizeRuntimePostCopyProposal,
  type CandidatePostPayload,
  type LocalPostDraftInput,
  type RuntimePostCopyProposal,
} from './post-draft.js';

// These are App-owned review candidates, never Realm upload or finalize requests.
// Publication is unavailable through the current protected App surface.
type ReviewedResourceCandidate = {
  deliveryAccess: 'SIGNED';
  label: string;
  mimeType: string;
  sourceRef: string;
  title: string;
  tags?: string[];
  metadata: {
    source: string;
    sourceKind: 'personaCharacter';
    attachmentPurpose: 'post' | 'identity';
    humanReviewed: true;
  };
};
type ReviewedMediaCandidate = ReviewedResourceCandidate & {
  sizeBytes: number;
  metadata: ReviewedResourceCandidate['metadata'] & {
    sourceId: string;
    sourceWorldId: string;
    sourceContentHash: string;
    resourceType: DirectMediaResourceType;
  };
};
type ReviewedTextCandidate = ReviewedResourceCandidate & {
  content: string;
  metadata: ReviewedResourceCandidate['metadata'] & { sourceRef: string };
};

export const REALM_POST_PUBLISH_SOURCE = 'Nimi App Access Persona post publication (unavailable)';
export const REALM_TEXT_RESOURCE_SOURCE = 'Nimi App Access Persona text resource publication (unavailable)';
export const REALM_RESOURCE_LIST_SOURCE = 'Realm ResourcesService.listResources';
export const REALM_MEDIA_RESOURCE_UPLOAD_SOURCE = 'Nimi App Access Persona media publication (unavailable)';
export const PERSONA_PUBLICATION_UNAVAILABLE_MESSAGE = 'Nimi App Access does not provide Persona post or media publication yet.';
export const PERSONA_PUBLICATION_AVAILABLE = false;

export type RealmPostPublishResult = {
  ok: false;
  source: typeof REALM_POST_PUBLISH_SOURCE;
  failure: 'persona-post-publication-unavailable';
  message: string;
};

export type RealmTextResourceCreateResult = {
  ok: false;
  source: typeof REALM_TEXT_RESOURCE_SOURCE;
  attachmentTruth: false;
  failure: 'post-text-resource-payload-invalid' | 'persona-text-resource-publication-unavailable';
  message: string;
  submitted: ReviewedTextCandidate | null;
};

export type PostAttachmentResourceOption = {
  id: string;
  resourceType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TEXT';
  status: 'READY';
  label: string;
  deliveryAccess?: string;
  source: typeof REALM_RESOURCE_LIST_SOURCE;
};

export type DirectMediaResourceType = Extract<PostAttachmentResourceOption['resourceType'], 'IMAGE' | 'VIDEO' | 'AUDIO'>;

export type DirectMediaResourceUploadFile = {
  name: string;
  type: string;
  size: number;
};

export type DirectMediaResourceUploadInput = {
  resourceType: DirectMediaResourceType;
  file: DirectMediaResourceUploadFile;
  persona: OwnerPortfolioPersonaDetail;
  purpose?: 'post' | 'identity';
  tags?: string[];
};

export type DirectMediaResourceUploadResult = {
  ok: false;
  source: typeof REALM_MEDIA_RESOURCE_UPLOAD_SOURCE;
  attachmentTruth: false;
  publicTruth: false;
  failure: 'media-upload-file-invalid' | 'media-upload-type-invalid' | 'persona-media-publication-unavailable';
  message: string;
  submitted: ReviewedMediaCandidate | null;
};
export type RuntimePostCopyProposalResult =
  | {
    ok: true;
    source: typeof POST_COPY_ASSISTANCE_SOURCE;
    candidate: true;
    truthWrite: false;
    proposal: RuntimePostCopyProposal;
    submitted: StudioTextCandidatePrompt;
    runtime: {
      traceId?: string;
      finishReason?: string;
    };
  }
  | {
    ok: false;
    source: typeof POST_COPY_ASSISTANCE_SOURCE;
    candidate: false;
    truthWrite: false;
    failure:
      | 'runtime-post-copy-payload-invalid'
      | 'runtime-post-copy-failed'
      | 'runtime-post-copy-invalid-output';
    message: string;
    submitted: StudioTextCandidatePrompt | null;
  };

function isDirectMediaResourceType(value: string): value is DirectMediaResourceType {
  return value === 'IMAGE' || value === 'VIDEO' || value === 'AUDIO';
}

function normalizeResourceTitle(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function isUploadableMediaFile(input: DirectMediaResourceUploadInput): boolean {
  if (!isDirectMediaResourceType(input.resourceType)) {
    return false;
  }
  if (!input.file.name.trim() || input.file.size <= 0) {
    return false;
  }
  if (input.resourceType === 'IMAGE') {
    return input.file.type.startsWith('image/');
  }
  if (input.resourceType === 'VIDEO') {
    return input.file.type.startsWith('video/');
  }
  return input.file.type.startsWith('audio/');
}

function normalizeDirectMediaTitle(fileName: string): string {
  return normalizeResourceTitle(fileName.replace(/\s+/g, ' ').trim() || 'Studio media upload');
}

function personaCharacterSourceRef(persona: OwnerPortfolioPersonaDetail): string {
  return `personaCharacter:${persona.homeWorldId}:${persona.id}:${persona.contentHash}`;
}

function buildReviewedMediaCandidate(input: DirectMediaResourceUploadInput): ReviewedMediaCandidate | null {
  if (!isUploadableMediaFile(input)) {
    return null;
  }

  const tags = input.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
  const purpose = input.purpose === 'identity' ? 'identity' : 'post';
  const sourceRef = purpose === 'identity'
    ? `${personaCharacterSourceRef(input.persona)}:reviewed-identity-media-resource`
    : `${personaCharacterSourceRef(input.persona)}:reviewed-post-media-resource`;
  return {
    deliveryAccess: 'SIGNED',
    label: `Reviewed ${purpose} ${input.resourceType.toLowerCase()} upload for ${input.persona.handle.value ? `@${input.persona.handle.value}` : input.persona.displayName.value}`,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    sourceRef,
    title: normalizeDirectMediaTitle(input.file.name),
    ...(tags.length > 0 ? { tags } : {}),
    metadata: {
      source: sourceRef,
      sourceKind: 'personaCharacter',
      sourceId: input.persona.id,
      sourceWorldId: input.persona.homeWorldId,
      sourceContentHash: input.persona.contentHash,
      attachmentPurpose: purpose,
      resourceType: input.resourceType,
      humanReviewed: true,
    },
  };
}

function buildReviewedTextCandidate(payload: CandidatePostPayload): ReviewedTextCandidate | null {
  const content = payload.realmCreatePost.caption?.trim();
  if (!content) {
    return null;
  }

  return {
    content,
    deliveryAccess: 'SIGNED',
    label: `Reviewed post text for ${payload.personaRef.handle ? `@${payload.personaRef.handle}` : payload.personaRef.displayName}`,
    mimeType: 'text/plain; charset=utf-8',
    sourceRef: payload.personaRef.sourceRefKey,
    title: normalizeResourceTitle(content),
    ...(payload.realmCreatePost.tags && payload.realmCreatePost.tags.length > 0 ? { tags: [...payload.realmCreatePost.tags] } : {}),
    metadata: {
      source: 'realm-persona-studio.reviewed-post-text-resource',
      sourceRef: payload.personaRef.sourceRefKey,
      sourceKind: 'personaCharacter',
      attachmentPurpose: 'post',
      humanReviewed: true,
    },
  };
}

export async function proposeReviewedPostCopy(scope: StudioScope,
  persona: OwnerPortfolioPersonaDetail,
  draft: LocalPostDraftInput,
  intent: string,
  runner: StudioTextCandidateRunner = runStudioTextCandidate.bind(null, scope),
): Promise<RuntimePostCopyProposalResult> {
  const built = buildRuntimePostCopyPrompt({
    persona,
    draft,
    intent,
  });
  if (!built.ok) {
    return {
      ok: false,
      source: POST_COPY_ASSISTANCE_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: 'runtime-post-copy-payload-invalid',
      message: built.errors.join('; ') || 'Runtime post copy payload invalid.',
      submitted: null,
    };
  }

  try {
    const output = await runner(built.payload);
    try {
      const proposal = normalizeRuntimePostCopyProposal(output.text, draft);
      return {
        ok: true,
        source: POST_COPY_ASSISTANCE_SOURCE,
        candidate: true,
        truthWrite: false,
        proposal,
        submitted: output.submitted,
        runtime: {
          ...(output.traceId ? { traceId: output.traceId } : {}),
          ...(output.finishReason ? { finishReason: output.finishReason } : {}),
        },
      };
    } catch (error) {
      return {
        ok: false,
        source: POST_COPY_ASSISTANCE_SOURCE,
        candidate: false,
        truthWrite: false,
        failure: 'runtime-post-copy-invalid-output',
        message: error instanceof Error ? error.message : 'Runtime post copy output invalid.',
        submitted: output.submitted,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'runtime transport call failed.';
    return {
      ok: false,
      source: POST_COPY_ASSISTANCE_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: 'runtime-post-copy-failed',
      message: `Nimi App Access ai.text.generateCandidate failed: ${message}`,
      submitted: null,
    };
  }
}
export async function publishReviewedPostDraft(
  _payload: CandidatePostPayload,
): Promise<RealmPostPublishResult> {
  return {
    ok: false,
    source: REALM_POST_PUBLISH_SOURCE,
    failure: 'persona-post-publication-unavailable',
    message: PERSONA_PUBLICATION_UNAVAILABLE_MESSAGE,
  };
}

export async function listReadyPostAttachmentResources(): Promise<PostAttachmentResourceOption[]> {
  throw new Error(PERSONA_PUBLICATION_UNAVAILABLE_MESSAGE);
}

export async function uploadReviewedPostMediaResource(
  input: DirectMediaResourceUploadInput,
): Promise<DirectMediaResourceUploadResult> {
  const finalizeInput = buildReviewedMediaCandidate(input);
  if (!finalizeInput) {
    return {
      ok: false,
      source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
      attachmentTruth: false,
      publicTruth: false,
      failure: isDirectMediaResourceType(input.resourceType) ? 'media-upload-file-invalid' : 'media-upload-type-invalid',
      message: 'Reviewed media Resource upload requires a matching non-empty image, video, or audio file.',
      submitted: null,
    };
  }
  return {
    ok: false,
    source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
    attachmentTruth: false,
    publicTruth: false,
    failure: 'persona-media-publication-unavailable',
    message: PERSONA_PUBLICATION_UNAVAILABLE_MESSAGE,
    submitted: finalizeInput,
  };
}

export async function uploadReviewedIdentityMediaResource(
  input: Omit<DirectMediaResourceUploadInput, 'purpose'>,
): Promise<DirectMediaResourceUploadResult> {
  return uploadReviewedPostMediaResource({ ...input, purpose: 'identity' });
}

export async function createReviewedPostTextResource(
  payload: CandidatePostPayload,
): Promise<RealmTextResourceCreateResult> {
  const submitted = buildReviewedTextCandidate(payload);
  if (!submitted) {
    return {
      ok: false,
      source: REALM_TEXT_RESOURCE_SOURCE,
      attachmentTruth: false,
      failure: 'post-text-resource-payload-invalid',
      message: 'Reviewed post text resource requires caption content.',
      submitted: null,
    };
  }

  return {
    ok: false,
    source: REALM_TEXT_RESOURCE_SOURCE,
    attachmentTruth: false,
    failure: 'persona-text-resource-publication-unavailable',
    message: PERSONA_PUBLICATION_UNAVAILABLE_MESSAGE,
    submitted,
  };
}
