import type { OwnerPortfolioPersonaDetail, PortfolioPersonaDetailSource } from './portfolio-data.js';
import {
  createStudioImageGeneratePayload,
  createStudioSpeechSynthesizePayload,
  resolveStudioImageCallParams,
  resolveStudioSpeechCallParams,
  STUDIO_DEFAULT_SPEECH_TIMING_MODE,
  type StudioImageGeneratePayload,
  type StudioSpeechSynthesizePayload,
} from './studio-ai-runtime.js';

export const MEDIA_CANDIDATE_RESOURCE_TYPES = ['IMAGE', 'VIDEO', 'AUDIO'] as const;
export const MEDIA_CANDIDATE_BINDING_POINTS = [
  'PERSONA_AVATAR',
  'PERSONA_PORTRAIT',
  'PERSONA_CANDIDATE',
  'PERSONA_VOICE_SAMPLE',
] as const;
export const AVATAR_PACKAGE_TARGETS = ['SPRITE2D', 'LIVE2D', 'VRM'] as const;

export const VISUAL_IMAGE_CANDIDATE_NOTICE = 'Image candidates stay local for owner review until a reviewed profile publishing path is available.';
export const AVATAR_PACKAGE_CANDIDATE_NOTICE = 'Avatar package candidates stay local for owner review; generated output is a design sheet and rigging brief, not a published Live2D/VRM package.';
export const VOICE_DEMO_CANDIDATE_NOTICE = 'Voice demo audio stays local for owner review; reviewed voice profile config is promoted separately where admitted.';
export const VISUAL_IMAGE_GENERATION_SOURCE = 'Runtime ScenarioService.submitScenarioJob image.generate';
export const VOICE_DEMO_SYNTHESIS_SOURCE = 'Runtime ScenarioService.executeScenario audio.synthesize';

export type MediaCandidateResourceType = typeof MEDIA_CANDIDATE_RESOURCE_TYPES[number];
export type MediaCandidateBindingPoint = typeof MEDIA_CANDIDATE_BINDING_POINTS[number];
export type VisualCandidateResourceType = Extract<MediaCandidateResourceType, 'IMAGE'>;
export type VoiceCandidateResourceType = Extract<MediaCandidateResourceType, 'AUDIO'>;
export type AvatarPackageTarget = typeof AVATAR_PACKAGE_TARGETS[number];

export type VisualMediaCandidateInput = {
  resourceType: string;
  bindingPoint: string;
  prompt: string;
  notes: string;
};

export type VisualImageGenerationInput = VisualMediaCandidateInput & {
  aspectRatio: string;
};

export type AvatarPackageCandidateInput = VisualImageGenerationInput & {
  packageTarget: string;
  motionNotes: string;
  interactionNotes: string;
};

export type VoiceDemoCandidateInput = {
  scriptText: string;
};

export type NormalizedVisualMediaCandidateInput = {
  resourceType: VisualCandidateResourceType;
  bindingPoint: Exclude<MediaCandidateBindingPoint, 'PERSONA_VOICE_SAMPLE'>;
  prompt: string;
  notes: string;
};

export type NormalizedVoiceDemoCandidateInput = {
  resourceType: VoiceCandidateResourceType;
  bindingPoint: Extract<MediaCandidateBindingPoint, 'PERSONA_VOICE_SAMPLE'>;
  scriptText: string;
};

export type CandidatePersonaContext = {
  source: PortfolioPersonaDetailSource;
  personaKey: string;
  handle: string;
  displayName: string;
  bio?: string;
  greeting?: string;
  profileCoverUrl?: string;
};

export type ReviewedVoiceDemoCandidatePayload = {
  candidate: true;
  publicTruth: false;
  source: 'realm-persona-studio.reviewed-voice-demo-candidate';
  personaContext: CandidatePersonaContext;
  runtime: {
    capabilityToken: 'audio.synthesize';
    runtimeScenario: 'speechSynthesize';
    source: typeof VOICE_DEMO_SYNTHESIS_SOURCE;
    request: StudioSpeechSynthesizePayload;
    status: 'candidate-ready';
  };
  futureEvidencePath: {
    resource: {
      carrier: 'Resource';
      type: VoiceCandidateResourceType;
      status: 'candidate-only';
    };
    binding: {
      family: 'Binding';
      hostType: 'PERSONA';
      objectType: 'RESOURCE';
      bindingPoint: Extract<MediaCandidateBindingPoint, 'PERSONA_VOICE_SAMPLE'>;
      status: 'candidate-only';
    };
  };
};

