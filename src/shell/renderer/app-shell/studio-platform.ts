import type { NimiClient } from '@nimiplatform/sdk';
import { createInstalledNimiAppBootstrap } from '@nimiplatform/sdk/app';
import { createNimiError } from '@nimiplatform/sdk/types';
import { createInstalledNimiAppStandardShellSurface } from '../bridge/index.js';
import { getStudioNimiClient, setStudioNimiClient } from '../infra/studio-nimi-client.js';

export const STUDIO_RUNTIME_APP_ID = 'nimi.realm-persona-studio';
export const STUDIO_CAPABILITY_UNAVAILABLE_REASON = 'capability-unavailable';

export const studioInstalledAppBootstrap = createInstalledNimiAppBootstrap({
  standardShell: createInstalledNimiAppStandardShellSurface(),
});

export async function buildStudioNimiClient(): Promise<NimiClient> {
  throw createNimiError({
    message: 'Realm Persona Studio account, Realm, AI, and publication operations require a separately admitted protected installed session.',
    reasonCode: STUDIO_CAPABILITY_UNAVAILABLE_REASON,
    actionHint: 'launch_from_nimi_desktop_after_persona_operations_are_admitted',
    source: 'sdk',
  });
}

export function isStudioCapabilityUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { reasonCode?: unknown; code?: unknown };
  return record.reasonCode === STUDIO_CAPABILITY_UNAVAILABLE_REASON
    || record.code === STUDIO_CAPABILITY_UNAVAILABLE_REASON;
}

export function getCurrentStudioNimiClient(): NimiClient {
  return getStudioNimiClient();
}

export function clearStudioNimiClient(): void {
  setStudioNimiClient(null);
}
