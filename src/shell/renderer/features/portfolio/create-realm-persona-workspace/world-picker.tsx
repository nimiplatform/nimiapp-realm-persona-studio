import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  Button,
  EmptyState,
  InlineAlert,
  OverlayShell,
  SearchField,
  StatusBadge,
  Surface,
} from '@nimiplatform/kit/ui';
import { RefreshCw } from 'lucide-react';
import {
  groupSelectableRealmWorldsForPicker,
  type SelectableRealmWorld,
} from '../create-persona-draft.js';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';
import { worldOptionLabel } from './draft-utils.js';

export function WorldPicker({
  open,
  worlds,
  selectedWorldId,
  onSelect,
  onClose,
}: {
  open: boolean;
  worlds: SelectableRealmWorld[];
  selectedWorldId: string;
  onSelect: (worldId: string) => void;
  onClose: () => void;
}) {
  const { t } = useStudioI18n();
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  const groups = useMemo(() => {
    const filtered = worlds.filter((world) => world.name.toLocaleLowerCase().includes(query));
    const grouped = groupSelectableRealmWorldsForPicker(filtered);
    return grouped;
  }, [query, worlds]);
  const orderedWorlds = [...groups.recommended, ...groups.others];

  function moveRadio(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? orderedWorlds.length - 1
        : event.key === 'ArrowDown'
          ? Math.min(index + 1, orderedWorlds.length - 1)
          : Math.max(index - 1, 0);
    const nextWorld = orderedWorlds[nextIndex];
    if (!nextWorld) return;
    onSelect(nextWorld.id);
    const group = event.currentTarget.closest('[role="radiogroup"]');
    const radios = group ? Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')) : [];
    radios[nextIndex]?.focus();
  }

  const renderWorld = (world: SelectableRealmWorld, index: number, recommended: boolean) => {
    const selected = world.id === selectedWorldId;
    return (
      <Surface
        key={world.id}
        as="button"
        type="button"
        tone="card"
        padding="sm"
        interactive
        active={selected}
        role="radio"
        aria-checked={selected}
        aria-label={worldOptionLabel(world)}
        onClick={() => onSelect(world.id)}
        onKeyDown={(event) => moveRadio(event, index)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--nimi-radius-md)] bg-[var(--nimi-action-primary-bg)] text-sm font-semibold text-[var(--nimi-action-primary-text)]">
          {world.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-[var(--nimi-text-primary)]">{world.name}</span>
            {recommended ? <StatusBadge tone="info">{t('create.world.defaultBadge')}</StatusBadge> : null}
          </div>
          <div className="truncate text-xs text-[var(--nimi-text-muted)]">{world.tagline || world.description || worldOptionLabel(world)}</div>
        </div>
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-[var(--nimi-border-strong)]" aria-hidden="true">
          {selected ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--nimi-action-primary-bg)]" /> : null}
        </span>
      </Surface>
    );
  };

  return (
    <OverlayShell
      open={open}
      kind="dialog"
      size="S"
      onClose={onClose}
      title={t('create.world.select')}
      footer={<div className="text-center text-xs text-[var(--nimi-text-muted)]">{t('create.world.selectionNote')}</div>}
      dataTestId="realm-persona-world-picker"
    >
      <div className="grid gap-4">
        <SearchField value={search} placeholder={t('create.world.search')} aria-label={t('create.world.search')} onChange={(event) => setSearch(event.currentTarget.value)} />
        {orderedWorlds.length === 0 ? <EmptyState title={t('create.world.noMatches')} description={t('create.world.search')} /> : (
          <div role="radiogroup" aria-label={t('create.world.select')} className="grid max-h-[52vh] gap-4 overflow-y-auto">
            {groups.recommended.length > 0 ? <section className="grid gap-2"><h3 className="m-0 text-xs font-semibold text-[var(--nimi-text-muted)]">{t('create.world.recommended')}</h3>{groups.recommended.map((world, index) => renderWorld(world, index, true))}</section> : null}
            {groups.others.length > 0 ? <section className="grid gap-2"><h3 className="m-0 text-xs font-semibold text-[var(--nimi-text-muted)]">{t('create.world.all')}</h3>{groups.others.map((world, index) => renderWorld(world, groups.recommended.length + index, false))}</section> : null}
          </div>
        )}
      </div>
    </OverlayShell>
  );
}

export function WorldRecoveryPanel({
  completedCount,
  retrying,
  onRetry,
  createDisabled,
}: {
  completedCount: number;
  retrying: boolean;
  onRetry: () => void;
  createDisabled: boolean;
}) {
  const { t } = useStudioI18n();
  const plural = completedCount === 1 ? '' : 's';
  return (
    <Surface tone="card" material="glass-regular" padding="lg" className="grid gap-5 rounded-[var(--nimi-radius-xl)]">
      <div className="grid gap-2">
        <StatusBadge tone="danger">{t('create.worldSelectionUnavailable')}</StatusBadge>
        <h2 className="m-0 text-xl font-semibold text-[var(--nimi-text-primary)]">{t('create.worldRecovery.title')}</h2>
        <p className="m-0 text-sm text-[var(--nimi-text-muted)]">{t('create.worldRecovery.savedCount', { count: completedCount, plural })}</p>
        <p className="m-0 text-sm text-[var(--nimi-text-muted)]">{t('create.worldRecovery.waiting')}</p>
      </div>
      <InlineAlert tone="warning">{t('create.worldRecovery.submitDisabled')}</InlineAlert>
      <div className="flex flex-wrap items-center gap-3">
        <Button tone="secondary" loading={retrying} onClick={onRetry} leadingIcon={<RefreshCw size={16} aria-hidden="true" />}>
          {t('create.worldRecovery.retry')}
        </Button>
        <Button tone="primary" disabled={createDisabled}>{t('create.submit')}</Button>
      </div>
    </Surface>
  );
}

export function WorldLoadingPanel() {
  const { t } = useStudioI18n();
  return <EmptyState title={t('create.world.loadingTitle')} description={t('create.world.loadingDescription')} />;
}
