import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPortfolioFile(path: string): string {
  return readFileSync(resolve(import.meta.dirname, path), 'utf8');
}

describe('RealmPersona CoreV1 hard cut', () => {
  it('keeps creation draft, graph, and copy on personaStyle naming', () => {
    const surface = [
      './create-persona-draft.ts',
      './CreateRealmPersonaWorkspace.tsx',
      './persona-creation-graph.ts',
      './persona-seed-generator.ts',
      './persona-reference-image.ts',
      '../../i18n/studio-copy.ts',
    ].map(readPortfolioFile).join('\n');

    expect(surface).toContain('personaArchetype');
    expect(surface).toContain('personaTraits');
    expect(surface).toContain('personaStyle');
    expect(surface).not.toMatch(/dnaPrimary|dnaSecondary|DnaPrimary|DnaSecondary|DNA_PRIMARY|DNA_SECONDARY|\bDNA\b|PersonaDna|section\.dna|sourceProfile(?!Id)|wakeStrategy/u);
  });
});
