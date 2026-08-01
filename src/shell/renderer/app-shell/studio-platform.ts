import { createNimiClient } from '@nimiplatform/sdk';
import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { createNimiError } from '@nimiplatform/sdk/types';
import { REALM_PERSONA_STUDIO_APP_ID } from '../../app-identity.js';
import { createNimiLocalAppStandardShellSurface } from '../bridge/index.js';

export const STUDIO_RUNTIME_APP_ID = REALM_PERSONA_STUDIO_APP_ID;
export const STUDIO_CAPABILITY_UNAVAILABLE_REASON = 'capability-unavailable';

let studioLocalAppClient: NimiLocalAppClient | null = null;

export function getStudioLocalAppClient(): NimiLocalAppClient {
  studioLocalAppClient ??= createNimiClient({
    localApp: {
      standardShell: createNimiLocalAppStandardShellSurface(),
    },
  });
  return studioLocalAppClient;
}

export function createStudioProtectedOperationUnavailableError(
  operation = 'Realm Persona Studio account, Realm, AI, and publication operations',
): Error {
  return createNimiError({
    message: `${operation} require an admitted Desktop-supervised protected operation.`,
    reasonCode: STUDIO_CAPABILITY_UNAVAILABLE_REASON,
    actionHint: 'admit_persona_studio_protected_operation_through_desktop',
    source: 'sdk',
  });
}

export function requireStudioProtectedOperation(operation?: string): never {
  throw createStudioProtectedOperationUnavailableError(operation);
}
