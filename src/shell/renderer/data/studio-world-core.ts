import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import type { RealmModel } from '@nimiplatform/sdk/realm/generated';
import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';

/**
 * Studio world reads on the Nimi App Access contract. `realm.worldCore.list`
 * is the only Realm surface currently exposed to Studio; errors propagate typed from
 * the SDK without local fallback or fabricated worlds.
 */

export type StudioWorldCoreDto = RealmModel<'WorldCoreDto'>;
export type StudioWorldCoreClient = Pick<NimiLocalAppClient, 'realm'>;

export type StudioWorldCardPresentation = {
  worldId: string;
  worldName: string;
  bannerUrl: string | null;
};

function isRenderableImageUrl(value: string): boolean {
  return /^(?:https?:|data:|blob:|asset:|tauri:|file:|\/)/i.test(value);
}

/**
 * Resolves only WorldCore-owned presentation data for Persona list cards.
 * Persona profile covers must never be used as a fallback for a missing world banner.
 */
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
      || world.id,
    bannerUrl,
  };
}

export async function listStudioWorldCores(
  input?: { take?: number },
  client: StudioWorldCoreClient = getStudioLocalAppClient(),
): Promise<readonly StudioWorldCoreDto[]> {
  return client.realm.worldCore.list({ take: input?.take ?? 100 });
}

export async function getStudioWorldCoreById(
  worldId: string,
  client: StudioWorldCoreClient = getStudioLocalAppClient(),
): Promise<StudioWorldCoreDto | null> {
  const normalized = worldId.trim();
  if (!normalized) {
    return null;
  }
  const worlds = await listStudioWorldCores(undefined, client);
  return worlds.find((world) => world.id === normalized) ?? null;
}
