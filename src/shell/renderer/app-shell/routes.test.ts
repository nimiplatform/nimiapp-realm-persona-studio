import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routesSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/app-shell/routes.tsx'), 'utf8');

describe('Studio route boundaries', () => {
  it('loads the default portfolio route with the app shell', () => {
    const source = routesSource();

    expect(source).toContain("import { PersonaListPage } from '../features/persona-list/persona-list-page.js';");
    expect(source).not.toContain("import('../features/persona-list/persona-list-page.js')");
  });

  it('keeps Realm Persona Studio routes owner-only', () => {
    const source = routesSource();

    expect(source).toContain('path="/portfolio"');
    expect(source).toContain('path="/portfolio/:personaId"');
    expect(source).toContain('path="/portfolio/:personaId/settings"');
    expect(source).toContain('path="/portfolio/:personaId/identity"');
    expect(source).toContain('path="/portfolio/:personaId/posts"');
    expect(source).toContain('path="/portfolio/:personaId/posts/manage"');
    expect(source).not.toContain('path="/worlds"');
    expect(source).not.toContain('path="/creator-personas/:personaId"');
    expect(source).not.toContain('path="/curation/forge-imported-system"');
    expect(source).not.toContain('path="/curation/forge-imported-system/:personaId/posts"');
    expect(source).not.toContain('path="/curation/forge-imported-system/:personaId/posts/schedule"');
    expect(source).not.toContain('path="/curation/forge-imported-system/:personaId/settings/review"');
  });

  it('removes obsolete workspace routes', () => {
    const source = routesSource();

    expect(source).not.toContain('path="/portfolio/:personaId/settings/voice"');
    expect(source).not.toContain('path="/portfolio/:personaId/posts/schedule"');
    expect(source).not.toContain('path="/portfolio/:personaId/preview"');
    expect(source).not.toContain('PersonaVoiceConfigPage');
    expect(source).not.toContain('PersonaPostsSchedulePage');
    expect(source).not.toContain('PersonaPublicPreviewPage');
  });

  it('does not hold the next route behind an exit wait or keep both pages in flex layout', () => {
    const source = routesSource();

    expect(source).toContain('<AnimatePresence mode="popLayout" initial={false}>');
    expect(source).not.toContain('mode="sync"');
    expect(source).not.toContain('mode="wait"');
    expect(source).toContain('key={location.pathname}');
    expect(source).toContain('<Routes location={location}>');
  });
});
