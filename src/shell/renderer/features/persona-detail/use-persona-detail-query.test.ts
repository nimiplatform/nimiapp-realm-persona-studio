import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const detailQuerySource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/features/persona-detail/use-persona-detail-query.ts'), 'utf8');

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
