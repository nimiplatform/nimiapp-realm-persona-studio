import { describe, expect, it, vi } from 'vitest';
import {
  getStudioWorldCoreById,
  listStudioWorldCores,
  studioWorldCardPresentation,
  type StudioWorldCoreClient,
} from './studio-world-core.js';
import { world as worldFixture } from '../features/portfolio/portfolio-client.test-helpers.js';

const worlds = [
  worldFixture,
  { ...worldFixture, id: 'world-atlas' },
];

function worldClient() {
  const list = vi.fn(async () => worlds);
  return {
    list,
    client: {
      realm: {
        worldCore: { list },
      },
    } as unknown as StudioWorldCoreClient,
  };
}

describe('Studio WorldCore App Access surface', () => {
  it('lists source-backed WorldCore DTOs with the bounded take value', async () => {
    const { client, list } = worldClient();

    await expect(listStudioWorldCores({ take: 5 }, client)).resolves.toEqual(worlds);
    expect(list).toHaveBeenCalledWith({ take: 5 });
  });

  it('gets a world through list and find without fabricating missing data', async () => {
    const { client, list } = worldClient();

    await expect(getStudioWorldCoreById(' world-atlas ', client)).resolves.toEqual(worlds[1]);
    await expect(getStudioWorldCoreById('world-missing', client)).resolves.toBeNull();
    await expect(getStudioWorldCoreById('   ', client)).resolves.toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledWith({ take: 100 });
  });

  it('resolves a card banner from the WorldCore presentation reference', () => {
    const presentation = studioWorldCardPresentation({
      ...worldFixture,
      core: {
        ...worldFixture.core,
        presentation: {
          ...worldFixture.core.presentation,
          displayName: 'Oasis Harbor',
          bannerResourceRef: 'world-banner-main',
        },
        assets: {
          ...worldFixture.core.assets,
          externalRefs: [{
            refId: 'world-banner-main',
            kind: 'image',
            purpose: 'world banner',
            uri: 'https://cdn.example.test/oasis-banner.webp',
          }],
        },
      },
    });

    expect(presentation).toEqual({
      worldId: 'world-oasis',
      worldName: 'Oasis Harbor',
      bannerUrl: 'https://cdn.example.test/oasis-banner.webp',
    });
  });

  it('keeps a missing WorldCore banner explicitly unavailable', () => {
    expect(studioWorldCardPresentation(worldFixture)).toMatchObject({
      worldId: 'world-oasis',
      worldName: 'OASIS',
      bannerUrl: null,
    });
  });
});
