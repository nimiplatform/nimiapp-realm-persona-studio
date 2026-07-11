import type { Realm } from '@nimiplatform/sdk/realm';
import { getCurrentStudioNimiClient } from '@renderer/app-shell/studio-platform.js';

export const STUDIO_REALM_SURFACE_METHODS = [
  'worldCoreControllerListRealmPersonas',
  'worldCoreControllerGetRealmPersona',
  'worldCoreControllerCreateRealmPersona',
  'worldCoreControllerReplaceRealmPersona',
  'worldCoreControllerListWorldCores',
  'worldCoreControllerGetWorldCore',
  'worldCoreControllerGetOasisWorld',
  'worldCoreControllerCreateSourceMaterializationPacket',
] as const;

export type StudioRealmSurfaceMethod = typeof STUDIO_REALM_SURFACE_METHODS[number];
export type StudioRealmSurface = Pick<Realm['generated'], StudioRealmSurfaceMethod>;

export function createStudioRealmSurface(realm: Pick<Realm, 'generated'>): StudioRealmSurface {
  const generated = realm.generated;
  return {
    worldCoreControllerListRealmPersonas: generated.worldCoreControllerListRealmPersonas.bind(generated),
    worldCoreControllerGetRealmPersona: generated.worldCoreControllerGetRealmPersona.bind(generated),
    worldCoreControllerCreateRealmPersona: generated.worldCoreControllerCreateRealmPersona.bind(generated),
    worldCoreControllerReplaceRealmPersona: generated.worldCoreControllerReplaceRealmPersona.bind(generated),
    worldCoreControllerListWorldCores: generated.worldCoreControllerListWorldCores.bind(generated),
    worldCoreControllerGetWorldCore: generated.worldCoreControllerGetWorldCore.bind(generated),
    worldCoreControllerGetOasisWorld: generated.worldCoreControllerGetOasisWorld.bind(generated),
    worldCoreControllerCreateSourceMaterializationPacket: generated.worldCoreControllerCreateSourceMaterializationPacket.bind(generated),
  };
}

export function createStudioRealmClient(): StudioRealmSurface {
  const realm = getCurrentStudioNimiClient().realm;
  if (!realm) {
    throw new Error(
      'Realm Persona Studio Realm client is unavailable. Reopen Studio after Runtime account bootstrap completes.',
    );
  }
  return createStudioRealmSurface(realm);
}