export type ReviewedVisualImageCandidatePayload = {
  candidate: true;
  publicTruth: false;
  source: 'realm-persona-studio.reviewed-visual-image-candidate';
  personaContext: CandidatePersonaContext;
  runtime: {
    capabilityToken: 'image.generate';
    runtimeScenario: 'imageGenerate';
    source: typeof VISUAL_IMAGE_GENERATION_SOURCE;
    request: StudioImageGeneratePayload;
    status: 'candidate-ready';
  };
  futureEvidencePath: {
    resource: {
      carrier: 'Resource';
      type: VisualCandidateResourceType;
      status: 'candidate-only';
    };
    binding: {
      family: 'Binding';
      hostType: 'PERSONA';
      objectType: 'RESOURCE';
      bindingPoint: Exclude<MediaCandidateBindingPoint, 'PERSONA_VOICE_SAMPLE'>;
      status: 'candidate-only';
    };
  };
};

export type ReviewedAvatarPackageCandidatePayload = {
  candidate: true;
  publicTruth: false;
  source: 'realm-persona-studio.reviewed-avatar-package-candidate';
  personaContext: CandidatePersonaContext;
  avatarPackage: {
    target: AvatarPackageTarget;
    status: 'candidate-only';
    generatedOutput: 'design-sheet-and-rigging-brief';
    publishState: 'not-published';
    requiredArtifacts: string[];
  };
  runtime: {
    capabilityToken: 'image.generate';
    runtimeScenario: 'imageGenerate';
    source: typeof VISUAL_IMAGE_GENERATION_SOURCE;
    request: StudioImageGeneratePayload;
    status: 'candidate-ready';
  };
  futureEvidencePath: {
    resource: {
      carrier: 'Resource';
      type: VisualCandidateResourceType;
      role: 'avatar-design-sheet';
      status: 'candidate-only';
    };
    binding: {
      family: 'Binding';
      hostType: 'PERSONA';
      objectType: 'RESOURCE';
      bindingPoint: 'PERSONA_AVATAR';
      status: 'candidate-only';
    };
    runtimePresentation: {
      backendKind: 'sprite2d' | 'live2d' | 'vrm';
      status: 'requires-reviewed-package-artifacts';
    };
  };
};

export type VisualImageCandidateBuildResult<TPayload> = VoiceDemoCandidateBuildResult<TPayload>;

export type VoiceDemoCandidateBuildResult<TPayload> =
  | {
    changed: true;
    errors: [];
    payload: TPayload;
  }
  | {
    changed: false;
    errors: string[];
    payload: null;
  };

const VISUAL_RESOURCE_TYPES = new Set<VisualCandidateResourceType>(['IMAGE']);
const VISUAL_BINDING_POINTS = new Set<Exclude<MediaCandidateBindingPoint, 'PERSONA_VOICE_SAMPLE'>>([
  'PERSONA_AVATAR',
  'PERSONA_PORTRAIT',
  'PERSONA_CANDIDATE',
]);
const AVATAR_PACKAGE_TARGET_SET = new Set<AvatarPackageTarget>(AVATAR_PACKAGE_TARGETS);
const AVATAR_PACKAGE_REQUIRED_ARTIFACTS: Record<AvatarPackageTarget, string[]> = {
  SPRITE2D: ['reviewed portrait image', 'idle pose policy', 'interaction policy'],
  LIVE2D: ['model3.json', 'moc3', 'texture atlas', 'idle motion', 'speaking/listening motion map'],
  VRM: ['vrm model', 'humanoid rig metadata', 'expression preset map', 'spring bone settings'],
};
const FORBIDDEN_MEDIA_CANDIDATE_FIELDS = new Set([
  'provider',
  'model',
  'localAgent',
  'worldId',
  'publicSuccess',
  'bindingSuccess',
  'resourceReady',
]);
const MODEL_ALLOWED_PATHS = new Set([
  'runtimePreview.requestCandidate.model',
  'runtime.request.params.model',
]);

