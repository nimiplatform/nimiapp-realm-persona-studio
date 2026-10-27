import { describe, expect, it, vi } from 'vitest';
import {
  getStudioWorldCoreById,
  getStudioWorldCores,
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
  const get = vi.fn(async (id: string) => {
    const world = worlds.find((item) => item.id === id);
    if (!world) throw new Error('not-found');
    return world;
  });
  return {
    list,
    get,
    client: {
      realm: {
        worldCore: { list, get },
      },
    } as unknown as StudioWorldCoreClient,
  };
}

describe('Studio WorldCore App Access surface', () => {
  it('resolves referenced worlds outside the discovery list once per identity', async () => {
    const { client, list, get } = worldClient();
    await expect(getStudioWorldCores(['world-atlas', worldFixture.id, 'world-atlas'], client)).resolves.toEqual([worlds[1], worlds[0]]);
    expect(list).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(2);
    await expect(getStudioWorldCores(['world-missing'], client)).rejects.toThrow('not-found');
  });
  it('lists source-backed WorldCore DTOs with the bounded take value', async () => {
    const { client, list } = worldClient();

    await expect(listStudioWorldCores({ take: 5 }, client)).resolves.toEqual(worlds);
    expect(list).toHaveBeenCalledWith({ take: 5 });
  });

  it('gets the exact world without fetching an oversized unrelated world list', async () => {
    const { client, list, get } = worldClient();

    await expect(getStudioWorldCoreById(' world-atlas ', client)).resolves.toEqual(worlds[1]);
    await expect(getStudioWorldCoreById('world-missing', client)).rejects.toThrow('not-found');
    await expect(getStudioWorldCoreById('   ', client)).resolves.toBeNull();
    expect(list).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledWith('world-atlas');
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

  it('never substitutes a world id for missing WorldCore naming fields', () => {
    expect(studioWorldCardPresentation({ ...worldFixture, core: {
      ...worldFixture.core, identity: { ...worldFixture.core.identity, name: '' },
      presentation: { ...worldFixture.core.presentation, displayName: '', title: '' },
    } }).worldName).toBeNull();
  });
});
