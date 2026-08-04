import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const shellLayoutSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/app-shell/shell-layout.tsx'), 'utf8');

const sidebarSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/app-shell/studio-sidebar/studio-sidebar.tsx'), 'utf8');

const rendererStylesSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/styles.css'), 'utf8');

const rendererEntrySource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/main.tsx'), 'utf8');

describe('Studio shell kit boundary', () => {
  it('uses governed kit primitives for the mesh shell and v2 sidebar', () => {
    const shell = shellLayoutSource();
    const sidebar = sidebarSource();

    expect(shell).toContain('AmbientBackground');
    expect(shell).toContain('variant="mesh"');
    expect(sidebar).toContain('Surface');
    expect(sidebar).toContain('material="glass-chrome"');
    expect(sidebar).toContain('SidebarHeader');
    expect(sidebar).toContain('SidebarSection');
    expect(sidebar).toContain('SidebarItem');
    expect(sidebar).toContain('ScrollArea');
    expect(sidebar).toContain('AccountPanel');
    expect(sidebar).toContain('Popover');
    expect(sidebar).toContain('Button');
    expect(sidebar).toContain('IconButton');
    expect(sidebar).toContain('Tooltip');
  });

  it('does not keep an app-local account menu state machine or fake auth actions', () => {
    const sidebar = sidebarSource();

    expect(sidebar).not.toContain('document.addEventListener');
    expect(sidebar).not.toContain('requestAnimationFrame');
    expect(sidebar).not.toContain('signOut');
    expect(sidebar).not.toContain('logout');
  });

  it('keeps only current owner navigation and places the asset item after personas', () => {
    const sidebar = sidebarSource();

    expect(sidebar).toContain("to: '/portfolio'");
    expect(sidebar).toContain("to: '/ai-config'");
    expect(sidebar).toContain("'/portfolio/create'");
    expect(sidebar).toContain("to: '/assets'");
    expect(sidebar).not.toContain("to: '/curation/forge-imported-system'");
    expect(sidebar).not.toContain("to: '/worlds'");
    expect(sidebar).not.toContain('ShieldCheck');
  });

  it('uses the kit glass material and accent tokens without the design primary color or hand-written sidebar blur', () => {
    const sidebar = sidebarSource();
    const styles = rendererStylesSource();

    expect(sidebar).not.toContain('#00aefc');
    expect(sidebar).not.toContain('backdrop-blur');
    expect(styles).not.toContain('.ras-sidebar');
    expect(styles).not.toContain('Kit Button tone polyfill');
    expect(styles).not.toContain('Tailwind arbitrary-value polyfills');
    expect(styles).not.toContain('.nimi-action--primary');
    expect(styles).not.toContain('.bg-\\[var(--nimi-action-primary-bg)\\]');
  });

  it('keeps the persisted 260px/72px sidebar and route content vertically scrollable', () => {
    const shell = shellLayoutSource();
    const styles = rendererStylesSource();

    expect(shell).toContain('STUDIO_SIDEBAR_PREFERENCE_STORAGE_PATH');
    expect(shell).toContain('getStudioProtectedJsonStorage().writeJson');
    expect(shell).toContain("t('shell.sidebar.preferenceUnavailable')");
    expect(shell).not.toContain('window.localStorage');
    expect(styles).toContain('width: 260px;');
    expect(styles).toContain('width: 72px;');
    expect(styles).toContain('var(--nimi-motion-slow)');
    expect(styles).toContain('.ras-main');
    expect(styles).toContain('overflow-y: auto;');
    expect(styles).toContain('scrollbar-gutter: stable;');
  });

  it('preserves the window drag whitelist and marks sidebar interactions', () => {
    const shell = shellLayoutSource();
    const sidebar = sidebarSource();

    expect(shell).toContain('TITLEBAR_INTERACTIVE_SELECTOR');
    expect(shell).toContain('startStudioWindowDrag');
    expect(shell).toContain('shell-main-drag-region');
    expect(sidebar).toContain('data-titlebar-interactive="true"');
    expect(sidebar).toContain('SegmentedControl');
  });

  it('does not use a blank renderer-entry lazy fallback', () => {
    const source = rendererEntrySource();

    expect(source).toContain('function EntryFallback');
    expect(source).toContain('AmbientBackground');
    expect(source).toContain('LoadingSkeleton');
    expect(source).toContain('fallback={<EntryFallback />}');
    expect(source).not.toContain('fallback={null}');
  });
});
