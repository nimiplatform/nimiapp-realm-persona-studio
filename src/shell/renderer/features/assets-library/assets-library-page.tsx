import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { AudioLines, Copy, ImageOff, Music2, Pause, Play, Trash2 } from 'lucide-react';
import {
  Button,
  DataList,
  DashedAddButton,
  EmptyState,
  IconToggleAction,
  InlineAlert,
  NimiText,
  nimiToast,
  OverlayShell,
  PillTabs,
  StatusBadge,
  Surface,
} from '@nimiplatform/kit/ui';
import {
  aggregateAssetLibraryData,
  type AssetLibraryData,
  type AssetLibraryEntry,
  type AssetLibraryProvenance,
  type AssetLibraryTab,
} from './asset-library-data.js';
import {
  getLocalAssetImportCapability,
  importLocalAssetFile,
  loadLocalImportedAssetRecords,
  removeLocalImportedAsset,
  type LocalImportCapabilityStatus,
  type LocalImportedAssetRecord,
} from './local-import-store.js';
import { translatePersonaArchetypeLabel, translatePersonaTraitLabel } from '@renderer/i18n/studio-i18n.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import {
  CREATIVE_ASSET_HISTORY_UPDATED_EVENT,
  creativeHistoryTitleKey,
  loadAllLocalCreativeAssetHistory,
  type CreativeAssetHistoryRecord,
} from '@renderer/features/portfolio/creative-asset-history.js';
import {
  CREATION_DRAFT_HISTORY_UPDATED_EVENT,
  loadCreationDraft,
  type CreationDraftAutosaveRecord,
} from '@renderer/features/portfolio/creation-draft-store.js';
import { loadCreationDraftHistory } from '@renderer/features/portfolio/creation-draft-history.js';

const EMPTY_AUDIO_SNAPSHOT: AudioSnapshot = {
  activeId: null,
  playing: false,
  durations: {},
};

let sharedAudio: HTMLAudioElement | null = null;
let sharedAudioSourceId: string | null = null;
let audioSnapshot = EMPTY_AUDIO_SNAPSHOT;
const audioSnapshotListeners = new Set<() => void>();

function publishAudioSnapshot(next: AudioSnapshot): void {
  audioSnapshot = next;
  audioSnapshotListeners.forEach((listener) => listener());
}

function getSharedAudio(): HTMLAudioElement | null {
  if (sharedAudio) return sharedAudio;
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  sharedAudio = new Audio();
  sharedAudio.preload = 'metadata';
  sharedAudio.addEventListener('loadedmetadata', () => {
    if (!sharedAudio || !sharedAudioSourceId || !Number.isFinite(sharedAudio.duration) || sharedAudio.duration <= 0) return;
    publishAudioSnapshot({
      ...audioSnapshot,
      durations: {
        ...audioSnapshot.durations,
        [sharedAudioSourceId]: sharedAudio.duration,
      },
    });
  });
  sharedAudio.addEventListener('play', () => {
    if (sharedAudioSourceId) publishAudioSnapshot({ ...audioSnapshot, activeId: sharedAudioSourceId, playing: true });
  });
  sharedAudio.addEventListener('pause', () => {
    publishAudioSnapshot({ ...audioSnapshot, playing: false });
  });
  sharedAudio.addEventListener('ended', () => {
    publishAudioSnapshot({ ...audioSnapshot, activeId: null, playing: false });
  });
  sharedAudio.addEventListener('error', () => {
    publishAudioSnapshot({ ...audioSnapshot, activeId: null, playing: false });
  });
  return sharedAudio;
}

async function toggleSharedAudio(entry: AssetLibraryEntry): Promise<void> {
  if (!entry.previewUrl || entry.mediaKind !== 'audio') return;
  const audio = getSharedAudio();
  if (!audio) return;
  if (audioSnapshot.activeId === entry.id && audioSnapshot.playing) {
    audio.pause();
    return;
  }
  if (sharedAudioSourceId !== entry.id) {
    audio.pause();
    sharedAudioSourceId = entry.id;
    audio.src = entry.previewUrl;
    audio.load();
  }
  try {
    await audio.play();
    publishAudioSnapshot({ ...audioSnapshot, activeId: entry.id, playing: true });
  } catch {
    publishAudioSnapshot({ ...audioSnapshot, activeId: null, playing: false });
  }
}

