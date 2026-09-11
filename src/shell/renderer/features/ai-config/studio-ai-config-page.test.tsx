import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CANONICAL_CAPABILITY_IDS } from '@nimiplatform/kit/core/runtime-capabilities';
import { StudioAIConfigPage } from './studio-ai-config-page.js';

const { loadStudioAIConfigMock, openStudioAIConfigurationInDesktopMock, aiConfigManagerMock } = vi.hoisted(() => ({
  loadStudioAIConfigMock: vi.fn(),
  openStudioAIConfigurationInDesktopMock: vi.fn(),
  aiConfigManagerMock: {
    overwrite: vi.fn(),
    listOptions: vi.fn(),
  },
}));

vi.mock('./studio-ai-config-store.js', () => ({
  loadStudioAIConfig: loadStudioAIConfigMock,
  getStudioAIConfigManager: () => aiConfigManagerMock,
  openStudioAIConfigurationInDesktop: openStudioAIConfigurationInDesktopMock,
}));

describe('Studio AIConfig self-owner page', () => {
  beforeEach(() => {
    loadStudioAIConfigMock.mockReset();
    openStudioAIConfigurationInDesktopMock.mockReset();
    aiConfigManagerMock.overwrite.mockReset();
    aiConfigManagerMock.listOptions.mockReset();
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
          route: { oneofKind: 'local', local: {} },
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

  it('keeps a persistent refresh path and mounts the direct App editor', async () => {
    renderPage();

    await screen.findByText(`1/${CANONICAL_CAPABILITY_IDS.length} Configured`);
    await screen.findByRole('button', { name: /Text Generate/u });
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(document.querySelector('[data-nimi-model-config-capability-grid="true"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(loadStudioAIConfigMock).toHaveBeenCalledTimes(2));
  });

  it('shows accepted feedback after a direct AI models handoff', async () => {
    openStudioAIConfigurationInDesktopMock.mockResolvedValue(undefined);
    renderPage();

    await screen.findByRole('button', { name: /Text Generate/u });
    fireEvent.click(screen.getByRole('button', { name: 'Open AI models in Nimi Desktop' }));

    await screen.findByText('Nimi Desktop accepted the request and opened Realm Persona Studio’s AI models. Complete the configuration there, then return and refresh.');
  });

  it('shows Desktop navigation rejection with typed copy and clipboard diagnostics', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    openStudioAIConfigurationInDesktopMock.mockRejectedValue(Object.assign(
      new Error('Desktop is not ready.'),
      {
        reasonCode: 'desktop-open-desktop-not-ready',
        actionHint: 'wait_for_desktop_ready',
      },
    ));
    renderPage();

    await screen.findByRole('button', { name: /Text Generate/u });
    fireEvent.click(screen.getByRole('button', { name: 'Open AI models in Nimi Desktop' }));

    await screen.findByText('Nimi Desktop could not open Realm Persona Studio’s AI models. No configuration was changed.');
    await screen.findByText('Something went wrong. Try again.');
    expect(document.querySelector('details')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostics' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const payload = String(writeText.mock.calls[0]?.[0]);
    expect(payload).toContain('desktop-open-desktop-not-ready');
    expect(payload).toContain('wait_for_desktop_ready');
  });

  it('uses the mutation acknowledgement revision before background effective refresh completes', async () => {
    const initialSnapshot = await loadStudioAIConfigMock();
    loadStudioAIConfigMock
      .mockReset()
      .mockResolvedValueOnce(initialSnapshot)
      .mockRejectedValue(new Error('effective refresh unavailable'));
    aiConfigManagerMock.overwrite.mockImplementation(async (input) => ({
      outcome: 'committed',
      config: {
        owner: { owner: { oneofKind: 'app', app: { appId: 'nimi.realm-persona-studio' } } },
        capabilities: [...input.capabilities],
      },
      revision: String(Number(input.expectedRevision) + 1),
    }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Text Generate/u }));
    const save = await screen.findByTestId('model-config-save:text.generate');
    fireEvent.click(save);
    await waitFor(() => expect(aiConfigManagerMock.overwrite).toHaveBeenCalledTimes(1));
    fireEvent.click(save);
    await waitFor(() => expect(aiConfigManagerMock.overwrite).toHaveBeenCalledTimes(2));
    expect(aiConfigManagerMock.overwrite.mock.calls[1]?.[0].expectedRevision).toBe('2');
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
