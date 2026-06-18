import type {
  RealmCreateAudioDirectUploadOperationRequest,
  RealmCreateAudioDirectUploadOperationResponse,
  RealmCreateImageDirectUploadOperationResponse,
  RealmCreatePostOperationRequest,
  RealmCreatePostOperationResponse,
  RealmCreateTextResourceOperationRequest,
  RealmCreateTextResourceOperationResponse,
  RealmCreateVideoDirectUploadOperationResponse,
  RealmFinalizeResourceOperationRequest,
  RealmFinalizeResourceOperationResponse,
  RealmListResourcesOperationResponse,
} from '@nimiplatform/sdk/realm/generated';
import { createStudioRealmClient, type StudioRealmSurface } from '@renderer/data/realm-client.js';
import { createStudioRuntimeClient } from '@renderer/data/runtime-client.js';
import {
  isStudioAIRouteBindingFailure,
  runStudioTextGenerate,
  type StudioRuntimeAIClient,
  type StudioTextGeneratePayload,
} from './studio-ai-runtime.js';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  POST_COPY_ASSISTANCE_SOURCE,
  buildRuntimePostCopyPrompt,
  normalizeRuntimePostCopyProposal,
  type CandidatePostPayload,
  type LocalPostDraftInput,
  type RuntimePostCopyProposal,
} from './post-draft.js';

type StudioRealmClient = StudioRealmSurface;

type RealmCreatePostInput = RealmCreatePostOperationRequest['body'];
type RealmCreatePostResponse = RealmCreatePostOperationResponse;
type RealmCreateTextResourceInput = RealmCreateTextResourceOperationRequest['body'];
type RealmCreateTextResourceResponse = RealmCreateTextResourceOperationResponse;
type RealmResourceListResponse = RealmListResourcesOperationResponse;
type RealmCreateImageUploadResponse = RealmCreateImageDirectUploadOperationResponse;
type RealmCreateVideoUploadResponse = RealmCreateVideoDirectUploadOperationResponse;
type RealmCreateAudioUploadInput = RealmCreateAudioDirectUploadOperationRequest['body'];
type RealmCreateAudioUploadResponse = RealmCreateAudioDirectUploadOperationResponse;
type RealmFinalizeResourceInput = RealmFinalizeResourceOperationRequest['body'];
type RealmFinalizeResourceResponse = RealmFinalizeResourceOperationResponse;

export const REALM_POST_PUBLISH_SOURCE = 'Realm PostsService.createPost';
export const REALM_TEXT_RESOURCE_SOURCE = 'Realm ResourcesService.createTextResource';
export const REALM_RESOURCE_LIST_SOURCE = 'Realm ResourcesService.listResources';
export const REALM_MEDIA_RESOURCE_UPLOAD_SOURCE = 'Realm ResourcesService direct upload + finalizeResource';

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
    failure: 'realm-create-post-failed' | 'realm-create-post-missing-canonical-id';
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

type DirectMediaResourceUploadSession =
  | RealmCreateImageUploadResponse
  | RealmCreateVideoUploadResponse
  | RealmCreateAudioUploadResponse;

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
      | 'realm-direct-upload-session-failed'
      | 'realm-direct-upload-session-invalid'
      | 'storage-direct-upload-failed'
      | 'realm-finalize-resource-failed'
      | 'realm-finalize-resource-not-ready';
    message: string;
      submitted: RealmFinalizeResourceInput | RealmCreateAudioUploadInput | null;
  };

type StorageUploadRequest = {
  uploadUrl: string;
  resourceType: DirectMediaResourceType;
  file: DirectMediaResourceUploadFile;
};

