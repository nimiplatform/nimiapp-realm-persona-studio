import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@nimiplatform/kit/ui';
import { WorldPicker, WorldRecoveryPanel } from '../src/shell/renderer/features/portfolio/create-realm-persona-workspace/world-picker.js';
import { REALM_WORLD_CORE_LIST_SOURCE, type SelectableRealmWorld } from '../src/shell/renderer/features/portfolio/create-persona-draft.js';
import { VisualImageEditorWorkspace } from '../src/shell/renderer/features/portfolio/visual-image-editor.js';
import { AssetImageGrid } from '../src/shell/renderer/features/assets-library/assets-library-page.js';
import type { AssetLibraryEntry } from '../src/shell/renderer/features/assets-library/asset-library-data.js';
import { PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS } from '../src/shell/renderer/features/persona-detail/persona-workspace.visual-fixture.js';
import { useStudioI18n } from '../src/shell/renderer/i18n/use-studio-i18n.js';

// Component presentation fixtures. Protected artifact calls remain real and unavailable without the host.
const meta = { title: 'Studio/Interactions', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const worlds: SelectableRealmWorld[] = ['OASIS', 'EDEN', 'NEBULA'].map((name) => ({
  id: name, name, identityName: name, type: null, status: null, description: '', tagline: '', source: REALM_WORLD_CORE_LIST_SOURCE,
}));
function WorldSelection({ empty = false, partial = false }: { empty?: boolean; partial?: boolean }) {
  const { t } = useStudioI18n();
  const [selected, setSelected] = useState('OASIS');
  const [open, setOpen] = useState(true);
  return <>
    <Button onClick={() => setOpen(true)}>{t('create.world.select')}</Button>
    <WorldPicker open={open} worlds={empty ? [] : partial ? [...worlds, { ...worlds[0]!, id: 'visual-unavailable', name: null }] : worlds} selectedWorldId={selected} onSelect={setSelected} onClose={() => setOpen(false)} />
  </>;
}
const persona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS['visual-xiaomi']!;
function ImportedActions() {
  const [entries, setEntries] = useState<AssetLibraryEntry[]>([{
    id: 'visual-imported', title: 'Imported reference', mediaKind: 'image', sourceKind: 'imported',
    reviewState: 'candidate-only', previewUrl: persona.avatarUrl,
    provenance: { kind: 'local-import', id: '01J00000000000000000000001' }, createdAt: '2026-09-30T00:00:00Z',
  }]);
  const [selected, setSelected] = useState('');
  return <><AssetImageGrid entries={entries} onSelect={(entry) => setSelected(entry.title)}
    onRemove={(entry) => setEntries((current) => current.filter((candidate) => candidate.id !== entry.id))} /><p role="status">{selected}</p></>;
}
export const WorldKeyboard: Story = { render: () => <WorldSelection /> };
export const WorldEmpty: Story = { render: () => <WorldSelection empty /> };
export const WorldPartial: Story = { render: () => <WorldSelection partial /> };
export const WorldUnavailable: Story = { render: () => <WorldRecoveryPanel completedCount={2} retrying={false} onRetry={() => {}} createDisabled /> };
export const ImportedImageActions: Story = { render: () => <ImportedActions /> };
export const ImageEditor: Story = { render: () => <VisualImageEditorWorkspace persona={persona} onHistoryUpdated={async () => {}} /> };
export const ImageEditorEmpty: Story = { render: () => <VisualImageEditorWorkspace persona={{ ...persona, avatarUrl: null }} onHistoryUpdated={async () => {}} /> };
