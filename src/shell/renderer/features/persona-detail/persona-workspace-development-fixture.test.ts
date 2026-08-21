import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST,
} from './persona-workspace.visual-fixture.js';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('persona workspace development fixture', () => {
  it('exposes four clearly marked personas without inventing friendCount', () => {
    expect(PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST.map((persona) => persona.displayName)).toEqual(['小米', '南星', '晨雾', '星澜']);
    expect(Object.keys(PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS)).toEqual([
      'visual-xiaomi',
      'visual-nanxing',
      'visual-chenwu',
      'visual-xinglan',
    ]);
    for (const persona of PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST) {
      expect(persona.friendCount).toEqual({
        status: 'source-unavailable',
        label: 'friendCount source unavailable',
      });
      expect(PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA[persona.id]?.developmentFixture).toBe(true);
    }

    const emptyPersona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS['visual-chenwu'];
    expect(emptyPersona?.avatarUrl).toBeNull();
    expect(emptyPersona?.profileCoverUrl.status).toBe('available-empty');
    expect(emptyPersona?.voice).toBeUndefined();
    expect(PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA['visual-chenwu']?.candidates).toEqual([]);

    const selectedVoice = PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA['visual-nanxing']?.candidates
      .find((candidate) => candidate.kind === 'voice' && candidate.selected);
    expect(selectedVoice).toMatchObject({
      fileName: 'nanxing_voice_v1.wav',
      mimeType: 'audio/wav',
      durationSeconds: 1,
      fileSizeBytes: 8044,
      sourceKind: 'imported',
      status: 'candidate-only',
    });
    expect(selectedVoice?.previewUrl).toMatch(/^data:audio\/wav;base64,/);
  });

  it('uses fixtures only through the explicit development visual-preview harness', () => {
    const sidebar = source('src/shell/renderer/app-shell/studio-sidebar/studio-sidebar.tsx');
    const shell = source('src/shell/renderer/features/persona-detail/persona-shell.tsx');
    const preview = source('src/shell/renderer/visual-preview.tsx');
    const portfolioClient = source('src/shell/renderer/features/portfolio/portfolio-client.ts');
    const personaList = source('src/shell/renderer/features/persona-list/persona-list-page.tsx');
    const detailPage = source('src/shell/renderer/features/persona-detail/persona-detail-page.tsx');
    const postsPage = source('src/shell/renderer/features/persona-posts/persona-posts-page.tsx');

    expect(sidebar).not.toContain('developmentFixtureFallback');
    expect(sidebar).toContain('const fixtureMode = visualFixturePersonas !== undefined');
    expect(shell).toContain('usePersonaVisualPreview()');
    expect(shell).toContain('enabled: developmentFixturePersona === undefined');
    expect(shell).not.toContain('persona-workspace.visual-fixture');
    expect(preview).toContain('<PersonaVisualPreviewProvider');
    expect(portfolioClient).not.toContain('PERSONA_WORKSPACE_VISUAL_FIXTURE');
    expect(portfolioClient).not.toContain('VITE_RPS_DEV_MOCK_PORTFOLIO');
    expect(personaList).not.toContain('DESIGN_PREVIEW_PERSONAS');
    expect(detailPage).toContain('<PersonaCockpit persona={persona} visualData={visualData} />');
    expect(postsPage).toContain('<PersonaPostEditor persona={persona} visualData={visualData} />');
  });
});