function stopSharedAudio(): void {
  if (sharedAudio) sharedAudio.pause();
  sharedAudioSourceId = null;
  publishAudioSnapshot({ ...audioSnapshot, activeId: null, playing: false });
}

function subscribeAudioSnapshot(listener: () => void): () => void {
  audioSnapshotListeners.add(listener);
  return () => audioSnapshotListeners.delete(listener);
}

function useAudioSnapshot(): AudioSnapshot {
  return useSyncExternalStore(subscribeAudioSnapshot, () => audioSnapshot, () => EMPTY_AUDIO_SNAPSHOT);
}

type AudioSnapshot = {
  activeId: string | null;
  playing: boolean;
  durations: Readonly<Record<string, number>>;
};

function formatDuration(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return null;
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function sourceLabel(entry: AssetLibraryEntry, t: ReturnType<typeof useStudioI18n>['t']): string {
  return entry.sourceKind === 'generated'
    ? t('assetsLibrary.source.generated')
    : t('assetsLibrary.source.imported');
}

function reviewStateLabel(entry: AssetLibraryEntry, t: ReturnType<typeof useStudioI18n>['t']): string {
  if (entry.reviewState === 'owner-reviewed') return t('assetsLibrary.review.ownerReviewed');
  if (entry.reviewState === 'owner-selected') return t('assetsLibrary.review.ownerSelected');
  return t('assetsLibrary.review.candidateOnly');
}

function provenanceLabel(provenance: AssetLibraryProvenance, t: ReturnType<typeof useStudioI18n>['t']): string {
  if (provenance.kind === 'persona') {
    const persona = t('assetsLibrary.provenance.persona', { id: provenance.personaId });
    return provenance.originDraftKey
      ? `${persona} · ${t('assetsLibrary.provenance.originDraft', { id: provenance.originDraftKey })}`
      : persona;
  }
  if (provenance.kind === 'draft') {
    const styleLabels = [
      provenance.archetype ? translatePersonaArchetypeLabel(provenance.archetype, t) : null,
      ...(provenance.traits || []).map((trait) => translatePersonaTraitLabel(trait, t)),
    ].filter(Boolean);
    return [
      t('assetsLibrary.provenance.draft', { id: provenance.draftKey }),
      ...styleLabels,
    ].join(' · ');
  }
  return t('assetsLibrary.provenance.localImport');
}

function SourceBadge({ entry, t }: { entry: AssetLibraryEntry; t: ReturnType<typeof useStudioI18n>['t'] }) {
  return (
    <StatusBadge tone={entry.sourceKind === 'generated' ? 'info' : 'neutral'}>
      {sourceLabel(entry, t)}
    </StatusBadge>
  );
}

function AssetImageGrid({
  entries,
  onSelect,
  onRemove,
}: {
  entries: AssetLibraryEntry[];
  onSelect: (entry: AssetLibraryEntry) => void;
  onRemove?: (entry: AssetLibraryEntry) => void;
}) {
  const { t } = useStudioI18n();
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label={t('assetsLibrary.images.ariaLabel')}>
      {entries.map((entry) => (
        <Surface
          key={entry.id}
          as="div"
          tone="card"
          interactive
          role="button"
          tabIndex={0}
          aria-label={`${entry.title} · ${sourceLabel(entry, t)}`}
          className="group relative aspect-square overflow-hidden p-0"
          onClick={() => onSelect(entry)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(entry);
            }
          }}
        >
          {entry.previewUrl ? (
            <img src={entry.previewUrl} alt={entry.title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--nimi-surface-panel)] p-3 text-center text-[var(--nimi-text-muted)]">
              <ImageOff size={24} strokeWidth={1.6} aria-hidden="true" />
              <span className="text-xs">{t('assetsLibrary.previewUnavailable')}</span>
            </div>
          )}
          <div className="absolute left-2 top-2">
            <SourceBadge entry={entry} t={t} />
          </div>
          {onRemove && entry.provenance.kind === 'local-import' ? (
            <IconToggleAction
              icon={<Trash2 size={15} strokeWidth={1.8} />}
              aria-label={t('assetsLibrary.upload.remove', { title: entry.title })}
              title={t('assetsLibrary.upload.remove', { title: entry.title })}
              className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(entry);
              }}
            />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 truncate bg-[linear-gradient(transparent,color-mix(in_srgb,var(--nimi-text-primary)_82%,transparent))] px-3 pb-2 pt-6 text-left text-xs font-medium text-[var(--nimi-surface-canvas)]">
            {entry.title}
          </div>
        </Surface>
      ))}
    </div>
  );
}

