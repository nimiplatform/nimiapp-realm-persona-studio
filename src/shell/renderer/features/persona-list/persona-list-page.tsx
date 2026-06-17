import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, AlertTriangle, LayoutGrid } from 'lucide-react';
import {
  Button,
  FieldShell,
  InlineAlert,
  LoadingSkeleton,
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
import { PersonaCard } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { ownerPortfolioListQueryKey } from '@renderer/features/persona-detail/use-persona-detail-query.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';

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
  'realm-unavailable': 'portfolio.failure.realmUnavailable.title',
  'permission-missing': 'portfolio.failure.permissionMissing.title',
  'owner-authority-missing': 'portfolio.failure.ownerAuthorityMissing.title',
  'setting-read-unavailable': 'portfolio.failure.settingReadUnavailable.title',
  unknown: 'portfolio.failure.portfolioUnavailable.title',
};

const PORTFOLIO_FAILURE_DETAIL_KEYS: Record<PortfolioFailureKind, StudioCopyKey> = {
  'realm-unavailable': 'portfolio.failure.portfolio.realm',
  'permission-missing': 'portfolio.failure.portfolio.permission',
  'owner-authority-missing': 'portfolio.failure.portfolio.owner',
  'setting-read-unavailable': 'portfolio.failure.portfolio.setting',
  unknown: 'portfolio.failure.portfolio.unknown',
};

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

function PortfolioFailureState({
  title,
  detail,
  loading,
  onRetry,
}: {
  title: string;
  detail: string;
  loading: boolean;
  onRetry: () => void;
}) {
  const { t } = useStudioI18n();
  return (
    <section className="ras-card">
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 16, alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'color-mix(in srgb, var(--nimi-status-danger) 12%, transparent)',
            color: 'var(--nimi-status-danger)',
          }}
        >
          <AlertTriangle size={28} strokeWidth={1.8} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--nimi-text-primary)' }}>{title}</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--nimi-text-muted)', fontSize: 14, lineHeight: 1.55 }}>{detail}</p>
        </div>
        <Button tone="primary" loading={loading} onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </div>
    </section>
  );
}

type PersonaListMode = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<OwnerPortfolioPersona[]>;
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  refreshLabel: string;
  createEnabled: boolean;
  detailPath: (personaId: string) => string;
};

function PortfolioListPage({ mode }: { mode: PersonaListMode }) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState('');
  const [filter, setFilter] = useState<OwnerPortfolioFilter>('all');
  const [sort, setSort] = useState<OwnerPortfolioSort>('realm-order');

  const portfolioQuery = useQuery({
    queryKey: mode.queryKey,
    queryFn: mode.queryFn,
  });

  const personas = portfolioQuery.data || [];
  const visiblePersonas = useMemo(
    () => applyOwnerPortfolioView(personas, { query: queryText, filter, sort }),
    [personas, filter, queryText, sort],
  );

  const sourceWarnings = personas.filter((persona) => persona.friendCount.status === 'source-unavailable');
  const hasPersonas = personas.length > 0;

  return (
    <ScrollArea className="flex-1" viewportClassName="bg-transparent">
      <div className="ras-page">
        <header className="ras-page-header">
          <div style={{ minWidth: 0 }}>
            <p className="ras-page-header__eyebrow">{mode.eyebrow}</p>
            <h1 className="ras-page-header__title">{mode.title}</h1>
            <p className="ras-page-header__description">
              {mode.description}
            </p>
          </div>
          <div className="ras-page-header__actions">
            <Button
              tone="secondary"
              loading={portfolioQuery.isFetching}
              leadingIcon={<RefreshCw size={15} strokeWidth={1.8} />}
              onClick={() => void portfolioQuery.refetch()}
              aria-label={t('portfolio.refreshAria')}
            >
              {mode.refreshLabel}
            </Button>
            {mode.createEnabled ? (
              <Button
                tone="primary"
                leadingIcon={<Plus size={15} strokeWidth={2} />}
                onClick={() => navigate('/portfolio/create')}
              >
                {t('portfolio.createButton')}
              </Button>
            ) : null}
          </div>
        </header>

        {portfolioQuery.isLoading ? (
          <PortfolioLoadingState />
        ) : portfolioQuery.isError ? (
          (() => {
            const failure = classifyPortfolioFailure(portfolioQuery.error);
            return (
              <PortfolioFailureState
                title={t(PORTFOLIO_FAILURE_TITLE_KEYS[failure.kind])}
                detail={t(PORTFOLIO_FAILURE_DETAIL_KEYS[failure.kind])}
                loading={portfolioQuery.isFetching}
                onRetry={() => void portfolioQuery.refetch()}
              />
            );
          })()
        ) : !hasPersonas ? (
          <div className="ras-hero-empty">
            <div className="ras-hero-empty__icon">
              <LayoutGrid size={28} strokeWidth={1.8} />
            </div>
            <div className="ras-stack-tight">
              <h2 className="ras-hero-empty__title">{mode.emptyTitle}</h2>
              <p className="ras-hero-empty__description">
                {mode.emptyDescription}
              </p>
            </div>
            {mode.createEnabled ? (
              <Button
                tone="primary"
                size="lg"
                leadingIcon={<Plus size={16} strokeWidth={2} />}
                onClick={() => navigate('/portfolio/create')}
              >
                {t('portfolio.createButton')}
              </Button>
            ) : null}
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
                <p className="ras-hero-empty__description">
                  {t('portfolio.noLocalMatchDescription')}
                </p>
              </div>
            ) : (
              <div className="ras-persona-grid">
                {visiblePersonas.map((persona) => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    active={false}
                    onSelect={() => navigate(mode.detailPath(persona.id))}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

export function PersonaListPage() {
  const { t } = useStudioI18n();
  return (
    <PortfolioListPage
      mode={{
        queryKey: ownerPortfolioListQueryKey(),
        queryFn: () => listOwnerPortfolioPersonas(),
        eyebrow: t('portfolio.eyebrow'),
        title: t('portfolio.title'),
        description: t('portfolio.description'),
        emptyTitle: t('portfolio.emptyTitle'),
        emptyDescription: t('portfolio.emptyDescription'),
        refreshLabel: t('common.refresh'),
        createEnabled: true,
        detailPath: (personaId) => `/portfolio/${personaId}`,
      }}
    />
  );
}
