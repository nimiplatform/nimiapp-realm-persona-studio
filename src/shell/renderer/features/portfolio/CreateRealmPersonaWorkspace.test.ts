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

describe('Create Realm Persona workspace shell', () => {
  it('keeps the reviewed creation flow with hard-cut source options visible', () => {
    const source = workspaceSource();

    expect(source).toContain("type CreateStage = 'seed' | 'edit'");
    expect(source).toContain("const [stage, setStage] = useState<CreateStage>('seed')");
    expect(source).toContain('SOURCE_MODE_OPTIONS');
    expect(source).toContain("mode: 'description'");
    expect(source).toContain("mode: 'manual'");
    expect(source).toContain("'create.source.description.title'");
    expect(source).toContain("'create.source.manual.title'");
    expect(source).toContain("'create.seedDescription'");
    expect(source).toContain("'create.manualEntryTitle'");
    expect(source).not.toContain(`'create.source.${retiredImportToken}.title'`);
    expect(source).not.toContain("'create.source.remix.title'");
  });

  it('keeps AI material as candidate/local draft before Realm create', () => {
    const source = workspaceSource();

    expect(source).toContain('generatePersonaSeedFromDescription(seedDescription)');
    expect(source).toContain("'create.aiDraftRationale'");
    expect(source).toContain("'create.boundaryDescription'");
    expect(source).toContain('referenceImageUrl: \'\'');
    expect(source).not.toContain(`parseDownloaded${retiredImportToken}File`);
    expect(source).not.toContain(`map${retiredImportToken}ToGraphSourceFields`);
    expect(source).toContain('createReviewedRealmPersonaWithProfileSettings(payload)');
    expect(source).toContain('validateCreateRealmPersonaReadiness(draft, { selectableWorldIds, handleAvailability })');
    expect(source).toContain('createMutation.mutate(readiness.payload)');
    expect(source).not.toContain('Object.entries(readiness.payload.body)');
  });

  it('does not expose the retired card import in the hard-cut create flow', () => {
    const source = workspaceSource();
    const styles = stylesSource();

    expect(source).not.toContain(`function handle${retiredImportToken}Drop`);
    expect(source).not.toContain(`void import${retiredImportToken}File(file)`);
    expect(source).not.toContain(`className="${retiredDropzoneClass}"`);
    expect(source).not.toContain(`data-drag-active={is${retiredImportToken}DragActive || undefined}`);
    expect(source).not.toContain(`t('create.${retiredImportToken}DropzoneTitle')`);
    expect(source).not.toContain(`t('create.${retiredImportToken}DropzoneHint')`);
    expect(source).not.toContain(`className="${['ras-create', 'character', 'card-field__message'].join('-')}"`);
    expect(styles).not.toContain(`.${retiredDropzoneClass}:hover`);
    expect(styles).not.toContain(`.${retiredDropzoneClass}[data-drag-active]`);
    expect(styles).not.toContain(`.${retiredDropzoneClass}__hint`);
  });

  it('gates create on reviewed essentials, graph review, handle preflight, and world source', () => {
    const source = workspaceSource();

    expect(source).toContain('const createDisabled = createMutation.isPending');
    expect(source).toContain('!readiness.ready');
    expect(source).toContain('!creationGraphReview.ready');
    expect(source).toContain('handleCheckBlocking');
    expect(source).toContain('!selectedWorld');
    expect(source).toContain('worlds.length === 0');
    expect(source).toContain('checkCreateRealmPersonaHandleAvailability(normalizedDraft.handle)');
    expect(source).toContain("t('create.worldSelectionUnavailable')");
  });

  it('keeps reviewed fields directly editable and gates the final write on graph acceptance', () => {
    const source = workspaceSource();

    expect(source).toContain('onChange={(event) => updateDraft({ handle: event.currentTarget.value })}');
    expect(source).toContain('onChange={(event) => updateDraft({ displayName: event.currentTarget.value })}');
    expect(source).toContain('onChange={(event) => updateDraft({ description: event.currentTarget.value })}');
    expect(source).toContain('GraphReviewBoard');
    expect(source).toContain('validatePersonaCreationGraphForRealmCreate(creationGraph, graphAcceptedFingerprint)');
    expect(source).not.toContain('function acceptField');
    expect(source).not.toContain('function acceptAllEssentials');
    expect(source).not.toContain("t('create.review.edit')");
    expect(source).toContain('setGraphAcceptedFingerprint(acceptPersonaCreationGraphForRealmCreate(creationGraph))');
  });

  it('normalizes owner-reviewed handle input before preflight and create', () => {
    const source = workspaceSource();

    expect(source).toContain('const normalizedDraft = useMemo(() => normalizeCreateRealmPersonaDraft(draft), [draft])');
    expect(source).toContain("queryKey: ['realm-persona-studio', 'create-persona-handle-availability', normalizedDraft.handle]");
    expect(source).toContain('enabled: normalizedDraft.handle.length > 0');
    expect(source).not.toContain(retiredHandleCandidate);
  });

  it('moves from source entry into editable reviewed RealmPersona draft', () => {
    const source = workspaceSource();

    expect(source).toContain('async function runSeedGeneration()');
    expect(source).toContain('function skipSeedAndCreateManually()');
    expect(source).toContain("setStage('edit')");
    expect(source).toContain('function returnToSeedStage()');
    expect(source).toContain("setStage('seed')");
  });

  it('adds optional Runtime reference image generation without making it required for create', () => {
    const source = workspaceSource();

    expect(source).toContain('generatePersonaReferenceImage');
    expect(source).toContain('async function runReferenceImageGeneration()');
    expect(source).toContain("t('create.generateReference')");
    expect(source).toContain("setDraft((current) => ({ ...current, referenceImageUrl: result.referenceImageUrl }))");
    expect(source).toContain("'create.referenceTitle'");
    expect(source).toContain('draft.referenceImageUrl ?');
    expect(source).toContain('const createDisabled = createMutation.isPending');
  });
});