function AudioAssetList({
  entries,
  onRemove,
}: {
  entries: AssetLibraryEntry[];
  onRemove?: (entry: AssetLibraryEntry) => void;
}) {
  const { t } = useStudioI18n();
  const snapshot = useAudioSnapshot();
  const items = entries.map((entry) => {
    const duration = formatDuration(snapshot.durations[entry.id]);
    const isPlaying = snapshot.activeId === entry.id && snapshot.playing;
    return {
      id: entry.id,
      title: entry.title,
      description: t('assetsLibrary.preview.description', {
        source: sourceLabel(entry, t),
        provenance: provenanceLabel(entry.provenance, t),
      }),
      meta: duration ? `${sourceLabel(entry, t)} · ${duration}` : sourceLabel(entry, t),
      leading: (
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--nimi-radius-md)] bg-[var(--nimi-status-info-soft-bg)] text-[var(--nimi-status-info-soft-text)]">
          <Music2 size={17} strokeWidth={1.7} aria-hidden="true" />
        </span>
      ),
      trailing: (
        <>
          <SourceBadge entry={entry} t={t} />
          {entry.previewUrl ? (
            <IconToggleAction
              icon={isPlaying ? <Pause size={15} strokeWidth={1.8} /> : <Play size={15} strokeWidth={1.8} />}
              active={isPlaying}
              aria-label={t(isPlaying ? 'assetsLibrary.audio.pause' : 'assetsLibrary.audio.play', { title: entry.title })}
              title={t(isPlaying ? 'assetsLibrary.audio.pause' : 'assetsLibrary.audio.play', { title: entry.title })}
              onClick={() => void toggleSharedAudio(entry)}
            />
          ) : (
            <StatusBadge tone="warning">{t('assetsLibrary.audio.previewUnavailable')}</StatusBadge>
          )}
          {onRemove && entry.provenance.kind === 'local-import' ? (
            <IconToggleAction
              icon={<Trash2 size={15} strokeWidth={1.8} />}
              aria-label={t('assetsLibrary.upload.remove', { title: entry.title })}
              title={t('assetsLibrary.upload.remove', { title: entry.title })}
              onClick={() => onRemove(entry)}
            />
          ) : null}
        </>
      ),
    };
  });

  return <DataList items={items} ariaLabel={t('assetsLibrary.audio.ariaLabel')} />;
}

