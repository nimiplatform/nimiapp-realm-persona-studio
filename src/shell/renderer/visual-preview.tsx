import { StrictMode, useRef, useState, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  AmbientBackground,
  Button,
  EmptyState,
  FieldShell,
  FieldTrigger,
  IconButton,
  InlineAlert,
  NimiText,
  NimiThemeProvider,
  NimiToaster,
  OverlayShell,
  SelectField,
  StatusBadge,
  Surface,
  TextareaField,
  TextField,
  TooltipProvider,
} from '@nimiplatform/kit/ui';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ImageIcon, Scan, X } from 'lucide-react';
import { StudioSidebar } from './app-shell/studio-sidebar/index.js';
import { PersonaVisualPreviewProvider } from './features/persona-detail/persona-visual-preview-context.js';
import {
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST,
} from './features/persona-detail/persona-workspace.visual-fixture.js';
import { PersonaOverviewPage } from './features/persona-overview/persona-overview-page.js';
import { PersonaIdentityPage } from './features/persona-identity/persona-identity-page.js';
import { PersonaPostsPage } from './features/persona-posts/persona-posts-page.js';
import { PersonaSettingsPage } from './features/persona-settings/persona-settings-page.js';
import { PersonaListPage } from './features/persona-list/persona-list-page.js';
import { PersonaContentManagementPage } from './features/persona-content-management/persona-content-management-page.js';
import { AssetsLibraryPage } from './features/assets-library/assets-library-page.js';
import { StudioAIConfigPage } from './features/ai-config/studio-ai-config-page.js';
import { ownerPortfolioListQueryKey } from './features/persona-detail/use-persona-detail-query.js';
import {
  PERSONA_ARCHETYPES,
  PERSONA_TRAIT_MAX,
  normalizeCreateRealmPersonaDraft,
  type CreateRealmPersonaDraftInput,
  type PersonaArchetype,
  type PersonaTrait,
} from './features/portfolio/create-persona-draft.js';
import { AutosaveIndicator } from './features/portfolio/create-realm-persona-workspace/autosave-indicator.js';
import { DescribeStage } from './features/portfolio/create-realm-persona-workspace/describe-stage.js';
import { createEmptyDraft } from './features/portfolio/create-realm-persona-workspace/draft-utils.js';
import { TraitsMultiSelect } from './features/portfolio/create-realm-persona-workspace/traits-multi-select.js';
import {
  ReferenceImageSourceChooser,
  type ReferenceImageSourceMode,
} from './features/portfolio/reference-image-source-chooser.js';
import { studioQueryClient } from './infra/query-client.js';
import {
  ensureStudioI18nInitialized,
  translatePersonaArchetypeLabel,
  translateStudioCopy,
} from './i18n/studio-i18n.js';
import './styles.css';

const previewI18n = ensureStudioI18nInitialized();
void previewI18n.changeLanguage('zh');

function useSeedPreviewSettingsCaches() {
  const seeded = useRef(false);
  if (seeded.current) {
    return;
  }
  seeded.current = true;
  // Development preview: seed read caches so the settings editor dialog renders
  // its editable state without a protected bridge. Writes still fail closed.
  studioQueryClient.setQueryDefaults(['realm-persona-studio', 'persona-settings'], { staleTime: Infinity, retry: false });
  studioQueryClient.setQueryDefaults(['realm-persona-studio', 'owner-persona-visibility'], { staleTime: Infinity, retry: false });
  studioQueryClient.setQueryDefaults(['realm-persona-studio', 'create-persona-worlds'], { staleTime: Infinity, retry: false });
  // Seed the owner portfolio list so the real PersonaListPage renders the visual
  // fixture personas; world banners stay empty so cards fall back to persona data.
  studioQueryClient.setQueryDefaults(ownerPortfolioListQueryKey(), { staleTime: Infinity, retry: false });
  studioQueryClient.setQueryDefaults(['realm-world-core', 'portfolio-card-banners'], { staleTime: Infinity, retry: false });
  studioQueryClient.setQueryData(ownerPortfolioListQueryKey(), PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST);
  studioQueryClient.setQueryData(['realm-world-core', 'portfolio-card-banners'], []);
  const previewWorlds = [...new Set(PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST.map((persona) => persona.worldName).filter(Boolean))]
    .map((worldName) => ({ id: worldName as string, name: worldName as string }));
  studioQueryClient.setQueryData(['realm-persona-studio', 'create-persona-worlds'], previewWorlds);
  for (const persona of Object.values(PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS)) {
    studioQueryClient.setQueryData(
      ['realm-persona-studio', 'persona-settings', persona.ownerScope, persona.id],
      {
        id: persona.id,
        contentHash: persona.contentHash,
        homeWorldId: persona.homeWorldId,
        displayName: persona.displayName.value,
        description: persona.bio.value,
        greeting: persona.greeting.value,
        handle: persona.handle.value,
      },
    );
    studioQueryClient.setQueryData(
      ['realm-persona-studio', 'owner-persona-visibility', persona.id],
      { visibility: persona.visibility.status === 'available' ? persona.visibility.value : 'private' },
    );
  }
}

