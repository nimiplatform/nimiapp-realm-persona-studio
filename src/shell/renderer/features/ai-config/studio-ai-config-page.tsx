import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import type { NimiPortableAppAIConfigIntent } from '@nimiplatform/sdk/ai';
import { TechnicalReviewDetails } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import {
  loadStudioAIConfig,
  openStudioAIConfigurationInDesktop,
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
  const configQuery = useQuery({
    queryKey: STUDIO_AI_CONFIG_QUERY_KEY,
    queryFn: () => loadStudioAIConfig(),
    retry: false,
    refetchOnWindowFocus: 'always',
  });
  const ownerConfigurationMutation = useMutation({
    mutationFn: () => openStudioAIConfigurationInDesktop(),
  });

  const config = configQuery.data ?? null;
  const readErrorDetails = describeAIConfigFailure(configQuery.error);
  const navigationErrorDetails = describeAIConfigFailure(ownerConfigurationMutation.error);

  return (
    <div className="ras-page">
      <Surface tone="card" padding="lg" className="ras-radius-xl">
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
          <InlineAlert tone="danger" className="mb-4">
            {t('aiConfig.unavailableDetail')}
          </InlineAlert>
        ) : null}
        {configQuery.isSuccess && !config ? (
          <InlineAlert tone="warning" className="mb-4">
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
          <Button
            tone="secondary"
            disabled={configQuery.isFetching}
            loading={configQuery.isFetching}
            onClick={() => void configQuery.refetch()}
          >
            {t('common.refresh')}
          </Button>
          <Button
            tone="primary"
            disabled={ownerConfigurationMutation.isPending}
            loading={ownerConfigurationMutation.isPending}
            onClick={() => ownerConfigurationMutation.mutate()}
          >
            {t('aiConfig.action.openOwnerConfiguration')}
          </Button>
        </div>
        {ownerConfigurationMutation.isError ? (
          <InlineAlert tone="warning" className="mt-3">
            {t('aiConfig.handoffRejected')}
          </InlineAlert>
        ) : null}
        {navigationErrorDetails ? (
          <TechnicalReviewDetails title={t('aiConfig.handoffErrorDetails')}>
            <AIConfigFailureDetails details={navigationErrorDetails} />
          </TechnicalReviewDetails>
        ) : null}
        {readErrorDetails ? (
          <TechnicalReviewDetails title={t('aiConfig.errorDetails')}>
            <AIConfigFailureDetails details={readErrorDetails} />
          </TechnicalReviewDetails>
        ) : null}
      </Surface>
    </div>
  );
}

type AIConfigFailureDetail = {
  readonly message: string;
  readonly reasonCode?: string;
  readonly actionHint?: string;
};

function describeAIConfigFailure(error: unknown): AIConfigFailureDetail | null {
  if (!error) return null;
  const record = typeof error === 'object' ? error as Record<string, unknown> : null;
  const message = error instanceof Error && error.message
    ? error.message
    : typeof record?.message === 'string'
      ? record.message
      : String(error);
  const reasonCode = typeof record?.reasonCode === 'string' ? record.reasonCode : undefined;
  const actionHint = typeof record?.actionHint === 'string' ? record.actionHint : undefined;
  return {
    message,
    ...(reasonCode ? { reasonCode } : {}),
    ...(actionHint ? { actionHint } : {}),
  };
}

function AIConfigFailureDetails({ details }: { details: AIConfigFailureDetail }) {
  return (
    <pre className="ras-json-preview m-0 min-h-16 overflow-auto rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-panel)] p-3 text-xs">
      {JSON.stringify(details, null, 2)}
    </pre>
  );
}
