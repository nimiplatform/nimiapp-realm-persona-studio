import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ensureStudioI18nInitialized } from '../i18n/studio-i18n.js';
import { StudioNavigationGuardProvider, useStudioNavigationGuard } from './studio-navigation-guard.js';

beforeEach(async () => { await ensureStudioI18nInitialized().changeLanguage('en'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Form({ source }: { source: 'post' | 'profile' }) {
  const [value, setValue] = useState('');
  useStudioNavigationGuard(source, Boolean(value), false);
  return <input aria-label={source} value={value} onChange={(event) => setValue(event.currentTarget.value)} />;
}
it('keeps a dirty post protected beside a clean profile form, and confirms both when both are dirty', async () => {
  const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const router = createMemoryRouter([
    { path: '/', element: <StudioNavigationGuardProvider><Form source="post" /><Form source="profile" /></StudioNavigationGuardProvider> },
    { path: '/away', element: <p>Destination</p> },
  ]);
  render(<RouterProvider router={router} />);
  const post = screen.getByRole('textbox', { name: 'post' }) as HTMLInputElement;
  fireEvent.change(post, { target: { value: 'Owner post writing' } });
  await act(async () => { await router.navigate('/away'); });
  expect(router.state.location.pathname).toBe('/');
  expect(screen.getByRole('dialog', { name: 'Discard unsaved post changes?' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  const profile = await screen.findByRole('textbox', { name: 'profile' });
  expect(post.value).toBe('Owner post writing');
  fireEvent.change(profile, { target: { value: 'Owner profile writing' } });
  await act(async () => { await router.navigate('/away'); });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByText(/Your post and Persona settings have unsaved changes/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(await screen.findByText('Destination')).toBeTruthy();
  expect(warnings.mock.calls.flat().join(' ')).not.toContain('router only supports one blocker');
});
