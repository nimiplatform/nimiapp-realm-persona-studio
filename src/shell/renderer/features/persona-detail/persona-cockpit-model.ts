import type { OwnerPortfolioPersonaDetail, SettingField } from '@renderer/features/portfolio/portfolio-data.js';

export type PersonaCockpitCardStatus = 'ready' | 'missing' | 'unavailable' | 'blocked';

export type PersonaCockpitActionKey =
  | 'improve-settings'
  | 'generate-identity'
  | 'create-post'
  | 'review-visibility'
  | 'inspect-source';

export type PersonaCockpitAction = {
  key: PersonaCockpitActionKey;
  label: string;
  route: 'settings' | 'assets' | 'posts' | 'insights';
  reason: string;
  source: 'Realm WorldCoreController.getRealmPersona' | 'local workspace state';
};

export type PersonaCockpitCard = {
  key: 'profile' | 'ai-readiness' | 'identity' | 'content' | 'adoption';
  title: string;
  status: PersonaCockpitCardStatus;
  summary: string;
  evidence: string[];
  actions: PersonaCockpitActionKey[];
  source: 'Realm WorldCoreController.getRealmPersona';
};

export type PersonaCockpitModel = {
  cards: PersonaCockpitCard[];
  actions: PersonaCockpitAction[];
  unavailableSignals: string[];
  missingSignals: string[];
};

function hasValue(field: SettingField): boolean {
  return field.status === 'available' && field.value.trim().length > 0;
}

function isUnavailable(field: SettingField): boolean {
  return field.status === 'source-unavailable';
}

function fieldEvidence(label: string, field: SettingField): string {
  if (isUnavailable(field)) return `${label}: source unavailable`;
  if (hasValue(field)) return `${label}: available`;
  return `${label}: not set`;
}

function statusFor(unavailable: string[], missing: string[]): PersonaCockpitCardStatus {
  if (unavailable.length > 0) return 'unavailable';
  if (missing.length > 0) return 'missing';
  return 'ready';
}

