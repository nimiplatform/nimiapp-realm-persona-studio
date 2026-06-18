import { beforeEach, describe, expect, it } from 'vitest';
import { resetStudioAIConfigForTest } from './portfolio-client.test-helpers.js';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  applyRuntimePostCopyProposal,
  buildLocalPostScheduleCandidate,
  buildRuntimePostCopyPrompt,
  normalizeLocalPostDraft,
  normalizeLocalPostScheduleInput,
  normalizeRuntimePostCopyProposal,
  validateLocalPostDraft,
  type CandidatePostPayload,
  type LocalPostDraftInput,
} from './post-draft.js';

const persona: OwnerPortfolioPersonaDetail = {
  id: 'persona-1',
  contentHash: 'hash-persona-1',
  contentRevision: 1,
  homeWorldId: 'world-oasis',
  displayName: {
    key: 'displayName',
    label: 'Display name',
    value: 'Mira',
    status: 'available',
    source: 'Realm WorldCoreController.getRealmPersona',
    readOnly: true,
  },
  handle: {
    key: 'handle',
    label: 'Handle',
    value: 'mira',
    status: 'available',
    source: 'Realm WorldCoreController.getRealmPersona',
    readOnly: true,
  },
  bio: {
    key: 'bio',
    label: 'Profile description',
    value: '',
    status: 'available-empty',
    source: 'Realm WorldCoreController.getRealmPersona',
    readOnly: true,
    emptyLabel: 'not set',
  },
  greeting: {
    key: 'greeting',
    label: 'Greeting',
    value: '',
    status: 'available-empty',
    source: 'Realm WorldCoreController.getRealmPersona',
    readOnly: true,
    emptyLabel: 'not set',
  },
  profileCoverUrl: {
    key: 'profileCoverUrl',
    label: 'Profile cover URL',
    value: '',
    status: 'available-empty',
    source: 'Realm WorldCoreController.getRealmPersona',
    readOnly: true,
    emptyLabel: 'not set',
  },
  ownership: {
    key: 'ownership',
    label: 'Ownership evidence',
    value: 'MASTER_OWNED',
    status: 'available',
    source: 'Realm WorldCoreController.getRealmPersona',
    readOnly: true,
  },
  world: {
    key: 'world',
    label: 'World evidence',
    value: 'world-1',
    status: 'available',
    source: 'Realm WorldCoreController.getRealmPersona',
    readOnly: true,
  },
  state: {
    key: 'state',
    label: 'State evidence',
    value: 'ACTIVE',
    status: 'available',
    source: 'Realm WorldCoreController.getRealmPersona',
    readOnly: true,
  },
  avatarUrl: null,
  friendCount: { status: 'available', value: 7 },
  ownerScope: 'owner-created',
  source: 'Realm WorldCoreController.getRealmPersona',
};

const baseInput: LocalPostDraftInput = {
  caption: ' New artifact pass ',
  tagsText: ' art, #draft, art, studio ',
  humanReviewed: true,
  attachmentEnabled: true,
  attachmentTargetType: 'ASSET',
  attachmentTargetId: 'asset-1 ',
};

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (!value || typeof value !== 'object') {
    return keys;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
}

beforeEach(() => {
  resetStudioAIConfigForTest();
});

describe('local post draft normalization', () => {
  it('trims caption and normalizes distinct tags', () => {
    expect(normalizeLocalPostDraft(baseInput)).toMatchObject({
      caption: 'New artifact pass',
      tags: ['art', 'draft', 'studio'],
      attachment: {
        enabled: true,
        targetType: 'ASSET',
        targetId: 'asset-1',
      },
    });
  });

  it('falls back to RESOURCE when an unknown attachment target type reaches normalization', () => {
    const draft = normalizeLocalPostDraft({
      ...baseInput,
      attachmentTargetType: 'WORLD' as LocalPostDraftInput['attachmentTargetType'],
    });

    expect(draft.attachment.targetType).toBe('RESOURCE');
  });
});

