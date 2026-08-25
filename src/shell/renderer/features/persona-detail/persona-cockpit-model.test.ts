import { describe, expect, it } from 'vitest';
import { derivePersonaCockpitModel } from './persona-cockpit-model.js';
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

describe('Persona Cockpit model', () => {
  it('derives ready source-backed cockpit cards from complete persona detail', () => {
    const model = derivePersonaCockpitModel(basePersona);

    expect(model.cards.map((card) => [card.key, card.status])).toEqual([
      ['profile', 'ready'],
      ['ai-readiness', 'ready'],
      ['identity', 'ready'],
      ['content', 'ready'],
      ['adoption', 'ready'],
    ]);
    expect(model.actions.map((action) => action.key)).toEqual([
      'improve-settings',
      'generate-identity',
      'create-post',
      'review-visibility',
      'inspect-source',
    ]);
  });

  it('keeps unavailable source signals unavailable instead of zero-filling', () => {
    const model = derivePersonaCockpitModel({
      ...basePersona,
      friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
    });

    expect(model.unavailableSignals).toContain('friendCount');
    expect(model.cards.find((card) => card.key === 'adoption')).toMatchObject({
      status: 'unavailable',
      summary: 'friendCount source is unavailable; no fallback metric is shown.',
      evidence: ['friendCount: source unavailable'],
    });
  });

  it('recommends settings and identity work from missing source-backed fields', () => {
    const model = derivePersonaCockpitModel({
      ...basePersona,
      bio: field('bio', 'Profile description', '', 'available-empty'),
      greeting: field('greeting', 'Greeting', '', 'available-empty'),
      profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', '', 'available-empty'),
      avatarUrl: null,
      voice: undefined,
    });

    expect(model.missingSignals).toEqual(expect.arrayContaining([
      'profile description',
      'greeting',
      'profile cover URL',
      'avatar',
    ]));
    expect(model.cards.find((card) => card.key === 'profile')?.status).toBe('missing');
    expect(model.cards.find((card) => card.key === 'identity')?.actions).toEqual(['generate-identity']);
    expect(model.cards.find((card) => card.key === 'content')?.actions).toEqual(['create-post', 'improve-settings']);
  });
});
