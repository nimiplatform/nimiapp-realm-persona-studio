import type { NimiAppRuntimeClient } from '@nimiplatform/sdk/app';
import type { StudioScope } from './studio-scope.js';
import { createNimiError } from '@nimiplatform/sdk/types';
import { REALM_PERSONA_STUDIO_APP_ID } from '../../app-identity.js';

export const STUDIO_RUNTIME_APP_ID = REALM_PERSONA_STUDIO_APP_ID;
export const STUDIO_CAPABILITY_UNAVAILABLE_REASON = 'capability-unavailable';

export function getStudioClient(scope: StudioScope): NimiAppRuntimeClient {
  scope.signal.throwIfAborted();
  return scope.client;
}

export function createStudioProtectedOperationUnavailableError(
  operation = 'Realm Persona Studio account, Realm, AI, and publication operations',
): Error {
  return createNimiError({
    message: `${operation} need a Nimi platform surface that is not available to Realm Persona Studio yet.`,
    reasonCode: STUDIO_CAPABILITY_UNAVAILABLE_REASON,
    actionHint: 'retry_when_platform_surface_available',
    source: 'sdk',
  });
}

export function requireStudioProtectedOperation(operation?: string): never {
  throw createStudioProtectedOperationUnavailableError(operation);
}
