import { StrictMode, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  AmbientBackground,
  Button,
  EmptyState,
  FieldShell,
  FieldTrigger,
  InlineAlert,
  NimiTabs,
  NimiText,
  NimiThemeProvider,
  NimiToaster,
  SelectField,
  StatusBadge,
  Surface,
  TextareaField,
  TextField,
  TooltipProvider,
} from '@nimiplatform/kit/ui';
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ImageIcon, Scan } from 'lucide-react';
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
  PERSONA_ARCHETYPES,
  PERSONA_TRAITS,
  PERSONA_TRAIT_MAX,
  type PersonaArchetype,
  type PersonaTrait,
} from './features/portfolio/create-persona-draft.js';
import {
  ReferenceImageSourceChooser,
  type ReferenceImageSourceMode,
} from './features/portfolio/reference-image-source-chooser.js';
import { studioQueryClient } from './infra/query-client.js';
import {
  ensureStudioI18nInitialized,
  translatePersonaArchetypeLabel,
  translatePersonaTraitLabel,
  translateStudioCopy,
} from './i18n/studio-i18n.js';
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
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [concept, setConcept] = useState('');
  const [archetype, setArchetype] = useState<PersonaArchetype | ''>('');
  const [traits, setTraits] = useState<PersonaTrait[]>(['HUMOROUS', 'REBELLIOUS']);
  const [traitPickerOpen, setTraitPickerOpen] = useState(true);
  const previewFileInputRef = useRef<HTMLInputElement>(null);

  const toggleTrait = (trait: PersonaTrait) => {
    setTraits((current) => current.includes(trait)
      ? current.filter((value) => value !== trait)
      : current.length < PERSONA_TRAIT_MAX ? [...current, trait] : current);
  };

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

            <div className="ras-create-personality-grid">
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
                <div className="ras-create-trait-picker" data-open={traitPickerOpen || undefined}>
                  <button
                    type="button"
                    className="ras-create-trait-trigger"
                    aria-expanded={traitPickerOpen}
                    onClick={() => setTraitPickerOpen((open) => !open)}
                  >
                    <span className="ras-create-trait-trigger__selection">
                      {traits.length > 0 ? traits.map((trait) => (
                        <span key={trait} className="ras-create-trait-chip">
                          {translatePersonaTraitLabel(trait).split(' · ')[0]}
                        </span>
                      )) : (
                        <span className="ras-create-trait-trigger__placeholder">
                          {translateStudioCopy('create.personaTraitsPlaceholder', { max: PERSONA_TRAIT_MAX })}
                        </span>
                      )}
                    </span>
                    <ChevronDown className="ras-create-trait-trigger__chevron" size={15} aria-hidden="true" />
                  </button>
                  {traitPickerOpen ? (
                    <div className="ras-create-trait-popover">
                      <div className="ras-create-trait-grid">
                        {PERSONA_TRAITS.map((trait) => {
                          const active = traits.includes(trait);
                          return (
                            <button
                              key={trait}
                              type="button"
                              className="ras-create-trait-option"
                              aria-pressed={active}
                              disabled={!active && traits.length >= PERSONA_TRAIT_MAX}
                              onClick={() => toggleTrait(trait)}
                            >
                              {active ? <Check size={13} strokeWidth={2.2} aria-hidden="true" /> : null}
                              {translatePersonaTraitLabel(trait)}
                            </button>
                          );
                        })}
                      </div>
                      <div className="ras-create-trait-popover__footer">
                        <span>{translateStudioCopy('create.personaTraitsSelectedCount', { count: traits.length, max: PERSONA_TRAIT_MAX })}</span>
                        <button type="button" disabled={traits.length === 0} onClick={() => setTraits([])}>
                          {translateStudioCopy('create.personaTraitsClear')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
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