function normalizeLineText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}

function normalizeSingleLine(value: string): string {
  return normalizeLineText(value).replace(/[ \t]+/g, ' ');
}

function isVisualResourceType(value: string): value is VisualCandidateResourceType {
  return VISUAL_RESOURCE_TYPES.has(value as VisualCandidateResourceType);
}

function isVisualBindingPoint(value: string): value is Exclude<MediaCandidateBindingPoint, 'PERSONA_VOICE_SAMPLE'> {
  return VISUAL_BINDING_POINTS.has(value as Exclude<MediaCandidateBindingPoint, 'PERSONA_VOICE_SAMPLE'>);
}

function isAvatarPackageTarget(value: string): value is AvatarPackageTarget {
  return AVATAR_PACKAGE_TARGET_SET.has(value as AvatarPackageTarget);
}

function avatarPresentationBackend(target: AvatarPackageTarget): 'sprite2d' | 'live2d' | 'vrm' {
  if (target === 'LIVE2D') return 'live2d';
  if (target === 'VRM') return 'vrm';
  return 'sprite2d';
}

export function isAllowedMediaCandidateResourceType(value: string): value is MediaCandidateResourceType {
  return MEDIA_CANDIDATE_RESOURCE_TYPES.includes(value as MediaCandidateResourceType);
}

export function isAllowedMediaCandidateBindingPoint(value: string): value is MediaCandidateBindingPoint {
  return MEDIA_CANDIDATE_BINDING_POINTS.includes(value as MediaCandidateBindingPoint);
}

export function assertNoForbiddenMediaCandidateFields(value: unknown, path: string[] = []): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = [...path, key];
    if (FORBIDDEN_MEDIA_CANDIDATE_FIELDS.has(key) && !(key === 'model' && MODEL_ALLOWED_PATHS.has(nextPath.join('.')))) {
      return key;
    }
    const nestedViolation = assertNoForbiddenMediaCandidateFields(nested, nextPath);
    if (nestedViolation) {
      return nestedViolation;
    }
  }

  return null;
}

function createPersonaContext(persona: OwnerPortfolioPersonaDetail): CandidatePersonaContext {
  return {
    source: persona.source,
    personaKey: persona.id,
    handle: persona.handle.value,
    displayName: persona.displayName.value,
    ...(persona.bio.value ? { bio: persona.bio.value } : {}),
    ...(persona.greeting.value ? { greeting: persona.greeting.value } : {}),
    ...(persona.profileCoverUrl.value ? { profileCoverUrl: persona.profileCoverUrl.value } : {}),
  };
}

export function normalizeVisualMediaCandidateInput(input: VisualMediaCandidateInput): NormalizedVisualMediaCandidateInput {
  return {
    resourceType: isVisualResourceType(input.resourceType) ? input.resourceType : 'IMAGE',
    bindingPoint: isVisualBindingPoint(input.bindingPoint) ? input.bindingPoint : 'PERSONA_CANDIDATE',
    prompt: normalizeLineText(input.prompt),
    notes: normalizeLineText(input.notes),
  };
}

export function normalizeVoiceDemoCandidateInput(input: VoiceDemoCandidateInput): NormalizedVoiceDemoCandidateInput {
  return {
    resourceType: 'AUDIO',
    bindingPoint: 'PERSONA_VOICE_SAMPLE',
    scriptText: normalizeLineText(input.scriptText),
  };
}

export function normalizeAvatarPackageTarget(value: string): AvatarPackageTarget {
  return isAvatarPackageTarget(value) ? value : 'LIVE2D';
}

