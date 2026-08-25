import type {
  PostDto,
  RealmModel,
} from '@nimiplatform/sdk/realm/generated';
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

type RealmCreatePostResponse = PostDto;
type RealmCreateTextResourceInput = RealmModel<'CreateTextResourceDto'>;
type RealmCreateTextResourceResponse = RealmModel<'ResourceDetailDto'>;
type RealmResourceListResponse = RealmModel<'ResourceListDto'>;
type RealmFinalizeResourceInput = RealmModel<'FinalizeResourceDto'>;
type RealmFinalizeResourceResponse = RealmModel<'ResourceDetailDto'>;

export const REALM_POST_PUBLISH_SOURCE = 'Nimi App Access Persona post publication (unavailable)';
export const REALM_TEXT_RESOURCE_SOURCE = 'Nimi App Access Persona text resource publication (unavailable)';
export const REALM_RESOURCE_LIST_SOURCE = 'Realm ResourcesService.listResources';
export const REALM_MEDIA_RESOURCE_UPLOAD_SOURCE = 'Nimi App Access Persona media publication (unavailable)';
export const PERSONA_PUBLICATION_UNAVAILABLE_MESSAGE = 'Nimi App Access does not provide Persona post or media publication yet.';
export const PERSONA_PUBLICATION_AVAILABLE = false;

export type RealmPostPublishCanonicalFields = {
  id: string;
  worldId?: string;
  moderationStatus?: string;
  status?: string;
  visibility?: string;
  contentRating?: string;
};

export type RealmPostPublishResult =
  | {
    ok: true;
    source: typeof REALM_POST_PUBLISH_SOURCE;
    post: RealmCreatePostResponse;
    canonical: RealmPostPublishCanonicalFields;
  }
  | {
    ok: false;
    source: typeof REALM_POST_PUBLISH_SOURCE;
    failure: 'persona-post-publication-unavailable' | 'realm-create-post-failed' | 'realm-create-post-missing-canonical-id';
    message: string;
  };

export type RealmTextResourceCanonicalFields = {
  id: string;
  resourceType: string;
  status: string;
  deliveryAccess?: string;
};

