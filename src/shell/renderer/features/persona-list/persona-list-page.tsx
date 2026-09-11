import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, FilePenLine, Info, LayoutGrid, Plus, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import {
  Avatar,
  Button,
  DataList,
  EmptyState,
  InlineAlert,
  LoadingSkeleton,
  NimiTabs,
  NimiText,
  ScrollArea,
  SearchField,
  SelectField,
  StatusBadge,
  Surface,
} from '@nimiplatform/kit/ui';
import {
  applyOwnerPortfolioView,
  classifyPortfolioFailure,
  type OwnerPortfolioSort,
  type PortfolioFailureKind,
} from '@renderer/features/portfolio/portfolio-data.js';
import { failureKindCopyKey } from '@renderer/features/portfolio/failure-copy.js';
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

const PORTFOLIO_SORT_OPTIONS: { value: OwnerPortfolioSort; labelKey: StudioCopyKey }[] = [
  { value: 'realm-order', labelKey: 'portfolio.sort.realmOrder' },
  { value: 'display-name-asc', labelKey: 'portfolio.sort.nameAsc' },
  { value: 'updated-desc', labelKey: 'portfolio.sort.updatedDesc' },
  { value: 'friend-count-desc', labelKey: 'portfolio.sort.friendCountDesc' },
  { value: 'friend-count-asc', labelKey: 'portfolio.sort.friendCountAsc' },
];

const PORTFOLIO_FAILURE_TITLE_KEYS: Record<PortfolioFailureKind, StudioCopyKey> = {
  'capability-unavailable': 'portfolio.failure.capabilityUnavailable.title',
  'invalid-input': 'portfolio.failure.settingReadUnavailable.title',
  'session-invalid': 'portfolio.failure.accessDenied.title',
  'access-denied': 'portfolio.failure.accessDenied.title',
  'owner-authority-missing': 'portfolio.failure.ownerAuthorityMissing.title',
  'not-found': 'portfolio.failure.portfolioUnavailable.title',
  'content-conflict': 'portfolio.failure.settingReadUnavailable.title',
  'realm-unavailable': 'portfolio.failure.realmUnavailable.title',
  'rate-limited': 'portfolio.failure.realmUnavailable.title',
  'upstream-failed': 'portfolio.failure.realmUnavailable.title',
  'contract-invalid': 'portfolio.failure.settingReadUnavailable.title',
  'request-too-large': 'portfolio.failure.settingReadUnavailable.title',
  'response-too-large': 'portfolio.failure.settingReadUnavailable.title',
};

const PORTFOLIO_FAILURE_DETAIL_KEYS: Record<PortfolioFailureKind, StudioCopyKey> = {
  'capability-unavailable': 'portfolio.failure.portfolio.capabilityUnavailable',
  'invalid-input': 'portfolio.failure.portfolio.setting',
  'session-invalid': 'portfolio.failure.portfolio.accessDenied',
  'access-denied': 'portfolio.failure.portfolio.accessDenied',
  'owner-authority-missing': 'portfolio.failure.portfolio.owner',
  'not-found': 'portfolio.failure.portfolio.unknown',
  'content-conflict': 'portfolio.failure.portfolio.setting',
  'realm-unavailable': 'portfolio.failure.portfolio.realm',
  'rate-limited': 'portfolio.failure.portfolio.realm',
  'upstream-failed': 'portfolio.failure.portfolio.realm',
  'contract-invalid': 'portfolio.failure.portfolio.setting',
  'request-too-large': 'portfolio.failure.portfolio.setting',
  'response-too-large': 'portfolio.failure.portfolio.setting',
};

type PortfolioView = 'personas' | 'local-drafts';
type DraftHistoryStatus = 'loading' | 'ready' | 'unavailable';

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

function PortfolioToolbar({
  queryText,
  sort,
  visibleCount,
  totalCount,
  onQueryChange,
  onSortChange,
}: {
  queryText: string;
  sort: OwnerPortfolioSort;
  visibleCount: number;
  totalCount: number;
  onQueryChange: (next: string) => void;
  onSortChange: (next: OwnerPortfolioSort) => void;
}) {
  const { t } = useStudioI18n();
  const sortOptions = PORTFOLIO_SORT_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));

  return (
    <div className="ras-portfolio-toolbar">
      <SearchField
        className="ras-portfolio-toolbar__search"
        value={queryText}
        placeholder={t('portfolio.search.placeholder')}
        aria-label={t('portfolio.search.ariaLabel')}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
      <div className="ras-portfolio-toolbar__controls">
        <div className="ras-portfolio-toolbar__field">
          <span className="ras-portfolio-toolbar__field-label">{t('portfolio.sort.label')}</span>
          <SelectField
            aria-label={t('portfolio.sort.label')}
            value={sort}
            options={sortOptions}
            onValueChange={(value) => onSortChange(value as OwnerPortfolioSort)}
          />
        </div>
        <p className="ras-portfolio-toolbar__count">
          {visibleCount === totalCount
            ? t('portfolio.count.total', { count: totalCount })
            : t('portfolio.count.filtered', { visible: visibleCount, total: totalCount })}
        </p>
      </div>
    </div>
  );
}

