import { beforeEach, describe, expect, it, vi } from 'vitest';

const personaCharacter = vi.hoisted(() => ({
  getOwned: vi.fn(),
  replace: vi.fn(),
  toProfileInput: vi.fn(),
}));

vi.mock('@renderer/app-shell/studio-platform.js', () => ({
  getStudioLocalAppClient: () => ({ realm: { personaCharacter } }),
}));

import {
  buildRealmUpdateVisibilityInput,
  createPersonaVisibilityDraft,
  getOwnerPersonaSettings,
  getPersonaVisibilitySettings,
  getPortfolioPersonaSettings,
  proposeReviewedOwnerPersonaSettings,
  updateReviewedOwnerPersonaSettings,
  updateReviewedPersonaVisibility,
  type RealmOwnerPersonaSettings,
  type RealmPersonaVisibilitySettings,
} from './portfolio-settings-client.js';
import { createOwnerPersonaSettingsDraft } from './setting-proposal.js';
import {
  ownerPersonaDetail,
  persona,
} from './portfolio-client.test-helpers.js';
import type { StudioTextCandidateRunner } from './studio-text-candidate.js';

function profileInput() {
  const { profileHash: _profileHash, profileCoverage: _profileCoverage, ...input } = persona.profile;
  return input;
}

function currentSettings(): RealmOwnerPersonaSettings {
  return {
    id: persona.id,
    contentHash: persona.contentHash,
    homeWorldId: persona.worldId,
    visibility: persona.visibility,
    origin: persona.origin,
    profile: persona.profile,
    persona,
    lorebookDeclaration: persona.lorebookDeclaration,
    displayName: 'Mira',
    description: 'Quiet strategist',
    greeting: 'Welcome in.',
    handle: 'mira',
  };
}

const visibility: RealmPersonaVisibilitySettings = { visibility: 'public', persona };