export function buildReviewedVisualImageGenerationPayload(
  input: VisualImageGenerationInput,
  persona: OwnerPortfolioPersonaDetail,
): VisualImageCandidateBuildResult<StudioImageGeneratePayload> {
  const normalized = normalizeVisualMediaCandidateInput(input);
  const aspectRatio = normalizeSingleLine(input.aspectRatio) || '1:1';
  const callParams = resolveStudioImageCallParams('realm-persona-studio.visual-image-candidate', {
    aspectRatio,
  });
  const errors: string[] = [];

  if (!normalized.prompt) {
    errors.push('visual prompt missing for image candidate generation');
  }

  if (errors.length > 0) {
    return { changed: false, errors, payload: null };
  }

  const promptParts = [
    normalized.prompt,
    normalized.notes ? `Owner notes: ${normalized.notes}` : '',
    persona.displayName.value ? `Realm Persona display name: ${persona.displayName.value}` : '',
    persona.bio.value ? `Profile description context: ${persona.bio.value}` : '',
  ].filter(Boolean);

  return {
    changed: true,
    errors: [],
    payload: createStudioImageGeneratePayload({
      surfaceId: 'realm-persona-studio.visual-image-candidate',
      params: {
        ...callParams,
      },
      spec: {
        prompt: promptParts.join('\n'),
        negativePrompt: '',
        n: 1,
        size: callParams.size || '',
        aspectRatio,
        quality: '',
        style: '',
        seed: callParams.seed || '',
        referenceImages: [],
        mask: '',
        responseFormat: callParams.responseFormat || 'url',
      },
    }),
  };
}

export function buildReviewedAvatarPackageImageGenerationPayload(
  input: AvatarPackageCandidateInput,
  persona: OwnerPortfolioPersonaDetail,
): VisualImageCandidateBuildResult<StudioImageGeneratePayload> {
  const visual = normalizeVisualMediaCandidateInput({
    ...input,
    bindingPoint: 'PERSONA_AVATAR',
  });
  const target = normalizeAvatarPackageTarget(input.packageTarget);
  const aspectRatio = normalizeSingleLine(input.aspectRatio) || '1:1';
  const motionNotes = normalizeLineText(input.motionNotes);
  const interactionNotes = normalizeLineText(input.interactionNotes);
  const callParams = resolveStudioImageCallParams('realm-persona-studio.avatar-package-candidate', {
    aspectRatio,
  });
  const errors: string[] = [];

  if (!visual.prompt) {
    errors.push('visual prompt missing for avatar package candidate generation');
  }

  if (errors.length > 0) {
    return { changed: false, errors, payload: null };
  }

  const promptParts = [
    `Avatar package target: ${target}.`,
    'Generate an owner-review design sheet and rigging brief only. Do not claim a usable Live2D/VRM package exists.',
    visual.prompt,
    visual.notes ? `Owner notes: ${visual.notes}` : '',
    motionNotes ? `Motion notes: ${motionNotes}` : '',
    interactionNotes ? `Interaction notes: ${interactionNotes}` : '',
    persona.displayName.value ? `Realm Persona display name: ${persona.displayName.value}` : '',
    persona.bio.value ? `Profile description context: ${persona.bio.value}` : '',
    persona.greeting.value ? `Greeting context: ${persona.greeting.value}` : '',
  ].filter(Boolean);

  return {
    changed: true,
    errors: [],
    payload: createStudioImageGeneratePayload({
      surfaceId: 'realm-persona-studio.avatar-package-candidate',
      params: {
        ...callParams,
      },
      spec: {
        prompt: promptParts.join('\n'),
        negativePrompt: '',
        n: 1,
        size: callParams.size || '',
        aspectRatio,
        quality: '',
        style: '',
        seed: callParams.seed || '',
        referenceImages: [],
        mask: '',
        responseFormat: callParams.responseFormat || 'url',
      },
    }),
  };
}

export function buildReviewedVisualImageCandidatePayload(
  input: VisualImageGenerationInput,
  persona: OwnerPortfolioPersonaDetail,
): VisualImageCandidateBuildResult<ReviewedVisualImageCandidatePayload> {
  const imagePayload = buildReviewedVisualImageGenerationPayload(input, persona);
  const normalized = normalizeVisualMediaCandidateInput(input);

  if (!imagePayload.payload) {
    return imagePayload;
  }

  return {
    changed: true,
    errors: [],
    payload: {
      candidate: true,
      publicTruth: false,
      source: 'realm-persona-studio.reviewed-visual-image-candidate',
      personaContext: createPersonaContext(persona),
      runtime: {
        capabilityToken: 'image.generate',
        runtimeScenario: 'imageGenerate',
        source: VISUAL_IMAGE_GENERATION_SOURCE,
        request: imagePayload.payload,
        status: 'candidate-ready',
      },
      futureEvidencePath: {
        resource: {
          carrier: 'Resource',
          type: normalized.resourceType,
          status: 'candidate-only',
        },
        binding: {
          family: 'Binding',
          hostType: 'PERSONA',
          objectType: 'RESOURCE',
          bindingPoint: normalized.bindingPoint,
          status: 'candidate-only',
        },
      },
    },
  };
}

