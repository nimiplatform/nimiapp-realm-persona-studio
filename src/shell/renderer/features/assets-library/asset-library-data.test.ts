import { describe, expect, it, vi } from 'vitest';
import {
  aggregateAssetLibraryData,
  filterAssetLibraryEntries,
  getAssetLibraryTabState,
} from './asset-library-data.js';

const draftKey = '01J00000000000000000000001';
const importedId = '01J00000000000000000000002';
const historyImageId = '01J00000000000000000000003';
const historyAudioId = '01J00000000000000000000004';

describe('asset library aggregation', () => {
  it('normalizes protected sources, drops malformed records, and counts provenance gaps', () => {
    const data = aggregateAssetLibraryData({
      creativeHistoryRecords: [
        {
          id: historyImageId,
          personaId: 'persona-1',
          sourceContentHash: 'hash-persona-1',
          kind: 'runtime-image-candidate',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
          label: 'Generated portrait',
          createdAt: '2026-08-04T12:00:00.000Z',
          source: 'Runtime image.generate',
          detail: 'artifact-image-1',
          previewUrl: 'https://cdn.example.test/portrait.png',
          publicTruth: false,
        },
        {
          id: '01J00000000000000000000005',
          personaId: 'persona-1',
          sourceContentHash: 'hash-persona-1',
          kind: 'runtime-image-candidate',
          label: 'Must be omitted',
          createdAt: '2026-08-04T11:00:00.000Z',
          source: 'Runtime image.generate',
          detail: 'artifact-image-2',
          publicTruth: false,
        },
        {
          id: historyAudioId,
          personaId: 'persona-1',
          sourceContentHash: 'hash-persona-1',
          kind: 'voice-demo-candidate',
          sourceKind: 'generated',
          reviewState: 'owner-reviewed',
          label: 'Voice sample',
          createdAt: '2026-08-04T10:00:00.000Z',
          source: 'Runtime audio.synthesize',
          detail: 'artifact-audio-1',
          publicTruth: false,
        },
      ],
      creationDraftRecords: [{
        draftKey,
        updatedAt: '2026-08-04T12:30:00.000Z',
        displayName: 'Draft Persona',
        referenceImageCandidates: [
          {
            draftKey,
            url: 'https://cdn.example.test/draft.png',
            prompt: 'A draft portrait',
            sourceKind: 'generated',
            reviewState: 'owner-selected',
            createdAt: '2026-08-04T12:20:00.000Z',
          },
          {
            draftKey,
            url: 'https://cdn.example.test/bad.png',
            prompt: 'Missing source kind',
            reviewState: 'candidate-only',
            createdAt: '2026-08-04T12:21:00.000Z',
          },
        ],
      }],
      importedRecords: [
        {
          id: importedId,
          mediaKind: 'image',
          sourceKind: 'imported',
          title: 'Reference upload.png',
          previewUrl: 'blob:https://app.example.test/local-preview',
          createdAt: '2026-08-04T12:40:00.000Z',
        },
        {
          id: 'bad-import',
          mediaKind: 'audio',
          title: 'Missing source kind.mp3',
          createdAt: '2026-08-04T12:41:00.000Z',
        },
      ],
    });

    expect(data.entries).toHaveLength(4);
    expect(data.entries.map((entry) => entry.id)).toEqual([
      importedId,
      `draft:${draftKey}:0`,
      historyImageId,
      historyAudioId,
    ]);
    expect(data.entries.find((entry) => entry.id === `draft:${draftKey}:0`)).toMatchObject({
      mediaKind: 'image',
      sourceKind: 'generated',
      reviewState: 'owner-selected',
      provenance: { kind: 'draft', draftKey },
    });
    expect(data.entries.find((entry) => entry.id === historyAudioId)?.previewUrl).toBeNull();
    expect(data.entries.find((entry) => entry.id === importedId)?.provenance).toEqual({
      kind: 'local-import',
      id: importedId,
    });
    expect(data.unavailableCount).toBe(3);
  });

  it('filters image, audio, and upload tabs without making a network call', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const data = aggregateAssetLibraryData({
      importedRecords: [{
        id: importedId,
        mediaKind: 'audio',
        sourceKind: 'imported',
        title: 'Imported audio.mp3',
        previewUrl: null,
        createdAt: '2026-08-04T12:00:00.000Z',
      }],
    });

    expect(filterAssetLibraryEntries(data.entries, 'images')).toEqual([]);
    expect(filterAssetLibraryEntries(data.entries, 'audio')).toHaveLength(1);
    expect(filterAssetLibraryEntries(data.entries, 'uploads')).toHaveLength(1);
    expect(getAssetLibraryTabState(data, 'audio')).toMatchObject({ isEmpty: false, unavailableCount: 0 });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});
