import { describe, expect, it } from 'vitest';
import {
  RAW_RULE_REVIEW_DEFERRED_REASON,
  assertNoForbiddenOwnerSettingsFields,
  applyRuntimeOwnerSettingsProposal,
  buildRealmOwnerPersonaSettingsUpdateInput,
  buildRuntimeOwnerSettingsProposalPrompt,
  createOwnerPersonaSettingsDraft,
  normalizeOwnerPersonaSettingsDraft,
  normalizeRuntimeOwnerSettingsProposal,
  partitionConsistencySuggestions,
  type OwnerPersonaSettingsSnapshot,
} from './setting-proposal.js';

const settings: OwnerPersonaSettingsSnapshot = {
  displayName: 'Mira',
  description: 'Quiet strategist',
  greeting: 'Welcome in.',
  naturalLanguageIntent: null,
  identity: {
    publicRole: 'Guide',
    worldview: 'The world is layered.',
  },
  personality: {
    summary: 'Patient and practical.',
    relationshipMode: 'mentor',
    interests: ['strategy', 'tea'],
    goals: ['keep lore coherent'],
  },
  communication: {
    contentStyle: 'Concise.',
    formality: 'casual',
    responseLength: 'medium',
    sentiment: 'neutral',
  },
  boundaries: {
    allowedThemes: ['adventure'],
    disallowedThemes: ['gore'],
  },
  positioning: {
    targetAudience: 'builders',
    positioning: 'operational guide',
  },
};