function AssetPreviewOverlay({
  entry,
  onClose,
}: {
  entry: AssetLibraryEntry | null;
  onClose: () => void;
}) {
  const { t } = useStudioI18n();
  const audioState = useAudioSnapshot();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => setCopyState('idle'), [entry?.id]);

  async function copyPreviewUrl() {
    if (!entry?.previewUrl?.startsWith('https://') || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyState('failed');
      return;
    }
    try {
      await navigator.clipboard.writeText(entry.previewUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  const source = entry ? sourceLabel(entry, t) : '';
  const provenance = entry ? provenanceLabel(entry.provenance, t) : '';
  return (
    <OverlayShell
      open={entry !== null}
      size="L"
      title={entry?.title || t('assetsLibrary.preview.title')}
      description={entry ? t('assetsLibrary.preview.description', { source, provenance }) : undefined}
      onClose={onClose}
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-3">
          {copyState === 'failed' ? <span className="text-sm text-[var(--nimi-status-danger)]">{t('assetsLibrary.copyFailed')}</span> : null}
          {copyState === 'copied' ? <span className="text-sm text-[var(--nimi-status-success)]">{t('assetsLibrary.copied')}</span> : null}
          <Button
            tone="secondary"
            leadingIcon={<Copy size={15} strokeWidth={1.8} />}
            disabled={!entry?.previewUrl?.startsWith('https://')}
            title={!entry?.previewUrl?.startsWith('https://') ? t('assetsLibrary.copyUnavailable') : undefined}
            onClick={() => void copyPreviewUrl()}
          >
            {t('assetsLibrary.copyUrl')}
          </Button>
        </div>
      )}
    >
      {entry ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="flex min-h-80 items-center justify-center overflow-hidden rounded-[var(--nimi-radius-lg)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)]">
            {entry.previewUrl ? (
              entry.mediaKind === 'image' ? (
                <img src={entry.previewUrl} alt={entry.title} className="max-h-[65vh] w-full object-contain" />
              ) : (
                <div className="flex w-full flex-col items-center gap-4 p-8">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--nimi-status-info-soft-bg)] text-[var(--nimi-status-info-soft-text)]">
                    <AudioLines size={28} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <IconToggleAction
                    icon={audioState.activeId === entry.id && audioState.playing ? <Pause size={18} strokeWidth={1.8} /> : <Play size={18} strokeWidth={1.8} />}
                    active={audioState.activeId === entry.id && audioState.playing}
                    aria-label={t(audioState.activeId === entry.id && audioState.playing ? 'assetsLibrary.audio.pause' : 'assetsLibrary.audio.play', { title: entry.title })}
                    title={t(audioState.activeId === entry.id && audioState.playing ? 'assetsLibrary.audio.pause' : 'assetsLibrary.audio.play', { title: entry.title })}
                    onClick={() => void toggleSharedAudio(entry)}
                  />
                </div>
              )
            ) : (
              <EmptyState
                icon={<ImageOff size={22} strokeWidth={1.6} />}
                title={t('assetsLibrary.previewUnavailable')}
                description={t('assetsLibrary.copyUnavailable')}
                className="w-full border-0 bg-transparent shadow-none"
              />
            )}
          </div>
          <Surface tone="card" padding="md" className="self-start">
            <div className="flex flex-wrap gap-2">
              <SourceBadge entry={entry} t={t} />
              <StatusBadge tone={entry.reviewState === 'candidate-only' ? 'warning' : 'success'}>{reviewStateLabel(entry, t)}</StatusBadge>
              <StatusBadge tone="neutral">{entry.mediaKind === 'image' ? t('assetsLibrary.tabs.images') : t('assetsLibrary.tabs.audio')}</StatusBadge>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-[var(--nimi-text-muted)]">{t('assetsLibrary.preview.title')}</dt>
                <dd className="ras-break-anywhere m-0 mt-1 text-[var(--nimi-text-primary)]">{provenance}</dd>
              </div>
              <div>
                <dt className="text-[var(--nimi-text-muted)]">{t('assetsLibrary.copyUrl')}</dt>
                <dd className="ras-break-anywhere m-0 mt-1 text-[var(--nimi-text-primary)]">{entry.previewUrl?.startsWith('https://') ? entry.previewUrl : entry.previewUrl ? t('assetsLibrary.localReference') : t('assetsLibrary.previewUnavailable')}</dd>
              </div>
            </dl>
          </Surface>
        </div>
      ) : null}
    </OverlayShell>
  );
}

function EmptyTabState({ tab }: { tab: AssetLibraryTab }) {
  const { t } = useStudioI18n();
  if (tab === 'images') {
    return <EmptyState title={t('assetsLibrary.images.emptyTitle')} description={t('assetsLibrary.images.emptyDescription')} />;
  }
  if (tab === 'audio') {
    return <EmptyState title={t('assetsLibrary.audio.emptyTitle')} description={t('assetsLibrary.audio.emptyDescription')} />;
  }
  return <EmptyState title={t('assetsLibrary.uploads.emptyTitle')} description={t('assetsLibrary.uploads.emptyDescription')} />;
}

