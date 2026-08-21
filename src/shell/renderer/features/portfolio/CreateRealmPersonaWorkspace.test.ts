import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceSource = () =>
  readFileSync(join(process.cwd(), 'src/shell/renderer/features/portfolio/CreateRealmPersonaWorkspace.tsx'), 'utf8');

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
    expect(source).toContain("const [stage, setStage] = useState<CreateStage>('describe')");
    expect(source).toContain("setStage('review')");
    expect(source).toContain("setStage('describe')");
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
    expect(source).toContain('generatePersonaSeedFromDescription(seedDescription, undefined, supplements)');
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
    expect(source).toContain("t('create.oneLineRequired')");
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
    expect(source).not.toContain('useNavigate');
  });

  it('renders the creation choices as stacked primary and secondary buttons', () => {
    const source = workspaceSource();

    expect(source).toContain("t('create.aiButton.label')");
    expect(source).toContain("t('create.manualButton.label')");
    expect(source).toContain('tone="primary"');
    expect(source).toContain('leadingIcon={<Pencil size={18} aria-hidden="true" />}');
    expect(source).not.toContain('AppCardSurface');
    expect(source).not.toContain('create.manualRow.text');
  });

  it('renders typed autosave state without coupling the persona roster to draft-history events', () => {
    const source = workspaceSource();
    const store = readFileSync(join(process.cwd(), 'src/shell/renderer/features/portfolio/creation-draft-store.ts'), 'utf8');
    const sidebar = readFileSync(join(process.cwd(), 'src/shell/renderer/app-shell/studio-sidebar/studio-sidebar.tsx'), 'utf8');

    expect(source).toContain('CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS');
    expect(source).toContain('create.autosave.failed');
    expect(source).toContain('persistCreationDraft(draftKey, draft)');
    expect(source).toContain('upsertCreationDraftHistoryEntry');
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
    expect(source).toMatch(/create\.review\.basicInfo[\s\S]*ras-create-reference-card[\s\S]*ras-create-identity-grid/);
    expect(source).toContain('setReferenceImageEditorOpen(true)');
    expect(source).toContain('aria-expanded={referenceImageEditorOpen}');
    expect(source).toContain('open={referenceImageEditorOpen}');
    expect(source).toContain('panelClassName="ras-visual-change-dialog"');
    expect(source).toContain('dataTestId="create-reference-image-dialog"');
    expect(styles).toContain('grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.82fr);');
    expect(styles).toContain('.ras-create-review-form > .ras-create-reference-card {');
    expect(styles).toContain('grid-row: 1 / span 3;');
    expect(source).toContain('className="ras-create-personality-grid"');
    expect(styles).toContain('.ras-create-personality-grid {');
    expect(styles).toContain('grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.28fr);');
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
    expect(source).toMatch(/<SelectField\s+required\s+value=\{draft\.personaArchetype\}/);
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
    expect(source).toContain('aria-expanded={traitPickerOpen}');
    expect(source).toContain('className="ras-create-trait-popover"');
    expect(source).toContain('create.personaTraitsSelectedCount');
    expect(source).toContain('create.personaTraitsClear');
    expect(source).toContain('disabled={disabled}');
    expect(source).not.toContain('create.personaTraitsHardLimit');
    expect(draft).toContain('persona traits exceed hard maximum of 3');
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
    expect(source).toContain("useState<ReferenceImageSourceMode | null>('ai')");
    expect(source).toContain("setReferenceImageSourceMode('ai')");
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
