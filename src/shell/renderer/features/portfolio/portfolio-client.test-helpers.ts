import type { Runtime } from '@nimiplatform/sdk/runtime';
import type { NimiAIConfigTargetRef } from '@nimiplatform/sdk/ai';
import type { NimiJsonValue } from '@nimiplatform/sdk/contracts';
import {
  ExecutionMode,
  ReasonCode,
  RoutePolicy,
  ScenarioJobStatus,
  ScenarioType,
} from '@nimiplatform/sdk/runtime/generated';
import type { StudioRealmSurface } from '@renderer/data/realm-client.js';
import {
  createStudioAIScopeRef,
  loadStudioAIConfig,
  saveStudioAIConfig,
} from '@renderer/features/ai-config/studio-ai-config-store.js';
import { vi } from 'vitest';
import type { MyRealmPersonaDto, OwnerPortfolioPersonaDetail, SettingField } from './portfolio-data.js';
import {
  REALM_PERSONA_CREATE_PATH,
  REALM_PERSONA_CREATE_SOURCE,
  type RealmPersonaCreationWorldDto,
  type ReviewedCreateRealmPersonaPayload,
} from './create-persona-draft.js';
import type { CandidatePostPayload } from './post-draft.js';

export type MockRuntimeRoute = {
  readonly capability: 'text.generate' | 'image.generate' | 'audio.synthesize';
  readonly model: string;
  readonly connectorId?: string;
};

export function createStudioLocalRuntimeTargetRefForTest(
  model: string,
  capability: MockRuntimeRoute['capability'] = 'text.generate',
): NimiAIConfigTargetRef {
  const localAssetId = `${localKindForCapability(capability)}:${model}`;
  return {
    kind: 'local-runtime',
    version: 'v2',
    profileBindingId: `local-runtime:${localAssetId}`,
  };
}

export function resetStudioAIConfigForTest(): void {
  const scopeRef = createStudioAIScopeRef();
  saveStudioAIConfig({
    scopeRef,
    capabilities: {
      targetRefs: {},
      selectedParams: {},
    },
    profileOrigin: null,
  }, scopeRef);
}

export function configureStudioAIConfigTargetRefsForTest(input: {
  readonly targetRefs: Partial<Record<MockRuntimeRoute['capability'], NimiAIConfigTargetRef | string>>;
  readonly selectedParams?: Partial<Record<MockRuntimeRoute['capability'], NimiJsonValue>>;
}): void {
  const scopeRef = createStudioAIScopeRef();
  const current = loadStudioAIConfig(scopeRef);
  const targetRefs: Record<string, NimiAIConfigTargetRef> = {};
  for (const [capability, targetRef] of Object.entries(input.targetRefs)) {
    targetRefs[capability] = typeof targetRef === 'string'
      ? createStudioLocalRuntimeTargetRefForTest(targetRef, capability as MockRuntimeRoute['capability'])
      : targetRef;
  }
  saveStudioAIConfig({
    ...current,
    capabilities: {
      targetRefs,
      selectedParams: {
        ...(input.selectedParams || {}),
      },
    },
    profileOrigin: null,
  }, scopeRef);
}

export const persona: MyRealmPersonaDto = {
  id: 'persona-1',
  schemaVersion: 'realm.persona/v1',
  contentRevision: 1,
  contentHash: 'hash-persona-1',
  origin: { kind: 'manual', sourceId: 'test' },
  ownerId: 'user-1',
  homeWorldId: 'world-oasis',
  visibility: 'public',
  core: {
    identity: {
      handle: 'mira',
      name: 'Mira',
      summary: 'Quiet strategist',
      concept: 'Quiet strategist',
    },
    presentation: {
      displayName: 'Mira',
      profileLine: 'Quiet strategist',
    },
    personaStyle: {
      archetype: 'CARING',
      traits: ['GENTLE'],
      voice: 'clear',
      pacing: 'responsive',
    },
    contentProfile: {
      topics: ['strategy'],
      boundaries: [],
      guidelines: [],
    },
    interactionProfile: {
      homeWorldId: 'world-oasis',
      interactionModes: ['conversation'],
      greeting: 'Welcome in.',
    },
    assets: {
      resourceRefs: [],
      intents: [],
    },
    authoring: {
      source: 'test',
      notes: [],
      extensions: {
        ownerSettings: {
          identity: {
            publicRole: 'Guide',
          },
        },
        socialVisibility: {
          defaultPostVisibility: 'PUBLIC',
          dmVisibility: 'FRIENDS',
          profileVisibility: 'PUBLIC',
        },
      },
    },
  },
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
};