describe('local post draft validation', () => {
  it('fails closed when human review is missing', () => {
    const result = validateLocalPostDraft({ ...baseInput, humanReviewed: false }, persona);

    expect(result.publishable).toBe(false);
    expect(result.errors).toContain('candidate not publishable: human review missing');
    expect(result.payload).toBeNull();
  });

  it('fails closed when attachment is enabled without a target', () => {
    const result = validateLocalPostDraft({ ...baseInput, attachmentTargetId: ' ' }, persona);

    expect(result.publishable).toBe(false);
    expect(result.errors).toContain('attachment validation failed: attachment target missing');
    expect(result.payload).toBeNull();
  });

  it('builds a reviewed candidate payload without forbidden Realm write fields', () => {
    const result = validateLocalPostDraft(baseInput, persona);

    expect(result.publishable).toBe(true);
    expect(result.payload).toEqual({
      candidate: true,
      source: 'realm-persona-studio.local-post-draft',
      personaRef: {
        source: 'Realm WorldCoreController.getRealmPersona',
        sourceKind: 'realmPersona',
        sourceRef: {
          kind: 'realmPersona',
          worldId: 'world-oasis',
          sourceId: 'persona-1',
          sourceContentHash: 'hash-persona-1',
        },
        sourceRefKey: 'realmPersona:world-oasis:persona-1:hash-persona-1',
        handle: 'mira',
        displayName: 'Mira',
      },
      realmCreatePost: {
        attachments: [{
          targetType: 'ASSET',
          targetId: 'asset-1',
        }],
        caption: 'New artifact pass',
        tags: ['art', 'draft', 'studio'],
      },
      review: {
        humanReviewed: true,
      },
    } satisfies CandidatePostPayload);
    expect(collectKeys(result.payload?.realmCreatePost).has('worldId')).toBe(false);
    expect(collectKeys(result.payload).has('id')).toBe(false);
    expect(collectKeys(result.payload).has('authorId')).toBe(false);
  });

  it('omits attachment envelope when no local target is selected', () => {
    const result = validateLocalPostDraft({ ...baseInput, attachmentEnabled: false, attachmentTargetId: '' }, persona);

    expect(result.publishable).toBe(true);
    expect(result.payload?.realmCreatePost.attachments).toEqual([]);
  });
});

