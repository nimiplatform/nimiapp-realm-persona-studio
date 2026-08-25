import { describe, expect, it } from 'vitest';
import type { LocalPostScheduleRecord } from './local-post-schedule-store.js';
import { buildDraftBoxEntries } from './draft-box.js';

describe('Draft Box model', () => {
  it('maps local creative history into candidate-only draft entries', () => {
    const entries = buildDraftBoxEntries({
      personaId: 'persona-1',
      creativeHistory: [{
        id: 'voice-1',
        personaId: 'persona-1',
        sourceContentHash: 'hash-persona-1',
        kind: 'voice-demo-candidate',
        sourceKind: 'generated',
        reviewState: 'candidate-only',
        label: 'Voice demo candidate',
        createdAt: '2026-06-18T01:00:00.000Z',
        source: 'Runtime audio.synthesize',
        publicTruth: false,
        detail: 'artifact-voice-1',
        artifactIds: ['artifact-voice-1'],
      }, {
        id: 'image-1',
        personaId: 'persona-1',
        sourceContentHash: 'hash-persona-1',
        kind: 'runtime-image-candidate',
        sourceKind: 'generated',
        reviewState: 'candidate-only',
        label: 'Runtime image candidate',
        createdAt: '2026-06-18T00:00:00.000Z',
        source: 'Runtime image.generate',
        publicTruth: false,
        detail: 'artifact-image-1',
        artifactIds: ['artifact-image-1'],
      }],
      localSchedule: null,
    });

    expect(entries).toEqual([{
      id: 'creative:voice-1',
      kind: 'voice-demo',
      destination: 'voice',
      status: 'needs-review',
      truthBoundary: 'candidate-only',
      title: 'Voice demo candidate',
      detail: 'artifact-voice-1',
      source: 'Runtime audio.synthesize',
      createdAt: '2026-06-18T01:00:00.000Z',
      actionPath: '/portfolio/persona-1/assets/voice',
    }, {
      id: 'creative:image-1',
      kind: 'identity-image',
      destination: 'identity',
      status: 'needs-review',
      truthBoundary: 'candidate-only',
      title: 'Runtime image candidate',
      detail: 'artifact-image-1',
      source: 'Runtime image.generate',
      createdAt: '2026-06-18T00:00:00.000Z',
      actionPath: '/portfolio/persona-1/assets',
    }]);
  });

  it('maps the single local schedule as local-only and due-aware', () => {
    const schedule: LocalPostScheduleRecord = {
      localKey: 'persona-1:2026-06-18T00:00:00.000Z',
      personaId: 'persona-1',
      savedAt: '2026-06-18T00:00:00.000Z',
      localRunAt: '2026-06-18T00:00:00.000Z',
      source: 'realm-persona-studio.local-single-post-schedule-store',
      appLocalOnly: true,
      execution: {
        mode: 'foreground-when-due',
        realmPublish: 'pending-owner-app-open',
      },
      candidate: {
        candidate: true,
        localRunAt: '2026-06-18T00:00:00.000Z',
        source: 'realm-persona-studio.local-single-post-schedule',
        appLocalOnly: true,
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
            handle: 'persona_1',
            displayName: 'Persona One',
          },
          realmCreatePost: {
            caption: 'Reviewed launch note',
            tags: ['launch'],
            attachments: [],
          },
          review: {
            humanReviewed: true,
          },
        },
      },
    };

    expect(buildDraftBoxEntries({
      personaId: 'persona-1',
      creativeHistory: [],
      localSchedule: schedule,
      now: new Date('2026-06-18T00:01:00.000Z'),
    })[0]).toMatchObject({
      id: 'schedule:persona-1:2026-06-18T00:00:00.000Z',
      kind: 'scheduled-post',
      destination: 'schedule',
      status: 'ready-when-due',
      truthBoundary: 'local-only',
      title: 'Scheduled post draft',
      detail: 'Reviewed launch note',
      actionPath: '/portfolio/persona-1/posts/schedule',
    });
  });
});