export const world: RealmPersonaCreationWorldDto = {
  id: 'world-oasis',
  schemaVersion: 'realm.world-core/v1',
  contentRevision: 1,
  contentHash: 'hash-world-oasis',
  origin: { kind: 'system', sourceId: 'OASIS' },
  creatorId: null,
  visibility: 'system',
  core: {
    identity: {
      name: 'OASIS',
      summary: 'Default system world.',
      worldType: 'system-default',
    },
    presentation: {
      title: 'OASIS',
      displayName: 'OASIS',
      tagline: 'Default entry world.',
    },
    ontology: {
      entityKinds: [],
      relationshipTypes: [],
    },
    timeModel: {
      anchor: {
        realStartedAt: '2026-05-21T00:00:00.000Z',
        worldStartedAt: '2026-05-21T00:00:00.000Z',
        worldStartedAtDisplay: '2026-05-21 00:00',
      },
      calendar: null,
      displayFormat: null,
      mode: 'wallClockAnchored',
      flowRatio: 1,
      isPaused: false,
      pausedWorldTime: null,
    },
    timeline: {
      events: [],
    },
    entities: [],
    relationships: [],
    systems: [],
    scenes: [],
    assets: {
      resourceRefs: [],
      intents: [],
    },
    authoring: {
      source: 'test',
    },
  },
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
};