describe('app-local post schedule candidate', () => {
  it('builds Runtime post copy prompt from owner intent without private state', () => {
    const result = buildRuntimePostCopyPrompt({
      persona,
      draft: baseInput,
      intent: 'Announce the new artifact pass.',
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      request: {
        model: { modelId: 'auto' },
        parameters: {
          metadata: {
            domain: 'realm-persona-studio.post-copy',
          },
        },
      },
    });
    const userText = result.payload?.request.messages
      .find((message) => message.role === 'user')
      ?.content.find((part) => part.type === 'text')?.text || '';
    expect(userText).not.toContain('LocalAgent');
    expect(userText).not.toContain('worldId');
  });

  it('normalizes Runtime post copy proposal into editable draft fields', () => {
    const proposal = normalizeRuntimePostCopyProposal(JSON.stringify({
      caption: 'Mira opens a new artifact pass for builders.',
      tagsText: ['artifact', 'studio'],
      rationale: 'Matches the requested announcement.',
    }), baseInput);

    expect(proposal).toMatchObject({
      source: 'Runtime runtime.ai.text.generate',
      candidate: true,
      truthWrite: false,
      draftPatch: {
        caption: 'Mira opens a new artifact pass for builders.',
        tagsText: 'artifact, studio',
      },
      changedPostKeys: ['caption', 'tagsText'],
    });
    expect(applyRuntimePostCopyProposal(baseInput, proposal)).toMatchObject({
      caption: 'Mira opens a new artifact pass for builders.',
      tagsText: 'artifact, studio',
      humanReviewed: false,
    });
  });

  it('rejects Runtime post copy proposals with forbidden post truth fields', () => {
    expect(() => normalizeRuntimePostCopyProposal(JSON.stringify({
      caption: 'publish me',
      worldId: 'world-forbidden',
    }), baseInput)).toThrow('unknown field worldId');
  });

  it('rejects Runtime post copy proposals wrapped in prose or carrying unknown fields', () => {
    expect(() => normalizeRuntimePostCopyProposal(`Here is the JSON:\n${JSON.stringify({
      caption: 'publish me',
    })}`, baseInput)).toThrow('single JSON object');
    expect(() => normalizeRuntimePostCopyProposal(JSON.stringify({
      caption: 'publish me',
      tagsText: 'studio',
      extra: 'not admitted',
    }), baseInput)).toThrow('unknown field extra');
  });

  it('normalizes local date and time input', () => {
    expect(normalizeLocalPostScheduleInput({
      localDate: ' 2026-05-22 ',
      localTime: ' 09:30 ',
    })).toMatchObject({
      localRunAt: '2026-05-22T09:30',
    });
  });

  it('rejects empty or malformed local run time', () => {
    expect(normalizeLocalPostScheduleInput({ localDate: '', localTime: '09:30' })).toBeNull();
    expect(normalizeLocalPostScheduleInput({ localDate: '2026/05/22', localTime: '09:30' })).toBeNull();
    expect(normalizeLocalPostScheduleInput({ localDate: '2026-05-22', localTime: '9:30' })).toBeNull();
    expect(normalizeLocalPostScheduleInput({ localDate: '2026-02-31', localTime: '09:30' })).toBeNull();
    expect(normalizeLocalPostScheduleInput({ localDate: '2026-05-22', localTime: '25:30' })).toBeNull();
  });

  it('wraps an already reviewed candidate payload without Realm schedule or success fields', () => {
    const postValidation = validateLocalPostDraft(baseInput, persona);
    const result = buildLocalPostScheduleCandidate(
      postValidation,
      { localDate: '2026-05-22', localTime: '09:30' },
      new Date('2026-05-21T09:30:00'),
    );

    expect(result.scheduleable).toBe(true);
    expect(result.candidate).toMatchObject({
      candidate: true,
      source: 'realm-persona-studio.local-single-post-schedule',
      appLocalOnly: true,
      localRunAt: '2026-05-22T09:30',
      boundary: {
        scope: 'app-local-only',
        realmPublish: 'not-created',
        realmScheduling: 'not-created',
        moderation: 'not-claimed',
      },
      postCandidate: postValidation.payload,
    });
    expect(collectKeys(result.candidate).has('scheduledAt')).toBe(false);
    expect(collectKeys(result.candidate).has('scheduleId')).toBe(false);
    expect(collectKeys(result.candidate?.postCandidate.realmCreatePost).has('worldId')).toBe(false);
    expect(collectKeys(result.candidate).has('authorId')).toBe(false);
    expect(collectKeys(result.candidate).has('id')).toBe(false);
    expect(collectKeys(result.candidate).has('queue')).toBe(false);
    expect(collectKeys(result.candidate).has('campaign')).toBe(false);
    expect(collectKeys(result.candidate).has('recurrence')).toBe(false);
    expect(collectKeys(result.candidate).has('publicSuccess')).toBe(false);
    expect(collectKeys(result.candidate).has('publishSuccess')).toBe(false);
    expect(collectKeys(result.candidate).has('moderationSuccess')).toBe(false);
  });

  it('fails closed when the post draft is not reviewed and publishable', () => {
    const postValidation = validateLocalPostDraft({ ...baseInput, humanReviewed: false }, persona);
    const result = buildLocalPostScheduleCandidate(
      postValidation,
      { localDate: '2026-05-22', localTime: '09:30' },
      new Date('2026-05-21T09:30:00'),
    );

    expect(result.scheduleable).toBe(false);
    expect(result.errors).toContain('app-local schedule unavailable: reviewed publishable local post draft required');
    expect(result.candidate).toBeNull();
  });

  it('fails closed when the local run time is not future-ish', () => {
    const postValidation = validateLocalPostDraft(baseInput, persona);
    const result = buildLocalPostScheduleCandidate(
      postValidation,
      { localDate: '2026-05-21', localTime: '09:30' },
      new Date('2026-05-21T09:30:00'),
    );

    expect(result.scheduleable).toBe(false);
    expect(result.errors).toContain('app-local schedule unavailable: local run time must be in the future');
    expect(result.candidate).toBeNull();
  });
});