export function derivePersonaCockpitModel(persona: OwnerPortfolioPersonaDetail): PersonaCockpitModel {
  const actions: PersonaCockpitAction[] = [
    {
      key: 'improve-settings',
      label: 'Improve settings',
      route: 'settings',
      reason: 'Review public identity, greeting, communication, and boundary fields.',
      source: 'Realm WorldCoreController.getRealmPersona',
    },
    {
      key: 'generate-identity',
      label: 'Generate identity',
      route: 'assets',
      reason: 'Create avatar, visual reference, and voice candidates from source-backed profile fields.',
      source: 'Realm WorldCoreController.getRealmPersona',
    },
    {
      key: 'create-post',
      label: 'Create post',
      route: 'posts',
      reason: 'Draft owner-reviewed content from current profile voice and public setting fields.',
      source: 'Realm WorldCoreController.getRealmPersona',
    },
    {
      key: 'review-visibility',
      label: 'Review visibility',
      route: 'settings',
      reason: 'Open owner-scoped settings and visibility controls.',
      source: 'Realm WorldCoreController.getRealmPersona',
    },
    {
      key: 'inspect-source',
      label: 'Inspect sources',
      route: 'insights',
      reason: 'Check source availability and deferred metrics without fallback values.',
      source: 'Realm WorldCoreController.getRealmPersona',
    },
  ];

  const unavailableSignals: string[] = [];
  const missingSignals: string[] = [];
  const trackedFields = [
    ['display name', persona.displayName],
    ['handle', persona.handle],
    ['profile description', persona.bio],
    ['greeting', persona.greeting],
    ['profile cover URL', persona.profileCoverUrl],
    ['world', persona.world],
    ['state', persona.state],
  ] as const;
  for (const [label, field] of trackedFields) {
    if (isUnavailable(field)) unavailableSignals.push(label);
    else if (!hasValue(field)) missingSignals.push(label);
  }
  if (!persona.avatarUrl) missingSignals.push('avatar');
  if (persona.friendCount.status === 'source-unavailable') unavailableSignals.push('friendCount');

  const profileUnavailable = [persona.displayName, persona.handle, persona.bio, persona.greeting].filter(isUnavailable).map((field) => field.label);
  const profileMissing = [
    ...(hasValue(persona.displayName) ? [] : ['display name']),
    ...(hasValue(persona.handle) ? [] : ['handle']),
    ...(hasValue(persona.bio) ? [] : ['profile description']),
    ...(hasValue(persona.greeting) ? [] : ['greeting']),
  ];

  const hasVoiceConfig = Boolean(persona.voice?.voiceId || persona.voice?.description || persona.voice?.speechModelId);
  const identityUnavailable = [persona.profileCoverUrl].filter(isUnavailable).map((field) => field.label);
  const identityMissing = [
    ...(persona.avatarUrl ? [] : ['avatar']),
    ...(hasValue(persona.profileCoverUrl) ? [] : ['profile cover']),
    ...(hasVoiceConfig ? [] : ['voice config']),
  ];

  const contentUnavailable = [persona.bio, persona.greeting].filter(isUnavailable).map((field) => field.label);
  const contentMissing = [
    ...(hasValue(persona.bio) ? [] : ['profile description']),
    ...(hasValue(persona.greeting) ? [] : ['greeting']),
  ];

  const adoptionUnavailable = persona.friendCount.status === 'source-unavailable' ? ['friendCount'] : [];

  const cards: PersonaCockpitCard[] = [
    {
      key: 'profile',
      title: 'Profile State',
      status: statusFor(profileUnavailable, profileMissing),
      summary: profileUnavailable.length > 0
        ? 'Realm did not return all required profile fields.'
        : profileMissing.length > 0
          ? 'Public profile needs owner-reviewed completion.'
          : 'Public profile fields are source-backed.',
      evidence: [
        fieldEvidence('Display name', persona.displayName),
        fieldEvidence('Handle', persona.handle),
        fieldEvidence('Profile description', persona.bio),
        fieldEvidence('Greeting', persona.greeting),
      ],
      actions: ['improve-settings', 'review-visibility'],
      source: 'Realm WorldCoreController.getRealmPersona',
    },
    {
      key: 'ai-readiness',
      title: 'AI Readiness',
      status: statusFor(profileUnavailable, [...profileMissing, ...(hasVoiceConfig ? [] : ['voice config'])]),
      summary: 'Runtime actions can use only visible owner-approved profile fields and explicit owner prompts.',
      evidence: [
        fieldEvidence('Profile description', persona.bio),
        fieldEvidence('Greeting', persona.greeting),
        `Voice config: ${hasVoiceConfig ? 'available' : 'not set'}`,
      ],
      actions: ['improve-settings', 'generate-identity'],
      source: 'Realm WorldCoreController.getRealmPersona',
    },
    {
      key: 'identity',
      title: 'Identity Assets',
      status: statusFor(identityUnavailable, identityMissing),
      summary: identityUnavailable.length > 0
        ? 'Profile media source is unavailable from Realm.'
        : identityMissing.length > 0
          ? 'Avatar, cover, or voice candidates need owner review.'
          : 'Identity media has source-backed profile evidence.',
      evidence: [
        `Avatar: ${persona.avatarUrl ? 'available' : 'not set'}`,
        fieldEvidence('Profile cover URL', persona.profileCoverUrl),
        `Voice config: ${hasVoiceConfig ? 'available' : 'not set'}`,
      ],
      actions: ['generate-identity'],
      source: 'Realm WorldCoreController.getRealmPersona',
    },
    {
      key: 'content',
      title: 'Content Readiness',
      status: statusFor(contentUnavailable, contentMissing),
      summary: contentMissing.length > 0
        ? 'Post drafts need stronger profile voice evidence before generation.'
        : 'Profile voice is available for owner-reviewed post drafting.',
      evidence: [
        fieldEvidence('Profile description', persona.bio),
        fieldEvidence('Greeting', persona.greeting),
      ],
      actions: ['create-post', 'improve-settings'],
      source: 'Realm WorldCoreController.getRealmPersona',
    },
    {
      key: 'adoption',
      title: 'Adoption Signal',
      status: adoptionUnavailable.length > 0 ? 'unavailable' : 'ready',
      summary: persona.friendCount.status === 'available'
        ? `friendCount is source-backed at ${persona.friendCount.value}.`
        : 'friendCount source is unavailable; no fallback metric is shown.',
      evidence: [
        persona.friendCount.status === 'available'
          ? `friendCount: ${persona.friendCount.value}`
          : 'friendCount: source unavailable',
      ],
      actions: ['inspect-source'],
      source: 'Realm WorldCoreController.getRealmPersona',
    },
  ];

  return {
    cards,
    actions,
    unavailableSignals,
    missingSignals,
  };
}
