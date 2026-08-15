import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, FilePenLine, Info, LayoutGrid, Plus, RefreshCw } from 'lucide-react';
import {
  Avatar,
  Button,
  FieldShell,
  InlineAlert,
  LoadingSkeleton,
  NimiTabs,
  NimiText,
  ScrollArea,
  SearchField,
  SelectField,
  StatusBadge,
} from '@nimiplatform/kit/ui';
import {
  applyOwnerPortfolioView,
  classifyPortfolioFailure,
  type OwnerPortfolioPersona,
  type OwnerPortfolioFilter,
  type OwnerPortfolioSort,
  type PortfolioFailureKind,
} from '@renderer/features/portfolio/portfolio-data.js';
import { listOwnerPortfolioPersonas } from '@renderer/features/portfolio/portfolio-client.js';
import {
  PersonaCard,
  PersonaLibraryStatusBadge,
} from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import {
  loadCreationDraftHistory,
  type CreationDraftHistoryEntry,
} from '@renderer/features/portfolio/creation-draft-history.js';
import {
  CREATION_DRAFT_HISTORY_UPDATED_EVENT,
  loadCreationDraft,
} from '@renderer/features/portfolio/creation-draft-store.js';
import { ownerPortfolioListQueryKey } from '@renderer/features/persona-detail/use-persona-detail-query.js';
import { translatePersonaArchetypeLabel } from '@renderer/i18n/studio-i18n.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import {
  listStudioWorldCores,
  studioWorldCardPresentation,
} from '@renderer/data/studio-world-core.js';
import oasisBannerUrl from '@renderer/assets/persona-preview/oasis-cover.png?url';
import edenBannerUrl from '@renderer/assets/persona-preview/eden-cover.png?url';
import xiaomiAvatarUrl from '@renderer/assets/persona-preview/xiaomi-avatar.png?url';
import nanxingAvatarUrl from '@renderer/assets/persona-preview/nanxing-avatar.png?url';

const PORTFOLIO_FILTER_OPTIONS: { value: OwnerPortfolioFilter; labelKey: StudioCopyKey }[] = [
  { value: 'all', labelKey: 'portfolio.filter.allPersonas' },
  { value: 'friend-count-available', labelKey: 'portfolio.filter.friendCountAvailable' },
  { value: 'friend-count-unavailable', labelKey: 'portfolio.filter.friendCountUnavailable' },
];

const PORTFOLIO_SORT_OPTIONS: { value: OwnerPortfolioSort; labelKey: StudioCopyKey }[] = [
  { value: 'realm-order', labelKey: 'portfolio.sort.realmOrder' },
  { value: 'display-name-asc', labelKey: 'portfolio.sort.nameAsc' },
  { value: 'updated-desc', labelKey: 'portfolio.sort.updatedDesc' },
  { value: 'friend-count-desc', labelKey: 'portfolio.sort.friendCountDesc' },
  { value: 'friend-count-asc', labelKey: 'portfolio.sort.friendCountAsc' },
];

const PORTFOLIO_FAILURE_TITLE_KEYS: Record<PortfolioFailureKind, StudioCopyKey> = {
  'capability-unavailable': 'portfolio.failure.capabilityUnavailable.title',
  'realm-unavailable': 'portfolio.failure.realmUnavailable.title',
  'access-denied': 'portfolio.failure.accessDenied.title',
  'owner-authority-missing': 'portfolio.failure.ownerAuthorityMissing.title',
  'setting-read-unavailable': 'portfolio.failure.settingReadUnavailable.title',
  unknown: 'portfolio.failure.portfolioUnavailable.title',
};

const PORTFOLIO_FAILURE_DETAIL_KEYS: Record<PortfolioFailureKind, StudioCopyKey> = {
  'capability-unavailable': 'portfolio.failure.portfolio.capabilityUnavailable',
  'realm-unavailable': 'portfolio.failure.portfolio.realm',
  'access-denied': 'portfolio.failure.portfolio.accessDenied',
  'owner-authority-missing': 'portfolio.failure.portfolio.owner',
  'setting-read-unavailable': 'portfolio.failure.portfolio.setting',
  unknown: 'portfolio.failure.portfolio.unknown',
};

