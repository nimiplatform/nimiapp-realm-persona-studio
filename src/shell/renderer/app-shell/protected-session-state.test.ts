import { describe, expect, it } from 'vitest';
import { classifyStudioProtectedSessionFailure } from './protected-session-state.js';

describe('Realm Persona Studio protected-session failure classifier', () => {
  it.each([
    ['account-authentication-required', 'action-required'],
    ['runtime-service-unavailable', 'runtime-unavailable'],
    ['runtime-restarted', 'session-ended'],
    ['local-app-access-denied', 'access-denied'],
    ['local-app-operation-unavailable', 'access-denied'],
    ['revoked', 'session-ended'],
    ['account-changed', 'session-ended'],
    ['process-replaced', 'session-ended'],
    ['protected-carrier-required', 'repair-required'],
    ['runtime-service-error-unclassified', 'repair-required'],
    ['SDK_LOCAL_APP_CARRIER_REQUIRED', 'repair-required'],
    ['SDK_LOCAL_APP_PROJECTION_INVALID', 'repair-required'],
    ['renderer-standard-shell-host-unavailable', 'repair-required'],
    ['renderer-standard-shell-result-invalid', 'repair-required'],
    ['persona-studio-operation-not-in-app-access', 'capability-unavailable'],
  ] as const)('maps %s to %s', (reasonCode, state) => {
    expect(classifyStudioProtectedSessionFailure(Object.assign(new Error(reasonCode), {
      reasonCode,
      actionHint: `act-${reasonCode}`,
    }))).toEqual({
      state,
      reasonCode,
      actionHint: `act-${reasonCode}`,
      message: reasonCode,
    });
  });

  it('does not synthesize a universal reason code or retry action', () => {
    const failure = classifyStudioProtectedSessionFailure(
      new Error('Protected Persona Studio operation unavailable'),
    );

    expect(failure).toEqual({
      state: 'capability-unavailable',
      message: 'Protected Persona Studio operation unavailable',
    });
    expect(failure).not.toHaveProperty('reasonCode');
    expect(failure).not.toHaveProperty('actionHint');
  });

  it('extracts structured native failures without interpreting text as success', () => {
    expect(classifyStudioProtectedSessionFailure(new Error(JSON.stringify({
      code: 'runtime-service-untrusted',
      reasonCode: 'runtime-service-untrusted',
      actionHint: 'repair_verified_runtime_service',
    })))).toMatchObject({
      state: 'repair-required',
      reasonCode: 'runtime-service-untrusted',
      actionHint: 'repair_verified_runtime_service',
    });
  });
});
