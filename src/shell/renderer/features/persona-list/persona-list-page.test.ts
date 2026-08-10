import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const personaListSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/features/persona-list/persona-list-page.tsx'), 'utf8');

const sidebarSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/app-shell/studio-sidebar/studio-sidebar.tsx'), 'utf8');

const sharedPortfolioSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/features/portfolio/OwnerPortfolio.shared.tsx'), 'utf8');

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

  it('renders the selected library design without a subtitle below the page title', () => {
    const source = personaListSource();

    expect(source).toContain("useState<PortfolioView>('local-drafts')");
    expect(source).toContain("t('portfolio.title')");
    expect(source).toContain("t('portfolio.tabs.personas')");
    expect(source).toContain("t('portfolio.tabs.localDrafts')");
    expect(source).not.toContain('ras-page-header__description');
    expect(source).not.toContain("t('portfolio.description')");
  });

  it('hides the pending App Access capability notice while preserving other portfolio failures', () => {
    const source = personaListSource();

    expect(source).toContain("portfolioFailure && portfolioFailure.kind !== 'capability-unavailable'");
    expect(source).toContain('<PortfolioSourceNotice');
  });

  it('keeps local drafts source-backed and opens real creation draft routes', () => {
    const source = personaListSource();

    expect(source).toContain('loadCreationDraftHistory()');
    expect(source).toContain('loadCreationDraft(entry.draftKey)');
    expect(source).toContain('CREATION_DRAFT_HISTORY_UPDATED_EVENT');
    expect(source).toContain('draft.record.referenceImageUrl || null');
    expect(source).toContain('`/portfolio/create?draft=${encodeURIComponent(draftKey)}`');
    expect(source).toContain("navigate('/portfolio/create')");
    expect(source).not.toContain('friendCount: 0');
  });

  it('shows explicitly labeled design examples only in development without inventing Realm metrics', () => {
    const source = personaListSource();

    expect(source).toContain('import.meta.env.DEV');
    expect(source).toContain("t('portfolio.preview.notice')");
    expect(source).toContain('DESIGN_PREVIEW_PERSONAS');
    expect(source).toContain("displayName: '小米'");
    expect(source).not.toContain('friendCount: 0');
  });

  it('uses WorldCore banners and a right-arrow detail action for persona cards', () => {
    const source = personaListSource();
    const sharedSource = sharedPortfolioSource();

    expect(source).toContain('listStudioWorldCores({ take: 100 })');
    expect(source).toContain('studioWorldCardPresentation(world)');
    expect(source).toContain('worldBannerUrl={worldPresentation?.bannerUrl || null}');
    expect(source).not.toContain('worldBannerUrl={persona.coverUrl}');
    expect(sharedSource).toContain("import { ArrowRight } from 'lucide-react'");
    expect(sharedSource).toContain("t('portfolio.card.enter', { persona: persona.displayName })");
    expect(sharedSource).toContain('<ArrowRight');
  });

  it('preserves the shared create action and replaces creation history with the owner persona roster', () => {
    const source = sidebarSource();

    expect(source).toContain("t('shell.sidebar.createPersona')");
    expect(source).toContain("t('shell.nav.myPersonas')");
    expect(source).toContain('listOwnerPortfolioPersonas');
    expect(source).not.toContain("t('shell.sidebar.creationHistory')");
    expect(source).toContain("onClick={() => navigate('/portfolio/create')}");
    expect(source).not.toContain('isPortfolioLibrary');
  });
});
