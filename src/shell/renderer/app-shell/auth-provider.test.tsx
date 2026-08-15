import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AuthProvider } from './auth-provider.js';
import { useAppStore } from './app-store.js';

const { runStudioBootstrapMock } = vi.hoisted(() => ({
  runStudioBootstrapMock: vi.fn(),
}));

vi.mock('../infra/studio-bootstrap.js', () => ({
  runStudioBootstrap: runStudioBootstrapMock,
}));

describe('Realm Persona Studio protected-session UI', () => {
  beforeEach(() => {
    runStudioBootstrapMock.mockReset();
    useAppStore.setState({
      auth: { status: 'unauthenticated', user: null },
      bootstrapReady: false,
      bootstrapError: 'Protected operation unavailable',
      bootstrapFailure: {
        state: 'repair-required',
        reasonCode: 'runtime-service-untrusted',
        actionHint: 'restart_verified_runtime_service',
        message: 'Protected operation unavailable',
      },
    });
  });

  afterEach(cleanup);

  it('renders a typed fail-closed state and never exposes product children', () => {
    render(<AuthProvider><div data-testid="persona-workbench">persona workbench</div></AuthProvider>);

    const panel = screen.getByTestId('persona-studio-protected-session-failure');
    expect(panel.getAttribute('data-protected-state')).toBe('repair-required');
    expect(screen.getByText('Nimi protected runtime needs attention')).toBeTruthy();
    expect(screen.queryByTestId('persona-workbench')).toBeNull();
    expect((screen.getByTestId('persona-studio-protected-operations-locked') as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('keeps machine codes inside collapsed technical details', () => {
    render(<AuthProvider><div /></AuthProvider>);

    const details = screen.getByText('Technical details').closest('details');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('runtime-service-untrusted');
    expect(details?.textContent).toContain('restart_verified_runtime_service');
  });

  it('forces a fresh same-host bootstrap when the owner checks again', () => {
    render(<AuthProvider><div /></AuthProvider>);

    screen.getByTestId('persona-studio-protected-session-retry').click();
    expect(runStudioBootstrapMock).toHaveBeenLastCalledWith({ force: true });
  });

  it('renders action-required posture without inventing technical codes', () => {
    useAppStore.setState({
      bootstrapFailure: {
        state: 'action-required',
        message: 'Account action is required in Nimi Desktop',
      },
    });

    render(<AuthProvider><div /></AuthProvider>);
    expect(screen.getByText('Action required in Nimi Desktop')).toBeTruthy();
    expect(screen.queryByText('Technical details')).toBeNull();
  });
});
