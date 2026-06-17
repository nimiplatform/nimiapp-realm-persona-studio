import { beforeEach, describe, expect, it } from 'vitest';
import { resetStudioAIConfigForTest } from './portfolio-client.test-helpers.js';
import {
  RAW_RULE_REVIEW_DEFERRED_REASON,
  assertNoForbiddenOwnerSettingsFields,
  applyRuntimeOwnerSettingsProposal,
  buildRealmOwnerPersonaSettingsUpdateInput,
  buildRuntimeOwnerSettingsProposalPrompt,
  createOwnerPersonaSettingsDraft,
  normalizeOwnerPersonaSettingsDraft,
  normalizeRuntimeOwnerSettingsProposal,
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

beforeEach(() => {
  resetStudioAIConfigForTest();
});

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

  it('builds an UpdateOwnerPersonaSettingsDto diff and excludes raw rule text', () => {
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
        identity: {
          worldview: 'The world is layered and negotiated.',
        },
        personality: {
          interests: ['strategy', 'tea', 'ruins'],
        },
        communication: {
          formality: 'formal',
        },
      },
    });
    expect(JSON.stringify(result.input)).not.toContain('Visible rule candidate only.');
    expect(result.ok ? result.preview.rawRuleReview?.reason : '').toBe(RAW_RULE_REVIEW_DEFERRED_REASON);
    expect(result.ok ? result.preview.submitted : {}).not.toHaveProperty('profileCoverUrl');
    expect(result.ok ? result.preview.submitted : {}).not.toHaveProperty('personaRules');
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

  it('rejects invalid enum values before Realm submission', () => {
    expect(buildRealmOwnerPersonaSettingsUpdateInput({
      ...createOwnerPersonaSettingsDraft(settings),
      formality: 'robotic',
    }, settings)).toMatchObject({
      ok: false,
      failure: 'owner-settings-invalid',
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

  it('builds a Runtime text proposal request from owner intent without hardcoded provider fields', () => {
    const draft = {
      ...createOwnerPersonaSettingsDraft(settings),
      naturalLanguageIntent: 'Make Mira warmer and clearer for builders.',
    };
    const result = buildRuntimeOwnerSettingsProposalPrompt({
      personaId: 'persona-1',
      current: settings,
      draft,
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      request: {
        model: { modelId: 'auto' },
        parameters: {
          metadata: {
            domain: 'realm-persona-studio.settings-proposal',
          },
        },
      },
    });
    const userText = result.payload?.request.messages
      .find((message) => message.role === 'user')
      ?.content.find((part) => part.type === 'text')?.text || '';
    expect(userText).not.toContain('provider');
    expect(userText).not.toContain('LocalAgent');
  });

  it('normalizes Runtime proposal JSON into admitted draft fields only', () => {
    const baseDraft = createOwnerPersonaSettingsDraft(settings);
    const proposal = normalizeRuntimeOwnerSettingsProposal(JSON.stringify({
      description: 'Warmer public strategist.',
      worldview: 'Layered world with practical entry points.',
      contentStyle: 'Warm, clear, and concise.',
      allowedThemesText: ['adventure', 'friendship'],
      responseLength: 'short',
      rationale: 'Matches the owner request.',
    }), baseDraft);

    expect(proposal).toMatchObject({
      candidate: true,
      truthWrite: false,
      changedSettingKeys: ['description', 'worldview', 'contentStyle', 'allowedThemesText', 'responseLength'],
      draftPatch: {
        description: 'Warmer public strategist.',
        allowedThemesText: 'adventure, friendship',
        responseLength: 'short',
      },
    });
    expect(applyRuntimeOwnerSettingsProposal(baseDraft, proposal)).toMatchObject({
      description: 'Warmer public strategist.',
      worldview: 'Layered world with practical entry points.',
      contentStyle: 'Warm, clear, and concise.',
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
    }), baseDraft)).toThrow('invalid responseLength');
  });

  it('rejects Runtime proposals wrapped in prose or carrying unknown fields', () => {
    const baseDraft = createOwnerPersonaSettingsDraft(settings);
    expect(() => normalizeRuntimeOwnerSettingsProposal(`\`\`\`json\n${JSON.stringify({
      description: 'Allowed text.',
    })}\n\`\`\``, baseDraft)).toThrow('single JSON object');
    expect(() => normalizeRuntimeOwnerSettingsProposal(JSON.stringify({
      description: 'Allowed text.',
      personaRule: 'not admitted',
    }), baseDraft)).toThrow('unknown field personaRule');
  });
});
