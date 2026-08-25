import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { OwnerPortfolioPersona } from '@renderer/features/portfolio/portfolio-data.js';
import {
  ownerPersonaDetailQueryKey,
  ownerPortfolioListQueryKey,
  removeDeletedOwnerPersonaReads,
} from './use-persona-detail-query.js';

const detailQuerySource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/features/persona-detail/use-persona-detail-query.ts'), 'utf8');

function persona(id: string): OwnerPortfolioPersona {
  return {
    id,
    displayName: id,
    handle: null,
    coverUrl: null,
    avatarUrl: null,
    ownerScope: 'owner-created',
    source: 'Nimi App Access realm.personaCharacter.listOwned',
    visibility: 'private',
    worldName: null,
    updatedAt: null,
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
  };
}

describe('persona detail query boundaries', () => {
  it('uses owner-only detail queries', () => {
    const source = detailQuerySource();

    expect(source).toContain('getOwnerPortfolioPersonaDetail');
    expect(source).toContain('ownerPersonaDetailQueryKey');
    expect(source).not.toContain('getForgeImportedSystemPortfolioPersonaDetail');
    expect(source).not.toContain('curationPersonaDetailQueryKey');
    expect(source).not.toContain('curationPortfolioListQueryKey');
  });
});

describe('removeDeletedOwnerPersonaReads', () => {
  it('removes the deleted detail and owner-list entry before navigation', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(ownerPersonaDetailQueryKey('persona-1'), { id: 'persona-1' });
    queryClient.setQueryData(ownerPortfolioListQueryKey(), [
      persona('persona-1'),
      persona('persona-2'),
    ]);

    await removeDeletedOwnerPersonaReads(queryClient, 'persona-1');

    expect(queryClient.getQueryData(ownerPersonaDetailQueryKey('persona-1'))).toBeUndefined();
    expect(queryClient.getQueryData<OwnerPortfolioPersona[]>(ownerPortfolioListQueryKey()))
      .toEqual([persona('persona-2')]);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ownerPortfolioListQueryKey(),
      exact: true,
      refetchType: 'active',
    });
  });
});
