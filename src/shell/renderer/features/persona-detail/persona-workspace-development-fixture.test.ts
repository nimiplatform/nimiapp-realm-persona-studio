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
  it('exposes two clearly marked personas without inventing friendCount', () => {
    expect(PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST.map((persona) => persona.displayName)).toEqual(['小米', '南星']);
    expect(Object.keys(PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS)).toEqual(['visual-xiaomi', 'visual-nanxing']);
    for (const persona of PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST) {
      expect(persona.friendCount).toEqual({
        status: 'source-unavailable',
        label: 'friendCount source unavailable',
      });
      expect(PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA[persona.id]?.developmentFixture).toBe(true);
    }
  });

  it('uses the fixture only behind the development guard when the real list is unavailable or empty', () => {
    const sidebar = source('src/shell/renderer/app-shell/studio-sidebar/studio-sidebar.tsx');
    const shell = source('src/shell/renderer/features/persona-detail/persona-shell.tsx');
    const detailPage = source('src/shell/renderer/features/persona-detail/persona-detail-page.tsx');
    const postsPage = source('src/shell/renderer/features/persona-posts/persona-posts-page.tsx');

    expect(sidebar).toContain('const developmentFixtureFallback = import.meta.env.DEV');
    expect(sidebar).toContain('portfolioQuery.isError || (portfolioQuery.data?.length ?? 0) === 0');
    expect(shell).toContain('const developmentFixturePersona = import.meta.env.DEV');
    expect(shell).toContain('enabled: developmentFixturePersona === undefined');
    expect(detailPage).toContain('<PersonaCockpit persona={persona} visualData={visualData} />');
    expect(postsPage).toContain('<PersonaPostEditor persona={persona} visualData={visualData} />');
  });
});
