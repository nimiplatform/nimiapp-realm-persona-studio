import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectLocalAssetImportCapability } from '../../assets-library/local-import-store.js';
import { normalizeCreateRealmPersonaDraft, type CreateRealmPersonaDraftInput } from '../create-persona-draft.js';
import { createEmptyDraft } from './draft-utils.js';
import type { CreateRealmPersonaDraftPatchInput, StudioTranslator } from './types.js';
import { useReferenceImage } from './use-reference-image.js';
import { ReferenceImageCard } from './reference-image-card.js';
import { ensureStudioI18nInitialized } from '../../../i18n/studio-i18n.js';

const { imageRunner } = vi.hoisted(() => ({ imageRunner: vi.fn() }));
vi.mock('../studio-media-candidate.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../studio-media-candidate.js')>(),
  runStudioImageCandidate: imageRunner,
}));
vi.mock('../creative-asset-history.js', () => ({
  CREATIVE_ASSET_HISTORY_UPDATED_EVENT: 'rps:creative-asset-history-updated',
  loadAllLocalCreativeAssetHistory: async () => ({ ok: true, records: [], unavailableCount: 0 }),
}));
vi.mock('../creation-draft-history.js', () => ({
  loadCreationDraftHistory: async () => ({ ok: true, entries: [], unavailableCount: 0 }),
}));

const draftKey = '01J00000000000000000000001';
const t: StudioTranslator = (key) => key;
beforeEach(async () => { vi.clearAllMocks(); await ensureStudioI18nInitialized().changeLanguage('en'); });
afterEach(cleanup);

function setup(capability = detectLocalAssetImportCapability({})) {
  let draft: CreateRealmPersonaDraftInput = { ...createEmptyDraft(), referenceImagePrompt: 'Owner portrait prompt' };
  const actions = {
    updateDraft: (patch: CreateRealmPersonaDraftPatchInput) => {
      draft = { ...draft, ...(typeof patch === 'function' ? patch(draft) : patch) };
    },
    setReferenceImageSourceMode: vi.fn(), setReferenceSourceFailure: vi.fn(),
    setReferenceAssetsLoading: vi.fn(), setReferenceAssets: vi.fn(),
  };
  const hook = renderHook((value) => useReferenceImage({
    draftKey, draft: value, normalizedDraft: normalizeCreateRealmPersonaDraft(value),
    stage: 'review', localImportCapability: capability, locale: 'en', t, actions,
  }), { initialProps: draft });
  return { hook, draft: () => draft, update: (next: CreateRealmPersonaDraftInput) => { draft = next; hook.rerender(next); } };
}

describe('reference image source adoption', () => {
  it('uses the validated local preview when the Runtime URI is not display-safe', async () => {
    imageRunner.mockResolvedValueOnce({
      ok: true, jobId: 'image-job', artifacts: [{
        artifactId: 'artifact-image', publicUri: 'http://cdn.example.test/image.png',
        previewUrl: 'data:image/png;base64,AQID',
      }],
    });
    const state = setup();
    await act(async () => { await state.hook.result.current.runReferenceImageGeneration({ mode: 'fill', slot: 0 }); });
    expect(normalizeCreateRealmPersonaDraft(state.draft()).referenceImageCandidates).toMatchObject([
      { url: 'data:image/png;base64,AQID', artifactId: 'artifact-image', reviewState: 'candidate-only' },
    ]);
  });

  it('keeps candidates added while an imported file is being read', async () => {
    let finishFileRead!: (buffer: ArrayBuffer) => void;
    const file = {
      name: 'portrait.png', type: 'image/png', size: 3,
      arrayBuffer: () => new Promise<ArrayBuffer>((resolve) => { finishFileRead = resolve; }),
    } as File;
    let index: unknown = [];
    const capability = detectLocalAssetImportCapability({
      ai: { artifacts: {
        upload: async () => ({ artifactId: 'artifact-import', mimeType: 'image/png', sizeBytes: 3 }),
        read: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png', sizeBytes: 3 }),
      } },
      storage: {
        readJson: async () => ({ value: index, sizeBytes: 1 }),
        writeJson: async (_path: string, value: unknown) => { index = value; return { value, sizeBytes: 1 }; },
      },
    });
    const state = setup(capability);
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    let importing!: Promise<void>;
    act(() => {
      importing = state.hook.result.current.handleReferenceImageUpload({ currentTarget: input } as Parameters<typeof state.hook.result.current.handleReferenceImageUpload>[0]);
    });
    state.update({ ...state.draft(), referenceImageCandidates: [{
      draftKey, slot: 0, url: 'https://cdn.example.test/new-candidate.png', prompt: 'Latest prompt',
      createdAt: '2026-09-12T00:00:00.000Z', sourceKind: 'generated', reviewState: 'candidate-only',
    }] });
    await act(async () => { finishFileRead(new Uint8Array([1, 2, 3]).buffer); await importing; });
    expect(state.draft().referenceImageCandidates).toMatchObject([
      { slot: 0, url: 'https://cdn.example.test/new-candidate.png', reviewState: 'candidate-only' },
      { slot: 1, artifactId: 'artifact-import', reviewState: 'owner-selected' },
    ]);
  });

  it('can regenerate an unavailable candidate after its selection was cleared', async () => {
    const state = setup();
    state.update({ ...state.draft(), referenceImageCandidates: [{
      draftKey, slot: 0, url: '', artifactId: 'artifact-missing', prompt: 'Original prompt',
      createdAt: '2026-09-12T00:00:00.000Z', sourceKind: 'generated', reviewState: 'candidate-only',
    }] });
    imageRunner.mockResolvedValueOnce({
      ok: true, jobId: 'replacement-job', artifacts: [{
        artifactId: 'artifact-replacement', previewUrl: 'data:image/png;base64,AQID',
      }],
    });
    render(<ReferenceImageCard draft={state.draft()} normalizedDraft={normalizeCreateRealmPersonaDraft(state.draft())}
      error={null} referenceAssets={{ loadState: 'ready', entries: [], unavailableCount: 0, sourceUnavailable: false }}
      referenceSourceFailure={null} referenceImageSourceMode="ai" referenceImageEditorOpen referenceImageLoadFailed={false}
      referenceImage={state.hook.result.current} onEditorOpenChange={vi.fn()} onReferenceImagePromptChange={vi.fn()} />);
    const generate = screen.getByRole('button', { name: /^(?:re)?generate /i });
    expect((generate as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(generate);
    await waitFor(() => expect(state.draft().referenceImageCandidates).toMatchObject([
      { artifactId: 'artifact-replacement', reviewState: 'candidate-only', prompt: 'Owner portrait prompt' },
    ]));
  });
});
