import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const personaListSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/features/persona-list/persona-list-page.tsx'), 'utf8');

describe('persona list read boundaries', () => {
  it('keeps owner portfolio list reads owner-only', () => {
    const source = personaListSource();

    expect(source).toContain('listOwnerPortfolioPersonas');
    expect(source).toContain('queryFn: () => listOwnerPortfolioPersonas()');
    expect(source).not.toContain('listForgeImportedSystemPortfolioPersonas');
    expect(source).not.toContain('queryFn: () => listForgeImportedSystemPortfolioPersonas()');
    expect(source).not.toContain('System curation unavailable for this Runtime account.');
    expect(source).not.toContain('CurationPersonaListPage');
  });
});
