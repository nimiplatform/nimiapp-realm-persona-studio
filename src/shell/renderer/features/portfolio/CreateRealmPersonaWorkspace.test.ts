import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceSource = () => {
  const moduleDir = join(process.cwd(), 'src/shell/renderer/features/portfolio/create-realm-persona-workspace');
  const moduleFiles = readdirSync(moduleDir)
    .filter((file) => /\.tsx?$/.test(file))
    .sort()
    .map((file) => readFileSync(join(moduleDir, file), 'utf8'));
  return [
    readFileSync(join(process.cwd(), 'src/shell/renderer/features/portfolio/CreateRealmPersonaWorkspace.tsx'), 'utf8'),
    ...moduleFiles,
  ].join('\n');
};

const stylesSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/styles.css'), 'utf8');

const retiredImportToken = ['character', 'Card'].join('');
const retiredDropzoneClass = ['ras-create', 'character', 'card-dropzone'].join('-');
const retiredHandleCandidate = ['createRealm', 'Ag', 'ent', 'HandleCandidate'].join('');
const retiredTraitLimitName = ['PERSONA_TRAIT_MAX', 'RECOMMENDED'].join('_');

describe('Create Realm Persona workspace v2 shell', () => {
  it('uses the shared route-level page container in every creation state', () => {
    const source = workspaceSource();

    expect(source.match(/className="ras-page ras-create-page"/g)).toHaveLength(2);
    expect(source).toContain('className="ras-page ras-create-page ras-create-page--describe"');
    expect(source).not.toContain('max-w-[920px]');
  });

  it('keeps the two-stage describe/review flow and local draft entry', () => {
    const source = workspaceSource();

    expect(source).toContain("type CreateStage = 'describe' | 'review'");
    expect(source).toContain("stage: 'describe'");
    expect(source).toContain("stage: 'review'");
    expect(source).toContain("'return-to-describe'");
    expect(source).toContain("create.oneLineLabel");
    expect(source).toContain("create.review.basicInfo");
    expect(source).not.toContain("t('create.review.title')");
    expect(source).not.toContain("t('create.review.description')");
    expect(source).toContain('createCreationDraftKey');
    expect(source).toContain('loadCreationDraft');
    expect(source).not.toContain("type CreateStage = 'seed' | 'edit'");
  });

  it('keeps owner supplements in the local draft and seed prompt', () => {
    const source = workspaceSource();

    expect(source).toContain('speechSupplement');
    expect(source).toContain('boundarySupplement');
    expect(source).toContain('visualSupplement');
    expect(source).toContain('generatePersonaSeedFromDescription(seedDescription, undefined, supplements, { locale })');
    expect(source).toContain('create.supplement.speech');
    expect(source).toContain('create.supplement.boundary');
    expect(source).toContain('create.supplement.visual');
  });

  it('keeps the describe screen focused on the primary creation actions inside a centered card', () => {
    const source = workspaceSource();
    const styles = stylesSource();

    expect(source).toContain('ras-create-page--describe');
    expect(source).toContain('className="ras-create-describe-card"');
    expect(source).toContain('ras-create-describe-card__body');
    expect(styles).toContain('.ras-create-page--describe {');
    expect(styles).toContain('.ras-create-describe-card {');
    expect(styles).toContain('.ras-create-describe-divider {');
    expect(styles).toContain('.ras-create-ai-button {');
    expect(styles).toContain('.ras-create-manual-button {');
    expect(source).not.toContain("t('create.oneLineOptional')");
    expect(source).toContain("t('create.supplement.hint')");
    expect(source).toContain("t('create.aiButton.helper')");
    expect(source).not.toContain("t('create.estimatedTime')");
    expect(source).not.toContain("t('create.describe.heading')");
    expect(source).not.toContain("t('create.describe.hint')");
    expect(source).not.toContain("t('create.describe.helper')");
    expect(source).not.toContain("t('create.describe.badge')");
    expect(source).not.toContain('create.boundaryLabel');
    expect(source).not.toContain('create.boundaryDescription');
    expect(source).not.toContain('create.generateFromDescription');
  });

  it('renders the creation choices as a right-aligned footer action group', () => {
    const source = workspaceSource();

    expect(source).toContain("t('create.aiButton.label')");
    expect(source).toContain("t('create.manualButton.label')");
    expect(source).toContain('tone="primary"');
    expect(source).toContain('leadingIcon={<Pencil size={18} aria-hidden="true" />}');
    expect(source).not.toContain('AppCardSurface');
    expect(source).not.toContain('create.manualRow.text');
  });

  it('keeps AI completion open to zero input with owner-input precedence on merge', () => {
    const source = workspaceSource();

    expect(source).not.toContain('disabled={!normalizedDraft.originalDescription}');
    expect(source).not.toContain('if (!seedDescription) return;');
    expect(source).toContain('current.handle.trim() ? current.handle : result.seed.handle');
    expect(source).toContain('current.displayName.trim() ? current.displayName : result.seed.displayName');
    expect(source).toContain('current.concept.trim() ? current.concept : result.seed.concept');
    expect(source).toContain('current.description.trim() ? current.description : result.seed.description');
    expect(source).toContain('current.ruleText.trim() ? current.ruleText : result.seed.ruleText');
    expect(source).toContain('current.personaArchetype.trim() ? current.personaArchetype : result.seed.personaArchetype');
    expect(source).toContain('current.personaTraits.length > 0 ? current.personaTraits : result.seed.personaTraits');
    expect(source).toContain('current.speechSupplement?.trim() ? current.speechSupplement : result.seed.speechStyle');
    expect(source).toContain('current.boundarySupplement?.trim() ? current.boundarySupplement : result.seed.behaviorBoundary');
    expect(source).not.toContain('fill-default-world');
  });

  it('offers a description reroll that only rewrites the owner-editable describe input', () => {
    const source = workspaceSource();

    expect(source).toContain("t('create.descriptionReroll.label')");
    expect(source).toContain("t('create.descriptionReroll.generating')");
    expect(source).toContain('generatePersonaDescriptionCandidate({');
    expect(source).toContain('updateDraft({ originalDescription: result.description })');
    expect(source).toContain('create.descriptionGenerationFailed');
    expect(source).toContain('disabled={isGeneratingDescription}');
    expect(source).toContain('disabled={isGeneratingSeed}');
  });

  it('renders typed autosave state without coupling the persona roster to draft-history events', () => {
    const source = workspaceSource();
    const store = readFileSync(join(process.cwd(), 'src/shell/renderer/features/portfolio/creation-draft-store.ts'), 'utf8');
    const sidebar = readFileSync(join(process.cwd(), 'src/shell/renderer/app-shell/studio-sidebar/studio-sidebar.tsx'), 'utf8');

    expect(source).toContain('CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS');
    expect(source).toContain('create.autosave.failed');
    expect(source).toContain('persistCreationDraft(draftKey, draft)');
    expect(source).toContain('upsertCreationDraftHistoryEntry');
    expect(source).toContain('normalizedDraft.displayName || normalizedDraft.originalDescription');
    expect(source).toContain('if (draftHistoryLabel)');
    expect(source).toContain("search.set('draft', draftKey)");
    expect(source).toContain("navigate({ pathname: location.pathname, search: `?${search.toString()}` }, { replace: true })");
    expect(store).toContain("'rps:creation-draft-history-updated'");
    expect(sidebar).toContain('listOwnerPortfolioPersonas');
    expect(sidebar).not.toContain('CREATION_DRAFT_HISTORY_UPDATED_EVENT');
  });

  it('keeps reviewed fields editable and validates them on explicit create', () => {
    const source = workspaceSource();

    expect(source).toContain('onChange={(event) => updateDraft({ displayName: event.currentTarget.value })}');
    expect(source).toContain('onChange={(event) => updateDraft({ handle: event.currentTarget.value })}');
    expect(source).toContain('const readiness = validateCreateRealmPersonaReadiness(draft, { selectableWorldIds, handleAvailability })');
    expect(source).toContain('const acceptedFingerprint = acceptPersonaCreationGraphForRealmCreate(creationGraph)');
    expect(source).toContain('validatePersonaCreationGraphForRealmCreate(creationGraph, acceptedFingerprint)');
    expect(source).toContain('setGraphAcceptedFingerprint(acceptedFingerprint)');
    expect(source).toContain('const createDisabled = createMutation.isPending');
    expect(source).toContain('!readiness.ready');
    expect(source).toContain('queryClient.fetchQuery({');
    expect(source).toContain('getOwnerPortfolioPersonaDetail(result.canonical.id)');
    expect(source).toContain("onOpenCreatedPersona(result.canonical.id)");
    expect(source).not.toContain('!creationGraphReview.canAccept');
    expect(source).not.toContain('handleCheckBlocking');
  });

  it('moves submit validation to the affected field with inline danger feedback', () => {
    const source = workspaceSource();

    expect(source).toContain('createFieldErrorsFromReadiness(readiness.errors)');
    expect(source).toContain('firstInvalidCreateField(nextFieldErrors)');
    expect(source).toContain('focusCreateField(firstInvalidField)');
    expect(source).toContain('scrollIntoView?.({ behavior: \'smooth\', block: \'center\' })');
    expect(source).toContain("tone={displayNameError ? 'danger' : 'default'}");
    expect(source).toContain("tone={handleError ? 'danger' : 'default'}");
    expect(source).toContain("tone={conceptError ? 'danger' : 'default'}");
    expect(source).toContain('data-create-field="personaArchetype"');
    expect(source).toContain('data-create-field="personaTraits"');
    expect(source).toContain('data-create-field="selectedWorldId"');
    expect(source).not.toContain("t('create.validationFailed'");
    expect(source).not.toContain("t('create.source.ownerLocal')");
    expect(source).not.toContain("t('create.worldDefault'");
  });

  it('renders the review form as one cohesive glass card', () => {
    const source = workspaceSource();
    const styles = stylesSource();

    expect(source).toContain('className="ras-create-review-card"');
    expect(source).toContain('className="ras-create-review-form"');
    expect(styles).toContain('.ras-create-review-card {');
    expect(styles).toContain('border-radius: 18px;');
  });

  it('places the Persona image beside identity fields and keeps personality controls below', () => {
    const source = workspaceSource();
    const styles = stylesSource();

    expect(source).not.toContain('xl:grid-cols-[380px_minmax(0,1fr)]');
    // DOM order matches visual order: the identity fields come before the
    // reference card inside the two-column review-form containers.
    expect(source).toMatch(/create\.review\.basicInfo[\s\S]*ras-create-identity-grid[\s\S]*ReferenceImageCard/);
    expect(source).toContain('ras-create-review-form__fields');
    expect(source).toContain('ras-create-review-form__aside');
    expect(source).toContain('setReferenceImageEditorOpen(true)');
    expect(source).toContain('aria-expanded={referenceImageEditorOpen}');
    expect(source).toContain('open={referenceImageEditorOpen}');
    expect(source).toContain('panelClassName="ras-visual-change-dialog"');
    expect(source).toContain('dataTestId="create-reference-image-dialog"');
    expect(styles).toContain('grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.82fr);');
    expect(styles).toContain('.ras-create-review-form__aside {');
    expect(styles).not.toContain('.ras-create-review-form > .ras-create-reference-card {');
    expect(styles).not.toContain('grid-row: 1 / span 3;');
    expect(source).toContain('className="ras-create-personality-grid"');
    expect(styles).toContain('.ras-create-personality-grid {');
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
  });

  it('shows inline danger feedback without a required asterisk and restores normal focus color on focus', () => {
    const source = workspaceSource();

    expect(source).not.toContain("t('create.displayNameMessage')");
    expect(source).not.toContain("t('create.handleMessage')");
    expect(source).not.toContain("t('create.personaArchetypeMessage')");
    expect(source).not.toContain('aria-hidden="true">*</span>');
    expect(source).toContain('focus-within:!border-[var(--nimi-field-focus)]');
    expect(source).toContain('focus-within:!ring-[var(--nimi-focus-ring-color)]');
    expect(source).toContain('focus:!border-[var(--nimi-field-focus)]');
    expect(source).toContain('focus:!ring-[var(--nimi-focus-ring-color)]');
    expect(source).toMatch(/<SelectField\s+required\s+value=\{draft\.personaArchetype \|\| SELECT_UNSET_VALUE\}/);
    expect(source).toContain("const SELECT_UNSET_VALUE = '__realm_persona_studio_unset__';");
    expect(source).not.toContain("{ value: '', label: t('create.personaArchetypePlaceholder') }");
    expect(source).not.toContain("{ value: '', label: t('create.visibilityPlaceholder') }");
  });

  it('does not render creation technical details or validation preview', () => {
    const source = workspaceSource();

    expect(source).not.toContain('TechnicalReviewDetails');
    expect(source).not.toContain('ReadinessPreview');
    expect(source).not.toContain("t('create.technicalDetails')");
    expect(source).not.toContain("t('create.readinessDetails')");
  });

  it('uses the hard trait cap instead of a warning-only recommendation', () => {
    const source = workspaceSource();
    const draft = readFileSync(join(process.cwd(), 'src/shell/renderer/features/portfolio/create-persona-draft.ts'), 'utf8');

    expect(source).toContain('PERSONA_TRAIT_MAX');
    expect(source).toContain('ras-create-trait-trigger');
    expect(source).toContain('<Popover');
    expect(source).toContain('PopoverTrigger');
    expect(source).toContain('PopoverContent');
    expect(source).toContain('Checkbox');
    expect(source).toContain('ScrollArea');
    expect(source).toContain('create.personaTraitsSelectedCount');
    expect(source).toContain('create.personaTraitsClear');
    expect(source).toContain('disabled={disabled}');
    expect(source).not.toContain('ras-create-trait-popover');
    expect(source).not.toContain('ras-create-trait-option');
    expect(source).not.toContain('create.personaTraitsHardLimit');
    expect(draft).toContain("'persona-traits-too-many'");
    expect(draft).not.toContain(retiredTraitLimitName);
  });

  it('uses a kit world dialog with grouped radio rows and keyboard movement', () => {
    const source = workspaceSource();

    expect(source).toContain('OverlayShell');
    expect(source).toContain('kind="dialog"');
    expect(source).toContain('size="S"');
    expect(source).toContain('SearchField');
    expect(source).toContain('role="radiogroup"');
    expect(source).toContain('role="radio"');
    expect(source).toContain('aria-checked={selected}');
    expect(source).toContain('ArrowDown');
    expect(source).toContain('create.world.recommended');
    expect(source).toContain('create.world.all');
    expect(source).toContain('groupSelectableRealmWorldsForPicker');
  });

  it('pre-selects the source-backed OASIS default world when the draft has no explicit selection', () => {
    const source = workspaceSource();

    expect(source).toContain('selectOasisDefaultWorld(worlds)');
    expect(source).toContain("draftLoadState !== 'ready'");
    expect(source).toContain('actions.applyDefaultWorld(oasisDefaultWorld.id)');
    expect(source).not.toContain('actions.updateDraft({ selectedWorldId: oasisDefaultWorld.id })');
    expect(source).not.toContain('fill-default-world');
  });

  it('keeps image generation actual, owner-reviewed, local, and fail-closed without the candidate-slot module', () => {
    const source = workspaceSource();

    expect(source).toContain('referenceImageCandidates');
    expect(source).toContain('referenceImagePrompt');
    expect(source).toContain('count: 1');
    expect(source).toContain('create.reference.selectCandidate');
    expect(source).toContain('create.reference.regenerateSelected');
    expect(source).toContain('create.reference.capabilityUnavailable');
    expect(source).toContain('generatePersonaReferenceImage');
    expect(source).not.toContain('count: 4');
    expect(source).not.toContain('create.reference.candidatesTitle');
    expect(source).not.toContain('create.reference.slotCount');
    expect(source).not.toContain('create.reference.emptySlotLabel');
    expect(source).not.toContain('create.reference.sourceSlotHelp');
    expect(source).not.toContain('create.reference.insufficient');
  });

  it('offers upload, owner-reviewed assets, and AI generation through one visual-source surface', () => {
    const source = workspaceSource();

    expect(source).toContain('ReferenceImageSourceChooser');
    expect(source).toContain('DEFAULT_REFERENCE_IMAGE_SOURCE_MODE');
    expect(source).toContain('set-reference-source-mode');
    const chooser = readFileSync(join(process.cwd(), 'src/shell/renderer/features/portfolio/reference-image-source-chooser.tsx'), 'utf8');
    expect(chooser).toContain("export type ReferenceImageSourceMode = 'assets' | 'ai'");
    expect(chooser).toContain("t('assets.visualChange.upload')");
    expect(chooser).toContain("t('assets.visualChange.assets')");
    expect(chooser).toContain("t('assets.visualChange.ai')");
    expect(chooser).toContain('onUploadRequest');
    expect(source).toContain('importLocalAssetFile');
    expect(source).toContain('aggregateAssetLibraryData');
    expect(source).toContain('adoptImportedReferenceImageCandidate');
    expect(source).toContain('referenceImageFileInputRef.current?.click()');
    expect(source).not.toContain('window.setTimeout(() => referenceImageFileInputRef.current?.click()');
    expect(source).not.toContain('data-testid="create-reference-upload"');
    expect(source).toContain("'create.reference.uploadUnavailable'");
    expect(source).toContain("t('create.reference.uploadLocalOnly')");
    expect(source).not.toContain('REFERENCE_IMAGE_CANDIDATE_SLOT_COUNT');
  });

  it('renders world recovery, keeps the prompt view read-only, and exposes a separate editable image prompt', () => {
    const source = workspaceSource();

    expect(source).toContain('WorldRecoveryPanel');
    expect(source).toContain('countCompletedCreationDraftFields(draft)');
    expect(source).toContain('create.worldRecovery.retry');
    expect(source).toContain('create.worldRecovery.submitDisabled');
    expect(source).toContain('PromptReadOnly');
    expect(source).toContain('create.prompt.copy');
    expect(source).toContain('value={draft.referenceImagePrompt}');
    expect(source).toContain('create.imagePromptReset');
  });

  it('does not expose the retired card import or old hard-cut handle candidate', () => {
    const source = workspaceSource();
    const styles = stylesSource();

    expect(source).not.toContain(`function handle${retiredImportToken}Drop`);
    expect(source).not.toContain(`void import${retiredImportToken}File(file)`);
    expect(source).not.toContain(`className="${retiredDropzoneClass}"`);
    expect(source).not.toContain(retiredHandleCandidate);
    expect(styles).not.toContain(`.${retiredDropzoneClass}:hover`);
    expect(styles).not.toContain(`.${retiredDropzoneClass}[data-drag-active]`);
    expect(styles).not.toContain(`.${retiredDropzoneClass}__hint`);
  });
});
