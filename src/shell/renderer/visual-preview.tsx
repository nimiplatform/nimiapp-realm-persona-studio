import { StrictMode, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  AmbientBackground,
  Button,
  EmptyState,
  FieldShell,
  InlineAlert,
  NimiTabs,
  NimiText,
  NimiThemeProvider,
  NimiToaster,
  StatusBadge,
  Surface,
  TextareaField,
  TooltipProvider,
} from '@nimiplatform/kit/ui';
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImageIcon, Scan } from 'lucide-react';
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
import { PersonaInsightsPage } from './features/persona-insights/persona-insights-page.js';
import { PersonaLaunchPage } from './features/persona-launch/persona-launch-page.js';
import { PersonaCard } from './features/portfolio/OwnerPortfolio.shared.js';
import { MediaVoiceCandidateWorkspace } from './features/portfolio/OwnerPortfolio.assets.js';
import {
  ReferenceImageSourceChooser,
  type ReferenceImageSourceMode,
} from './features/portfolio/reference-image-source-chooser.js';
import { studioQueryClient } from './infra/query-client.js';
import { ensureStudioI18nInitialized, translateStudioCopy } from './i18n/studio-i18n.js';
import './styles.css';

const previewI18n = ensureStudioI18nInitialized();
void previewI18n.changeLanguage('zh');

