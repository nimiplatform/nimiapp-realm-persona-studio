import { type StudioScope } from '@renderer/app-shell/studio-scope.js';
import type { NimiAppRuntimeClient } from '@nimiplatform/sdk/app';
import type { RealmModel } from '@nimiplatform/sdk/realm/generated';
import { getStudioClient } from '@renderer/app-shell/studio-platform.js';

/**
 * Studio world reads on the Nimi App Access list and exact-get contracts;
 * errors propagate typed from
 * the SDK without local fallback or fabricated worlds.
 */

export type StudioWorldCoreDto = RealmModel<'WorldCoreDto'>;
export type StudioWorldCoreClient = Pick<NimiAppRuntimeClient, 'realm'>;

export type StudioWorldCardPresentation = {
  worldId: string;
  worldName: string | null;
  bannerUrl: string | null;
};

function isRenderableImageUrl(value: string): boolean {
  return /^(?:https?:|data:|blob:|asset:|tauri:|file:|\/)/i.test(value);
}

/**
 * Resolves only WorldCore-owned presentation data for Persona list cards.
 * Persona profile covers must never be used as a fallback for a missing world banner.
 */
// @nimi-authority: rule.realm-persona-studio.metrics.r004
export function studioWorldCardPresentation(world: StudioWorldCoreDto): StudioWorldCardPresentation {
  const presentation = world.core.presentation;
  const bannerResourceRef = presentation.bannerResourceRef?.trim() || null;
  const externalRefs = world.core.assets.externalRefs || [];
  const referencedBanner = bannerResourceRef
    ? externalRefs.find((asset) => asset.refId === bannerResourceRef)
    : null;
  const semanticBanner = externalRefs.find((asset) => {
    const kind = asset.kind.toLocaleLowerCase();
    const purpose = asset.purpose?.toLocaleLowerCase() || '';
    return kind === 'banner' || kind === 'worldbanner' || purpose.includes('banner');
  });
  const bannerUrl = referencedBanner?.uri
    || semanticBanner?.uri
    || (bannerResourceRef && isRenderableImageUrl(bannerResourceRef) ? bannerResourceRef : null);

  return {
    worldId: world.id,
    worldName: presentation.displayName?.trim()
      || presentation.title?.trim()
      || world.core.identity.name.trim()
      || null,
    bannerUrl,
  };
}

export async function listStudioWorldCores(scope: StudioScope,
  input?: { take?: number },
  client: StudioWorldCoreClient = getStudioClient(scope),
): Promise<readonly StudioWorldCoreDto[]> {
  return client.realm.worldCore.list({ take: input?.take ?? 100 });
}

export async function getStudioWorldCoreById(scope: StudioScope,
  worldId: string,
  client: StudioWorldCoreClient = getStudioClient(scope),
): Promise<StudioWorldCoreDto | null> {
  const normalized = worldId.trim();
  if (!normalized) {
    return null;
  }
  return client.realm.worldCore.get(normalized);
}

export async function getStudioWorldCores(scope: StudioScope,
  worldIds: readonly string[],
  client: StudioWorldCoreClient = getStudioClient(scope),
): Promise<readonly StudioWorldCoreDto[]> {
  const worlds: StudioWorldCoreDto[] = [];
  for (const id of new Set(worldIds)) worlds.push(await client.realm.worldCore.get(id));
  return worlds;
}
