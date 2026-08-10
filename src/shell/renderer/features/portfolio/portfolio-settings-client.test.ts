import { describe, expect, it, vi } from 'vitest';
import {
  buildPersonaChatReadinessProjectionInput,
  buildRealmUpdateVisibilityInput,
  buildRuntimeProjectionInput,
  createPersonaVisibilityDraft,
  getOwnerPersonaSettings,
  getPersonaVisibilitySettings,
  getPortfolioPersonaSettings,
  normalizePersonaChatReadinessProjectionSummary,
  normalizeRuntimeProjectionSummary,
  projectPersonaRuntimeContextSummary,
  proposeReviewedOwnerPersonaSettings,
  updateReviewedOwnerPersonaSettings,
  updateReviewedPersonaVisibility,
  updateReviewedPortfolioPersonaSettings,
  type PersonaVisibilityDraft,
  type RealmOwnerPersonaSettings,
  type RealmPersonaVisibilitySettings,
} from './portfolio-settings-client.js';
import { createOwnerPersonaSettingsDraft } from './setting-proposal.js';
import {
  collectKeys,
  ownerPersonaDetail,
  ownerPersonaDetailWithWorldId,
  persona,
} from './portfolio-client.test-helpers.js';
import type { StudioTextCandidateRunner } from './studio-text-candidate.js';

function currentSettings(): RealmOwnerPersonaSettings {
  return {
    id: persona.id,
    contentHash: persona.contentHash,
    homeWorldId: persona.worldId,
    visibility: persona.visibility,
    origin: persona.origin,
    core: persona.profile as unknown as Record<string, unknown>,
    displayName: 'Mira',
    description: 'Artifact review guide.',
    greeting: null,
    naturalLanguageIntent: null,
    identity: { publicRole: 'Guide' },
    personality: {},
    communication: {},
    boundaries: {},
    positioning: {},
  };
}

const visibility: RealmPersonaVisibilitySettings = {
  defaultPostVisibility: 'PUBLIC',
  dmVisibility: 'FRIENDS',
  profileVisibility: 'PUBLIC',
};

describe('owner portfolio settings client', () => {
  it('fails closed for all Persona settings and visibility reads and writes', async () => {
    const settings = currentSettings();
    const ownerDraft = createOwnerPersonaSettingsDraft(settings);
    const visibilityDraft = createPersonaVisibilityDraft(visibility);
    const detail = ownerPersonaDetail();
    const operations = [
      getPersonaVisibilitySettings('persona-1'),
      getOwnerPersonaSettings('persona-1'),
      getPortfolioPersonaSettings(detail),
      updateReviewedPersonaVisibility('persona-1', visibilityDraft, visibility),
      updateReviewedOwnerPersonaSettings('persona-1', ownerDraft, settings),
      updateReviewedPortfolioPersonaSettings(detail, ownerDraft, settings),
    ];

    for (const operation of operations) {
      await expect(operation).rejects.toMatchObject({
        reasonCode: 'capability-unavailable',
        actionHint: 'retry_when_platform_surface_available',
      });
    }
  });

  it('builds changed visibility fields without transport or lifecycle state', () => {
    const draft: PersonaVisibilityDraft = {
      ...createPersonaVisibilityDraft(visibility),
      dmVisibility: 'PRIVATE',
      profileVisibility: 'FRIENDS',
    };

    expect(buildRealmUpdateVisibilityInput(draft, visibility)).toEqual({
      input: {
        dmVisibility: 'PRIVATE',
        profileVisibility: 'FRIENDS',
      },
      errors: [],
    });
    expect(buildRealmUpdateVisibilityInput(createPersonaVisibilityDraft(visibility), visibility)).toEqual({
      input: null,
      errors: ['visibility settings have no reviewed changes'],
    });
  });

  it('uses the injected text candidate runner for owner-reviewed proposals only', async () => {
    const settings = currentSettings();
    const draft = {
      ...createOwnerPersonaSettingsDraft(settings),
      naturalLanguageIntent: 'Make Mira warmer for builders.',
    };
    const runner = vi.fn(async (prompt: Parameters<StudioTextCandidateRunner>[0]) => ({
      text: JSON.stringify({
        description: 'Warmer strategist for builders.',
        contentStyle: 'Warm and concise.',
        rationale: 'Owner asked for a warmer public presentation.',
      }),
      finishReason: 'stop' as const,
      traceId: 'trace-settings',
      submitted: prompt,
    }));

    const result = await proposeReviewedOwnerPersonaSettings('persona-1', draft, settings, runner);

    expect(runner).toHaveBeenCalledOnce();
    expect(runner.mock.calls[0]?.[0]).toMatchObject({
      surfaceId: 'realm-persona-studio.settings-proposal',
      params: { maxTokens: 900, temperature: 0.2, topP: 1 },
    });
    expect(result).toMatchObject({
      ok: true,
      candidate: true,
      truthWrite: false,
      proposal: {
        draftPatch: {
          description: 'Warmer strategist for builders.',
          contentStyle: 'Warm and concise.',
        },
      },
    });
  });

  it('does not call the candidate runner when owner intent is empty', async () => {
    const settings = currentSettings();
    const runner = vi.fn<StudioTextCandidateRunner>();

    const result = await proposeReviewedOwnerPersonaSettings('persona-1', {
      ...createOwnerPersonaSettingsDraft(settings),
      naturalLanguageIntent: '',
    }, settings, runner);

    expect(runner).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      failure: 'runtime-settings-proposal-payload-invalid',
    });
  });

  it('keeps Runtime projection local and fail-closed without source evidence', async () => {
    const detail = ownerPersonaDetail();
    const unavailable = await projectPersonaRuntimeContextSummary({
      ...detail,
      homeWorldId: '',
    });

    expect(buildRuntimeProjectionInput({ ...detail, id: '' })).toBeNull();
    expect(buildRuntimeProjectionInput({ ...detail, homeWorldId: '' })).toBeNull();
    expect(buildRuntimeProjectionInput({ ...detail, contentHash: '' })).toBeNull();
    expect(unavailable).toMatchObject({
      ok: false,
      failure: 'runtime-projection-world-unavailable',
      submitted: null,
    });
  });

  it('normalizes projection summaries without raw source content', () => {
    const summary = normalizeRuntimeProjectionSummary({
      sourceWorldId: 'world-1',
      packetHash: 'checksum-1',
      payload: { worldRules: [{ statement: 'world raw' }] },
    });
    const chatSummary = normalizePersonaChatReadinessProjectionSummary({
      sourceWorldId: 'world-1',
      sourceId: 'persona-1',
      packetHash: 'checksum-1',
      payload: { 'communication.contentStyle': 'must stay hidden' },
    });

    expect(summary).toMatchObject({
      worldId: 'world-1',
      checksum: 'checksum-1',
      rawRuleContentExposed: false,
    });
    expect(chatSummary).toMatchObject({
      personaId: 'persona-1',
      selectedOwnerSettingFields: ['communication.contentStyle'],
      rawRuleContentExposed: false,
    });
    expect(collectKeys(summary).has('statement')).toBe(false);
    expect(collectKeys(chatSummary).has('contentStyle')).toBe(false);
    expect(buildPersonaChatReadinessProjectionInput(ownerPersonaDetailWithWorldId())).toMatchObject({
      sourceRef: { kind: 'realmPersona', worldId: 'world-oasis' },
    });
  });
});