function PreviewWorkspace({ tab }: { tab: 'detail' | 'posts' | 'assets' }) {
  const { personaId = 'visual-xiaomi' } = useParams();
  const persona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS[personaId];
  const visualData = PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA[personaId];
  if (!persona || !visualData) return <Navigate to="/portfolio/visual-xiaomi" replace />;

  return (
    <PersonaWorkspaceFrame persona={persona} current={tab}>
      {tab === 'posts' ? (
        <PersonaPostEditor persona={persona} visualData={visualData} />
      ) : tab === 'assets' ? (
        <MediaVoiceCandidateWorkspace
          persona={persona}
          developmentVisualData={visualData}
          onPersonaWrite={async () => {
            throw new Error('Development visual fixture does not expose Realm writes.');
          }}
        />
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
        <NimiText as="h1" role="page-title" className="m-0">
          {translateStudioCopy('portfolio.title')}
        </NimiText>
      </header>
      <NimiTabs
        items={[
          { value: 'personas', label: translateStudioCopy('portfolio.tabs.personas') },
          { value: 'local-drafts', label: translateStudioCopy('portfolio.tabs.localDrafts') },
        ]}
        value="personas"
        onValueChange={() => undefined}
        ariaLabel={translateStudioCopy('portfolio.tabs.ariaLabel')}
      />
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

function PreviewCreateReferenceSources() {
  const [mode, setMode] = useState<ReferenceImageSourceMode | null>(null);
  const [prompt, setPrompt] = useState('character portrait, cinematic lighting, full body, high detail, neutral background');
  const [generationUnavailable, setGenerationUnavailable] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const previewFileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="ras-page ras-create-page">
      <header className="ras-page-header">
        <NimiText as="h1" role="page-title" className="m-0">
          {translateStudioCopy('create.title')}
        </NimiText>
        <StatusBadge tone="info">{translateStudioCopy('persona.workspace.fixtureBadge')}</StatusBadge>
      </header>
      <div className="grid min-w-0 gap-6 p-6">
        <Button tone="ghost" size="sm" className="justify-self-start" leadingIcon={<ArrowLeft size={15} aria-hidden="true" />}>
          {translateStudioCopy('create.review.back')}
        </Button>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-base font-semibold">{translateStudioCopy('create.review.basicInfo')}</h3>
            <StatusBadge tone="info">{translateStudioCopy('create.review.aiDraft')}</StatusBadge>
          </div>
          <Surface tone="card" material="glass-thick" padding="none" className="ras-create-reference-card">
            <h4 className="ras-create-reference-card__title">{translateStudioCopy('create.referenceTitle')}</h4>
            <button
              type="button"
              className="ras-create-reference-card__preview"
              aria-expanded={editorOpen}
              aria-label={`${translateStudioCopy('create.referenceTitle')}: ${translateStudioCopy('create.reference.emptyTitle')}. ${translateStudioCopy('create.reference.sourceTitle')}`}
              onClick={() => setEditorOpen((open) => !open)}
            >
              <Scan className="ras-create-reference-card__corner" data-corner="top-left" strokeWidth={1.15} aria-hidden="true" />
              <Scan className="ras-create-reference-card__corner" data-corner="top-right" strokeWidth={1.15} aria-hidden="true" />
              <Scan className="ras-create-reference-card__corner" data-corner="bottom-left" strokeWidth={1.15} aria-hidden="true" />
              <Scan className="ras-create-reference-card__corner" data-corner="bottom-right" strokeWidth={1.15} aria-hidden="true" />
              <span className="ras-create-reference-card__empty">
                <span className="ras-create-reference-card__empty-icon" aria-hidden="true">
                  <ImageIcon size={21} strokeWidth={1.8} />
                </span>
                <span className="ras-create-reference-card__empty-title">{translateStudioCopy('create.reference.emptyTitle')}</span>
                <span className="ras-create-reference-card__empty-description">{translateStudioCopy('create.reference.emptyDescription')}</span>
              </span>
            </button>
            {editorOpen ? (
              <div className="ras-create-reference-card__editor">
                <input
                  ref={previewFileInputRef}
                  type="file"
                  accept="image/*"
                  className="ras-create-visual-source__file-input"
                  aria-label={translateStudioCopy('assets.visualChange.uploadAriaLabel')}
                  onChange={(event) => {
                    event.currentTarget.value = '';
                    setGenerationUnavailable(true);
                  }}
                />
                <ReferenceImageSourceChooser
                  value={mode}
                  attached={false}
                  onUploadRequest={() => {
                    setMode(null);
                    setGenerationUnavailable(false);
                    previewFileInputRef.current?.click();
                  }}
                  onValueChange={(nextMode) => {
                    setMode(nextMode);
                    setGenerationUnavailable(false);
                  }}
                />
                {mode === 'assets' ? (
                  <EmptyState
                    title={translateStudioCopy('assets.visualChange.assetsEmptyTitle')}
                    description={translateStudioCopy('create.reference.assetsEmptyDescription')}
                  />
                ) : null}
                {mode === 'ai' ? (
                  <div className="grid gap-3">
                    <FieldShell label={translateStudioCopy('create.imagePromptLabel')} message={translateStudioCopy('create.imagePromptMessage')}>
                      <TextareaField rows={3} value={prompt} onChange={(event) => {
                        setPrompt(event.currentTarget.value);
                        setGenerationUnavailable(false);
                      }} />
                    </FieldShell>
                    <Button tone="ghost" size="sm" className="justify-self-end">{translateStudioCopy('create.imagePromptReset')}</Button>
                  </div>
                ) : null}
                {mode === 'ai' ? (
                  <>
                    <Button
                      tone="primary"
                      fullWidth
                      disabled={!prompt.trim()}
                      onClick={() => setGenerationUnavailable(true)}
                    >
                      {translateStudioCopy('create.generateReference')}
                    </Button>
                    {generationUnavailable ? <InlineAlert tone="info">{translateStudioCopy('create.reference.capabilityUnavailable')}</InlineAlert> : null}
                  </>
                ) : null}
                {mode === null && generationUnavailable ? <InlineAlert tone="info">{translateStudioCopy('create.reference.uploadUnavailable')}</InlineAlert> : null}
              </div>
            ) : null}
          </Surface>
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
            <Route path="/portfolio/:personaId/assets" element={<PreviewWorkspace tab="assets" />} />
            <Route path="/portfolio/:personaId/insights" element={<PersonaInsightsPage />} />
            <Route path="/portfolio/:personaId/launch" element={<PersonaLaunchPage />} />
            <Route path="/preview/create-reference-sources" element={<PreviewCreateReferenceSources />} />
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
  __RPS_VISUAL_PREVIEW__?: boolean;
};
previewGlobal.__RPS_VISUAL_PREVIEW__ = true;
const previewRoot = previewGlobal.__RPS_VISUAL_PREVIEW_ROOT__ ?? createRoot(rootElement);
previewGlobal.__RPS_VISUAL_PREVIEW_ROOT__ = previewRoot;

previewRoot.render(
  <StrictMode>
    <NimiThemeProvider accentPack="nimi-accent" defaultScheme="light" defaultDensity="compact">
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
