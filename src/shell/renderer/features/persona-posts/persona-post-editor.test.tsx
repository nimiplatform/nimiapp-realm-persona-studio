import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@nimiplatform/kit/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureStudioI18nInitialized } from '@renderer/i18n/studio-i18n.js';
import { PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS } from '../persona-detail/persona-workspace.visual-fixture.js';
import { saveLocalPostDraft } from '../portfolio/local-post-draft-store.js';
import type { PostCopyPolishResult } from '../portfolio/post-copy-polish.js';
import { PersonaPostEditor } from './persona-post-editor.js';

const { values, polish } = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  polish: vi.fn<() => Promise<PostCopyPolishResult>>(),
}));
vi.mock('../portfolio/post-copy-polish.js', () => ({ requestPostCopyPolish: polish }));
vi.mock('@renderer/app-shell/studio-storage.js', () => ({
  getStudioProtectedJsonStorage: () => ({
    readJson: async (path: string) => {
      if (!values.has(path)) throw { code: 'not-found' };
      return { value: values.get(path), sizeBytes: 1 };
    },
    writeJson: async (path: string, value: unknown) => {
      values.set(path, value);
      return { value, sizeBytes: 1 };
    },
    removeJson: async (path: string) => ({ removed: values.delete(path) }),
  }),
  isStudioStorageNotFoundError: (error: { code?: string }) => error.code === 'not-found',
}));

const persona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS['visual-xiaomi']!;
function showEditor() {
  render(<TooltipProvider><PersonaPostEditor persona={persona} /></TooltipProvider>);
}
async function seedDraft(caption: string) {
  const saved = await saveLocalPostDraft({ personaId: persona.id, caption, tagsText: '', visibility: 'private', category: null, attachments: [] });
  if (!saved.ok) throw new Error('Expected persisted draft');
}

beforeEach(async () => {
  values.clear();
  polish.mockReset();
  window.localStorage.clear();
  await ensureStudioI18nInitialized().changeLanguage('en');
});
afterEach(cleanup);

describe('persona post editor draft isolation', () => {
  it('keeps owner edits when AI finishes after the input changes', async () => {
    let finish!: (result: PostCopyPolishResult) => void;
    polish.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    showEditor();
    const input = screen.getByRole('textbox');
    await waitFor(() => expect((input as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.change(input, { target: { value: 'Original draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'AI assist' }));
    expect(polish).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: 'Owner revision' } });
    await act(async () => finish({ ok: true, proposal: {
      draftPatch: { caption: 'Stale AI copy' }, rationale: 'Polished original',
      candidate: true, truthWrite: false, changedPostKeys: ['caption'],
      source: 'Nimi App Access ai.text.generateCandidate', rawText: 'Stale AI copy',
    } }));
    expect((input as HTMLTextAreaElement).value).toBe('Owner revision');
    expect(screen.queryByText('Stale AI copy')).toBeNull();
  });

  it('keeps unsaved edits when the active draft card is selected again', async () => {
    await seedDraft('Saved draft');
    showEditor();
    const card = await screen.findByRole('button', { name: /Saved draft/ });
    fireEvent.click(card);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Unsaved revision' } });
    fireEvent.click(card);
    expect((input as HTMLTextAreaElement).value).toBe('Unsaved revision');
  });

  it('does not reopen a card when the nested delete button receives a key event', async () => {
    await seedDraft('Saved draft');
    showEditor();
    const remove = await screen.findByRole('button', { name: 'Delete draft' });
    fireEvent.keyDown(remove, { key: 'Enter' });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });
});