export function mockRealm(): StudioRealmSurface {
  return {
      worldCoreControllerListRealmPersonas: vi.fn(async () => [
        persona,
        {
          ...persona,
          id: 'persona-taken',
          contentHash: 'hash-persona-taken',
          core: {
            ...persona.core,
            identity: {
              handle: 'taken.persona',
              name: 'Taken',
              summary: 'Taken persona',
              concept: 'Taken persona',
            },
            presentation: {
              displayName: 'Taken',
              profileLine: 'Taken persona',
            },
          },
        },
      ]),
      worldCoreControllerGetRealmPersona: vi.fn(async (request: { readonly path: { readonly personaId: string } }) => ({
        ...persona,
        id: request.path.personaId,
        contentHash: request.path.personaId === 'persona-1' ? persona.contentHash : `hash-${request.path.personaId}`,
      })),
      worldCoreControllerCreateRealmPersona: vi.fn(async (request: { readonly body: Record<string, unknown> }) => ({
          ...persona,
          id: 'persona-created-1',
          contentHash: 'hash-persona-created-1',
          core: request.body.core && typeof request.body.core === 'object' ? request.body.core as Record<string, unknown> : {},
      })),
      worldCoreControllerReplaceRealmPersona: vi.fn(async (request: { readonly path: { readonly personaId: string }; readonly body: Record<string, unknown> }) => ({
        ...persona,
        id: request.path.personaId,
        contentHash: 'hash-replaced',
        homeWorldId: typeof request.body.homeWorldId === 'string' ? request.body.homeWorldId : persona.homeWorldId,
        origin: request.body.origin && typeof request.body.origin === 'object'
          ? request.body.origin as typeof persona.origin
          : persona.origin,
        core: request.body.core && typeof request.body.core === 'object' ? request.body.core as Record<string, unknown> : persona.core,
        updatedAt: '2026-05-22T00:00:00.000Z',
      })),
      worldCoreControllerListWorldCores: vi.fn(async () => [world]),
      worldCoreControllerGetWorldCore: vi.fn(async (request: { readonly path: { readonly worldId: string } }) => ({
          ...world,
          id: request.path.worldId,
      })),
      worldCoreControllerGetOasisWorld: vi.fn(async () => world),
      worldCoreControllerCreateSourceMaterializationPacket: vi.fn(async (request: { readonly body: { readonly intendedRuntimeAudience: string; readonly sourceRef: { readonly kind: 'realmPersona' | 'worldCharacter'; readonly worldId: string; readonly sourceId: string; readonly sourceContentHash: string } } }) => ({
        packetSchemaVersion: 'realm.source-materialization-packet/v1',
        packetId: `packet-${request.body.sourceRef.sourceId}`,
        sourceKind: request.body.sourceRef.kind,
        sourceId: request.body.sourceRef.sourceId,
        sourceWorldId: request.body.sourceRef.worldId,
        sourceContentRevision: 1,
        sourceContentHash: request.body.sourceRef.sourceContentHash,
        issuedAt: '2026-05-22T00:00:00.000Z',
        expiresAt: '2026-05-22T01:00:00.000Z',
        nonce: 'nonce-runtime-1',
        packetProof: 'proof-runtime-1',
        packetHash: 'checksum-runtime-1',
        intendedRuntimeAudience: request.body.intendedRuntimeAudience,
        runtimeSourceRef: `runtime-source:${request.body.sourceRef.kind}:${request.body.sourceRef.worldId}:${request.body.sourceRef.sourceId}:${request.body.sourceRef.sourceContentHash}`,
        sourceDisplayMetadata: {},
        payload: {
          displayName: 'Mira',
          communication: { contentStyle: 'Concise.' },
        },
      })),
      createPost: vi.fn(async () => ({
          id: 'post-1',
          authorId: 'author-from-realm',
          author: {
            id: 'author-from-realm',
            displayName: 'Mira',
          },
          attachments: [],
          caption: 'Published caption',
          createdAt: '2026-05-21T00:00:00.000Z',
          moderationStatus: 'PENDING',
          tags: ['studio'],
          visibility: 'PUBLIC',
          worldId: 'world-from-realm',
      })),
      listResources: vi.fn(async () => ({
          items: [
            {
              id: 'resource-text-1',
              resourceType: 'TEXT',
              provider: 'S3_OBJECT',
              status: 'READY',
              storageRef: 'text/user-1/resource-text-1.txt',
              mimeType: 'text/plain; charset=utf-8',
              provenance: 'UPLOADED',
              uploaderAccountId: 'user-1',
              controllerKind: 'ACCOUNT',
              controllerId: 'user-1',
              deliveryAccess: 'SIGNED',
              label: 'Reviewed post text for @mira',
              tags: ['studio'],
              title: 'Published caption',
              metadata: {
                sourceKind: 'realmPersona',
                sourceId: 'persona-1',
                sourceWorldId: 'world-oasis',
                sourceContentHash: 'hash-persona-1',
                sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1',
              },
              createdAt: '2026-05-21T00:00:00.000Z',
              updatedAt: '2026-05-21T00:00:00.000Z',
            },
            {
              id: 'resource-pending-image',
              resourceType: 'IMAGE',
              provider: 'CF_IMAGE',
              status: 'PENDING',
              storageRef: 'image/user-1/pending',
              provenance: 'UPLOADED',
              uploaderAccountId: 'user-1',
              controllerKind: 'ACCOUNT',
              controllerId: 'user-1',
              deliveryAccess: 'SIGNED',
              tags: [],
              createdAt: '2026-05-21T00:00:00.000Z',
              updatedAt: '2026-05-21T00:00:00.000Z',
            },
          ],
      })),
      createImageDirectUpload: vi.fn(async () => ({
        resourceId: 'resource-image-upload',
        resourceType: 'IMAGE',
        provider: 'CF_IMAGE',
        storageRef: 'cf-image-1',
        uploadUrl: 'https://upload.example.test/image',
        expiresIn: null,
        status: 'PENDING',
        deliveryAccess: 'SIGNED',
      })),
      createVideoDirectUpload: vi.fn(async () => ({
        resourceId: 'resource-video-upload',
        resourceType: 'VIDEO',
        provider: 'CF_STREAM',
        storageRef: 'cf-video-1',
        uploadUrl: 'https://upload.example.test/video',
        expiresIn: null,
        status: 'PENDING',
        deliveryAccess: 'SIGNED',
      })),
      createAudioDirectUpload: vi.fn(async () => ({
        resourceId: 'resource-audio-upload',
        resourceType: 'AUDIO',
        provider: 'S3_OBJECT',
        storageRef: 'audio/user-1/audio.mp3',
        uploadUrl: 'https://upload.example.test/audio',
        expiresIn: 3600,
        status: 'PENDING',
        deliveryAccess: 'SIGNED',
      })),
      finalizeResource: vi.fn(async (request: { readonly path: { readonly resourceId: string }; readonly body: Record<string, unknown> }) => {
        const input = request.body;
        return {
          id: request.path.resourceId,
          resourceType: input.metadata && typeof input.metadata === 'object'
            ? (input.metadata as Record<string, unknown>).resourceType
            : 'IMAGE',
          provider: 'S3_OBJECT',
          status: 'READY',
          storageRef: request.path.resourceId,
          mimeType: input.mimeType,
          provenance: 'UPLOADED',
          uploaderAccountId: 'user-1',
          controllerKind: 'ACCOUNT',
          controllerId: 'user-1',
          deliveryAccess: input.deliveryAccess || 'SIGNED',
          label: input.label,
          tags: input.tags || [],
          title: input.title,
          metadata: input.metadata,
          createdAt: '2026-05-21T00:00:00.000Z',
          updatedAt: '2026-05-21T00:00:00.000Z',
        };
      }),
      createTextResource: vi.fn(async () => ({
        id: 'resource-text-1',
        resourceType: 'TEXT',
        provider: 'S3_OBJECT',
        status: 'READY',
        storageRef: 'text/user-1/resource-text-1.txt',
        mimeType: 'text/plain; charset=utf-8',
        provenance: 'UPLOADED',
        uploaderAccountId: 'user-1',
        controllerKind: 'ACCOUNT',
        controllerId: 'user-1',
        deliveryAccess: 'SIGNED',
        label: 'Reviewed post text for @mira',
        tags: ['studio'],
        title: 'Published caption',
        metadata: {
          sourceKind: 'realmPersona',
          sourceId: 'persona-1',
          sourceWorldId: 'world-oasis',
          sourceContentHash: 'hash-persona-1',
          sourceRef: 'realmPersona:world-oasis:persona-1:hash-persona-1',
        },
        createdAt: '2026-05-21T00:00:00.000Z',
        updatedAt: '2026-05-21T00:00:00.000Z',
      })),
  } as unknown as StudioRealmSurface;
}

