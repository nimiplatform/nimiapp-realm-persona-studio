import type { OwnerPortfolioPersonaDetail, SettingField } from './portfolio-data.js';

export type IdentityPackCandidateKey =
  | 'avatar'
  | 'profile-cover'
  | 'portrait-reference'
  | 'post-image-style'
  | 'voice-demo';

export type IdentityPackCandidate = {
  key: IdentityPackCandidateKey;
  title: string;
  prompt: string;
  reviewState: 'candidate-only';
  publicWrite:
    | 'avatar-url-selection-unavailable'
    | 'profile-cover-publication-unavailable'
    | 'resource-persona-binding-unavailable'
    | 'voice-publication-unavailable'
    | 'post-attachment-candidate-only';
  sourceFields: string[];
  blockedReason?: string;
};

export type IdentityPackBuildResult =
  | {
    changed: true;
    errors: [];
    source: 'realm-persona-studio.identity-pack-from-current-persona';
    candidates: IdentityPackCandidate[];
  }
  | {
    changed: false;
    errors: string[];
    source: 'realm-persona-studio.identity-pack-from-current-persona';
    candidates: [];
  };

function available(field: SettingField): string {
  return field.status === 'available' && field.value.trim() ? field.value.trim() : '';
}

function joinPrompt(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join('\n');
}

function sourceFields(persona: OwnerPortfolioPersonaDetail): string[] {
  return [
    ...(available(persona.displayName) ? ['displayName'] : []),
    ...(available(persona.handle) ? ['handle'] : []),
    ...(available(persona.bio) ? ['bio'] : []),
    ...(available(persona.greeting) ? ['greeting'] : []),
    ...(available(persona.world) ? ['world'] : []),
    ...(persona.avatarUrl ? ['avatarUrl'] : []),
  ];
}

export function buildIdentityPackFromPersona(persona: OwnerPortfolioPersonaDetail): IdentityPackBuildResult {
  const displayName = available(persona.displayName);
  const bio = available(persona.bio);
  const greeting = available(persona.greeting);
  const world = available(persona.world);
  const fields = sourceFields(persona);
  const errors: string[] = [];
  if (!displayName) errors.push('display name source unavailable or empty');
  if (!bio && !greeting) errors.push('profile description or greeting required for identity pack');
  if (errors.length > 0) {
    return {
      changed: false,
      errors,
      source: 'realm-persona-studio.identity-pack-from-current-persona',
      candidates: [],
    };
  }

  const common = joinPrompt([
    `Realm Persona: ${displayName}`,
    bio ? `Profile description: ${bio}` : '',
    greeting ? `Greeting voice: ${greeting}` : '',
    world ? `World context: ${world}` : '',
  ]);

  return {
    changed: true,
    errors: [],
    source: 'realm-persona-studio.identity-pack-from-current-persona',
    candidates: [
      {
        key: 'avatar',
        title: 'Avatar',
        prompt: joinPrompt([
          common,
          'Create a clear square avatar portrait. Emphasize recognizable face, strong silhouette, and readable profile identity.',
        ]),
        reviewState: 'candidate-only',
        publicWrite: 'avatar-url-selection-unavailable',
        sourceFields: fields,
        blockedReason: 'Nimi App Access does not provide Persona avatar selection yet.',
      },
      {
        key: 'profile-cover',
        title: 'Profile Cover',
        prompt: joinPrompt([
          common,
          'Create a wide profile cover composition with environment, mood, and identity cues. Do not include text.',
        ]),
        reviewState: 'candidate-only',
        publicWrite: 'profile-cover-publication-unavailable',
        sourceFields: fields,
        blockedReason: 'Nimi App Access does not provide owner-scoped profile cover publication yet.',
      },
      {
        key: 'portrait-reference',
        title: 'Portrait Reference',
        prompt: joinPrompt([
          common,
          'Create a portrait/reference image for future visual consistency. Keep it inspectable and neutral.',
        ]),
        reviewState: 'candidate-only',
        publicWrite: 'resource-persona-binding-unavailable',
        sourceFields: fields,
        blockedReason: 'Nimi App Access does not provide Resource-to-Persona binding publication yet.',
      },
      {
        key: 'post-image-style',
        title: 'Post Image Style',
        prompt: joinPrompt([
          common,
          'Create a reusable image style direction for future persona-authored posts.',
        ]),
        reviewState: 'candidate-only',
        publicWrite: 'post-attachment-candidate-only',
        sourceFields: fields,
      },
      {
        key: 'voice-demo',
        title: 'Voice Demo',
        prompt: greeting || `I am ${displayName}. ${bio}`,
        reviewState: 'candidate-only',
        publicWrite: 'voice-publication-unavailable',
        sourceFields: fields,
        blockedReason: 'Nimi App Access does not provide voice sample publication yet.',
      },
    ],
  };
}