function UploadTab({
  data,
  capability,
  isImporting,
  onChooseFile,
  onSelect,
  onRemove,
}: {
  data: AssetLibraryData;
  capability: LocalImportCapabilityStatus;
  isImporting: boolean;
  onChooseFile: () => void;
  onSelect: (entry: AssetLibraryEntry) => void;
  onRemove: (entry: AssetLibraryEntry) => void;
}) {
  const { t } = useStudioI18n();
  const importedImages = data.uploads.filter((entry) => entry.mediaKind === 'image');
  const importedAudio = data.uploads.filter((entry) => entry.mediaKind === 'audio');
  return (
    <div className="grid gap-5">
      {!capability.available ? (
        <InlineAlert tone="warning">{t('assetsLibrary.upload.capabilityUnavailable')}</InlineAlert>
      ) : null}
      <DashedAddButton
        shape="dropzone"
        disabled={!capability.available || isImporting}
        label={isImporting ? t('common.loadingEllipsis') : t('assetsLibrary.upload.dropzoneLabel')}
        description={t('assetsLibrary.upload.dropzoneDescription')}
        onClick={onChooseFile}
      />
      {data.uploads.length === 0 ? <EmptyTabState tab="uploads" /> : (
        <div className="grid gap-5">
          {importedImages.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="m-0 text-base font-semibold">{t('assetsLibrary.uploads.images')}</h2>
              <AssetImageGrid entries={importedImages} onSelect={onSelect} onRemove={onRemove} />
            </section>
          ) : null}
          {importedAudio.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="m-0 text-base font-semibold">{t('assetsLibrary.uploads.audio')}</h2>
              <AudioAssetList entries={importedAudio} onRemove={onRemove} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function AssetsLibraryPage() {
  const { t } = useStudioI18n();
  const [activeTab, setActiveTab] = useState<AssetLibraryTab>('images');
  const [selectedEntry, setSelectedEntry] = useState<AssetLibraryEntry | null>(null);
  const [capability] = useState<LocalImportCapabilityStatus>(() => getLocalAssetImportCapability());
  const [importedRecords, setImportedRecords] = useState<LocalImportedAssetRecord[]>([]);
  const [creativeHistoryRecords, setCreativeHistoryRecords] = useState<CreativeAssetHistoryRecord[]>([]);
  const [creationDraftRecords, setCreationDraftRecords] = useState<CreationDraftAutosaveRecord[]>([]);
  const [sourceUnavailableCount, setSourceUnavailableCount] = useState(0);
  const [sourceStorageUnavailable, setSourceStorageUnavailable] = useState(false);
  const [importedUnavailableCount, setImportedUnavailableCount] = useState(0);
  const [importFailure, setImportFailure] = useState<{ message: string; informational: boolean } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const data = useMemo(() => {
    const aggregated = aggregateAssetLibraryData({
      creativeHistoryRecords,
      creationDraftRecords,
      importedRecords,
      sourceUnavailableCount,
      importedUnavailableCount,
    });
    // Resolve recognized Studio history title keys in the active locale.
    const localize = (entry: AssetLibraryEntry): AssetLibraryEntry => {
      const titleKey = creativeHistoryTitleKey(entry.title);
      return titleKey ? { ...entry, title: t(titleKey) } : entry;
    };
    return {
      ...aggregated,
      entries: aggregated.entries.map(localize),
      images: aggregated.images.map(localize),
      audio: aggregated.audio.map(localize),
      uploads: aggregated.uploads.map(localize),
    };
  }, [creativeHistoryRecords, creationDraftRecords, importedRecords, sourceUnavailableCount, importedUnavailableCount, t]);

  useEffect(() => {
    let cancelled = false;
    const refreshSources = async () => {
      const [imported, creative, history] = await Promise.all([
        loadLocalImportedAssetRecords(capability),
        loadAllLocalCreativeAssetHistory(),
        loadCreationDraftHistory(),
      ]);
      if (cancelled) return;
      setImportedRecords(imported.records);
      setImportedUnavailableCount(imported.unavailableCount);
      if (imported.failure) {
        setImportFailure({
          message: t('assetsLibrary.upload.capabilityUnavailable'),
          informational: true,
        });
      }

      const draftRecords: CreationDraftAutosaveRecord[] = [];
      let unavailableCount = creative.unavailableCount + history.unavailableCount;
      let storageUnavailable = !creative.ok || !history.ok;
      if (history.ok) {
        const loadedDrafts = await Promise.all(history.entries.map((entry) => loadCreationDraft(entry.draftKey)));
        if (cancelled) return;
        for (const loaded of loadedDrafts) {
          if (loaded.ok && loaded.record) draftRecords.push(loaded.record);
          else if (!loaded.ok) storageUnavailable = true;
          else unavailableCount += 1;
        }
      }
      setCreativeHistoryRecords(creative.records);
      setCreationDraftRecords(draftRecords);
      setSourceUnavailableCount(unavailableCount);
      setSourceStorageUnavailable(storageUnavailable);
    };
    const handleSourceUpdated = () => void refreshSources();
    void refreshSources();
    window.addEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, handleSourceUpdated);
    window.addEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, handleSourceUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, handleSourceUpdated);
      window.removeEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, handleSourceUpdated);
      stopSharedAudio();
    };
  }, [capability, t]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setImportFailure(null);
    setIsImporting(true);
    try {
      const result = await importLocalAssetFile(file, capability);
      if (result.ok) {
        setImportedRecords((current) => [result.record, ...current.filter((record) => record.id !== result.record.id)]);
        nimiToast.success(t('assetsLibrary.upload.success', { title: result.record.title }));
      } else if (result.failure === 'unsupported-media-type') {
        setImportFailure({ message: t('assetsLibrary.upload.fileRejected'), informational: false });
      } else if (result.failure === 'file-too-large') {
        setImportFailure({ message: t('assetsLibrary.upload.fileTooLarge'), informational: false });
      } else if (result.failure === 'capability-unavailable') {
        setImportFailure({ message: t('assetsLibrary.upload.capabilityUnavailable'), informational: true });
      } else {
        setImportFailure({ message: t('assetsLibrary.upload.failure'), informational: false });
      }
    } finally {
      setIsImporting(false);
    }
  }

  async function handleRemove(entry: AssetLibraryEntry) {
    if (entry.provenance.kind !== 'local-import') return;
    const importId = entry.provenance.id;
    const result = await removeLocalImportedAsset(importId, capability);
    if (result.ok) {
      setImportedRecords((current) => current.filter((record) => record.id !== importId));
      if (selectedEntry?.id === entry.id) setSelectedEntry(null);
    } else {
      setImportFailure({ message: t('assetsLibrary.upload.removeFailed'), informational: false });
    }
  }

  const activeEntries = activeTab === 'images' ? data.images : activeTab === 'audio' ? data.audio : data.uploads;

  return (
    <div className="ras-page ras-assets-library">
      <header className="ras-page-header ras-assets-library__header">
        <div className="min-w-0">
          <NimiText as="h1" role="page-title" className="m-0">
            {t('assetsLibrary.title')}
          </NimiText>
          <p className="ras-page-header__description">
            {t('assetsLibrary.description')}
          </p>
        </div>
        <div className="ras-page-header__actions">
          <StatusBadge tone="warning">{t('common.localOnly')}</StatusBadge>
        </div>
      </header>

      <div className="grid gap-6">
        <PillTabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as AssetLibraryTab)}
          ariaLabel={t('assetsLibrary.tabs.ariaLabel')}
          items={[
            { value: 'images', label: t('assetsLibrary.tabs.images') },
            { value: 'audio', label: t('assetsLibrary.tabs.audio') },
            { value: 'uploads', label: t('assetsLibrary.tabs.uploads') },
          ]}
        />

        {data.unavailableCount > 0 ? (
          <InlineAlert tone="warning">
            {t('assetsLibrary.unavailableCount', { count: data.unavailableCount })}
          </InlineAlert>
        ) : null}
        {sourceStorageUnavailable ? <InlineAlert tone="warning">{t('assetsLibrary.storageUnavailable')}</InlineAlert> : null}
        {importFailure ? (
          <InlineAlert tone={importFailure.informational ? 'info' : 'danger'}>
            {importFailure.message}
          </InlineAlert>
        ) : null}

        {activeTab === 'images' ? (
          activeEntries.length > 0
            ? <AssetImageGrid entries={activeEntries} onSelect={setSelectedEntry} />
            : <EmptyTabState tab="images" />
        ) : null}
        {activeTab === 'audio' ? (
          activeEntries.length > 0
            ? <AudioAssetList entries={activeEntries} />
            : <EmptyTabState tab="audio" />
        ) : null}
        {activeTab === 'uploads' ? (
          <UploadTab
            data={data}
            capability={capability}
            isImporting={isImporting}
            onChooseFile={() => fileInputRef.current?.click()}
            onSelect={setSelectedEntry}
            onRemove={(entry) => void handleRemove(entry)}
          />
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />

      </div>
      <AssetPreviewOverlay entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
}

export const AssetLibraryPage = AssetsLibraryPage;
