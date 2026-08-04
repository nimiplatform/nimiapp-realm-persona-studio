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
  it('keeps the two-stage describe/review flow and local draft entry', () => {
    const source = workspaceSource();

    expect(source).toContain("type CreateStage = 'describe' | 'review'");
    expect(source).toContain("const [stage, setStage] = useState<CreateStage>('describe')");
    expect(source).toContain("setStage('review')");
    expect(source).toContain("setStage('describe')");
    expect(source).toContain("create.describe.heading");
    expect(source).toContain("create.review.title");
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

  it('renders typed autosave state and updates the sidebar history event after persistence', () => {
    const source = workspaceSource();
    const store = readFileSync(join(process.cwd(), 'src/shell/renderer/features/portfolio/creation-draft-store.ts'), 'utf8');
    const sidebar = readFileSync(join(process.cwd(), 'src/shell/renderer/app-shell/studio-sidebar/studio-sidebar.tsx'), 'utf8');

    expect(source).toContain('CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS');
    expect(source).toContain('create.autosave.failed');
    expect(source).toContain('persistCreationDraft(draftKey, draft)');
    expect(source).toContain('upsertCreationDraftHistoryEntry');
    expect(store).toContain("'rps:creation-draft-history-updated'");
    expect(sidebar).toContain('window.addEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT');
  });

  it('keeps reviewed fields editable and gates the final write on graph acceptance', () => {
    const source = workspaceSource();

    expect(source).toContain('onChange={(event) => updateDraft({ displayName: event.currentTarget.value })}');
    expect(source).toContain('onChange={(event) => updateDraft({ handle: event.currentTarget.value })}');
    expect(source).toContain('GraphReviewBoard');
    expect(source).toContain('validatePersonaCreationGraphForRealmCreate(creationGraph, graphAcceptedFingerprint)');
    expect(source).toContain('setGraphAcceptedFingerprint(acceptPersonaCreationGraphForRealmCreate(creationGraph))');
    expect(source).toContain('const createDisabled = createMutation.isPending');
    expect(source).toContain('!readiness.ready');
    expect(source).toContain('!creationGraphReview.ready');
    expect(source).toContain('handleCheckBlocking');
  });

  it('uses the hard trait cap instead of a warning-only recommendation', () => {
    const source = workspaceSource();
    const draft = readFileSync(join(process.cwd(), 'src/shell/renderer/features/portfolio/create-persona-draft.ts'), 'utf8');

    expect(source).toContain('PERSONA_TRAIT_MAX');
    expect(source).toContain('disabled={disabled}');
    expect(source).toContain('create.personaTraitsHardLimit');
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

  it('keeps image candidates actual, local, and fail-closed', () => {
    const source = workspaceSource();

    expect(source).toContain('referenceImageCandidates');
    expect(source).toContain('count: 4');
    expect(source).toContain('create.reference.insufficient');
    expect(source).toContain('create.reference.capabilityUnavailable');
    expect(source).toContain('generatePersonaReferenceImage');
    expect(source).not.toContain('placeholder="');
    expect(source).not.toContain('referenceImagePrompt');
  });

  it('renders the dedicated world recovery state and keeps the prompt view read-only', () => {
    const source = workspaceSource();

    expect(source).toContain('WorldRecoveryPanel');
    expect(source).toContain('countCompletedCreationDraftFields(draft)');
    expect(source).toContain('create.worldRecovery.retry');
    expect(source).toContain('create.worldRecovery.submitDisabled');
    expect(source).toContain('PromptReadOnly');
    expect(source).toContain('create.prompt.copy');
    expect(source).not.toContain('value={referenceImagePrompt}');
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
