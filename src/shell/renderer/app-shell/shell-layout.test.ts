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
    expect(sidebar).not.toContain(['re', 'questAnimationFrame'].join(''));
    expect(sidebar).not.toContain('signOut');
    expect(sidebar).not.toContain('logout');
  });

  it('uses the owner persona roster as primary navigation and keeps global asset/config items below it', () => {
    const sidebar = sidebarSource();

    expect(sidebar).toContain('listOwnerPortfolioPersonas');
    expect(sidebar).toContain('PersonaRosterItem');
    expect(sidebar).toContain("to: '/portfolio'");
    expect(sidebar).toContain('myPersonasNavigationItem');
    expect(sidebar).toContain('navigate(`/portfolio/${persona.id}${suffix}`)');
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
    expect(styles).not.toContain('.ras-sidebar {');
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

  it('uses one shared width and gutter for route-level page containers', () => {
    const styles = rendererStylesSource();

    expect(styles).toContain('--ras-page-max-width: 1160px;');
    expect(styles).toContain('--ras-page-gutter: clamp(16px, 2.2vw, 28px);');
    expect(styles).toMatch(/\.ras-page\s*\{[^}]*max-width: var\(--ras-page-max-width\);/);
    expect(styles).toMatch(/\.ras-page\s*\{[^}]*padding: 12px var\(--ras-page-gutter\) 32px;/);
    expect(styles).not.toMatch(/\.ras-persona-library\s*\{[^}]*max-width:/);
    expect(styles).not.toMatch(/\.ras-persona-workspace-page\s*\{[^}]*max-width:/);
    expect(styles).not.toMatch(/\.ras-asset-overview\s*\{[^}]*max-width:/);
  });

  it('preserves the window drag whitelist and marks sidebar interactions', () => {
    const shell = shellLayoutSource();
    const sidebar = sidebarSource();

    expect(shell).toContain('TITLEBAR_INTERACTIVE_SELECTOR');
    expect(shell).toContain('startStudioWindowDrag');
    expect(shell).toContain('shell-main-drag-region');
    expect(sidebar).toContain('data-titlebar-interactive="true"');
  });

  it('uses the supplied panel icon and lets the collapsed brand reveal the expand action', () => {
    const sidebar = sidebarSource();
    const styles = rendererStylesSource();

    expect(sidebar).toContain('PanelLeft,');
    expect(sidebar).not.toContain('PanelLeftClose');
    expect(sidebar).not.toContain('PanelLeftOpen');
    expect(sidebar).toContain('data-testid="sidebar-collapse"');
    expect(sidebar).toContain('data-testid="sidebar-brand-expand"');
    expect(sidebar).toContain('onClick={() => onCollapsedChange(false)}');
    expect(styles).toContain('.ras-sidebar-brand-switcher:hover .ras-sidebar-brand-switcher__logo');
    expect(styles).toContain('.ras-sidebar-brand-switcher:focus-visible .ras-sidebar-brand-switcher__icon');
  });

  it('keeps locale switching inside the account popover', () => {
    const sidebar = sidebarSource();

    expect(sidebar).toContain("id: 'language'");
    expect(sidebar).toContain('footerItems');
    expect(sidebar).toContain("locale === 'en' ? 'locale.switchToChinese' : 'locale.switchToEnglish'");
    expect(sidebar).not.toContain('function LanguageSwitcher');
    expect(sidebar).not.toContain('SegmentedControl');
  });

  it('starts the full sidebar and route content at the top of the my-personas page', () => {
    const shell = shellLayoutSource();
    const sidebar = sidebarSource();
    const styles = rendererStylesSource();

    expect(shell).not.toContain('ras-topbar');
    expect(shell).toContain('<div className="ras-shell__body">');
    expect(shell).not.toContain('isPortfolioLibrary');
    expect(sidebar).toContain("t('shell.sidebar.createPersona')");
    expect(sidebar).toContain('myPersonasNavigationItem');
    expect(sidebar).not.toContain("t('persona.workspace.fixtureBadge')");
    expect(sidebar).not.toContain("t('shell.sidebar.creationHistory')");
    expect(sidebar).not.toContain('isPortfolioLibrary');
    expect(styles).toMatch(/\.ras-shell__body\s*\{[^}]*padding: 12px;/);
    expect(styles).not.toContain('padding: 70px 14px 14px 14px;');
    expect(styles).not.toContain('data-compact-chrome');
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