export type RealmTextResourceCreateResult =
  | {
    ok: true;
    source: typeof REALM_TEXT_RESOURCE_SOURCE;
    attachmentTruth: true;
    resource: RealmCreateTextResourceResponse;
    canonical: RealmTextResourceCanonicalFields;
  }
  | {
    ok: false;
    source: typeof REALM_TEXT_RESOURCE_SOURCE;
    attachmentTruth: false;
    failure:
      | 'post-text-resource-payload-invalid'
      | 'persona-text-resource-publication-unavailable'
      | 'realm-create-text-resource-failed'
      | 'realm-create-text-resource-missing-id'
      | 'realm-create-text-resource-not-ready';
    message: string;
    submitted: RealmCreateTextResourceInput | null;
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

type DirectMediaResourceCanonicalFields = {
  id: string;
  resourceType: DirectMediaResourceType;
  status: 'READY';
  deliveryAccess?: string;
};

export type DirectMediaResourceUploadResult =
  | {
    ok: true;
    source: typeof REALM_MEDIA_RESOURCE_UPLOAD_SOURCE;
    attachmentTruth: true;
    publicTruth: false;
    session: {
      resourceId: string;
      resourceType: DirectMediaResourceType;
      status: string;
    };
    resource: RealmFinalizeResourceResponse;
    canonical: DirectMediaResourceCanonicalFields;
  }
  | {
    ok: false;
    source: typeof REALM_MEDIA_RESOURCE_UPLOAD_SOURCE;
    attachmentTruth: false;
    publicTruth: false;
    failure:
      | 'media-upload-file-invalid'
      | 'media-upload-type-invalid'
      | 'persona-media-publication-unavailable'
      | 'realm-direct-upload-session-failed'
      | 'realm-direct-upload-session-invalid'
      | 'storage-direct-upload-failed'
      | 'realm-finalize-resource-failed'
      | 'realm-finalize-resource-not-ready';
    message: string;
      submitted: RealmFinalizeResourceInput | null;
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

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isPostAttachmentResourceType(value: string): value is PostAttachmentResourceOption['resourceType'] {
  return value === 'IMAGE' || value === 'VIDEO' || value === 'AUDIO' || value === 'TEXT';
}

function isDirectMediaResourceType(value: string): value is DirectMediaResourceType {
  return value === 'IMAGE' || value === 'VIDEO' || value === 'AUDIO';
}

function normalizeResourceTitle(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

export function normalizePostAttachmentResourceOptions(response: RealmResourceListResponse): PostAttachmentResourceOption[] {
  const responseRecord = response as unknown as Record<string, unknown>;
  const items = response && typeof response === 'object' && Array.isArray(responseRecord.items)
    ? responseRecord.items
    : [];

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const record = item as Record<string, unknown>;
    const id = readOptionalString(record, 'id');
    const resourceType = readOptionalString(record, 'resourceType');
    const status = readOptionalString(record, 'status');
    if (!id || !resourceType || !isPostAttachmentResourceType(resourceType) || status !== 'READY') {
      return [];
    }

    const title = readOptionalString(record, 'title');
    const label = readOptionalString(record, 'label');
    const storageRef = readOptionalString(record, 'storageRef');
    const deliveryAccess = readOptionalString(record, 'deliveryAccess');

    return [{
      id,
      resourceType,
      status,
      label: title || label || storageRef || id,
      ...(deliveryAccess ? { deliveryAccess } : {}),
      source: REALM_RESOURCE_LIST_SOURCE,
    }];
  });
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

export function buildFinalizeDirectMediaResourceInput(input: DirectMediaResourceUploadInput): RealmFinalizeResourceInput | null {
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

export function normalizeFinalizedDirectMediaResource(
  resource: RealmFinalizeResourceResponse,
  expectedResourceType: DirectMediaResourceType,
): DirectMediaResourceCanonicalFields | null {
  if (!resource || typeof resource !== 'object') {
    return null;
  }
  const record = resource as unknown as Record<string, unknown>;
  const id = readOptionalString(record, 'id');
  const resourceType = readOptionalString(record, 'resourceType');
  const status = readOptionalString(record, 'status');
  const deliveryAccess = readOptionalString(record, 'deliveryAccess');
  if (!id || resourceType !== expectedResourceType || status !== 'READY') {
    return null;
  }
  return {
    id,
    resourceType,
    status,
    ...(deliveryAccess ? { deliveryAccess } : {}),
  };
}
export function buildRealmPostTextResourceInput(payload: CandidatePostPayload): RealmCreateTextResourceInput | null {
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

export function normalizeRealmTextResourceCreateResult(
  resource: RealmCreateTextResourceResponse,
  submitted: RealmCreateTextResourceInput,
): RealmTextResourceCreateResult {
  if (!resource || typeof resource !== 'object') {
    return {
      ok: false,
      source: REALM_TEXT_RESOURCE_SOURCE,
      attachmentTruth: false,
      failure: 'realm-create-text-resource-missing-id',
      message: 'Realm Create Text Resource returned no resource object.',
      submitted,
    };
  }

  const record = resource as unknown as Record<string, unknown>;
  const id = readOptionalString(record, 'id');
  if (!id) {
    return {
      ok: false,
      source: REALM_TEXT_RESOURCE_SOURCE,
      attachmentTruth: false,
      failure: 'realm-create-text-resource-missing-id',
      message: 'Realm Create Text Resource returned no canonical resource id.',
      submitted,
    };
  }

  const resourceType = readOptionalString(record, 'resourceType');
  const status = readOptionalString(record, 'status');
  const deliveryAccess = readOptionalString(record, 'deliveryAccess');
  if (resourceType !== 'TEXT' || status !== 'READY') {
    return {
      ok: false,
      source: REALM_TEXT_RESOURCE_SOURCE,
      attachmentTruth: false,
      failure: 'realm-create-text-resource-not-ready',
      message: `Realm text resource ${id} is not a READY TEXT resource.`,
      submitted,
    };
  }

  return {
    ok: true,
    source: REALM_TEXT_RESOURCE_SOURCE,
    attachmentTruth: true,
    resource,
    canonical: {
      id,
      resourceType,
      status,
      ...(deliveryAccess ? { deliveryAccess } : {}),
    },
  };
}

export function normalizeRealmPostPublishResult(post: RealmCreatePostResponse): RealmPostPublishResult {
  if (!post || typeof post !== 'object') {
    return {
      ok: false,
      source: REALM_POST_PUBLISH_SOURCE,
      failure: 'realm-create-post-missing-canonical-id',
      message: 'Realm Create Post returned no post object.',
    };
  }

  const record = post as unknown as Record<string, unknown>;
  const id = readOptionalString(record, 'id');
  if (!id) {
    return {
      ok: false,
      source: REALM_POST_PUBLISH_SOURCE,
      failure: 'realm-create-post-missing-canonical-id',
      message: 'Realm Create Post returned no canonical post id.',
    };
  }

  const worldId = readOptionalString(record, 'worldId');
  const moderationStatus = readOptionalString(record, 'moderationStatus');
  const status = readOptionalString(record, 'status');
  const visibility = readOptionalString(record, 'visibility');
  const contentRating = readOptionalString(record, 'contentRating');

  return {
    ok: true,
    source: REALM_POST_PUBLISH_SOURCE,
    post,
    canonical: {
      id,
      ...(worldId ? { worldId } : {}),
      ...(moderationStatus ? { moderationStatus } : {}),
      ...(status ? { status } : {}),
      ...(visibility ? { visibility } : {}),
      ...(contentRating ? { contentRating } : {}),
    },
  };
}
export async function proposeReviewedPostCopy(
  persona: OwnerPortfolioPersonaDetail,
  draft: LocalPostDraftInput,
  intent: string,
  runner: StudioTextCandidateRunner = runStudioTextCandidate,
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
  const finalizeInput = buildFinalizeDirectMediaResourceInput(input);
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
  const submitted = buildRealmPostTextResourceInput(payload);
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
