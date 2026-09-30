import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ensureStudioI18nInitialized } from '../../i18n/studio-i18n.js';
import { AssetImageGrid } from './assets-library-page.js';
import type { AssetLibraryEntry } from './asset-library-data.js';

beforeEach(async () => { await ensureStudioI18nInitialized().changeLanguage('en'); });
afterEach(cleanup);
const entry: AssetLibraryEntry = {
  id: 'imported-image', mediaKind: 'image', sourceKind: 'imported', reviewState: 'candidate-only',
  title: 'Owner image', previewUrl: null, provenance: { kind: 'local-import', id: '01J00000000000000000000001' },
  createdAt: '2026-09-30T00:00:00Z',
};
it('separates preview and removal into native sibling actions', () => {
  const preview = vi.fn();
  const remove = vi.fn();
  render(<AssetImageGrid entries={[entry]} onSelect={preview} onRemove={remove} />);
  const removal = screen.getByRole('button', { name: 'Remove Owner image from this library' });
  expect(removal.parentElement!.closest('button, [role="button"]')).toBeNull();
  fireEvent.click(removal);
  expect(remove).toHaveBeenCalledWith(entry);
  expect(preview).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Owner image ·/ }));
  expect(preview).toHaveBeenCalledWith(entry);
});