function localKindForCapability(capability: MockRuntimeRoute['capability']): string {
  if (capability === 'image.generate') return 'image';
  if (capability === 'audio.synthesize') return 'tts';
  return 'chat';
}

export function mockRuntimeWithRoutes(input: {
  readonly executeScenario: ReturnType<typeof vi.fn>;
  readonly submitScenarioJob?: ReturnType<typeof vi.fn>;
  readonly subscribeScenarioJobEvents?: ReturnType<typeof vi.fn>;
  readonly getScenarioArtifacts?: ReturnType<typeof vi.fn>;
  readonly resolveLocalEnvironmentPlan?: ReturnType<typeof vi.fn>;
  readonly listLocalEnvironmentDependencyJobs?: ReturnType<typeof vi.fn>;
  readonly startLocalEnvironmentDependencyJob?: ReturnType<typeof vi.fn>;
  readonly routes: readonly MockRuntimeRoute[];
}): Runtime {
  const cloudRoutes = input.routes.filter((route) => route.connectorId);
  const localRoutes = input.routes.filter((route) => !route.connectorId);
  const defaultSubmitScenarioJob = vi.fn(async (request: {
    readonly scenarioType?: ScenarioType;
    readonly executionMode?: ExecutionMode;
    readonly head?: { readonly modelId?: string };
  }) => ({
    job: {
      jobId: 'job-test-1',
      scenarioType: request.scenarioType ?? ScenarioType.UNSPECIFIED,
      executionMode: request.executionMode ?? ExecutionMode.ASYNC_JOB,
      routeDecision: RoutePolicy.UNSPECIFIED,
      modelResolved: request.head?.modelId || '',
      status: ScenarioJobStatus.COMPLETED,
      providerJobId: '',
      reasonCode: ReasonCode.REASON_CODE_UNSPECIFIED,
      reasonDetail: '',
      retryCount: 0,
      artifacts: [],
      traceId: 'trace-test-1',
      ignoredExtensions: [],
      progressPercent: 100,
      progressCurrentStep: 0,
      progressTotalSteps: 0,
    },
  }));
  const defaultResolveLocalEnvironmentPlan = vi.fn(async () => ({
    plan: {
      planId: 'local-image-native-plan-ready',
      packId: 'local-image-native',
      productLabel: 'Local image native',
      hostProfileId: 'test-host',
      platformTuple: 'test-platform',
      runtimeDataRoot: '',
      consumerScope: 'local-image-native',
      cloudOnlyImpact: '',
      state: 'ready',
      reasonCode: '',
      dependencies: [],
    },
  }));
  return {
    ai: {
      executeScenario: input.executeScenario,
      submitScenarioJob: input.submitScenarioJob ?? defaultSubmitScenarioJob,
      subscribeScenarioJobEvents: input.subscribeScenarioJobEvents ?? vi.fn(async function* () {}),
      getScenarioArtifacts: input.getScenarioArtifacts ?? vi.fn(async () => ({ artifacts: [], traceId: '' })),
      streamScenario: async function* () {},
    },
    connectors: {
      listConnectors: vi.fn(async () => ({
        connectors: [...new Map(cloudRoutes.map((route) => [
          route.connectorId,
          {
            connectorId: route.connectorId,
            label: route.connectorId,
            provider: route.connectorId,
            kind: 'remote_managed',
          },
        ])).values()],
        nextPageToken: '',
      })),
      listConnectorModels: vi.fn(async (request: { readonly connectorId: string }) => ({
        models: cloudRoutes
          .filter((route) => route.connectorId === request.connectorId)
          .map((route) => ({
            modelId: route.model,
            remoteModelCatalogId: `remote-catalog:${route.connectorId}:${route.model}`,
            providerModelId: route.model,
            provider: route.connectorId,
            capabilities: [route.capability],
            available: true,
          })),
        nextPageToken: '',
      })),
    },
    local: {
      resolveLocalEnvironmentPlan: input.resolveLocalEnvironmentPlan ?? defaultResolveLocalEnvironmentPlan,
      listLocalEnvironmentDependencyJobs: input.listLocalEnvironmentDependencyJobs ?? vi.fn(async () => ({ jobs: [] })),
      startLocalEnvironmentDependencyJob: input.startLocalEnvironmentDependencyJob ?? vi.fn(),
      listLocalAssets: vi.fn(async () => ({
        assets: localRoutes.map((route) => ({
          localAssetId: `${localKindForCapability(route.capability)}:${route.model}`,
          assetId: route.model,
          kind: localKindForCapability(route.capability),
          engine: 'mock-runtime',
          endpoint: 'runtime://mock-local',
          status: 'active',
          capabilities: [route.capability],
        })),
        nextPageToken: '',
      })),
    },
  } as unknown as Runtime;
}

