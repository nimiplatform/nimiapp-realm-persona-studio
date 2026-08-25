import { describe, expect, it } from 'vitest';
import { deriveMaintenanceSuggestions } from './maintenance-suggestion.js';
import type { CreativeAssetHistoryRecord } from '@renderer/features/portfolio/creative-asset-history.js';
import type { LocalPostScheduleRecord } from '@renderer/features/portfolio/local-post-schedule-store.js';
import type { LocalPostScheduleCandidate } from '@renderer/features/portfolio/post-draft.js';
import type { OwnerPortfolioPersonaDetail, SettingField } from '@renderer/features/portfolio/portfolio-data.js';

function field(key: SettingField['key'], label: string, value: string, status: SettingField['status'] = 'available'): SettingField {
  return {
    key,
    label,
    value,
    status,
    source: 'Nimi App Access realm.personaCharacter.getOwned',
    readOnly: true,
  };
}

const basePersona: OwnerPortfolioPersonaDetail = {
  id: 'persona-1',
  contentHash: 'hash-persona-1',
  sourceHash: 'source-hash-persona-1',
  contentRevision: 1,
  homeWorldId: 'world-oasis',
  displayName: field('displayName', 'Display name', 'Mira Prime'),
  handle: field('handle', 'Handle', 'mira-prime'),
  bio: field('bio', 'Profile description', 'Source-backed profile.'),
  greeting: field('greeting', 'Greeting', 'Bring the source material first.'),
  profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', 'https://cdn.example.test/cover.png'),
  ownership: field('ownership', 'Ownership evidence', 'MASTER_OWNED'),
  world: field('world', 'World evidence', 'world-oasis'),
  visibility: field('visibility', 'Visibility', 'public'),
  avatarUrl: 'https://cdn.example.test/avatar.png',
  voice: {
    voiceId: 'voice-1',
    description: 'Calm studio voice.',
    emotionEnabled: true,
    speed: 1,
    pitch: 1,
    speechModelId: 'speech-model',
    speechRoutePolicy: 'local',
  },
  friendCount: { status: 'available', value: 42 },
  ownerScope: 'owner-created',
  source: 'Nimi App Access realm.personaCharacter.getOwned',
};

const creativeCandidate: CreativeAssetHistoryRecord = {
  id: 'asset-1',
  personaId: 'persona-1',
  sourceContentHash: 'hash-persona-1',
  kind: 'runtime-image-candidate',
  sourceKind: 'generated',
  reviewState: 'candidate-only',
  label: 'Portrait candidate',
  createdAt: '2026-06-16T10:00:00.000Z',
  source: 'Runtime image.generate',
  publicTruth: false,
  detail: 'Local portrait candidate.',
};

const postCandidate: LocalPostScheduleCandidate = {
  candidate: true,
  source: 'realm-persona-studio.local-single-post-schedule',
  appLocalOnly: true,
  localRunAt: '2026-06-17T09:30',
  boundary: {
    scope: 'app-local-only',
    realmPublish: 'not-created',
    realmScheduling: 'not-created',
    moderation: 'not-claimed',
  },
  postCandidate: {
    candidate: true,
    source: 'realm-persona-studio.local-post-draft',
    personaRef: {
      source: 'Nimi App Access realm.personaCharacter.getOwned',
      sourceKind: 'personaCharacter',
      sourceRef: {
        kind: 'personaCharacter',
        worldId: 'world-oasis',
        id: 'persona-1',
        sourceHash: 'source-hash-persona-1',
      },
      sourceRefKey: 'personaCharacter:world-oasis:persona-1:source-hash-persona-1',
      handle: 'mira-prime',
      displayName: 'Mira Prime',
    },
    realmCreatePost: {
      attachments: [],
      caption: 'Reviewed post.',
      tags: ['realm'],
    },
    review: {
      humanReviewed: true,
    },
  },
};