type StorageUploadTransport = (request: StorageUploadRequest) => Promise<void>;
export type RuntimePostCopyProposalResult =
  | {
    ok: true;
    source: typeof POST_COPY_ASSISTANCE_SOURCE;
    candidate: true;
    truthWrite: false;
    proposal: RuntimePostCopyProposal;
    submitted: StudioTextGeneratePayload;
    runtime: {
      traceId?: string;
      modelResolved?: string;
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
      | 'runtime-post-copy-transport-unavailable'
      | 'runtime-post-copy-route-unbound'
      | 'runtime-post-copy-failed'
      | 'runtime-post-copy-invalid-output';
    message: string;
    submitted: StudioTextGeneratePayload | null;
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

export function buildRealmCreatePostInput(payload: CandidatePostPayload): RealmCreatePostInput {
  return {
    attachments: payload.realmCreatePost.attachments.map((attachment) => ({
      targetType: attachment.targetType,
      targetId: attachment.targetId,
    })),
    ...(payload.realmCreatePost.caption ? { caption: payload.realmCreatePost.caption } : {}),
    ...(payload.realmCreatePost.tags && payload.realmCreatePost.tags.length > 0 ? { tags: [...payload.realmCreatePost.tags] } : {}),
    sourceRef: { ...payload.personaRef.sourceRef },
  };
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

function realmPersonaSourceRef(persona: OwnerPortfolioPersonaDetail): string {
  return `realmPersona:${persona.homeWorldId}:${persona.id}:${persona.contentHash}`;
}

export function buildFinalizeDirectMediaResourceInput(input: DirectMediaResourceUploadInput): RealmFinalizeResourceInput | null {
  if (!isUploadableMediaFile(input)) {
    return null;
  }

  const tags = input.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
  const purpose = input.purpose === 'identity' ? 'identity' : 'post';
  const sourceRef = purpose === 'identity'
    ? `${realmPersonaSourceRef(input.persona)}:reviewed-identity-media-resource`
    : `${realmPersonaSourceRef(input.persona)}:reviewed-post-media-resource`;
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
      sourceKind: 'realmPersona',
      sourceId: input.persona.id,
      sourceWorldId: input.persona.homeWorldId,
      sourceContentHash: input.persona.contentHash,
      attachmentPurpose: purpose,
      resourceType: input.resourceType,
      humanReviewed: true,
    },
  };
}

function normalizeDirectMediaUploadSession(
  session: DirectMediaResourceUploadSession,
  expectedResourceType: DirectMediaResourceType,
): { resourceId: string; resourceType: DirectMediaResourceType; uploadUrl: string; status: string } | null {
  if (!session || typeof session !== 'object') {
    return null;
  }
  const record = session as unknown as Record<string, unknown>;
  const resourceId = readOptionalString(record, 'resourceId');
  const resourceType = readOptionalString(record, 'resourceType');
  const uploadUrl = readOptionalString(record, 'uploadUrl');
  const status = readOptionalString(record, 'status');
  if (!resourceId || resourceType !== expectedResourceType || !uploadUrl || status !== 'PENDING') {
    return null;
  }
  return {
    resourceId,
    resourceType,
    uploadUrl,
    status,
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
      sourceKind: 'realmPersona',
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
  runtime?: StudioRuntimeAIClient | null,
): Promise<RuntimePostCopyProposalResult> {
  // The prompt starts with the unresolved marker; studio-ai-runtime must bind a
  // concrete text.generate route before dispatch.
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

  const runtimeClient = runtime === undefined ? await createStudioRuntimeClient() : runtime;
  if (!runtimeClient) {
    return {
      ok: false,
      source: POST_COPY_ASSISTANCE_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: 'runtime-post-copy-transport-unavailable',
      message: 'Runtime runtime.ai.text.generate runtime transport unavailable: Tauri IPC runtime transport is required.',
      submitted: built.payload,
    };
  }

  try {
    const output = await runStudioTextGenerate(built.payload, runtimeClient);
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
          ...(output.trace?.traceId ? { traceId: output.trace.traceId } : {}),
          ...(output.trace?.modelResolved ? { modelResolved: output.trace.modelResolved } : {}),
          ...(output.finishReason ? { finishReason: String(output.finishReason) } : {}),
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
    const routeUnbound = isStudioAIRouteBindingFailure(error);
    return {
      ok: false,
      source: POST_COPY_ASSISTANCE_SOURCE,
      candidate: false,
      truthWrite: false,
      failure: routeUnbound ? 'runtime-post-copy-route-unbound' : 'runtime-post-copy-failed',
      message: routeUnbound ? message : `Runtime runtime.ai.text.generate failed: ${message}`,
      submitted: null,
    };
  }
}
export async function publishReviewedPostDraft(
  payload: CandidatePostPayload,
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<RealmPostPublishResult> {
  try {
    const post = await realm.createPost({
      path: {},
      body: buildRealmCreatePostInput(payload),
    });
    return normalizeRealmPostPublishResult(post);
  } catch (error) {
    return {
      ok: false,
      source: REALM_POST_PUBLISH_SOURCE,
      failure: 'realm-create-post-failed',
      message: error instanceof Error ? error.message : 'Realm Create Post failed.',
    };
  }
}

export async function listReadyPostAttachmentResources(
  realm: StudioRealmClient = createStudioRealmClient(),
): Promise<PostAttachmentResourceOption[]> {
  const response = await realm.listResources({ path: {} });
  return normalizePostAttachmentResourceOptions(response);
}

async function defaultStorageUploadTransport(request: StorageUploadRequest): Promise<void> {
  const response = request.resourceType === 'AUDIO'
    ? await fetch(request.uploadUrl, {
      method: 'PUT',
      body: request.file as unknown as BodyInit,
      headers: request.file.type ? { 'content-type': request.file.type } : undefined,
    })
    : await fetch(request.uploadUrl, {
      method: 'POST',
      body: (() => {
        const formData = new FormData();
        formData.append('file', request.file as unknown as Blob, request.file.name);
        return formData;
      })(),
    });

  if (!response.ok) {
    throw new Error(`storage upload failed with HTTP ${response.status}`);
  }
}

export async function uploadReviewedPostMediaResource(
  input: DirectMediaResourceUploadInput,
  realm: StudioRealmClient = createStudioRealmClient(),
  storageUpload: StorageUploadTransport = defaultStorageUploadTransport,
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

  let rawSession: DirectMediaResourceUploadSession;
  try {
    if (input.resourceType === 'IMAGE') {
      rawSession = await realm.createImageDirectUpload({
        path: {},
        query: { requireSignedUrls: 'true' },
      });
    } else if (input.resourceType === 'VIDEO') {
      rawSession = await realm.createVideoDirectUpload({
        path: {},
        query: { requireSignedUrls: 'true' },
      });
    } else {
      rawSession = await realm.createAudioDirectUpload({
        path: {},
        body: {
          ...finalizeInput,
          filename: input.file.name,
        },
      });
    }
  } catch (error) {
    return {
      ok: false,
      source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
      attachmentTruth: false,
      publicTruth: false,
      failure: 'realm-direct-upload-session-failed',
      message: error instanceof Error ? error.message : 'Realm direct upload session failed.',
      submitted: input.resourceType === 'AUDIO' ? { ...finalizeInput, filename: input.file.name } : finalizeInput,
    };
  }

  const session = normalizeDirectMediaUploadSession(rawSession, input.resourceType);
  if (!session) {
    return {
      ok: false,
      source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
      attachmentTruth: false,
      publicTruth: false,
      failure: 'realm-direct-upload-session-invalid',
      message: 'Realm direct upload session did not return a PENDING resource id and upload URL.',
      submitted: finalizeInput,
    };
  }

  try {
    await storageUpload({
      uploadUrl: session.uploadUrl,
      resourceType: input.resourceType,
      file: input.file,
    });
  } catch (error) {
    return {
      ok: false,
      source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
      attachmentTruth: false,
      publicTruth: false,
      failure: 'storage-direct-upload-failed',
      message: error instanceof Error ? error.message : 'Storage direct upload failed.',
      submitted: finalizeInput,
    };
  }

  try {
    const resource = await realm.finalizeResource({
      path: { resourceId: session.resourceId },
      body: finalizeInput,
    });
    const canonical = normalizeFinalizedDirectMediaResource(resource, input.resourceType);
    if (!canonical) {
      return {
        ok: false,
        source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
        attachmentTruth: false,
        publicTruth: false,
        failure: 'realm-finalize-resource-not-ready',
        message: 'Realm finalizeResource did not return a READY media Resource.',
        submitted: finalizeInput,
      };
    }
    return {
      ok: true,
      source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
      attachmentTruth: true,
      publicTruth: false,
      session: {
        resourceId: session.resourceId,
        resourceType: session.resourceType,
        status: session.status,
      },
      resource,
      canonical,
    };
  } catch (error) {
    return {
      ok: false,
      source: REALM_MEDIA_RESOURCE_UPLOAD_SOURCE,
      attachmentTruth: false,
      publicTruth: false,
      failure: 'realm-finalize-resource-failed',
      message: error instanceof Error ? error.message : 'Realm finalizeResource failed.',
      submitted: finalizeInput,
    };
  }
}

export async function uploadReviewedIdentityMediaResource(
  input: Omit<DirectMediaResourceUploadInput, 'purpose'>,
  realm: StudioRealmClient = createStudioRealmClient(),
  storageUpload: StorageUploadTransport = defaultStorageUploadTransport,
): Promise<DirectMediaResourceUploadResult> {
  return uploadReviewedPostMediaResource({ ...input, purpose: 'identity' }, realm, storageUpload);
}

export async function createReviewedPostTextResource(
  payload: CandidatePostPayload,
  realm: StudioRealmClient = createStudioRealmClient(),
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

  try {
    const resource = await realm.createTextResource({
      path: {},
      body: submitted,
    });
    return normalizeRealmTextResourceCreateResult(resource, submitted);
  } catch (error) {
    return {
      ok: false,
      source: REALM_TEXT_RESOURCE_SOURCE,
      attachmentTruth: false,
      failure: 'realm-create-text-resource-failed',
      message: error instanceof Error ? error.message : 'Realm Create Text Resource failed.',
      submitted,
    };
  }
}