function PreviewPersonaPage({ page: Page }: { page: ComponentType }) {
  const { personaId = 'visual-xiaomi' } = useParams();
  if (!PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS[personaId] || !PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA[personaId]) {
    return <Navigate to="/portfolio/visual-xiaomi" replace />;
  }
  return <Page />;
}

function PreviewCreateReferenceSources() {
  const [mode, setMode] = useState<ReferenceImageSourceMode | null>(null);
  const [prompt, setPrompt] = useState('character portrait, cinematic lighting, full body, high detail, neutral background');
  const [generationUnavailable, setGenerationUnavailable] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [concept, setConcept] = useState('');
  const [archetype, setArchetype] = useState<PersonaArchetype | ''>('');
  const [traits, setTraits] = useState<PersonaTrait[]>(['HUMOROUS', 'REBELLIOUS']);
  const previewFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="ras-page ras-create-page">
      <header className="ras-page-header">
        <NimiText as="h1" role="page-title" className="m-0">
          {translateStudioCopy('create.title')}
        </NimiText>
        <StatusBadge tone="success">{translateStudioCopy('create.autosave.saved')}</StatusBadge>
      </header>
      <div className="grid min-w-0 gap-5 px-1 pb-6 pt-1">
        <Button tone="ghost" size="sm" className="justify-self-start" leadingIcon={<ArrowLeft size={15} aria-hidden="true" />}>
          {translateStudioCopy('create.review.back')}
        </Button>

        <Surface tone="card" material="glass-thick" padding="none" className="ras-create-review-card">
          <div className="ras-create-review-form">
            <div className="ras-create-review-card__heading">
              <h3>{translateStudioCopy('create.review.basicInfo')}</h3>
              <StatusBadge tone="info">{translateStudioCopy('create.review.aiDraft')}</StatusBadge>
            </div>

            <Surface tone="card" material="glass-thick" padding="none" className="ras-create-reference-card">
              <h4 className="ras-create-reference-card__title">{translateStudioCopy('create.referenceTitle')}</h4>
              <button
                type="button"
                className="ras-create-reference-card__preview"
                aria-expanded={editorOpen}
                aria-label={`${translateStudioCopy('create.referenceTitle')}: ${translateStudioCopy('create.reference.emptyTitle')}. ${translateStudioCopy('create.reference.sourceTitle')}`}
                onClick={() => setEditorOpen(true)}
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
              <OverlayShell
                open={editorOpen}
                size="M"
                onClose={() => setEditorOpen(false)}
                title={(
                  <div className="ras-visual-change__title-row">
                    <span>{translateStudioCopy('create.referenceTitle')}</span>
                    <IconButton
                      tone="ghost"
                      size="sm"
                      className="ras-visual-change__close"
                      aria-label={translateStudioCopy('common.close')}
                      onClick={() => setEditorOpen(false)}
                      icon={<X size={18} strokeWidth={1.8} aria-hidden="true" />}
                    />
                  </div>
                )}
                description={<span className="ras-visual-change__description">{translateStudioCopy('create.reference.emptyDescription')}</span>}
                panelClassName="ras-visual-change-dialog"
                contentClassName="ras-visual-change-dialog__content"
                footer={(
                  <div className="flex justify-end">
                    <Button tone="secondary" onClick={() => setEditorOpen(false)}>{translateStudioCopy('common.cancel')}</Button>
                  </div>
                )}
                dataTestId="create-reference-image-dialog"
              >
                <div className="ras-visual-change">
                  <input
                    ref={previewFileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
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
              </OverlayShell>
            </Surface>

            <div className="ras-create-identity-grid">
              <div className="min-w-0" data-create-field="displayName">
                <FieldShell label={translateStudioCopy('create.displayNameLabel')}>
                  <TextField value={displayName} placeholder={translateStudioCopy('create.displayNamePlaceholder')} onChange={(event) => setDisplayName(event.currentTarget.value)} />
                </FieldShell>
              </div>
              <div className="min-w-0" data-create-field="handle">
                <FieldShell label={translateStudioCopy('create.handleLabel')}>
                  <TextField value={handle} placeholder={translateStudioCopy('create.handlePlaceholder')} onChange={(event) => setHandle(event.currentTarget.value)} />
                </FieldShell>
              </div>
            </div>

            <div className="min-w-0" data-create-field="concept">
              <FieldShell label={translateStudioCopy('create.conceptLabel')} message={translateStudioCopy('create.conceptMessage')}>
                <TextareaField rows={3} value={concept} placeholder={translateStudioCopy('create.conceptPlaceholder')} onChange={(event) => setConcept(event.currentTarget.value)} />
              </FieldShell>
            </div>

            <div className="ras-create-form-grid">
            <div className="min-w-0" data-create-field="personaArchetype">
              <FieldShell label={translateStudioCopy('create.personaArchetypeLabel')}>
                <SelectField
                  value={archetype}
                  options={[
                    { value: '', label: translateStudioCopy('create.personaArchetypePlaceholder') },
                    ...PERSONA_ARCHETYPES.map((value) => ({ value, label: translatePersonaArchetypeLabel(value) })),
                  ]}
                  onValueChange={(value) => setArchetype(value as PersonaArchetype | '')}
                />
              </FieldShell>
            </div>

            <div className="min-w-0" data-create-field="personaTraits">
              <FieldShell label={translateStudioCopy('create.personaTraitsLabel', { max: PERSONA_TRAIT_MAX })}>
                <TraitsMultiSelect value={traits} error={null} onChange={setTraits} />
              </FieldShell>
            </div>
            </div>

            <div className="min-w-0" data-create-field="selectedWorldId">
              <FieldShell label={translateStudioCopy('create.worldLabel')}>
                <FieldTrigger>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--nimi-radius-sm)] bg-[var(--nimi-action-primary-bg)] text-xs font-semibold text-[var(--nimi-action-primary-text)]">O</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">OASIS</span>
                    <span className="block truncate text-xs text-[var(--nimi-text-muted)]">OASIS · {translateStudioCopy('common.realm')}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--nimi-text-secondary)]">
                    {translateStudioCopy('create.world.change')}
                    <ChevronDown size={14} aria-hidden="true" />
                  </span>
                </FieldTrigger>
              </FieldShell>
            </div>
          </div>

          <details className="ras-create-prompt-panel grid gap-3 rounded-[var(--nimi-radius-lg)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-4">
            <summary className="cursor-pointer font-medium text-[var(--nimi-text-primary)]">{translateStudioCopy('create.prompt.title')}</summary>
            <p className="m-0 text-sm text-[var(--nimi-text-muted)]">{translateStudioCopy('create.prompt.description')}</p>
          </details>

          <div className="ras-create-review-actions">
            <Button tone="primary">{translateStudioCopy('create.submit')}</Button>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function PreviewCreateDescribe() {
  const [draft, setDraft] = useState<CreateRealmPersonaDraftInput>(() => createEmptyDraft());
  return (
    <div className="ras-page ras-create-page ras-create-page--describe">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <NimiText as="h1" role="page-title" className="m-0">
          {translateStudioCopy('create.title')}
        </NimiText>
        <AutosaveIndicator state="saved" failureMessage={null} idle />
      </header>
      <DescribeStage
        originalDescription={draft.originalDescription}
        normalizedDraft={normalizeCreateRealmPersonaDraft(draft)}
        seedResult={null}
        isGeneratingSeed={false}
        isGeneratingDescription={false}
        updateDraft={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onRunSeedGeneration={() => undefined}
        onRunDescriptionReroll={() => undefined}
        onSkipSeed={() => undefined}
      />
    </div>
  );
}

function PreviewShell() {
  const [collapsed, setCollapsed] = useState(false);
  useSeedPreviewSettingsCaches();
  return (
    <AmbientBackground variant="mesh" className="ras-shell">
      <div className="ras-shell__body">
        <StudioSidebar
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          visualFixturePersonas={PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST}
        />
        <main className="ras-main">
          <Routes>
            <Route path="/portfolio" element={<PersonaListPage />} />
            <Route path="/portfolio/create" element={<PreviewCreateDescribe />} />
            <Route path="/portfolio/:personaId" element={<PreviewPersonaPage page={PersonaOverviewPage} />} />
            <Route path="/portfolio/:personaId/settings" element={<PreviewPersonaPage page={PersonaSettingsPage} />} />
            <Route path="/portfolio/:personaId/identity" element={<PreviewPersonaPage page={PersonaIdentityPage} />} />
            <Route path="/portfolio/:personaId/posts" element={<PreviewPersonaPage page={PersonaPostsPage} />} />
            <Route path="/portfolio/:personaId/posts/manage" element={<PreviewPersonaPage page={PersonaContentManagementPage} />} />
            <Route path="/assets" element={<AssetsLibraryPage />} />
            <Route path="/ai-config" element={<StudioAIConfigPage />} />
            <Route path="/preview/create-reference-sources" element={<PreviewCreateReferenceSources />} />
            <Route path="/preview/create-describe" element={<PreviewCreateDescribe />} />
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
    <NimiThemeProvider accentPack="nimi-accent" defaultScheme="light" defaultDensity="compact">
      <QueryClientProvider client={studioQueryClient}>
        <TooltipProvider>
          <HashRouter>
            <PersonaVisualPreviewProvider
              details={PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS}
              visualData={PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA}
            >
              <PreviewShell />
            </PersonaVisualPreviewProvider>
          </HashRouter>
          <NimiToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NimiThemeProvider>
  </StrictMode>,
);
