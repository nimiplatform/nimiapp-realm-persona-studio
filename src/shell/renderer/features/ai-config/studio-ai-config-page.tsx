import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import type { NimiPortableAppAIConfigIntent } from '@nimiplatform/sdk/ai';
import { TechnicalReviewDetails } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import {
  createStudioLocalCapabilityIntent,
  loadStudioAIConfig,
  overwriteStudioCapabilityIntent,
  STUDIO_TEXT_GENERATE_CAPABILITY_CONTRACT,
} from './studio-ai-config-store.js';

const STUDIO_AI_CONFIG_QUERY_KEY = ['realm-persona-studio', 'studio-ai-config'] as const;

const ROUTE_KIND_LABEL_KEYS: Record<NimiPortableAppAIConfigIntent['route']['oneofKind'], StudioCopyKey> = {
  local: 'aiConfig.route.local',
  cloud: 'aiConfig.route.cloud',
};

function routeKindLabelKey(intent: NimiPortableAppAIConfigIntent): StudioCopyKey {
  return ROUTE_KIND_LABEL_KEYS[intent.route.oneofKind];
}

export function StudioAIConfigPage() {
  const { t } = useStudioI18n();
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: STUDIO_AI_CONFIG_QUERY_KEY,
    queryFn: () => loadStudioAIConfig(),
    retry: false,
  });
  const overwriteMutation = useMutation({
    mutationFn: () => overwriteStudioCapabilityIntent(createStudioLocalCapabilityIntent()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: STUDIO_AI_CONFIG_QUERY_KEY });
    },
  });

  const config = configQuery.data ?? null;
  const textGenerateIntent = config?.capabilities.find(
    (intent) => intent.capabilityContract === STUDIO_TEXT_GENERATE_CAPABILITY_CONTRACT,
  ) ?? null;
  const rawError = configQuery.error ?? overwriteMutation.error;
  const rawErrorText = rawError instanceof Error ? rawError.message : rawError ? String(rawError) : '';

  return (
    <div className="ras-page">
      <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
        <div className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 text-2xl font-semibold">{t('aiConfig.title')}</h2>
            <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
              {t('aiConfig.description')}
            </p>
          </div>
          <StatusBadge
            tone={configQuery.isPending ? 'neutral' : configQuery.isError ? 'warning' : config ? 'success' : 'info'}
            shape="dot"
          >
            {configQuery.isPending
              ? t('common.loading')
              : configQuery.isError
                ? t('aiConfig.state.unavailable')
                : config
                  ? t('aiConfig.state.configured')
                  : t('aiConfig.state.notConfigured')}
          </StatusBadge>
        </div>

        {configQuery.isError ? (
          <InlineAlert tone="info" className="mb-4">
            {t('aiConfig.unavailableDetail')}
          </InlineAlert>
        ) : null}
        {configQuery.isSuccess && !config ? (
          <InlineAlert tone="info" className="mb-4">
            {t('aiConfig.notConfiguredDetail')}
          </InlineAlert>
        ) : null}
        {config ? (
          <div className="mb-4 grid gap-2">
            {config.capabilities.map((intent) => (
              <Surface key={intent.capabilityContract} tone="card" padding="md">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="ras-break-anywhere font-medium">{intent.capabilityContract}</div>
                  <StatusBadge tone="info">{t(routeKindLabelKey(intent))}</StatusBadge>
                </div>
              </Surface>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {configQuery.isError ? (
            <Button tone="secondary" onClick={() => void configQuery.refetch()}>
              {t('common.retry')}
            </Button>
          ) : null}
          <Button
            tone="primary"
            className="text-white"
            disabled={configQuery.isPending || overwriteMutation.isPending}
            loading={overwriteMutation.isPending}
            onClick={() => overwriteMutation.mutate()}
          >
            {textGenerateIntent ? t('aiConfig.action.resetLocalIntent') : t('aiConfig.action.writeLocalIntent')}
          </Button>
        </div>
        {overwriteMutation.isSuccess ? (
          <InlineAlert tone="success" className="mt-3">
            {t('aiConfig.action.saved')}
          </InlineAlert>
        ) : null}
        {rawErrorText ? (
          <TechnicalReviewDetails title={t('aiConfig.errorDetails')}>
            <pre className="ras-json-preview m-0 min-h-16 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
              {rawErrorText}
            </pre>
          </TechnicalReviewDetails>
        ) : null}
      </Surface>
    </div>
  );
}
