import { FinishReason, RoutePolicy } from '@nimiplatform/sdk/runtime/generated';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFinalizeDirectMediaResourceInput,
  buildPersonaChatReadinessProjectionInput,
  buildRealmCreatePersonaInput,
  buildRealmCreatePostInput,
  buildRealmPostTextResourceInput,
  buildRealmSelectAvatarInput,
  buildRealmUpdateVisibilityInput,
  buildRuntimeProjectionInput,
  checkCreateRealmPersonaHandleAvailability,
  createPersonaVisibilityDraft,
  createReviewedPostTextResource,
  createReviewedRealmPersona,
  generateReviewedVisualImageCandidate,
  getPersonaVisibilitySettings,
  getCreateRealmPersonaWorldPreview,
  getOwnerPersonaSettings,
  getPortfolioPersonaSettings,
  getOwnerPortfolioPersonaDetail,
  listCreateRealmPersonaSelectableWorlds,
  listOwnerPortfolioPersonas,
  listReadyPostAttachmentResources,
  normalizeFinalizedDirectMediaResource,
  normalizePostAttachmentResourceOptions,
  normalizeRealmPersonaAvatarSelectResult,
  normalizeRealmPersonaCreateResult,
  normalizeRealmPostPublishResult,
  normalizeRealmTextResourceCreateResult,
  normalizePersonaChatReadinessProjectionSummary,
  normalizeRuntimeProjectionSummary,
  projectPersonaChatReadinessContextSummary,
  projectPersonaRuntimeContextSummary,
  proposeReviewedOwnerPersonaSettings,
  proposeReviewedPortfolioPersonaSettings,
  proposeReviewedPostCopy,
  publishReviewedPostDraft,
  selectReviewedPersonaAvatarUrl,
  synthesizeReviewedVoiceDemo,
  updateReviewedPersonaVisibility,
  updateReviewedOwnerPersonaSettings,
  updateReviewedPortfolioPersonaSettings,
  uploadReviewedIdentityMediaResource,
  uploadReviewedPostMediaResource,
  type PersonaVisibilityDraft,
  type RealmPersonaVisibilitySettings,
} from './portfolio-client.js';
import { REALM_PERSONA_CREATE_SOURCE, type ReviewedCreateRealmPersonaPayload } from './create-persona-draft.js';
import { applyRuntimeOwnerSettingsProposal, createOwnerPersonaSettingsDraft } from './setting-proposal.js';
import {
  candidatePayload,
  collectKeys,
  configureStudioAIConfigTargetRefsForTest,
  createPayload,
  detailField,
  mockRealm,
  mockRuntimeWithRoutes,
  ownerPersonaDetail,
  ownerPersonaDetailWithWorldId,
  resetStudioAIConfigForTest,
} from './portfolio-client.test-helpers.js';

beforeEach(() => {
  resetStudioAIConfigForTest();
});