type PortfolioView = 'personas' | 'local-drafts';
type DraftHistoryStatus = 'loading' | 'ready' | 'unavailable';
type DesignPreviewPersona = OwnerPortfolioPersona & { worldBannerUrl: string };

const DESIGN_PREVIEW_PERSONAS: readonly DesignPreviewPersona[] = [
  {
    id: 'design-preview-xiaomi',
    displayName: '小米',
    handle: 'xiaomi',
    worldName: 'OASIS',
    worldBannerUrl: oasisBannerUrl,
    coverUrl: null,
    avatarUrl: xiaomiAvatarUrl,
    ownerScope: 'owner-created',
    source: 'Realm WorldCoreController.listRealmPersonas',
    realmState: 'PUBLIC',
    updatedAt: '2026-08-10T09:42:00+08:00',
    friendCount: { status: 'available', value: 128 },
  },
  {
    id: 'design-preview-nanxing',
    displayName: '南星',
    handle: 'nanxing',
    worldName: 'EDEN',
    worldBannerUrl: edenBannerUrl,
    coverUrl: null,
    avatarUrl: nanxingAvatarUrl,
    ownerScope: 'owner-created',
    source: 'Realm WorldCoreController.listRealmPersonas',
    realmState: 'PUBLIC',
    updatedAt: '2026-08-09T18:20:00+08:00',
    friendCount: { status: 'available', value: 76 },
  },
];

export function formatDraftUpdatedAt(updatedAt: string, locale: 'en' | 'zh'): string {
  const updatedDate = new Date(updatedAt);
  if (Number.isNaN(updatedDate.getTime())) return updatedAt;
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(updatedDate);
}

function FilterCard({
  queryText,
  filter,
  sort,
  visibleCount,
  totalCount,
  onQueryChange,
  onFilterChange,
  onSortChange,
}: {
  queryText: string;
  filter: OwnerPortfolioFilter;
  sort: OwnerPortfolioSort;
  visibleCount: number;
  totalCount: number;
  onQueryChange: (next: string) => void;
  onFilterChange: (next: OwnerPortfolioFilter) => void;
  onSortChange: (next: OwnerPortfolioSort) => void;
}) {
  const { t } = useStudioI18n();
  const filterOptions = PORTFOLIO_FILTER_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));
  const sortOptions = PORTFOLIO_SORT_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));

  return (
    <section className="ras-card">
      <SearchField
        value={queryText}
        placeholder={t('portfolio.search.placeholder')}
        aria-label={t('portfolio.search.ariaLabel')}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
      <div className="ras-filter-grid">
        <FieldShell label={t('portfolio.filter.label')}>
          <SelectField
            value={filter}
            options={filterOptions}
            onValueChange={(value) => onFilterChange(value as OwnerPortfolioFilter)}
          />
        </FieldShell>
        <FieldShell label={t('portfolio.sort.label')}>
          <SelectField
            value={sort}
            options={sortOptions}
            onValueChange={(value) => onSortChange(value as OwnerPortfolioSort)}
          />
        </FieldShell>
        <div className="ras-filter-status">
          <StatusBadge tone="neutral">{visibleCount} / {totalCount}</StatusBadge>
          <StatusBadge tone="info">{t('portfolio.localView')}</StatusBadge>
        </div>
      </div>
    </section>
  );
}

function PortfolioLoadingState() {
  return (
    <div className="ras-persona-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <section key={index} className="ras-card ras-card--quiet">
          <LoadingSkeleton lines={3} />
        </section>
      ))}
    </div>
  );
}

