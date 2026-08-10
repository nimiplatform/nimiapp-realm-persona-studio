import type { CreativeAssetHistoryRecord } from '@renderer/features/portfolio/creative-asset-history.js';
import type { LocalPostScheduleRecord } from '@renderer/features/portfolio/local-post-schedule-store.js';
import type { OwnerPortfolioPersonaDetail, SettingField } from '@renderer/features/portfolio/portfolio-data.js';

export type MaintenanceSuggestionStatus = 'ready' | 'blocked' | 'unavailable';
export type MaintenanceSuggestionPriority = 'high' | 'medium' | 'low';
export type MaintenanceSuggestionRoute = 'settings' | 'assets' | 'posts' | 'schedule' | 'insights';
export type MaintenanceSuggestionKind = 'profile' | 'identity' | 'content' | 'schedule' | 'adoption';

export type MaintenanceSuggestionSource =
  | 'Realm WorldCoreController.getRealmPersona'
  | 'realm-persona-studio.local-creative-asset-history'
  | 'realm-persona-studio.local-single-post-schedule-store';

export type MaintenanceSuggestion = {
  id: string;
  kind: MaintenanceSuggestionKind;
  status: MaintenanceSuggestionStatus;
  priority: MaintenanceSuggestionPriority;
  title: string;
  rationale: string;
  evidence: string[];
  action: {
    label: string;
    route: MaintenanceSuggestionRoute;
  };
  sources: MaintenanceSuggestionSource[];
  candidate: true;
  publicTruth: false;
  truthWrite: false;
};

export type MaintenanceSuggestionContext = {
  persona: OwnerPortfolioPersonaDetail;
  creativeHistory?: readonly CreativeAssetHistoryRecord[];
  localPostSchedule?: LocalPostScheduleRecord | null;
};

const priorityRank: Record<MaintenanceSuggestionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const statusRank: Record<MaintenanceSuggestionStatus, number> = {
  ready: 0,
  blocked: 1,
  unavailable: 2,
};

function hasValue(field: SettingField): boolean {
  return field.status === 'available' && field.value.trim().length > 0;
}

function isUnavailable(field: SettingField): boolean {
  return field.status === 'source-unavailable';
}

function missingFieldLabels(fields: readonly SettingField[]): string[] {
  return fields.filter((field) => !isUnavailable(field) && !hasValue(field)).map((field) => field.label);
}

function unavailableFieldLabels(fields: readonly SettingField[]): string[] {
  return fields.filter(isUnavailable).map((field) => field.label);
}

function hasVoiceConfig(persona: OwnerPortfolioPersonaDetail): boolean {
  return Boolean(persona.voice?.voiceId || persona.voice?.description || persona.voice?.speechModelId);
}

function sortSuggestions(suggestions: MaintenanceSuggestion[]): MaintenanceSuggestion[] {
  return [...suggestions].sort((left, right) => (
    priorityRank[left.priority] - priorityRank[right.priority]
    || statusRank[left.status] - statusRank[right.status]
    || left.id.localeCompare(right.id)
  ));
}