describe('owner settings proposal normalization', () => {
  it('creates an editable draft from owner settings DTO shape', () => {
    expect(createOwnerPersonaSettingsDraft(settings)).toMatchObject({
      displayName: 'Mira',
      description: 'Quiet strategist',
      publicRole: 'Guide',
      interestsText: 'strategy, tea',
      allowedThemesText: 'adventure',
      rawRuleTextCandidate: '',
    });
  });

  it('normalizes text, enums, and list fields without introducing hidden keys', () => {
    expect(normalizeOwnerPersonaSettingsDraft({
      ...createOwnerPersonaSettingsDraft(settings),
      displayName: '  Mira   Prime  ',
      interestsText: 'strategy, ruins\ntea',
      allowedThemesText: ' adventure, friendship ',
      rawRuleTextCandidate: '  Keep replies practical.\r\nAvoid spoilers.  ',
    })).toMatchObject({
      displayName: 'Mira Prime',
      interests: ['strategy', 'ruins', 'tea'],
      allowedThemes: ['adventure', 'friendship'],
      rawRuleTextCandidate: 'Keep replies practical.\nAvoid spoilers.',
    });
  });

  it('builds only native PersonaCharacter profile changes and excludes local creative fields', () => {
    const result = buildRealmOwnerPersonaSettingsUpdateInput({
      ...createOwnerPersonaSettingsDraft(settings),
      displayName: 'Mira Prime',
      worldview: 'The world is layered and negotiated.',
      interestsText: 'strategy, tea, ruins',
      formality: 'formal',
      rawRuleTextCandidate: 'Visible rule candidate only.',
    }, settings);

    expect(result).toMatchObject({
      ok: true,
      changed: true,
      input: {
        displayName: 'Mira Prime',
      },
    });
    expect(JSON.stringify(result.input)).not.toContain('Visible rule candidate only.');
    expect(result.ok ? result.preview.rawRuleReview?.reason : '').toBe(RAW_RULE_REVIEW_DEFERRED_REASON);
    expect(result.ok ? result.preview.submitted : {}).not.toHaveProperty('profileCoverUrl');
    expect(result.ok ? result.preview.submitted : {}).not.toHaveProperty('personaRules');
  });

  it('submits an owner-reviewed handle normalized to profile.identity.handle', () => {
    const withHandle: OwnerPersonaSettingsSnapshot = { ...settings, handle: 'mira' };
    const result = buildRealmOwnerPersonaSettingsUpdateInput({
      ...createOwnerPersonaSettingsDraft(withHandle),
      handle: '  @Mira-Prime  ',
    }, withHandle);

    expect(result).toMatchObject({
      ok: true,
      changed: true,
      input: { handle: 'mira-prime' },
    });
  });

  it('clears an owner-reviewed handle to null without a forbidden-field rejection', () => {
    const withHandle: OwnerPersonaSettingsSnapshot = { ...settings, handle: 'mira' };
    const result = buildRealmOwnerPersonaSettingsUpdateInput({
      ...createOwnerPersonaSettingsDraft(withHandle),
      handle: '',
    }, withHandle);

    expect(result).toMatchObject({
      ok: true,
      changed: true,
      input: { handle: null },
    });
  });

  it('submits a reviewed home-world change and rejects an empty one', () => {
    const withWorld: OwnerPersonaSettingsSnapshot = { ...settings, homeWorldId: 'world-oasis' };
    expect(buildRealmOwnerPersonaSettingsUpdateInput({
      ...createOwnerPersonaSettingsDraft(withWorld),
      worldId: 'world-eden',
    }, withWorld)).toMatchObject({
      ok: true,
      changed: true,
      input: { worldId: 'world-eden' },
    });
    expect(buildRealmOwnerPersonaSettingsUpdateInput({
      ...createOwnerPersonaSettingsDraft(withWorld),
      worldId: '   ',
    }, withWorld)).toMatchObject({
      ok: false,
      failure: 'owner-settings-invalid',
      errors: ['worldId cannot be empty because PersonaCharacter replace requires a home world'],
      input: null,
    });
  });

  it('fails closed when only raw rule review changed', () => {
    expect(buildRealmOwnerPersonaSettingsUpdateInput({
      ...createOwnerPersonaSettingsDraft(settings),
      rawRuleTextCandidate: 'Only raw rule review.',
    }, settings)).toMatchObject({
      ok: false,
      failure: 'raw-rule-review-deferred',
      errors: [RAW_RULE_REVIEW_DEFERRED_REASON],
      input: null,
    });
  });

  it('keeps legacy creative enum fields local instead of submitting them', () => {
    expect(buildRealmOwnerPersonaSettingsUpdateInput({
      ...createOwnerPersonaSettingsDraft(settings),
      formality: 'robotic',
    }, settings)).toMatchObject({
      ok: false,
      failure: 'owner-settings-no-changes',
      input: null,
    });
  });

  it('detects forbidden owner settings fields recursively', () => {
    expect(assertNoForbiddenOwnerSettingsFields({
      submitted: {
        provider: 'forbidden',
      },
    })).toBe('provider');
    expect(assertNoForbiddenOwnerSettingsFields({
      submitted: {
        profileCoverUrl: 'https://cdn.example.test/cover.png',
      },
    })).toBe('profileCoverUrl');
    expect(assertNoForbiddenOwnerSettingsFields({
      submitted: {
        identity: {
          worldview: 'Allowed',
        },
      },
    })).toBeNull();
  });

  it('builds a text candidate prompt from owner intent without hardcoded provider fields', () => {
    const draft = {
      ...createOwnerPersonaSettingsDraft(settings),
      naturalLanguageIntent: 'Make Mira warmer and clearer for builders.',
    };
    const result = buildRuntimeOwnerSettingsProposalPrompt({
      personaId: 'persona-1',
      current: {
        ...settings,
        contentHash: 'private-canonical-hash',
        profile: { profileHash: 'private-profile-hash' },
      } as OwnerPersonaSettingsSnapshot,
      draft,
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      surfaceId: 'realm-persona-studio.settings-proposal',
      params: {
        maxTokens: 900,
        temperature: 0.2,
        topP: 1,
      },
    });
    const userText = result.payload?.userText || '';
    expect(userText).not.toContain('provider');
    expect(userText).not.toContain('LocalAgent');
    expect(userText).not.toContain('contentHash');
    expect(userText).not.toContain('profileHash');
    expect(userText).not.toContain('publicRole');
  });

  it('normalizes Runtime proposal JSON into supported draft fields only', () => {
    const baseDraft = createOwnerPersonaSettingsDraft(settings);
    const proposal = normalizeRuntimeOwnerSettingsProposal(JSON.stringify({
      description: 'Warmer public strategist.',
      rationale: 'Matches the owner intent.',
    }), baseDraft);

    expect(proposal).toMatchObject({
      candidate: true,
      truthWrite: false,
      changedSettingKeys: ['description'],
      draftPatch: {
        description: 'Warmer public strategist.',
      },
    });
    expect(applyRuntimeOwnerSettingsProposal(baseDraft, proposal)).toMatchObject({
      description: 'Warmer public strategist.',
    });
  });

  it('rejects Runtime proposals with forbidden or invalid setting fields', () => {
    const baseDraft = createOwnerPersonaSettingsDraft(settings);
    expect(() => normalizeRuntimeOwnerSettingsProposal(JSON.stringify({
      model: 'forbidden',
      description: 'Allowed text.',
    }), baseDraft)).toThrow('unknown field model');
    expect(() => normalizeRuntimeOwnerSettingsProposal(JSON.stringify({
      responseLength: 'endless',
    }), baseDraft)).toThrow('unknown field responseLength');
  });

  it('rejects Runtime proposals wrapped in prose or carrying unknown fields', () => {
    const baseDraft = createOwnerPersonaSettingsDraft(settings);
    expect(() => normalizeRuntimeOwnerSettingsProposal(`\`\`\`json\n${JSON.stringify({
      description: 'Allowed text.',
    })}\n\`\`\``, baseDraft)).toThrow('single JSON object');
    expect(() => normalizeRuntimeOwnerSettingsProposal(JSON.stringify({
      description: 'Allowed text.',
      personaRule: 'unsupported',
    }), baseDraft)).toThrow('unknown field personaRule');
  });
});

describe('partitionConsistencySuggestions', () => {
  it('keeps editable profile fields visible', () => {
    expect(partitionConsistencySuggestions({
      displayName: 'New name',
      description: 'New description',
      greeting: 'New greeting',
    })).toEqual({
      visible: {
        displayName: 'New name',
        description: 'New description',
        greeting: 'New greeting',
      },
      deferredKeys: [],
    });
  });

  it('defers patch keys without a visible settings field', () => {
    expect(partitionConsistencySuggestions({
      greeting: 'New greeting',
      rawRuleTextCandidate: 'Rule text',
      publicRole: 'Guide',
    })).toEqual({
      visible: { greeting: 'New greeting' },
      deferredKeys: ['rawRuleTextCandidate', 'publicRole'],
    });
  });

  it('skips undefined patch values and empty patches', () => {
    expect(partitionConsistencySuggestions({
      displayName: undefined,
      description: 'New description',
    })).toEqual({
      visible: { description: 'New description' },
      deferredKeys: [],
    });
    expect(partitionConsistencySuggestions({})).toEqual({ visible: {}, deferredKeys: [] });
  });
});
