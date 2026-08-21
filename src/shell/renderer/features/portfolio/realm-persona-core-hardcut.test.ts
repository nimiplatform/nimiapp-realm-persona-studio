import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPortfolioFile(path: string): string {
  return readFileSync(resolve(import.meta.dirname, path), 'utf8');
}

describe('PersonaCharacter App adoption hard cut', () => {
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

  it('uses only the admitted host-injected owner PersonaCharacter surface', () => {
    const client = readPortfolioFile('./portfolio-client.ts');
    const settings = readPortfolioFile('./portfolio-settings-client.ts');
    const media = readPortfolioFile('./portfolio-media-client.ts');
    const draft = readPortfolioFile('./create-persona-draft.ts');
    const externalRef = readPortfolioFile('./persona-external-ref.ts');

    expect(client).toContain('client.listOwned');
    expect(client).toContain('nextAfterId');
    expect(client).toContain('realm.personaCharacter.getOwned');
    expect(client).toContain('realm.personaCharacter.create');
    expect(settings).toContain('realm.personaCharacter.replace');
    expect(settings).toContain('toProfileInput');
    expect(settings).not.toContain('packetHash');
    expect(settings).not.toContain('normalizeRuntimeProjectionSummary');
    expect(settings).not.toContain('createSourceMaterializationPacket');
    expect(settings).not.toContain('buildRuntimeProjectionInput');
    expect(media).toContain('toProfileInput');
    expect(`${client}\n${settings}\n${media}`).not.toMatch(/InvokeRealmUnary|invokeRealm|realmBaseUrl|ownerAccountId|accessToken|refreshToken/u);
    expect(draft).not.toContain('/api/realm/core/personas');
    expect(draft).not.toContain('WorldCoreController.createRealmPersona');
    expect(draft).not.toContain('WorldCoreController.listWorldCores');
    expect(draft).toContain('Nimi App Access realm.worldCore.list');
    expect(externalRef).toContain("parsed.protocol !== 'https:'");
  });

  it('keeps visual fixtures outside normal owner routes and clients', () => {
    const client = readPortfolioFile('./portfolio-client.ts');
    const list = readPortfolioFile('../persona-list/persona-list-page.tsx');
    const shell = readPortfolioFile('../persona-detail/persona-shell.tsx');
    const preview = readPortfolioFile('../../visual-preview.tsx');

    expect(client).not.toContain('persona-workspace.visual-fixture');
    expect(client).not.toContain('VITE_RPS_DEV_MOCK_PORTFOLIO');
    expect(list).not.toContain('DESIGN_PREVIEW_PERSONAS');
    expect(shell).not.toContain('persona-workspace.visual-fixture');
    expect(preview).toContain('persona-workspace.visual-fixture');
    expect(preview).toContain('PersonaVisualPreviewProvider');
  });

  it('removes old state, FRIENDS mapping, and bare extension payloads', () => {
    const data = readPortfolioFile('./portfolio-data.ts');
    const settings = readPortfolioFile('./portfolio-settings-client.ts');
    const draft = readPortfolioFile('./create-persona-draft.ts');

    expect(data).not.toMatch(/realmState|\bstate:\s*settingField/u);
    expect(settings).not.toMatch(/\bFRIENDS\b|socialVisibility|readOwnerSettingsExtension|writeAuthoringExtension/u);
    expect(draft).not.toMatch(/extensions:\s*\{|https?:\)/u);
  });
});
