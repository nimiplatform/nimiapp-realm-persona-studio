import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NimiThemeProvider, TooltipProvider } from '@nimiplatform/kit/ui';
import { ensureStudioI18nInitialized } from '../../i18n/studio-i18n.js';
import { PersonaVisualIdentityDialog } from './OwnerPortfolio.assets.js';
import { ownerPersonaDetail } from './portfolio-client.test-helpers.js';

vi.mock('@renderer/app-shell/studio-storage.js', () => ({
  getStudioProtectedJsonStorage: () => ({ readJson: async () => ({ value: [], sizeBytes: 2 }), writeJson: vi.fn() }),
  isStudioStorageNotFoundError: () => false,
}));
beforeEach(async () => {
  await ensureStudioI18nInitialized().changeLanguage('en');
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/selected-image');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function showDialog() {
  render(<NimiThemeProvider accentPack="nimi-accent"><TooltipProvider><PersonaVisualIdentityDialog
    persona={{ ...ownerPersonaDetail(), avatarUrl: null }} open onClose={vi.fn()} onPersonaWrite={vi.fn()}
  /></TooltipProvider></NimiThemeProvider>);
}
it('opens the local image editor before a Persona has an avatar', async () => {
  showDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Open image editor' }));
  expect(await screen.findByTestId('visual-image-editor')).toBeTruthy();
});
it('hands the selected local file directly to the image editor', async () => {
  showDialog();
  const file = new File([new Uint8Array([1, 2, 3])], 'owner-image.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Choose a visual identity image'), { target: { files: [file] } });
  const preview = await screen.findByRole('img', { name: 'Edit preview' });
  expect(preview.getAttribute('src')).toBe('blob:http://localhost/selected-image');
  expect(URL.createObjectURL).toHaveBeenCalledWith(file);
});
