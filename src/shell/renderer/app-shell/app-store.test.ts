import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './app-store.js';

describe('Realm Persona Studio app bootstrap state', () => {
  beforeEach(() => {
    useAppStore.setState({
      auth: { status: 'bootstrapping', user: null },
      bootstrapReady: false,
      bootstrapError: null,
      bootstrapFailure: null,
    });
  });

  it('retains the typed protected-session failure separately from display text', () => {
    const failure = {
      state: 'repair-required' as const,
      reasonCode: 'protected-carrier-required',
      actionHint: 'repair_verified_runtime_service',
      message: 'Protected carrier required.',
    };

    useAppStore.getState().setBootstrapFailure(failure);
    useAppStore.getState().setBootstrapError(failure.message);

    expect(useAppStore.getState()).toMatchObject({
      bootstrapError: 'Protected carrier required.',
      bootstrapFailure: failure,
    });
  });

  it('clears a previous typed failure without synthesizing session identity', () => {
    useAppStore.getState().setBootstrapFailure({
      state: 'runtime-unavailable',
      message: 'Runtime unavailable.',
    });
    useAppStore.getState().setBootstrapFailure(null);
    useAppStore.getState().clearAuthSession();

    expect(useAppStore.getState().bootstrapFailure).toBeNull();
    expect(useAppStore.getState().auth).toEqual({ status: 'unauthenticated', user: null });
  });
});