const localSchedule: LocalPostScheduleRecord = {
  localKey: 'persona-1:2026-06-17T09:30',
  personaId: 'persona-1',
  savedAt: '2026-06-16T10:05:00.000Z',
  localRunAt: '2026-06-17T09:30',
  source: 'realm-persona-studio.local-single-post-schedule-store',
  appLocalOnly: true,
  execution: {
    mode: 'foreground-when-due',
    realmPublish: 'pending-owner-app-open',
  },
  candidate: postCandidate,
};

function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return out;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out.add(key);
    collectKeys(nested, out);
  }
  return out;
}

describe('maintenance suggestions', () => {
  it('derives candidate-only cockpit actions from Realm detail and Studio-owned local history', () => {
    const suggestions = deriveMaintenanceSuggestions({
      persona: basePersona,
      creativeHistory: [creativeCandidate],
      localPostSchedule: localSchedule,
    });

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual([
      'review-local-post-schedule',
      'review-local-creative-candidate',
      'create-content-variant',
    ]);
    expect(suggestions.every((suggestion) => suggestion.candidate && !suggestion.publicTruth && !suggestion.truthWrite)).toBe(true);
    expect(suggestions.find((suggestion) => suggestion.id === 'review-local-post-schedule')).toMatchObject({
      status: 'ready',
      action: { route: 'schedule' },
      sources: ['realm-persona-studio.local-single-post-schedule-store'],
    });
    expect(suggestions.find((suggestion) => suggestion.id === 'review-local-creative-candidate')).toMatchObject({
      status: 'ready',
      action: { route: 'assets' },
      sources: ['realm-persona-studio.local-creative-asset-history'],
    });
  });

  it('keeps missing and unavailable sources explicit instead of inventing readiness', () => {
    const suggestions = deriveMaintenanceSuggestions({
      persona: {
        ...basePersona,
        bio: field('bio', 'Profile description', '', 'source-unavailable'),
        greeting: field('greeting', 'Greeting', '', 'available-empty'),
        profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', '', 'available-empty'),
        avatarUrl: null,
        voice: undefined,
        friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
      },
    });

    expect(suggestions.find((suggestion) => suggestion.id === 'profile-source-unavailable')).toMatchObject({
      status: 'unavailable',
      evidence: ['Profile description: source unavailable'],
    });
    expect(suggestions.find((suggestion) => suggestion.id === 'content-source-unavailable')).toMatchObject({
      status: 'unavailable',
    });
    expect(suggestions.find((suggestion) => suggestion.id === 'generate-identity-pack')).toMatchObject({
      status: 'blocked',
      evidence: ['Avatar: not set', 'Profile cover URL: not set', 'Voice config: not set'],
    });
    expect(suggestions.find((suggestion) => suggestion.id === 'friendcount-source-unavailable')).toMatchObject({
      status: 'unavailable',
      evidence: ['friendCount: source unavailable'],
    });
    expect(JSON.stringify(suggestions)).not.toContain('friendCount: 0');
  });

  it('does not introduce private runtime, analytics, queue, campaign, or truth-success fields', () => {
    const suggestions = deriveMaintenanceSuggestions({
      persona: basePersona,
      creativeHistory: [creativeCandidate],
      localPostSchedule: localSchedule,
    });
    const keys = collectKeys(suggestions);

    expect(keys.has('worldId')).toBe(false);
    expect(keys.has('authorId')).toBe(false);
    expect(keys.has('scheduleId')).toBe(false);
    expect(keys.has('queue')).toBe(false);
    expect(keys.has('campaign')).toBe(false);
    expect(keys.has('recurrence')).toBe(false);
    expect(keys.has('analytics')).toBe(false);
    expect(keys.has('publishSuccess')).toBe(false);
    expect(keys.has('localAgent')).toBe(false);
    expect(JSON.stringify(suggestions)).not.toContain('LocalAgent');
    expect(JSON.stringify(suggestions)).not.toContain('transcript');
    expect(JSON.stringify(suggestions)).not.toContain('profile view');
  });
});
