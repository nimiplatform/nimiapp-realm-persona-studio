import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudioAIConfigPage } from './studio-ai-config-page.js';

const { loadStudioAIConfigMock, openStudioAIConfigurationInDesktopMock } = vi.hoisted(() => ({
  loadStudioAIConfigMock: vi.fn(),
  openStudioAIConfigurationInDesktopMock: vi.fn(),
}));

vi.mock('./studio-ai-config-store.js', () => ({
  loadStudioAIConfig: loadStudioAIConfigMock,
  openStudioAIConfigurationInDesktop: openStudioAIConfigurationInDesktopMock,
}));

describe('Studio AIConfig read-only page', () => {
  beforeEach(() => {
    loadStudioAIConfigMock.mockReset();
    openStudioAIConfigurationInDesktopMock.mockReset();
    loadStudioAIConfigMock.mockResolvedValue({
      owner: {
        owner: {
          oneofKind: 'app',
          app: { appId: 'nimi.realm-persona-studio' },
        },
      },
      capabilities: [{
        capabilityContract: 'text.generate',
        requiredFeatures: [],
        route: { oneofKind: 'local', local: {} },
      }],
    });
  });

  afterEach(cleanup);

  it('keeps a persistent refresh path and exposes no App mutation controls', async () => {
    renderPage();

    await screen.findByText('text.generate');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(screen.queryByText(/write text\.generate local intent/iu)).toBeNull();
    expect(screen.queryByText(/reset text\.generate local intent/iu)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(loadStudioAIConfigMock).toHaveBeenCalledTimes(2));
  });

  it('shows Desktop navigation rejection independently with typed details', async () => {
    openStudioAIConfigurationInDesktopMock.mockRejectedValue(Object.assign(
      new Error('Desktop is not ready.'),
      {
        reasonCode: 'desktop-open-desktop-not-ready',
        actionHint: 'wait_for_desktop_ready',
      },
    ));
    renderPage();

    await screen.findByText('text.generate');
    fireEvent.click(screen.getByRole('button', { name: 'Configure in Nimi Desktop' }));

    await screen.findByText('Nimi Desktop could not open the Studio App configuration surface. No configuration was changed.');
    const details = screen.getByText('Desktop navigation details').closest('details');
    expect(details?.textContent).toContain('desktop-open-desktop-not-ready');
    expect(details?.textContent).toContain('wait_for_desktop_ready');
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StudioAIConfigPage />
    </QueryClientProvider>,
  );
}