export function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') {
    return keys;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectKeys(nested, keys);
  }

  return keys;
}

export function detailField(key: SettingField['key'], label: string, value: string): SettingField {
  if (!value) {
    return {
      key,
      label,
      value,
      status: 'available-empty',
      source: 'Realm WorldCoreController.getRealmPersona',
      readOnly: true,
      emptyLabel: 'not set',
    };
  }
  return {
    key,
    label,
    value,
    status: 'available',
    source: 'Realm WorldCoreController.getRealmPersona',
    readOnly: true,
  };
}

export function ownerPersonaDetail(): OwnerPortfolioPersonaDetail {
  return {
    id: 'persona-1',
    displayName: detailField('displayName', 'Display name', 'Mira'),
    handle: detailField('handle', 'Handle', 'mira'),
    bio: detailField('bio', 'Profile description', ''),
    greeting: detailField('greeting', 'Greeting', ''),
    profileCoverUrl: detailField('profileCoverUrl', 'Profile cover URL', ''),
    ownership: detailField('ownership', 'Ownership evidence', 'owner-created RealmPersona'),
    world: detailField('world', 'World evidence', 'OASIS'),
    state: detailField('state', 'State evidence', 'ACTIVE'),
    avatarUrl: null,
    contentHash: 'hash-persona-1',
    contentRevision: 1,
    homeWorldId: 'world-oasis',
    voice: {
      voiceId: '',
      description: '',
      emotionEnabled: null,
      speed: null,
      pitch: null,
      speechModelId: '',
      speechRoutePolicy: null,
    },
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
    ownerScope: 'owner-created',
    source: 'Realm WorldCoreController.getRealmPersona',
  };
}

