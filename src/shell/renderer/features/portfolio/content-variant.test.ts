import { describe, expect, it } from 'vitest';
import { buildContentVariantsFromPersona } from './content-variant.js';
import type { OwnerPortfolioPersonaDetail, SettingField } from './portfolio-data.js';
import type { LocalPostDraftInput } from './post-draft.js';

function field(key: SettingField['key'], label: string, value: string, status: SettingField['status'] = 'available'): SettingField {
  return {
    key,
    label,
    value,
    status,
    source: 'Realm WorldCoreController.getRealmPersona',
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
  bio: field('bio', 'Profile description', 'Reviews evidence before public action.'),
  greeting: field('greeting', 'Greeting', 'Bring the source material first.'),
  profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', ''),
  ownership: field('ownership', 'Ownership evidence', 'MASTER_OWNED'),
  world: field('world', 'World evidence', 'world-oasis'),
  state: field('state', 'State evidence', 'ACTIVE'),
  avatarUrl: null,
  friendCount: { status: 'available', value: 1 },
  ownerScope: 'owner-created',
  source: 'Realm WorldCoreController.getRealmPersona',
};

const draft: LocalPostDraftInput = {
  caption: '',
  tagsText: '',
  humanReviewed: false,
  attachmentEnabled: false,
  attachmentTargetType: 'RESOURCE',
  attachmentTargetId: '',
};

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (!value || typeof value !== 'object') return keys;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
}

describe('content variant board', () => {
  it('builds candidate-only post variants from current persona and owner intent', () => {
    const result = buildContentVariantsFromPersona(persona, draft, 'Announce the new artifact review pass.');

    expect(result.changed).toBe(true);
    if (!result.changed) return;
    expect(result.variants.map((variant) => variant.key)).toEqual([
      'announcement',
      'process-note',
      'conversation-starter',
    ]);
    expect(result.variants[0]?.tagsText).toBe('mira-prime, realm-persona, studio, update');
    expect(result.variants.every((variant) => variant.candidate && !variant.publicTruth)).toBe(true);
    expect(result.variants[0]?.reviewChecklist).toContain('optional READY Resource selected before publish');
    expect(collectKeys(result).has('worldId')).toBe(false);
    expect(collectKeys(result).has('authorId')).toBe(false);
    expect(collectKeys(result).has('scheduleId')).toBe(false);
  });

  it('fails closed without source-backed identity or owner/content anchor', () => {
    expect(buildContentVariantsFromPersona({
      ...persona,
      displayName: field('displayName', 'Display name', '', 'available-empty'),
      handle: field('handle', 'Handle', '', 'available-empty'),
      bio: field('bio', 'Profile description', '', 'available-empty'),
      greeting: field('greeting', 'Greeting', '', 'available-empty'),
    }, draft, '')).toEqual({
      changed: false,
      errors: [
        'persona identity source unavailable or empty',
        'owner intent, draft caption, profile description, or greeting required',
      ],
      source: 'realm-persona-studio.content-variant-board',
      variants: [],
    });
  });
});
