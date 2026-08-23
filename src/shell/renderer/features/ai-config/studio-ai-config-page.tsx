import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { ModelConfigAIConfigSurface } from '@nimiplatform/kit/features/model-config';
import { CANONICAL_CAPABILITY_IDS } from '@nimiplatform/kit/core/runtime-capabilities';
import type { NimiPortableAppAIConfigIntent } from '@nimiplatform/sdk/ai';
import { TechnicalReviewDetails } from '@renderer/features/portfolio/OwnerPortfolio.shared.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import {
  loadStudioAIConfig,
  getStudioAIConfigManager,
  openStudioAIConfigurationInDesktop,
} from './studio-ai-config-store.js';

const STUDIO_AI_CONFIG_QUERY_KEY = ['realm-persona-studio', 'studio-ai-config'] as const;

function routeKindLabelKey(intent: NimiPortableAppAIConfigIntent): StudioCopyKey {
  if (intent.route.oneofKind === 'local') return 'aiConfig.route.local';
  if (intent.route.oneofKind === 'cloud') return 'aiConfig.route.cloud';
  throw new Error(`AIConfig route is missing for ${intent.capabilityContract}.`);
}

export function StudioAIConfigPage() {
  const { t } = useStudioI18n();
  const queryClient = useQueryClient();
  const aiConfigManager = getStudioAIConfigManager();
  const configQuery = useQuery({
    queryKey: STUDIO_AI_CONFIG_QUERY_KEY,
    queryFn: () => loadStudioAIConfig(),
    retry: false,
    refetchOnWindowFocus: 'always',
  });
  const ownerConfigurationMutation = useMutation({
    mutationFn: () => openStudioAIConfigurationInDesktop(),
  });

  const snapshot = configQuery.data;
  const config = snapshot?.config ?? null;
  const intents = config?.capabilities ?? [];
  const effectiveByCapability = new Map(
    snapshot?.effectiveSelections.map((selection) => [selection.capabilityContract, selection]),
  );
  const configured = intents.length > 0;
  const effectiveReady = configured && intents.every(
    (intent) => effectiveByCapability.get(intent.capabilityContract)?.state === 'ready',
  );
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
            tone={configQuery.isPending ? 'neutral' : configQuery.isError || (configured && !effectiveReady) ? 'warning' : configured ? 'success' : 'info'}
            shape="dot"
          >
            {configQuery.isPending
              ? t('common.loading')
              : configQuery.isError
                ? t('aiConfig.state.unavailable')
                : configured && effectiveReady
                  ? t('aiConfig.state.configured')
                  : configured
                    ? t('aiConfig.state.unavailable')
                  : t('aiConfig.state.notConfigured')}
          </StatusBadge>
        </div>

        {configQuery.isError ? (
          <InlineAlert tone="danger" className="mb-4">
            {t('aiConfig.unavailableDetail')}
          </InlineAlert>
        ) : null}
        {configQuery.isSuccess && !configured ? (
          <InlineAlert tone="warning" className="mb-4">
            {t('aiConfig.notConfiguredDetail')}
          </InlineAlert>
        ) : null}
        <ModelConfigAIConfigSurface
          className="mb-4"
          context={{ owner: 'app-ai-config', appId: 'nimi.realm-persona-studio' }}
          capabilityContracts={CANONICAL_CAPABILITY_IDS}
          capabilities={snapshot?.config?.capabilities ?? (configQuery.isSuccess ? null : undefined)}
          revision={snapshot?.revision}
          effectiveSelections={snapshot?.effectiveSelections}
          listOptions={(query) => aiConfigManager.listOptions(query)}
          onOverwrite={async (input) => {
            const result = await aiConfigManager.overwrite(input);
            queryClient.setQueryData(STUDIO_AI_CONFIG_QUERY_KEY, {
              config: result.config,
              revision: result.revision,
              effectiveSelections: [],
            });
            void configQuery.refetch();
            return result;
          }}
          onOpenOwnerConfiguration={() => ownerConfigurationMutation.mutate()}
          loadError={configQuery.isError ? t('aiConfig.unavailableDetail') : null}
          onRetry={() => { void configQuery.refetch(); }}
        />
        {config ? (
          <div className="mb-4 grid gap-2">
            {intents.map((intent) => (
              <Surface key={intent.capabilityContract} tone="card" padding="md">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="ras-break-anywhere font-medium">{intent.capabilityContract}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{t(routeKindLabelKey(intent))}</StatusBadge>
                    <StatusBadge tone={effectiveByCapability.get(intent.capabilityContract)?.state === 'ready' ? 'success' : 'warning'}>
                      {t(effectiveByCapability.get(intent.capabilityContract)?.state === 'ready'
                        ? 'aiConfig.state.configured'
                        : 'aiConfig.state.unavailable')}
                    </StatusBadge>
                  </div>
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
        {ownerConfigurationMutation.isSuccess ? (
          <InlineAlert tone="success" className="mt-3">
            {t('aiConfig.handoffAccepted')}
          </InlineAlert>
        ) : null}
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