export function deriveMaintenanceSuggestions(context: MaintenanceSuggestionContext): MaintenanceSuggestion[] {
  const { persona } = context;
  const creativeHistory = context.creativeHistory ?? [];
  const suggestions: MaintenanceSuggestion[] = [];

  const profileFields = [persona.displayName, persona.handle, persona.bio, persona.greeting] as const;
  const profileUnavailable = unavailableFieldLabels(profileFields);
  const profileMissing = missingFieldLabels(profileFields);
  if (profileUnavailable.length > 0) {
    suggestions.push({
      id: 'profile-source-unavailable',
      kind: 'profile',
      status: 'unavailable',
      priority: 'high',
      title: 'Profile source unavailable',
      rationale: 'Realm detail did not return the profile fields needed for reliable maintenance.',
      evidence: profileUnavailable.map((field) => `${field}: source unavailable`),
      action: { label: 'Inspect source', route: 'insights' },
      sources: ['Realm WorldCoreController.getRealmPersona'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  } else if (profileMissing.length > 0) {
    suggestions.push({
      id: 'complete-profile-voice',
      kind: 'profile',
      status: 'ready',
      priority: 'high',
      title: 'Complete profile voice',
      rationale: 'Public profile and greeting fields need owner-reviewed copy before stronger content and identity work.',
      evidence: profileMissing.map((field) => `${field}: not set`),
      action: { label: 'Open settings', route: 'settings' },
      sources: ['Realm WorldCoreController.getRealmPersona'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  }

  const identityUnavailable = unavailableFieldLabels([persona.profileCoverUrl]);
  const identityMissing = [
    ...(persona.avatarUrl ? [] : ['Avatar']),
    ...(hasValue(persona.profileCoverUrl) ? [] : ['Profile cover URL']),
    ...(hasVoiceConfig(persona) ? [] : ['Voice config']),
  ];
  if (identityUnavailable.length > 0) {
    suggestions.push({
      id: 'identity-source-unavailable',
      kind: 'identity',
      status: 'unavailable',
      priority: 'medium',
      title: 'Identity media source unavailable',
      rationale: 'Realm did not return enough profile media state to judge public identity readiness.',
      evidence: identityUnavailable.map((field) => `${field}: source unavailable`),
      action: { label: 'Inspect source', route: 'insights' },
      sources: ['Realm WorldCoreController.getRealmPersona'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  } else if (identityMissing.length > 0) {
    suggestions.push({
      id: 'generate-identity-pack',
      kind: 'identity',
      status: profileUnavailable.length > 0 ? 'blocked' : 'ready',
      priority: 'medium',
      title: 'Generate identity pack',
      rationale: 'Avatar, cover, or voice candidates can be prepared from current owner-visible profile state.',
      evidence: identityMissing.map((field) => `${field}: not set`),
      action: { label: 'Open assets', route: 'assets' },
      sources: ['Realm WorldCoreController.getRealmPersona'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  }

  const latestCreativeCandidate = creativeHistory[0];
  if (latestCreativeCandidate) {
    suggestions.push({
      id: 'review-local-creative-candidate',
      kind: 'identity',
      status: 'ready',
      priority: 'medium',
      title: 'Review local creative candidate',
      rationale: 'Studio has a local candidate that is not public truth and needs owner review before any supported profile action.',
      evidence: [
        `${latestCreativeCandidate.label}: ${latestCreativeCandidate.kind}`,
        `Created: ${latestCreativeCandidate.createdAt}`,
      ],
      action: { label: 'Open assets', route: 'assets' },
      sources: ['realm-persona-studio.local-creative-asset-history'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  }

  const contentFields = [persona.bio, persona.greeting] as const;
  const contentUnavailable = unavailableFieldLabels(contentFields);
  const contentMissing = missingFieldLabels(contentFields);
  if (contentUnavailable.length > 0) {
    suggestions.push({
      id: 'content-source-unavailable',
      kind: 'content',
      status: 'unavailable',
      priority: 'high',
      title: 'Content voice source unavailable',
      rationale: 'Post variants need source-backed profile voice fields; Studio will not infer them from private or missing state.',
      evidence: contentUnavailable.map((field) => `${field}: source unavailable`),
      action: { label: 'Inspect source', route: 'insights' },
      sources: ['Realm WorldCoreController.getRealmPersona'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  } else if (contentMissing.length > 0) {
    suggestions.push({
      id: 'strengthen-content-voice',
      kind: 'content',
      status: 'blocked',
      priority: 'high',
      title: 'Strengthen content voice first',
      rationale: 'Content Studio should use reviewed profile voice instead of inventing a voice from empty fields.',
      evidence: contentMissing.map((field) => `${field}: not set`),
      action: { label: 'Open settings', route: 'settings' },
      sources: ['Realm WorldCoreController.getRealmPersona'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  } else {
    suggestions.push({
      id: 'create-content-variant',
      kind: 'content',
      status: 'ready',
      priority: 'low',
      title: 'Create next content variant',
      rationale: 'Profile description and greeting are available for owner-reviewed post drafting.',
      evidence: ['Profile description: available', 'Greeting: available'],
      action: { label: 'Open posts', route: 'posts' },
      sources: ['Realm WorldCoreController.getRealmPersona'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  }

  if (context.localPostSchedule) {
    suggestions.push({
      id: 'review-local-post-schedule',
      kind: 'schedule',
      status: 'ready',
      priority: 'high',
      title: 'Review saved local schedule',
      rationale: 'One reviewed app-local scheduled post candidate exists on this device; public success still requires Realm publish when due.',
      evidence: [
        `Run at: ${context.localPostSchedule.localRunAt}`,
        'Scope: app-local foreground execution',
      ],
      action: { label: 'Open schedule', route: 'schedule' },
      sources: ['realm-persona-studio.local-single-post-schedule-store'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  }

  if (persona.friendCount.status === 'source-unavailable') {
    suggestions.push({
      id: 'friendcount-source-unavailable',
      kind: 'adoption',
      status: 'unavailable',
      priority: 'low',
      title: 'Adoption source unavailable',
      rationale: 'friendCount is not present on the Realm detail projection, so Studio shows no fallback engagement metric.',
      evidence: ['friendCount: source unavailable'],
      action: { label: 'Inspect source', route: 'insights' },
      sources: ['Realm WorldCoreController.getRealmPersona'],
      candidate: true,
      publicTruth: false,
      truthWrite: false,
    });
  }

  return sortSuggestions(suggestions);
}
