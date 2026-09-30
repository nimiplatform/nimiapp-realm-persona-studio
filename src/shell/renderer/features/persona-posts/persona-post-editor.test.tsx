import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { TooltipProvider } from '@nimiplatform/kit/ui';
import { StudioNavigationGuardProvider } from '../../app-shell/studio-navigation-guard.js';
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
function showEditor(path = '/') {
  const router = createMemoryRouter([
    { path: '/away', element: <div>Destination</div> },
    { path: '*', element: <StudioNavigationGuardProvider><TooltipProvider><PersonaPostEditor persona={persona} /></TooltipProvider></StudioNavigationGuardProvider> },
  ], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
async function seedDraft(caption: string) {
  const saved = await saveLocalPostDraft({ personaId: persona.id, caption, tagsText: '', visibility: 'private', category: null, attachments: [] });
  if (!saved.ok) throw new Error('Expected persisted draft');
  return saved.record;
}

beforeEach(async () => {
  values.clear();
  polish.mockReset();
  window.localStorage.clear();
  await ensureStudioI18nInitialized().changeLanguage('en');
});
afterEach(cleanup);

describe('persona post editor draft isolation', () => {
  it('opens the exact saved draft selected from content management', async () => {
    const selected = await seedDraft('Selected draft');
    await seedDraft('Another draft');
    showEditor(`/portfolio/${persona.id}/posts?draft=${selected.id}`);
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Post copy' }) as HTMLTextAreaElement).value)
      .toBe('Selected draft'));
  });

  it('keeps owner edits when AI finishes after the input changes', async () => {
    let finish!: (result: PostCopyPolishResult) => void;
    polish.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    showEditor();
    const input = screen.getByRole('textbox', { name: 'Post copy' });
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
    const input = screen.getByRole('textbox', { name: 'Post copy' });
    fireEvent.change(input, { target: { value: 'Unsaved revision' } });
    fireEvent.click(card);
    expect((input as HTMLTextAreaElement).value).toBe('Unsaved revision');
  });

  it('does not reopen a card when the nested delete button receives a key event', async () => {
    await seedDraft('Saved draft');
    showEditor();
    const remove = await screen.findByRole('button', { name: 'Delete draft' });
    expect(remove.parentElement!.closest('[role="button"], button')).toBeNull();
    fireEvent.keyDown(remove, { key: 'Enter' });
    expect((screen.getByRole('textbox', { name: 'Post copy' }) as HTMLTextAreaElement).value).toBe('');
  });

  it('preserves unsaved edits on cancelled draft switching and discards only after confirmation', async () => {
    await seedDraft('First saved draft');
    await seedDraft('Second saved draft');
    showEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'First saved draft' }));
    const input = screen.getByRole('textbox', { name: 'Post copy' }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Owner unsaved revision' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Second saved draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(input.value).toBe('Owner unsaved revision');
    fireEvent.click(await screen.findByRole('button', { name: 'Second saved draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(input.value).toBe('Second saved draft');
  });

  it('blocks leaving with unsaved edits, and permits it after the real local draft save resolves', async () => {
    const router = showEditor();
    const input = screen.getByRole('textbox', { name: 'Post copy' }) as HTMLTextAreaElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    fireEvent.change(input, { target: { value: 'Unsaved post' } });
    const unloading = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unloading);
    expect(unloading.defaultPrevented).toBe(true);
    await act(async () => { await router.navigate('/away'); });
    expect(router.state.location.pathname).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(input.value).toBe('Unsaved post');
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unsaved post' })).toBeTruthy());
    const savedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(savedUnload);
    expect(savedUnload.defaultPrevented).toBe(false);
    await act(async () => { await router.navigate('/away'); });
    expect(screen.getByText('Destination')).toBeTruthy();
  });

  it('keeps the local draft until its removal is confirmed', async () => {
    const record = await seedDraft('Remove only after confirmation');
    showEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('button', { name: record.caption })).toBeTruthy();
  });
});