function DesignPreviewPersonaList() {
  const { t } = useStudioI18n();
  const navigate = useNavigate();

  return (
    <div className="ras-persona-preview" aria-label={t('portfolio.preview.ariaLabel')}>
      <InlineAlert tone="info">{t('portfolio.preview.notice')}</InlineAlert>
      <div className="ras-persona-grid">
        {DESIGN_PREVIEW_PERSONAS.map((persona) => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            worldBannerUrl={persona.worldBannerUrl}
            worldName={persona.worldName}
            active={false}
            onSelect={() => navigate(`/portfolio/${persona.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function PortfolioSourceNotice({
  failure,
  loading,
  onRetry,
}: {
  failure: PortfolioFailureKind;
  loading: boolean;
  onRetry: () => void;
}) {
  const { t } = useStudioI18n();
  const informational = failure === 'capability-unavailable';
  const Icon = informational ? Info : AlertTriangle;

  return (
    <section
      className="ras-portfolio-source-notice"
      data-tone={informational ? 'info' : 'danger'}
      aria-live="polite"
    >
      <div className="ras-portfolio-source-notice__icon" aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="ras-portfolio-source-notice__copy">
        <h2>{t(PORTFOLIO_FAILURE_TITLE_KEYS[failure])}</h2>
        <p>{t(PORTFOLIO_FAILURE_DETAIL_KEYS[failure])}</p>
      </div>
      <Button tone="secondary" loading={loading} onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </section>
  );
}

function LocalDraftList({
  entries,
  images,
  status,
  partial,
  onContinue,
  onCreate,
}: {
  entries: CreationDraftHistoryEntry[];
  images: Record<string, string | null>;
  status: DraftHistoryStatus;
  partial: boolean;
  onContinue: (draftKey: string) => void;
  onCreate: () => void;
}) {
  const { locale, t } = useStudioI18n();

  if (status === 'loading') {
    return (
      <section className="ras-local-draft-list ras-local-draft-list--loading" aria-label={t('portfolio.localDrafts.loading')}>
        <LoadingSkeleton lines={3} />
      </section>
    );
  }

  if (status === 'unavailable') {
    return (
      <section className="ras-local-draft-empty" aria-live="polite">
        <AlertTriangle size={28} strokeWidth={1.8} aria-hidden="true" />
        <h2>{t('portfolio.localDrafts.unavailableTitle')}</h2>
        <p>{t('portfolio.localDrafts.unavailableDescription')}</p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="ras-local-draft-empty">
        <FilePenLine size={30} strokeWidth={1.7} aria-hidden="true" />
        <h2>{t('portfolio.localDrafts.emptyTitle')}</h2>
        <p>{t('portfolio.localDrafts.emptyDescription')}</p>
        <Button tone="primary" leadingIcon={<Plus size={16} />} onClick={onCreate}>
          {t('portfolio.createButton')}
        </Button>
      </section>
    );
  }

  return (
    <div className="ras-local-drafts-stack">
      {partial ? (
        <InlineAlert tone="warning">{t('portfolio.localDrafts.partialUnavailable')}</InlineAlert>
      ) : null}
      <section className="ras-local-draft-list">
        <div className="ras-local-draft-list__rows">
          {entries.map((entry) => {
            const description = [
              entry.worldName,
              entry.archetype ? translatePersonaArchetypeLabel(entry.archetype, t) : null,
            ].filter(Boolean).join(' · ');
            const updatedAt = formatDraftUpdatedAt(entry.updatedAt, locale);

            return (
              <article key={entry.draftKey} className="ras-local-draft-row">
                <Avatar
                  alt={entry.displayName}
                  src={images[entry.draftKey]}
                  size="lg"
                  shape="rounded"
                  tone="accent"
                  className="ras-local-draft-row__avatar"
                  fallback={<span className="text-xl font-semibold">{entry.displayName.charAt(0).toUpperCase()}</span>}
                />
                <div className="ras-local-draft-row__identity">
                  <h2>{entry.displayName}</h2>
                  {description ? <p>{description}</p> : null}
                </div>
                <div className="ras-local-draft-row__meta">
                  <PersonaLibraryStatusBadge status="local-draft" />
                  <time
                    className="ras-local-draft-row__updated-at"
                    dateTime={entry.updatedAt}
                    aria-label={t('portfolio.localDrafts.updatedAt', { dateTime: updatedAt })}
                  >
                    {updatedAt}
                  </time>
                </div>
                <Button
                  tone="ghost"
                  size="sm"
                  className="ras-local-draft-row__action"
                  trailingIcon={<ChevronRight size={17} strokeWidth={1.8} />}
                  onClick={() => onContinue(entry.draftKey)}
                >
                  {t('portfolio.localDrafts.continue')}
                </Button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function PersonaListPage() {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<PortfolioView>('personas');
  const [queryText, setQueryText] = useState('');
  const [filter, setFilter] = useState<OwnerPortfolioFilter>('all');
  const [sort, setSort] = useState<OwnerPortfolioSort>('realm-order');
  const [draftEntries, setDraftEntries] = useState<CreationDraftHistoryEntry[]>([]);
  const [draftImages, setDraftImages] = useState<Record<string, string | null>>({});
  const [draftHistoryStatus, setDraftHistoryStatus] = useState<DraftHistoryStatus>('loading');
  const [draftHistoryPartial, setDraftHistoryPartial] = useState(false);

  const portfolioQuery = useQuery({
    queryKey: ownerPortfolioListQueryKey(),
    queryFn: () => listOwnerPortfolioPersonas(),
  });

  const refreshDraftHistory = useCallback(async () => {
    setDraftHistoryStatus('loading');
    const result = await loadCreationDraftHistory();
    if (!result.ok) {
      setDraftEntries([]);
      setDraftImages({});
      setDraftHistoryPartial(false);
      setDraftHistoryStatus('unavailable');
      return;
    }

    const imageEntries = await Promise.all(result.entries.map(async (entry) => {
      const draft = await loadCreationDraft(entry.draftKey);
      const referenceImageUrl = draft.ok && draft.record ? draft.record.referenceImageUrl || null : null;
      return [entry.draftKey, referenceImageUrl] as const;
    }));

    setDraftEntries(result.entries);
    setDraftImages(Object.fromEntries(imageEntries));
    setDraftHistoryPartial(result.unavailableCount > 0);
    setDraftHistoryStatus('ready');
  }, []);

  useEffect(() => {
    const handleHistoryUpdated = () => void refreshDraftHistory();
    void refreshDraftHistory();
    window.addEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, handleHistoryUpdated);
    return () => window.removeEventListener(CREATION_DRAFT_HISTORY_UPDATED_EVENT, handleHistoryUpdated);
  }, [refreshDraftHistory]);

  const personas = portfolioQuery.data || [];
  const worldCoresQuery = useQuery({
    queryKey: ['realm-world-core', 'portfolio-card-banners'],
    queryFn: () => listStudioWorldCores({ take: 100 }),
    enabled: activeView === 'personas' && personas.length > 0,
  });
  const worldPresentationById = useMemo(() => new Map(
    (worldCoresQuery.data || []).map((world) => {
      const presentation = studioWorldCardPresentation(world);
      return [presentation.worldId, presentation] as const;
    }),
  ), [worldCoresQuery.data]);
  const visiblePersonas = useMemo(
    () => applyOwnerPortfolioView(personas, { query: queryText, filter, sort }),
    [personas, filter, queryText, sort],
  );
  const sourceWarnings = personas.filter((persona) => persona.friendCount.status === 'source-unavailable');
  const portfolioFailure = portfolioQuery.isError ? classifyPortfolioFailure(portfolioQuery.error) : null;
  const showDesignPreview = import.meta.env.DEV && portfolioQuery.isSuccess && personas.length === 0;
  const refreshing = portfolioQuery.isFetching || worldCoresQuery.isFetching || draftHistoryStatus === 'loading';
  const refreshAll = () => {
    void portfolioQuery.refetch();
    void worldCoresQuery.refetch();
    void refreshDraftHistory();
  };
  const openCreate = () => navigate('/portfolio/create');

  return (
    <ScrollArea className="flex-1" viewportClassName="bg-transparent">
      <div className="ras-page ras-persona-library">
        <header className="ras-page-header ras-persona-library__header">
          <NimiText as="h1" role="page-title" className="m-0">
            {t('portfolio.title')}
          </NimiText>
          <div className="ras-page-header__actions">
            <Button
              tone="secondary"
              loading={refreshing}
              leadingIcon={<RefreshCw size={15} strokeWidth={1.8} />}
              onClick={refreshAll}
              aria-label={t('portfolio.refreshAria')}
            >
              {t('common.refresh')}
            </Button>
            <Button
              tone="primary"
              leadingIcon={<Plus size={15} strokeWidth={2} />}
              onClick={openCreate}
            >
              {t('portfolio.createButton')}
            </Button>
          </div>
        </header>

        <NimiTabs
          items={[
            { value: 'personas', label: t('portfolio.tabs.personas') },
            { value: 'local-drafts', label: t('portfolio.tabs.localDrafts') },
          ]}
          value={activeView}
          onValueChange={(value) => setActiveView(value as PortfolioView)}
          ariaLabel={t('portfolio.tabs.ariaLabel')}
        />

        {activeView === 'personas' && portfolioFailure ? (
          <PortfolioSourceNotice
            failure={portfolioFailure.kind}
            loading={portfolioQuery.isFetching}
            onRetry={() => void portfolioQuery.refetch()}
          />
        ) : null}

        {activeView === 'local-drafts' ? (
          <div
            id="portfolio-panel-local-drafts"
            role="tabpanel"
          >
            <LocalDraftList
              entries={draftEntries}
              images={draftImages}
              status={draftHistoryStatus}
              partial={draftHistoryPartial}
              onContinue={(draftKey) => navigate(`/portfolio/create?draft=${encodeURIComponent(draftKey)}`)}
              onCreate={openCreate}
            />
          </div>
        ) : (
          <div
            id="portfolio-panel-personas"
            role="tabpanel"
            className="ras-persona-library__persona-panel"
          >
            {portfolioQuery.isLoading ? (
              <PortfolioLoadingState />
            ) : showDesignPreview ? (
              <DesignPreviewPersonaList />
            ) : portfolioFailure ? null : personas.length === 0 ? (
              <div className="ras-hero-empty">
                <div className="ras-hero-empty__icon">
                  <LayoutGrid size={28} strokeWidth={1.8} />
                </div>
                <div className="ras-stack-tight">
                  <h2 className="ras-hero-empty__title">{t('portfolio.emptyTitle')}</h2>
                  <p className="ras-hero-empty__description">{t('portfolio.emptyDescription')}</p>
                </div>
                <Button
                  tone="primary"
                  size="lg"
                  leadingIcon={<Plus size={16} strokeWidth={2} />}
                  onClick={openCreate}
                >
                  {t('portfolio.createButton')}
                </Button>
              </div>
            ) : (
              <>
                <FilterCard
                  queryText={queryText}
                  filter={filter}
                  sort={sort}
                  visibleCount={visiblePersonas.length}
                  totalCount={personas.length}
                  onQueryChange={setQueryText}
                  onFilterChange={setFilter}
                  onSortChange={setSort}
                />

                {sourceWarnings.length > 0 ? (
                  <InlineAlert tone="warning">
                    {t('portfolio.friendCountWarning', {
                      count: sourceWarnings.length,
                      plural: sourceWarnings.length === 1 ? '' : 's',
                    })}
                  </InlineAlert>
                ) : null}

                {visiblePersonas.length === 0 ? (
                  <div className="ras-hero-empty">
                    <h2 className="ras-hero-empty__title">{t('portfolio.noLocalMatchTitle')}</h2>
                    <p className="ras-hero-empty__description">{t('portfolio.noLocalMatchDescription')}</p>
                  </div>
                ) : (
                  <div className="ras-persona-grid">
                    {visiblePersonas.map((persona) => {
                      const worldPresentation = persona.worldName
                        ? worldPresentationById.get(persona.worldName)
                        : undefined;
                      return (
                        <PersonaCard
                          key={persona.id}
                          persona={persona}
                          worldBannerUrl={worldPresentation?.bannerUrl || null}
                          worldName={worldPresentation?.worldName || persona.worldName}
                          active={false}
                          onSelect={() => navigate(`/portfolio/${persona.id}`)}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