export function buildReviewedAvatarPackageCandidatePayload(
  input: AvatarPackageCandidateInput,
  persona: OwnerPortfolioPersonaDetail,
): VisualImageCandidateBuildResult<ReviewedAvatarPackageCandidatePayload> {
  const imagePayload = buildReviewedAvatarPackageImageGenerationPayload(input, persona);
  const target = normalizeAvatarPackageTarget(input.packageTarget);

  if (!imagePayload.payload) {
    return imagePayload;
  }

  return {
    changed: true,
    errors: [],
    payload: {
      candidate: true,
      publicTruth: false,
      source: 'realm-persona-studio.reviewed-avatar-package-candidate',
      personaContext: createPersonaContext(persona),
      avatarPackage: {
        target,
        status: 'candidate-only',
        generatedOutput: 'design-sheet-and-rigging-brief',
        publishState: 'not-published',
        requiredArtifacts: AVATAR_PACKAGE_REQUIRED_ARTIFACTS[target],
      },
      runtime: {
        capabilityToken: 'image.generate',
        runtimeScenario: 'imageGenerate',
        source: VISUAL_IMAGE_GENERATION_SOURCE,
        request: imagePayload.payload,
        status: 'candidate-ready',
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
          backendKind: avatarPresentationBackend(target),
          status: 'requires-reviewed-package-artifacts',
        },
      },
    },
  };
}

export function buildReviewedVoiceSynthesisPayload(
  input: VoiceDemoCandidateInput,
): VoiceDemoCandidateBuildResult<StudioSpeechSynthesizePayload> {
  const normalized = normalizeVoiceDemoCandidateInput(input);
  const callParams = resolveStudioSpeechCallParams('realm-persona-studio.voice-demo-candidate');
  const errors: string[] = [];

  if (!normalized.scriptText) {
    errors.push('voice demo script missing for voice candidate generation');
  }

  if (errors.length > 0) {
    return { changed: false, errors, payload: null };
  }

  const payload = createStudioSpeechSynthesizePayload({
    surfaceId: 'realm-persona-studio.voice-demo-candidate',
    params: {
      ...callParams,
    },
    spec: {
      text: normalizeSingleLine(normalized.scriptText),
      language: callParams.language || '',
      audioFormat: callParams.audioFormat || '',
      sampleRateHz: 0,
      speed: callParams.speed ?? 0,
      pitch: callParams.pitch ?? 0,
      volume: callParams.volume ?? 0,
      emotion: '',
      timingMode: STUDIO_DEFAULT_SPEECH_TIMING_MODE,
    },
  });

  return { changed: true, errors: [], payload };
}

export function buildReviewedVoiceDemoCandidatePayload(
  input: VoiceDemoCandidateInput,
  persona: OwnerPortfolioPersonaDetail,
): VoiceDemoCandidateBuildResult<ReviewedVoiceDemoCandidatePayload> {
  const synthesisPayload = buildReviewedVoiceSynthesisPayload(input);
  const normalized = normalizeVoiceDemoCandidateInput(input);

  if (!synthesisPayload.payload) {
    return synthesisPayload;
  }

  return {
    changed: true,
    errors: [],
    payload: {
      candidate: true,
      publicTruth: false,
      source: 'realm-persona-studio.reviewed-voice-demo-candidate',
      personaContext: createPersonaContext(persona),
      runtime: {
        capabilityToken: 'audio.synthesize',
        runtimeScenario: 'speechSynthesize',
        source: VOICE_DEMO_SYNTHESIS_SOURCE,
        request: synthesisPayload.payload,
        status: 'candidate-ready',
      },
      futureEvidencePath: {
        resource: {
          carrier: 'Resource',
          type: normalized.resourceType,
          status: 'candidate-only',
        },
        binding: {
          family: 'Binding',
          hostType: 'PERSONA',
          objectType: 'RESOURCE',
          bindingPoint: normalized.bindingPoint,
          status: 'candidate-only',
        },
      },
    },
  };
}
