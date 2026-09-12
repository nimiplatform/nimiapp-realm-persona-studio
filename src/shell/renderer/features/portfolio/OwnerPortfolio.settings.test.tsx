import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonaSettingsForm } from './OwnerPortfolio.settings.js';
import { readPersonaSettings } from './portfolio-settings-client.js';
import { ownerPersonaDetail, persona } from './portfolio-client.test-helpers.js';
import { ensureStudioI18nInitialized } from '../../i18n/studio-i18n.js';

const { readSettings } = vi.hoisted(() => ({ readSettings: vi.fn() }));
vi.mock('./portfolio-client.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./portfolio-client.js')>(),
  getPortfolioPersonaSettings: readSettings,
  listCreateRealmPersonaSelectableWorlds: async () => [],
}));

function settings(greeting: string) {
  return readPersonaSettings({
    ...persona,
    profile: { ...persona.profile, interactionProfile: { ...persona.profile.interactionProfile, greeting } },
  });
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('owner settings editor read baseline', () => {
  it('waits for a fresh owner read on reopen and protects later owner edits from refetch', async () => {
    await ensureStudioI18nInitialized().changeLanguage('en');
    const detail = ownerPersonaDetail();
    const key = ['realm-persona-studio', 'persona-settings', detail.ownerScope, detail.id];
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    queryClient.setQueryData(key, settings('Cached greeting'));
    let finishRead!: (value: ReturnType<typeof settings>) => void;
    readSettings.mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
    const router = createMemoryRouter([{ path: '/', element: (
      <PersonaSettingsForm persona={detail} onPersonaWrite={async () => {}} mode="page" />
    ) }]);
    render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
    await waitFor(() => expect(readSettings).toHaveBeenCalledOnce());
    expect(screen.queryByDisplayValue('Cached greeting')).toBeNull();
    await act(async () => finishRead(settings('Latest owner greeting')));
    const greeting = await screen.findByDisplayValue('Latest owner greeting');
    fireEvent.change(greeting, { target: { value: 'Unsaved owner writing' } });
    readSettings.mockResolvedValueOnce(settings('New server greeting'));
    await act(async () => { await queryClient.invalidateQueries({ queryKey: key }); });
    expect(screen.getByDisplayValue('Unsaved owner writing')).toBeTruthy();
    expect(screen.queryByDisplayValue('New server greeting')).toBeNull();
  });
});
