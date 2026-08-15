import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ensureStudioI18nInitialized, studioI18n } from '../../i18n/studio-i18n.js';
import { ReferenceImageSourceChooser } from './reference-image-source-chooser.js';

describe('ReferenceImageSourceChooser', () => {
  afterEach(cleanup);

  it('treats upload as a direct action and keeps assets and AI as expandable modes', async () => {
    ensureStudioI18nInitialized();
    await studioI18n.changeLanguage('en');
    const onUploadRequest = vi.fn();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <ReferenceImageSourceChooser
        value={null}
        attached={false}
        onUploadRequest={onUploadRequest}
        onValueChange={onValueChange}
      />,
    );

    const upload = screen.getByRole('button', { name: 'Upload image' });
    expect(upload.getAttribute('aria-pressed')).toBeNull();
    fireEvent.click(upload);
    expect(onUploadRequest).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Use existing asset' }));
    expect(onValueChange).toHaveBeenLastCalledWith('assets');

    rerender(
      <ReferenceImageSourceChooser
        value="assets"
        attached={false}
        onUploadRequest={onUploadRequest}
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'Use existing asset' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'AI generate' }).getAttribute('aria-pressed')).toBe('false');
  });
});