export function ownerPersonaDetailWithWorldId(worldId = 'world-oasis'): OwnerPortfolioPersonaDetail {
  return {
    ...ownerPersonaDetail(),
    world: detailField('world', 'World id evidence', worldId),
  };
}

export const candidatePayload: CandidatePostPayload = {
  candidate: true,
  source: 'realm-persona-studio.local-post-draft',
  personaRef: {
    source: 'Realm WorldCoreController.getRealmPersona',
    sourceKind: 'realmPersona',
    sourceRef: {
      kind: 'realmPersona',
      worldId: 'world-oasis',
      sourceId: 'persona-1',
      sourceContentHash: 'hash-persona-1',
    },
    sourceRefKey: 'realmPersona:world-oasis:persona-1:hash-persona-1',
    handle: 'mira',
    displayName: 'Mira',
  },
  realmCreatePost: {
    attachments: [{
      targetType: 'RESOURCE',
      targetId: 'resource-1',
    }],
    caption: 'Published caption',
    tags: ['studio'],
  },
  review: {
    humanReviewed: true,
  },
};

export const createPayload: ReviewedCreateRealmPersonaPayload = {
  source: REALM_PERSONA_CREATE_SOURCE,
  path: REALM_PERSONA_CREATE_PATH,
  publicFields: {
    handle: 'mira.persona',
    displayName: 'Mira Persona',
    concept: 'Durable public Realm Persona',
    description: 'Owner-created public identity',
    rulesText: 'Stay visible.\nStay owner-reviewed.',
  },
  body: {
    homeWorldId: 'world-oasis',
    origin: {
      kind: 'manual',
      sourceId: 'realm-persona-studio:mira.persona',
      sourceVersion: 'owner-reviewed-v1',
    },
    core: {
      identity: {
        handle: 'mira.persona',
        name: 'Mira Persona',
        summary: 'Owner-created public identity',
        concept: 'Durable public RealmPersona',
      },
      presentation: {
        displayName: 'Mira Persona',
        profileLine: 'Owner-created public identity',
      },
      personaStyle: {
        archetype: 'CARING',
        traits: ['GENTLE', 'WISE'],
        voice: 'owner-reviewed',
        pacing: 'responsive',
      },
      contentProfile: {
        topics: [],
        boundaries: [],
        guidelines: [
          {
            guidelineId: 'owner-reviewed-1',
            statement: 'Stay visible.',
            source: 'realm-persona-studio',
          },
          {
            guidelineId: 'owner-reviewed-2',
            statement: 'Stay owner-reviewed.',
            source: 'realm-persona-studio',
          },
        ],
      },
      interactionProfile: {
        homeWorldId: 'world-oasis',
        interactionModes: ['conversation'],
      },
      assets: {
        resourceRefs: [],
        intents: [],
      },
      authoring: {
        source: 'realm-persona-studio',
        notes: [],
        review: {
          status: 'owner-reviewed',
        },
      },
    },
  },
};
