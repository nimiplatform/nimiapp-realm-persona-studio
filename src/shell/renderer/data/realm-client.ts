import type { Realm } from '@nimiplatform/sdk/realm';
import { requireStudioProtectedOperation } from '@renderer/app-shell/studio-platform.js';

export const STUDIO_REALM_SURFACE_METHODS = [
  'worldCoreControllerListPersonaCharacters',
  'worldCoreControllerGetPersonaCharacter',
  'worldCoreControllerCreatePersonaCharacter',
  'worldCoreControllerReplacePersonaCharacter',
  'worldCoreControllerListWorldCores',
  'worldCoreControllerGetWorldCore',
  'worldCoreControllerGetOasisWorld',
] as const;

export type StudioRealmSurfaceMethod = typeof STUDIO_REALM_SURFACE_METHODS[number];
export type StudioRealmSurface = Pick<Realm['generated'], StudioRealmSurfaceMethod>;

export function createStudioRealmSurface(realm: Pick<Realm, 'generated'>): StudioRealmSurface {
  const generated = realm.generated;
  return {
    worldCoreControllerListPersonaCharacters: generated.worldCoreControllerListPersonaCharacters.bind(generated),
    worldCoreControllerGetPersonaCharacter: generated.worldCoreControllerGetPersonaCharacter.bind(generated),
    worldCoreControllerCreatePersonaCharacter: generated.worldCoreControllerCreatePersonaCharacter.bind(generated),
    worldCoreControllerReplacePersonaCharacter: generated.worldCoreControllerReplacePersonaCharacter.bind(generated),
    worldCoreControllerListWorldCores: generated.worldCoreControllerListWorldCores.bind(generated),
    worldCoreControllerGetWorldCore: generated.worldCoreControllerGetWorldCore.bind(generated),
    worldCoreControllerGetOasisWorld: generated.worldCoreControllerGetOasisWorld.bind(generated),
  };
}

export function createStudioRealmClient(): StudioRealmSurface {
  return requireStudioProtectedOperation('Realm Persona operations');
}
