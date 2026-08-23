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
      config: {
        owner: {
          owner: {
            oneofKind: 'app',
            app: { appId: 'nimi.realm-persona-studio' },
          },
        },
        capabilities: [{
          capabilityContract: 'text.generate',
          requiredFeatures: [],
          route: { oneofKind: 'local', local: { loadoutRef: 'text-local' } },
        }],
      },
      revision: '1',
      effectiveSelections: [{
        capabilityContract: 'text.generate',
        state: 'ready',
        resource: {
          oneofKind: 'local',
          local: {
            loadoutRef: 'text-local',
            label: 'Text local',
            capabilityContract: 'text.generate',
            implementation: { implementationId: 'text-local', driverId: 'local', driverDialect: 'test/local/v1' },
            supportedFeatures: [],
            state: 'ready',
            reasons: [],
          },
        },
        reasons: [],
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

  it('shows accepted feedback after a direct AI models handoff', async () => {
    openStudioAIConfigurationInDesktopMock.mockResolvedValue(undefined);
    renderPage();

    await screen.findByText('text.generate');
    fireEvent.click(screen.getByRole('button', { name: 'Open AI models in Nimi Desktop' }));

    await screen.findByText('Nimi Desktop accepted the request and opened Realm Persona Studio’s AI models. Complete the configuration there, then return and refresh.');
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
    fireEvent.click(screen.getByRole('button', { name: 'Open AI models in Nimi Desktop' }));

    await screen.findByText('Nimi Desktop could not open Realm Persona Studio’s AI models. No configuration was changed.');
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
