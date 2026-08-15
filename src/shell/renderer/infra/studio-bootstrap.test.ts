import { beforeEach, describe, expect, it, vi } from 'vitest';

const authStatusMock = vi.fn();
const createNimiClientMock = vi.fn();
const createNimiLocalAppStandardShellSurfaceMock = vi.fn();

vi.mock('@nimiplatform/sdk', () => ({
  createNimiClient: createNimiClientMock,
}));

vi.mock('../bridge/index.js', () => ({
  createNimiLocalAppStandardShellSurface: createNimiLocalAppStandardShellSurfaceMock,
}));

let useAppStore: typeof import('../app-shell/app-store.js').useAppStore;
let ensureStudioBootstrapReady: typeof import('./studio-bootstrap.js').ensureStudioBootstrapReady;
let runStudioBootstrap: typeof import('./studio-bootstrap.js').runStudioBootstrap;

describe('Realm Persona Studio Desktop-supervised bootstrap hardcut', () => {
  beforeEach(async () => {
    vi.resetModules();
    authStatusMock.mockReset();
    createNimiClientMock.mockReset();
    createNimiLocalAppStandardShellSurfaceMock.mockReset();
    const standardShell = { session: { status: vi.fn() } };
    createNimiLocalAppStandardShellSurfaceMock.mockReturnValue(standardShell);
    createNimiClientMock.mockReturnValue({ auth: { status: authStatusMock } });
    authStatusMock.mockResolvedValue({
      state: 'session-bound',
      sessionBound: true,
      reasonCode: 'local-app-session-bound',
      actionHint: 'none',
    });

    ({ useAppStore } = await import('../app-shell/app-store.js'));
    ({ ensureStudioBootstrapReady, runStudioBootstrap } = await import('./studio-bootstrap.js'));
    useAppStore.setState({
      auth: { status: 'bootstrapping', user: null },
      bootstrapReady: false,
      bootstrapError: null,
      bootstrapFailure: null,
    });
  });

  it('binds only through the Desktop-supervised local-app standard shell', async () => {
    await runStudioBootstrap();

    expect(createNimiLocalAppStandardShellSurfaceMock).toHaveBeenCalledTimes(1);
    expect(createNimiClientMock).toHaveBeenCalledWith({
      localApp: {
        standardShell: expect.objectContaining({ session: expect.any(Object) }),
      },
    });
    expect(useAppStore.getState().bootstrapReady).toBe(true);
    expect(useAppStore.getState().bootstrapFailure).toBeNull();
    expect(useAppStore.getState().auth.status).toBe('authenticated');
  });

  it('preserves an unbound local-app carrier as a typed repair state', async () => {
    authStatusMock.mockResolvedValueOnce({
      state: 'action-required',
      sessionBound: false,
      reasonCode: 'protected-carrier-required',
      actionHint: 'repair_verified_runtime_service',
    });

    await runStudioBootstrap({ force: true });

    expect(useAppStore.getState()).toMatchObject({
      auth: { status: 'unauthenticated', user: null },
      bootstrapReady: false,
      bootstrapError: 'Realm Persona Studio Desktop-supervised local-app session is not bound.',
      bootstrapFailure: {
        state: 'repair-required',
        reasonCode: 'protected-carrier-required',
        actionHint: 'repair_verified_runtime_service',
        message: 'Realm Persona Studio Desktop-supervised local-app session is not bound.',
      },
    });
  });

  it('preserves a thrown structured Runtime failure for readiness callers', async () => {
    authStatusMock.mockRejectedValue(Object.assign(
      new Error('Runtime service unavailable.'),
      {
        reasonCode: 'runtime-service-unavailable',
        actionHint: 'restart_runtime_service',
      },
    ));

    await runStudioBootstrap({ force: true });

    expect(useAppStore.getState().bootstrapFailure).toEqual({
      state: 'runtime-unavailable',
      reasonCode: 'runtime-service-unavailable',
      actionHint: 'restart_runtime_service',
      message: 'Runtime service unavailable.',
    });
    await expect(ensureStudioBootstrapReady()).rejects.toThrow('Runtime service unavailable.');
  });
});