describe('owner portfolio settings client', () => {
     it('reads owner settings through WorldCoreController.getRealmPersona', async () => {
      const realm = mockRealm();
      const settings = await getOwnerPersonaSettings('persona-1', realm);

      expect(realm.worldCoreControllerGetPersonaCharacter).toHaveBeenCalledWith({
        path: { personaCharacterId: 'persona-1' },
      });
      expect(settings).toMatchObject({
        id: 'persona-1',
        contentHash: 'hash-persona-1',
        displayName: 'Mira',
        identity: {
          publicRole: 'Guide',
        },
      });
    });

     it('updates owner settings through WorldCoreController.replaceRealmPersona without raw rule payloads', async () => {
      const realm = mockRealm();
      const current = await getOwnerPersonaSettings('persona-1', realm);
      const draft = {
        ...createOwnerPersonaSettingsDraft(current),
        displayName: 'Mira Prime',
        worldview: 'Layered world with owner-reviewed framing.',
        interestsText: 'strategy, tea',
        rawRuleTextCandidate: 'Visible raw rule candidate must stay deferred.',
      };
      const result = await updateReviewedOwnerPersonaSettings('persona-1', draft, current, realm);
      const updateSettings = realm.worldCoreControllerReplacePersonaCharacter;
      const submittedRequest = vi.mocked(updateSettings).mock.calls[0]?.[0];
      const submittedPayload = submittedRequest?.body;

      expect(updateSettings).toHaveBeenCalledWith({
        path: { personaCharacterId: 'persona-1' },
        body: expect.objectContaining({
          baseContentHash: 'hash-persona-1',
          profile: expect.objectContaining({
            identity: expect.objectContaining({
              name: 'Mira Prime',
            }),
            presentation: expect.objectContaining({
              displayName: 'Mira Prime',
            }),
            authoring: expect.objectContaining({
              extensions: expect.objectContaining({
                ownerSettings: expect.objectContaining({
                  identity: expect.objectContaining({
                    worldview: 'Layered world with owner-reviewed framing.',
                  }),
                  personality: expect.objectContaining({
                    interests: ['strategy', 'tea'],
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      expect(collectKeys(submittedPayload).has('rawRuleTextCandidate')).toBe(false);
      expect(collectKeys(submittedPayload).has('ruleText')).toBe(false);
      expect(collectKeys(submittedPayload).has('personaRules')).toBe(false);
      expect(collectKeys(submittedPayload).has('profileCoverUrl')).toBe(false);
      expect(collectKeys(submittedPayload).has('provider')).toBe(false);
      expect(collectKeys(submittedPayload).has('model')).toBe(false);
      expect(result).toMatchObject({
        ok: true,
        source: 'Realm WorldCoreController.replaceRealmPersona',
        truthWrite: true,
        submitted: expect.objectContaining({
          baseContentHash: 'hash-persona-1',
        }),
        settings: {
          contentHash: 'hash-replaced',
        },
      });
    });

     it('uses Runtime text.generate for candidate owner settings proposals only', async () => {
      // Studio resolves a concrete Runtime route before dispatch; `auto` never
      // reaches ScenarioService.
      const realm = mockRealm();
      const current = await getOwnerPersonaSettings('persona-1', realm);
      const draft = {
        ...createOwnerPersonaSettingsDraft(current),
        naturalLanguageIntent: 'Make Mira warmer for builders.',
      };
      const executeScenario = vi.fn(async (_input: unknown) => ({
        output: {
          output: {
            oneofKind: 'textGenerate' as const,
            textGenerate: {
              text: JSON.stringify({
                description: 'Warmer strategist for builders.',
                contentStyle: 'Warm and concise.',
                rationale: 'Owner asked for a warmer public presentation.',
              }),
            },
          },
        },
        finishReason: FinishReason.STOP,
        routeDecision: RoutePolicy.UNSPECIFIED,
        modelResolved: 'runtime-default-text',
        traceId: 'trace-settings',
        ignoredExtensions: [],
      }));
      const runtime = mockRuntimeWithRoutes({
        executeScenario,
        routes: [{ capability: 'text.generate', model: 'runtime-default-text' }],
      });
      configureStudioAIConfigTargetRefsForTest({
        targetRefs: {
          'text.generate': 'runtime-default-text',
        },
      });

      const result = await proposeReviewedOwnerPersonaSettings('persona-1', draft, current, runtime);
      const submittedPayload = executeScenario.mock.calls[0]?.[0] as Record<string, unknown> | undefined;

      expect(executeScenario).toHaveBeenCalledTimes(1);
      expect(submittedPayload).toMatchObject({
        head: {
          modelId: 'runtime-default-text',
        },
        spec: {
          spec: {
            oneofKind: 'textGenerate',
          },
        },
      });
      expect(collectKeys(submittedPayload).has('provider')).toBe(false);
      const textGenerate = (submittedPayload?.spec as { spec?: { textGenerate?: { input?: unknown } } } | undefined)
        ?.spec?.textGenerate;
      const submittedUserInput = JSON.stringify(textGenerate?.input ?? []);
      expect(submittedUserInput).not.toContain('LocalAgent');
      expect(result).toMatchObject({
        ok: true,
        source: 'Runtime runtime.ai.text.generate',
        candidate: true,
        truthWrite: false,
        proposal: {
          draftPatch: {
            description: 'Warmer strategist for builders.',
            contentStyle: 'Warm and concise.',
          },
        },
        runtime: {
          traceId: 'trace-settings',
        },
      });
      expect(realm.worldCoreControllerReplacePersonaCharacter).not.toHaveBeenCalled();
    });

     it('fails closed for Runtime settings proposal when intent is missing', async () => {
      // Previously this test asserted "fails closed when model env is missing".
      // The route resolver is not reached when caller input is invalid; an
      // empty intent still trips `runtime-settings-proposal-payload-invalid`.
      const realm = mockRealm();
      const current = await getOwnerPersonaSettings('persona-1', realm);
      const runtime = mockRuntimeWithRoutes({
        executeScenario: vi.fn(),
        routes: [{ capability: 'text.generate', model: 'runtime-default-text' }],
      });

      const result = await proposeReviewedOwnerPersonaSettings('persona-1', {
        ...createOwnerPersonaSettingsDraft(current),
        naturalLanguageIntent: '',
      }, current, runtime);

      expect(runtime.ai.executeScenario).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        source: 'Runtime runtime.ai.text.generate',
        candidate: false,
        truthWrite: false,
        failure: 'runtime-settings-proposal-payload-invalid',
        message: 'natural-language setting intent missing',
      });
      vi.unstubAllEnvs();
    });

     it('fails closed before owner settings PATCH when there are no admitted changes', async () => {
      const realm = mockRealm();
      const current = await getOwnerPersonaSettings('persona-1', realm);
      const result = await updateReviewedOwnerPersonaSettings('persona-1', {
        ...createOwnerPersonaSettingsDraft(current),
        rawRuleTextCandidate: 'Only raw rule review.',
      }, current, realm);

      expect(realm.worldCoreControllerReplacePersonaCharacter).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        source: 'Realm WorldCoreController.replaceRealmPersona',
        truthWrite: false,
        failure: 'owner-settings-no-changes',
        submitted: null,
      });
    });

     it('reads owner visibility through WorldCoreController.getRealmPersona', async () => {
      const realm = mockRealm();
      const settings = await getPersonaVisibilitySettings('persona-1', realm);

      expect(realm.worldCoreControllerGetPersonaCharacter).toHaveBeenCalledWith({
        path: { personaCharacterId: 'persona-1' },
      });
      expect(settings).toEqual({
        defaultPostVisibility: 'PUBLIC',
        dmVisibility: 'FRIENDS',
        profileVisibility: 'PUBLIC',
      });
    });

     it('updates owner visibility through WorldCoreController.replaceRealmPersona with changed allowlisted fields only', async () => {
      const realm = mockRealm();
      const current: RealmPersonaVisibilitySettings = {
        defaultPostVisibility: 'PUBLIC',
        dmVisibility: 'FRIENDS',
        profileVisibility: 'PUBLIC',
      };
      const draft: PersonaVisibilityDraft = {
        defaultPostVisibility: 'PUBLIC',
        dmVisibility: 'PRIVATE',
        profileVisibility: 'FRIENDS',
      };
      const result = await updateReviewedPersonaVisibility('persona-1', draft, current, realm);
      const updateVisibility = realm.worldCoreControllerReplacePersonaCharacter;
      const submittedRequest = vi.mocked(updateVisibility).mock.calls[0]?.[0];
      const submittedPayload = submittedRequest?.body;

      expect(updateVisibility).toHaveBeenCalledWith({
        path: { personaCharacterId: 'persona-1' },
        body: expect.objectContaining({
          baseContentHash: 'hash-persona-1',
          profile: expect.objectContaining({
            authoring: expect.objectContaining({
              extensions: expect.objectContaining({
                socialVisibility: expect.objectContaining({
                  dmVisibility: 'PRIVATE',
                  profileVisibility: 'FRIENDS',
                }),
              }),
            }),
          }),
          visibility: 'unlisted',
        }),
      });
      expect(collectKeys(submittedPayload).has('accountVisibility')).toBe(false);
      expect(collectKeys(submittedPayload).has('dmVisibility')).toBe(true);
      expect(collectKeys(submittedPayload).has('profileVisibility')).toBe(true);
      expect(Object.keys((submittedPayload?.profile as { socialVisibility?: unknown } | undefined) || {}).includes('socialVisibility')).toBe(false);
      expect(collectKeys(submittedPayload).has('lifecycle')).toBe(false);
      expect(collectKeys(submittedPayload).has('moderationStatus')).toBe(false);
      expect(collectKeys(submittedPayload).has('homeWorldId')).toBe(false);
      expect(collectKeys(submittedPayload).has('provider')).toBe(false);
      expect(collectKeys(submittedPayload).has('model')).toBe(false);
      expect(result).toMatchObject({
        ok: true,
        source: 'Realm WorldCoreController.replaceRealmPersona',
        lifecycleTruth: false,
        submitted: {
          dmVisibility: 'PRIVATE',
          profileVisibility: 'FRIENDS',
        },
      });
    });

     it('fails closed on visibility no-op or invalid enum without calling Realm', async () => {
      const realm = mockRealm();
      const current: RealmPersonaVisibilitySettings = {
        defaultPostVisibility: 'PUBLIC',
        dmVisibility: 'FRIENDS',
        profileVisibility: 'PUBLIC',
      };

      const noChange = await updateReviewedPersonaVisibility('persona-1', createPersonaVisibilityDraft(current), current, realm);
      const invalidDraft = {
        ...createPersonaVisibilityDraft(current),
        dmVisibility: 'EVERYONE',
      } as PersonaVisibilityDraft;
      const invalid = await updateReviewedPersonaVisibility('persona-1', invalidDraft, current, realm);

      expect(realm.worldCoreControllerReplacePersonaCharacter).not.toHaveBeenCalled();
      expect(noChange).toMatchObject({
        ok: false,
        source: 'Realm WorldCoreController.replaceRealmPersona',
        lifecycleTruth: false,
        failure: 'visibility-no-changes',
        submitted: null,
      });
      expect(invalid).toMatchObject({
        ok: false,
        source: 'Realm WorldCoreController.replaceRealmPersona',
        lifecycleTruth: false,
        failure: 'visibility-payload-invalid',
        submitted: null,
      });
    });

     it('builds UpdatePersonaVisibilityDto from changed visibility fields only', () => {
      const current: RealmPersonaVisibilitySettings = {
        defaultPostVisibility: 'PUBLIC',
        dmVisibility: 'FRIENDS',
        profileVisibility: 'PUBLIC',
      };
      const draft: PersonaVisibilityDraft = {
        ...createPersonaVisibilityDraft(current),
        profileVisibility: 'PRIVATE',
      };

      expect(buildRealmUpdateVisibilityInput(draft, current)).toEqual({
        input: {
          profileVisibility: 'PRIVATE',
        },
        errors: [],
      });
    });

     it('fails closed before source materialization without a Runtime-issued challenge', async () => {
      const realm = mockRealm();
      const result = await projectPersonaRuntimeContextSummary(ownerPersonaDetail(), realm);
      const projectRuntimePayload = (realm as Record<string, unknown>).worldCoreControllerCreateSourceMaterializationPacket;

      expect(projectRuntimePayload).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        source: 'Realm WorldCoreController.createSourceMaterializationPacket',
        truthWrite: false,
        failure: 'runtime-projection-not-admitted',
        submitted: {
          intendedRuntimeAudience: 'desktop.runtime',
          sourceRef: {
            kind: 'realmPersona',
            worldId: 'world-oasis',
            sourceId: 'persona-1',
            sourceContentHash: 'hash-persona-1',
          },
        },
      });
      expect(collectKeys(result).has('statement')).toBe(false);
      expect(collectKeys(result).has('ruleKey')).toBe(false);
      expect(collectKeys(result).has('selectedInputs')).toBe(false);
    });

     it('normalizes Runtime projection summary without exposing raw rule content', () => {
      const summary = normalizeRuntimeProjectionSummary({
        sourceWorldId: 'world-1',
        packetHash: 'checksum-1',
        payload: {
          worldRules: [{ statement: 'world raw' }],
        },
      });

      expect(summary).toEqual({
        source: 'Realm WorldCoreController.createSourceMaterializationPacket',
        consumerSurface: 'RUNTIME_PAYLOAD',
        worldId: 'world-1',
        checksum: 'checksum-1',
        selectedInputCount: 1,
        suppressedInputCount: 0,
        worldRuleCount: 1,
        rawRuleContentExposed: false,
      });
      expect(collectKeys(summary).has('statement')).toBe(false);
      expect(collectKeys(summary).has('personaId')).toBe(false);
    });

     it('normalizes localAgent Chat readiness projection summary to persona setting fields only', () => {
      const summary = normalizePersonaChatReadinessProjectionSummary({
        sourceWorldId: 'world-1',
        sourceId: 'persona-1',
        packetHash: 'checksum-1',
        payload: {
          'communication.contentStyle': 'must stay hidden',
        },
      });

      expect(summary).toEqual({
        source: 'Realm WorldCoreController.createSourceMaterializationPacket',
        consumerSurface: 'RUNTIME_PAYLOAD',
        worldId: 'world-1',
        checksum: 'checksum-1',
        selectedInputCount: 1,
        suppressedInputCount: 0,
        worldRuleCount: 0,
        rawRuleContentExposed: false,
        personaId: 'persona-1',
        personaRuleCount: 0,
        selectedOwnerSettingFields: ['communication.contentStyle'],
      });
      expect(collectKeys(summary).has('statement')).toBe(false);
      expect(collectKeys(summary).has('contentStyle')).toBe(false);
    });

     it('fails closed before Runtime projection when source evidence is incomplete', async () => {
      const realm = mockRealm();
      const result = await projectPersonaRuntimeContextSummary({
        ...ownerPersonaDetail(),
        homeWorldId: '',
      }, realm);

      expect(buildRuntimeProjectionInput({ ...ownerPersonaDetail(), id: '' })).toBeNull();
      expect(buildRuntimeProjectionInput({ ...ownerPersonaDetail(), homeWorldId: '' })).toBeNull();
      expect(buildRuntimeProjectionInput({ ...ownerPersonaDetail(), contentHash: '' })).toBeNull();
      expect((realm as Record<string, unknown>).worldCoreControllerCreateSourceMaterializationPacket).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        truthWrite: false,
        failure: 'runtime-projection-world-unavailable',
        submitted: null,
      });
    });

     it('builds no source-specific Runtime projection request for owner-facing summary UI', () => {
      expect(buildRuntimeProjectionInput(ownerPersonaDetail())).toMatchObject({
        sourceRef: {
          kind: 'realmPersona',
          worldId: 'world-oasis',
          sourceId: 'persona-1',
          sourceContentHash: 'hash-persona-1',
        },
      });
      expect(collectKeys(buildRuntimeProjectionInput(ownerPersonaDetail())).has('personaId')).toBe(false);
    });

     it('builds source-specific Runtime projection request for localAgent Chat readiness only', () => {
      const input = buildPersonaChatReadinessProjectionInput(ownerPersonaDetailWithWorldId('world-oasis'));
      expect(input).toMatchObject({
        sourceRef: {
          kind: 'realmPersona',
          worldId: 'world-oasis',
          sourceId: 'persona-1',
          sourceContentHash: 'hash-persona-1',
        },
      });
      expect(collectKeys(input).has('statement')).toBe(false);
    });
});