describe('owner PersonaCharacter settings client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    personaCharacter.getOwned.mockResolvedValue(persona);
    personaCharacter.toProfileInput.mockImplementation(profileInput);
    personaCharacter.replace.mockImplementation(async (input) => ({
      ...persona,
      contentHash: 'e'.repeat(64),
      contentRevision: 2,
      visibility: input.visibility,
      profile: { ...input.profile, profileHash: 'f'.repeat(64), profileCoverage: persona.profile.profileCoverage },
    }));
  });

  it('reads native settings and canonical visibility through getOwned', async () => {
    await expect(getPersonaVisibilitySettings('persona-1')).resolves.toMatchObject({ visibility: 'public' });
    await expect(getOwnerPersonaSettings('persona-1')).resolves.toMatchObject({
      displayName: 'Mira',
      description: 'Quiet strategist',
      greeting: 'Welcome in.',
    });
    await expect(getPortfolioPersonaSettings(ownerPersonaDetail())).resolves.toMatchObject({ id: 'persona-1' });
    expect(personaCharacter.getOwned).toHaveBeenCalledTimes(3);
  });

  it('builds one canonical lowercase visibility update', () => {
    expect(buildRealmUpdateVisibilityInput({ visibility: 'unlisted' }, visibility)).toEqual({
      input: { visibility: 'unlisted' },
      errors: [],
    });
    expect(buildRealmUpdateVisibilityInput(createPersonaVisibilityDraft(visibility), visibility)).toEqual({
      input: null,
      errors: ['visibility settings have no reviewed changes'],
    });
    expect(buildRealmUpdateVisibilityInput({ visibility: 'FRIENDS' }, visibility)).toEqual({
      input: null,
      errors: ['visibility must be private, unlisted, or public'],
    });
    expect(buildRealmUpdateVisibilityInput(
      { visibility: 'public' },
      { visibility: 'system', persona: { ...persona, visibility: 'system' } },
    )).toEqual({
      input: null,
      errors: ['system visibility is read-only'],
    });
  });

  it('replaces visibility with toProfileInput and the latest canonical hash', async () => {
    const result = await updateReviewedPersonaVisibility('persona-1', { visibility: 'unlisted' }, visibility);

    expect(personaCharacter.toProfileInput).toHaveBeenCalledWith(persona.profile);
    expect(personaCharacter.replace).toHaveBeenCalledWith({
      personaCharacterId: 'persona-1',
      baseContentHash: persona.contentHash,
      worldId: persona.worldId,
      visibility: 'unlisted',
      origin: persona.origin,
      lorebookDeclaration: persona.lorebookDeclaration,
      profile: profileInput(),
    });
    expect(result).toMatchObject({ ok: true, settings: { visibility: 'unlisted' } });
  });

  it('writes only native profile fields and never restores bare extensions', async () => {
    const settings = currentSettings();
    const draft = {
      ...createOwnerPersonaSettingsDraft(settings),
      displayName: 'Mira Prime',
      description: 'Owner-reviewed native summary.',
      greeting: 'Welcome back.',
    };

    const result = await updateReviewedOwnerPersonaSettings('persona-1', draft, settings);
    const submitted = personaCharacter.replace.mock.calls[0]?.[0];

    expect(result.ok).toBe(true);
    expect(personaCharacter.toProfileInput).toHaveBeenCalledWith(persona.profile);
    expect(submitted.profile.presentation.displayName).toBe('Mira Prime');
    expect(submitted.profile.identity.summary).toBe('Owner-reviewed native summary.');
    expect(submitted.profile.interactionProfile.greeting).toBe('Welcome back.');
    expect(JSON.stringify(submitted.profile)).not.toContain('ownerSettings');
    expect(JSON.stringify(submitted.profile)).not.toContain('socialVisibility');
    expect(JSON.stringify(submitted.profile)).not.toContain('must remain local');
  });

  it('writes a reviewed handle change and home-world change through replace', async () => {
    const settings = currentSettings();
    const draft = {
      ...createOwnerPersonaSettingsDraft(settings),
      handle: ' @Mira-Prime ',
      worldId: 'world-eden',
    };

    const result = await updateReviewedOwnerPersonaSettings('persona-1', draft, settings);
    const submitted = personaCharacter.replace.mock.calls[0]?.[0];

    expect(result.ok).toBe(true);
    expect(submitted.worldId).toBe('world-eden');
    expect(submitted.profile.identity.handle).toBe('mira-prime');
  });

  it('drops identity.handle from the replacement profile when the owner clears it', async () => {
    const settings = currentSettings();
    const draft = {
      ...createOwnerPersonaSettingsDraft(settings),
      handle: '',
    };

    const result = await updateReviewedOwnerPersonaSettings('persona-1', draft, settings);
    const submitted = personaCharacter.replace.mock.calls[0]?.[0];

    expect(result.ok).toBe(true);
    expect(submitted.profile.identity).not.toHaveProperty('handle');
    expect(submitted.worldId).toBe(persona.worldId);
  });

  it('preserves sanitized content-conflict without upstream text', async () => {
    personaCharacter.replace.mockRejectedValue(Object.assign(new Error('private Realm body'), {
      reasonCode: 'content-conflict',
    }));
    const result = await updateReviewedPersonaVisibility('persona-1', { visibility: 'unlisted' }, visibility);

    expect(result).toMatchObject({ ok: false, failure: 'content-conflict', message: 'content-conflict' });
    expect(JSON.stringify(result)).not.toContain('private Realm body');
  });

  it('sanitizes profile roundtrip failures before replace transport', async () => {
    personaCharacter.toProfileInput.mockImplementationOnce(() => {
      throw Object.assign(new Error('private profile detail'), { reasonCode: 'contract-invalid' });
    });

    const result = await updateReviewedPersonaVisibility('persona-1', { visibility: 'unlisted' }, visibility);

    expect(result).toMatchObject({ ok: false, failure: 'contract-invalid', message: 'contract-invalid' });
    expect(personaCharacter.replace).not.toHaveBeenCalled();
  });

  it('rejects settings and visibility writes when the current detail belongs to another persona', async () => {
    const mismatchedSettings = await updateReviewedOwnerPersonaSettings(
      'persona-2',
      { ...createOwnerPersonaSettingsDraft(currentSettings()), displayName: 'Mira Prime' },
      currentSettings(),
    );
    const mismatchedVisibility = await updateReviewedPersonaVisibility(
      'persona-2',
      { visibility: 'unlisted' },
      visibility,
    );

    expect(mismatchedSettings).toMatchObject({ ok: false, failure: 'invalid-input', submitted: null });
    expect(mismatchedVisibility).toMatchObject({ ok: false, failure: 'invalid-input', submitted: null });
    expect(personaCharacter.replace).not.toHaveBeenCalled();
  });

  it('uses the injected text candidate runner for native profile proposals only', async () => {
    const settings = currentSettings();
    const draft = {
      ...createOwnerPersonaSettingsDraft(settings),
      naturalLanguageIntent: 'Make Mira warmer for builders.',
    };
    const runner = vi.fn(async (prompt: Parameters<StudioTextCandidateRunner>[0]) => ({
      text: JSON.stringify({
        description: 'Warmer strategist for builders.',
        rationale: 'Owner asked for a warmer public presentation.',
      }),
      finishReason: 'stop' as const,
      traceId: 'trace-settings',
      submitted: prompt,
    }));

    const result = await proposeReviewedOwnerPersonaSettings('persona-1', draft, settings, runner);

    expect(result).toMatchObject({
      ok: true,
      candidate: true,
      truthWrite: false,
      proposal: { draftPatch: { description: 'Warmer strategist for builders.' } },
    });
  });

});

it('does not replace a character changed in Realm while its owner was editing', async () => {
  personaCharacter.replace.mockClear();
  personaCharacter.getOwned.mockResolvedValue({ ...persona, contentHash: '9'.repeat(64) });
  const settings = currentSettings();
  const draft = { ...createOwnerPersonaSettingsDraft(settings), greeting: 'An unsaved greeting.' };
  const result = await updateReviewedOwnerPersonaSettings(persona.id, draft, settings);
  expect(result).toMatchObject({ ok: false, failure: 'content-conflict', draft: { greeting: 'An unsaved greeting.' } });
  expect(personaCharacter.replace).not.toHaveBeenCalled();
});

it('replaces a reviewed declaration with the latest complete profile, preserving unrelated source fields', async () => {
  personaCharacter.getOwned.mockResolvedValue(persona);
  personaCharacter.toProfileInput.mockImplementation(profileInput);
  personaCharacter.replace.mockImplementation(async (input) => ({ ...persona, contentHash: '8'.repeat(64), contentRevision: 2, lorebookDeclaration: input.lorebookDeclaration }));
  const settings = currentSettings();
  const result = await updateReviewedOwnerPersonaSettings(persona.id, { ...createOwnerPersonaSettingsDraft(settings), speakingText: 'Short sentences.\nDry humor.' }, settings);
  expect(result.ok).toBe(true);
  expect(personaCharacter.replace).toHaveBeenLastCalledWith(expect.objectContaining({
    baseContentHash: persona.contentHash,
    profile: profileInput(),
    lorebookDeclaration: { ...persona.lorebookDeclaration, speaking: ['Short sentences.', 'Dry humor.'] },
  }));
});
