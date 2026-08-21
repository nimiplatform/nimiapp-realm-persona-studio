import { describe, expect, it } from 'vitest';
import { buildIdentityPackFromPersona } from './identity-pack.js';
import type { OwnerPortfolioPersonaDetail, SettingField } from './portfolio-data.js';

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

const persona: OwnerPortfolioPersonaDetail = {
  id: 'persona-1',
  contentHash: 'hash-persona-1',
  contentRevision: 1,
  homeWorldId: 'world-oasis',
  displayName: field('displayName', 'Display name', 'Mira Prime'),
  handle: field('handle', 'Handle', 'mira-prime'),
  bio: field('bio', 'Profile description', 'A calm artifact review strategist.'),
  greeting: field('greeting', 'Greeting', 'Bring the source material first.'),
  profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', ''),
  ownership: field('ownership', 'Ownership evidence', 'MASTER_OWNED'),
  world: field('world', 'World evidence', 'world-oasis'),
  visibility: field('visibility', 'Visibility', 'public'),
  avatarUrl: null,
  friendCount: { status: 'available', value: 1 },
  ownerScope: 'owner-created',
  source: 'Nimi App Access realm.personaCharacter.getOwned',
};

describe('identity pack', () => {
  it('builds candidate-only identity outputs from source-backed persona fields', () => {
    const pack = buildIdentityPackFromPersona(persona);

    expect(pack.changed).toBe(true);
    if (!pack.changed) return;
    expect(pack.candidates.map((candidate) => candidate.key)).toEqual([
      'avatar',
      'profile-cover',
      'portrait-reference',
      'post-image-style',
      'voice-demo',
    ]);
    expect(pack.candidates.every((candidate) => candidate.reviewState === 'candidate-only')).toBe(true);
    expect(pack.candidates.find((candidate) => candidate.key === 'profile-cover')).toMatchObject({
      publicWrite: 'profile-cover-publication-unavailable',
      blockedReason: 'Nimi App Access does not provide owner-scoped profile cover publication yet.',
    });
    expect(pack.candidates.find((candidate) => candidate.key === 'portrait-reference')).toMatchObject({
      publicWrite: 'resource-persona-binding-unavailable',
    });
    expect(pack.candidates.find((candidate) => candidate.key === 'avatar')).toMatchObject({
      publicWrite: 'avatar-url-selection-unavailable',
      blockedReason: 'Nimi App Access does not provide Persona avatar selection yet.',
    });
  });

  it('fails closed when required source-backed identity text is missing', () => {
    expect(buildIdentityPackFromPersona({
      ...persona,
      displayName: field('displayName', 'Display name', '', 'available-empty'),
      bio: field('bio', 'Profile description', '', 'available-empty'),
      greeting: field('greeting', 'Greeting', '', 'available-empty'),
    })).toEqual({
      changed: false,
      errors: [
        'display name source unavailable or empty',
        'profile description or greeting required for identity pack',
      ],
      source: 'realm-persona-studio.identity-pack-from-current-persona',
      candidates: [],
    });
  });
});
