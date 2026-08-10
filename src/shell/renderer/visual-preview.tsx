import { StrictMode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  AmbientBackground,
  NimiThemeProvider,
  NimiToaster,
  TooltipProvider,
} from '@nimiplatform/kit/ui';
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { StudioSidebar } from './app-shell/studio-sidebar/index.js';
import { PersonaCockpit } from './features/persona-detail/persona-cockpit.js';
import { PersonaWorkspaceFrame } from './features/persona-detail/persona-shell.js';
import {
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_PENDING_REVIEWS,
} from './features/persona-detail/persona-workspace.visual-fixture.js';
import { PersonaPostEditor } from './features/persona-posts/persona-post-editor.js';
import { PersonaCard } from './features/portfolio/OwnerPortfolio.shared.js';
import { studioQueryClient } from './infra/query-client.js';
import { ensureStudioI18nInitialized, translateStudioCopy } from './i18n/studio-i18n.js';
import './styles.css';

const previewI18n = ensureStudioI18nInitialized();
void previewI18n.changeLanguage('zh');

function PreviewWorkspace({ tab }: { tab: 'detail' | 'posts' }) {
  const { personaId = 'visual-xiaomi' } = useParams();
  const persona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS[personaId];
  const visualData = PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA[personaId];
  if (!persona || !visualData) return <Navigate to="/portfolio/visual-xiaomi" replace />;

  return (
    <PersonaWorkspaceFrame persona={persona} current={tab}>
      {tab === 'posts' ? (
        <PersonaPostEditor persona={persona} visualData={visualData} />
      ) : (
        <PersonaCockpit persona={persona} visualData={visualData} />
      )}
    </PersonaWorkspaceFrame>
  );
}

function PreviewPersonaLibrary() {
  const navigate = useNavigate();
  return (
    <div className="ras-page ras-persona-library">
      <header className="ras-page-header ras-persona-library__header">
        <h1 className="ras-page-header__title">{translateStudioCopy('portfolio.title')}</h1>
      </header>
      <div className="ras-portfolio-tabs" role="tablist" aria-label={translateStudioCopy('portfolio.tabs.ariaLabel')}>
        <button type="button" role="tab" aria-selected="true" className="ras-portfolio-tabs__item" data-active="true">
          {translateStudioCopy('portfolio.tabs.personas')}
        </button>
        <button type="button" role="tab" aria-selected="false" className="ras-portfolio-tabs__item">
          {translateStudioCopy('portfolio.tabs.localDrafts')}
        </button>
      </div>
      <div className="ras-persona-library__persona-panel">
        <div className="ras-persona-grid">
          {PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              worldBannerUrl={persona.coverUrl}
              worldName={persona.worldName}
              active={false}
              onSelect={() => navigate(`/portfolio/${persona.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewShell() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <AmbientBackground variant="mesh" className="ras-shell">
      <div className="ras-shell__body">
        <StudioSidebar
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          visualFixturePersonas={PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST}
          visualFixturePendingReviews={PERSONA_WORKSPACE_VISUAL_FIXTURE_PENDING_REVIEWS}
        />
        <main className="ras-main">
          <Routes>
            <Route path="/portfolio" element={<PreviewPersonaLibrary />} />
            <Route path="/portfolio/:personaId" element={<PreviewWorkspace tab="detail" />} />
            <Route path="/portfolio/:personaId/posts" element={<PreviewWorkspace tab="posts" />} />
            <Route path="*" element={<Navigate to="/portfolio/visual-xiaomi" replace />} />
          </Routes>
        </main>
      </div>
    </AmbientBackground>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('REALM_PERSONA_STUDIO_VISUAL_PREVIEW_ROOT_MISSING');

const previewGlobal = globalThis as typeof globalThis & {
  __RPS_VISUAL_PREVIEW_ROOT__?: Root;
};
const previewRoot = previewGlobal.__RPS_VISUAL_PREVIEW_ROOT__ ?? createRoot(rootElement);
previewGlobal.__RPS_VISUAL_PREVIEW_ROOT__ = previewRoot;

previewRoot.render(
  <StrictMode>
    <NimiThemeProvider accentPack="nimi-accent" defaultScheme="light">
      <QueryClientProvider client={studioQueryClient}>
        <TooltipProvider>
          <HashRouter>
            <PreviewShell />
          </HashRouter>
          <NimiToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NimiThemeProvider>
  </StrictMode>,
);