function PortfolioLoadingState() {
  return (
    <div className="ras-persona-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <Surface key={index} tone="panel" padding="lg" className="ras-radius-xl">
          <LoadingSkeleton lines={3} />
        </Surface>
      ))}
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
        <StatusBadge tone="neutral">{t(failureKindCopyKey(failure))}</StatusBadge>
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
      <EmptyState
        className="ras-local-draft-empty"
        icon={<AlertTriangle size={28} strokeWidth={1.8} aria-hidden="true" />}
        title={t('portfolio.localDrafts.unavailableTitle')}
        description={t('portfolio.localDrafts.unavailableDescription')}
      />
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        className="ras-local-draft-empty"
        icon={<FilePenLine size={30} strokeWidth={1.7} aria-hidden="true" />}
        title={t('portfolio.localDrafts.emptyTitle')}
        description={t('portfolio.localDrafts.emptyDescription')}
        action={(
          <Button tone="primary" leadingIcon={<Plus size={16} />} onClick={onCreate}>
            {t('portfolio.createButton')}
          </Button>
        )}
      />
    );
  }

  return (
    <div className="ras-local-drafts-stack">
      {partial ? (
        <InlineAlert tone="warning">{t('portfolio.localDrafts.partialUnavailable')}</InlineAlert>
      ) : null}
      <DataList
        ariaLabel={t('portfolio.localDrafts.ariaLabel')}
        items={entries.map((entry) => {
          const description = [
            entry.worldName,
            entry.archetype ? translatePersonaArchetypeLabel(entry.archetype, t) : null,
          ].filter(Boolean).join(' · ');
          const updatedAt = formatDraftUpdatedAt(entry.updatedAt, locale);

          return {
            id: entry.draftKey,
            leading: (
              <Avatar
                alt={entry.displayName}
                src={images[entry.draftKey]}
                size="lg"
                shape="rounded"
                tone="accent"
                fallback={<span className="text-xl font-semibold">{entry.displayName.charAt(0).toUpperCase()}</span>}
              />
            ),
            title: entry.displayName,
            description: description || undefined,
            meta: (
              <>
                <PersonaLibraryStatusBadge status="local-draft" />
                <time
                  dateTime={entry.updatedAt}
                  aria-label={t('portfolio.localDrafts.updatedAt', { dateTime: updatedAt })}
                >
                  {updatedAt}
                </time>
              </>
            ),
            actions: (
              <Button
                tone="ghost"
                size="sm"
                trailingIcon={<ChevronRight size={17} strokeWidth={1.8} />}
                onClick={() => onContinue(entry.draftKey)}
              >
                {t('portfolio.localDrafts.continue')}
              </Button>
            ),
          };
        })}
      />
    </div>
  );
}

export function PersonaListPage() {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<PortfolioView>('personas');
  const [queryText, setQueryText] = useState('');
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
    () => applyOwnerPortfolioView(personas, { query: queryText, filter: 'all', sort }),
    [personas, queryText, sort],
  );
  const portfolioFailure = portfolioQuery.isError ? classifyPortfolioFailure(portfolioQuery.error) : null;
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

          </div>
        </header>

        <section className="ras-persona-welcome">
          <span className="ras-workshop-eyebrow">{t('workshop.hub.eyebrow')}</span>
          <h2>{t('workshop.hub.title')}</h2>
          <p>{t('workshop.hub.description')}</p>
          <div className="ras-persona-welcome__actions">
            <Button tone="primary" leadingIcon={<Sparkles size={16} aria-hidden="true" />} onClick={openCreate}>{t('workshop.hub.create')}</Button>
            {draftHistoryStatus === 'ready' && draftEntries[0] ? <Button tone="ghost" trailingIcon={<ArrowRight size={15} aria-hidden="true" />} onClick={() => navigate(`/portfolio/create?draft=${encodeURIComponent(draftEntries[0]!.draftKey)}`)}>{t('workshop.hub.resume')}</Button> : null}
          </div>
        </section>

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
            ) : portfolioFailure ? null : personas.length === 0 ? (
              <EmptyState
                icon={<LayoutGrid size={22} strokeWidth={1.6} />}
                title={t('portfolio.emptyTitle')}
                description={t('portfolio.emptyDescription')}
                action={(
                  <Button
                    tone="primary"
                    size="lg"
                    leadingIcon={<Plus size={16} strokeWidth={2} />}
                    onClick={openCreate}
                  >
                    {t('portfolio.createButton')}
                  </Button>
                )}
              />
            ) : (
              <>
                <PortfolioToolbar
                  queryText={queryText}
                  sort={sort}
                  visibleCount={visiblePersonas.length}
                  totalCount={personas.length}
                  onQueryChange={setQueryText}
                  onSortChange={setSort}
                />


                {visiblePersonas.length === 0 ? (
                  <EmptyState
                    title={t('portfolio.noLocalMatchTitle')}
                    description={t('portfolio.noLocalMatchDescription')}
                  />
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
