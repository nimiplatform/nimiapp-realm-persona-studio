import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, InlineAlert, NimiText, StatusBadge, Surface, nimiToast } from '@nimiplatform/kit/ui';
import { ModelConfigAIConfigSurface, type ModelConfigCopy } from '@nimiplatform/kit/features/model-config';
import { failureKindCopyKey } from '@renderer/features/portfolio/failure-copy.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import type { StudioCopyTranslator } from '@renderer/i18n/studio-i18n.js';
import {
  loadStudioAIConfig,
  getStudioAIConfigManager,
  openStudioAIConfigurationInDesktop,
} from './studio-ai-config-store.js';

const STUDIO_AI_CONFIG_QUERY_KEY = ['realm-persona-studio', 'studio-ai-config'] as const;
// @nimi-authority: rule.realm-persona-studio.runtime-ai.r011
const STUDIO_AI_CAPABILITIES = ['text.generate', 'image.generate', 'audio.synthesize'] as const;

const CAPABILITY_LABEL_KEYS: Readonly<Record<string, StudioCopyKey>> = {
  'audio.synthesize': 'ModelConfig.surface.capability.audioSynthesize',
  'audio.transcribe': 'ModelConfig.surface.capability.audioTranscribe',
  'image.generate': 'ModelConfig.surface.capability.imageGenerate',
  'music.generate': 'ModelConfig.surface.capability.musicGenerate',
  'realtime.interact': 'ModelConfig.surface.capability.realtimeInteract',
  'text.embed': 'ModelConfig.surface.capability.textEmbed',
  'text.generate': 'ModelConfig.surface.capability.textGenerate',
  'video.generate': 'ModelConfig.surface.capability.videoGenerate',
  'voice.create': 'ModelConfig.surface.capability.voiceCreate',
  'world.generate': 'ModelConfig.surface.capability.worldGenerate',
};

function buildStudioModelConfigCopy(t: StudioCopyTranslator): ModelConfigCopy {
  return {
    title: t('ModelConfig.surface.title'),
    description: t('ModelConfig.surface.description'),
    backLabel: t('ModelConfig.surface.backLabel'),
    detailTitle: (capabilityLabel) => t('ModelConfig.surface.detailTitle', { capability: capabilityLabel }),
    activeModelLabel: t('ModelConfig.surface.activeModelLabel'),
    activeModelHint: t('ModelConfig.surface.activeModelHint'),
    activeModelConfiguredLabel: t('ModelConfig.surface.activeModelConfiguredLabel'),
    activeModelSetupPendingLabel: t('ModelConfig.surface.activeModelSetupPendingLabel'),
    modelPickerTitle: t('ModelConfig.surface.modelPickerTitle'),
    modelPickerSearchPlaceholder: t('ModelConfig.surface.modelPickerSearchPlaceholder'),
    modelPickerLoadingLabel: t('ModelConfig.surface.modelPickerLoadingLabel'),
    modelPickerEmptyLabel: t('ModelConfig.surface.modelPickerEmptyLabel'),
    configuredSummary: t('ModelConfig.surface.configuredSummary'),
    emptySummary: t('ModelConfig.surface.emptySummary'),
    routeLabel: t('ModelConfig.surface.routeLabel'),
    localLabel: t('ModelConfig.surface.localLabel'),
    cloudLabel: t('ModelConfig.surface.cloudLabel'),
    saveLocalLabel: t('ModelConfig.surface.saveLabel'),
    saveCloudLabel: t('ModelConfig.surface.saveLabel'),
    savingLabel: t('ModelConfig.surface.savingLabel'),
    clearLabel: t('ModelConfig.surface.clearLabel'),
    clearingLabel: t('ModelConfig.surface.clearingLabel'),
    conflictLabel: t('ModelConfig.surface.conflictLabel'),
    conflictDescription: t('ModelConfig.surface.conflictDescription'),
    conflictCurrentLabel: (revision, summary) => t('ModelConfig.surface.conflictCurrentLabel', { revision, summary }),
    advancedLabel: t('ModelConfig.surface.advancedLabel'),
    advancedHint: t('ModelConfig.surface.advancedHint'),
    requiredFeaturesLabel: t('ModelConfig.surface.requiredFeaturesLabel'),
    requiredFeaturesPlaceholder: t('ModelConfig.surface.requiredFeaturesPlaceholder'),
    defaultsLabel: t('ModelConfig.surface.defaultsLabel'),
    defaultsPlaceholder: t('ModelConfig.surface.defaultsPlaceholder'),
    defaultsUnsetLabel: t('ModelConfig.surface.defaultsUnsetLabel'),
    defaultsTrueLabel: t('ModelConfig.surface.defaultsTrueLabel'),
    defaultsFalseLabel: t('ModelConfig.surface.defaultsFalseLabel'),
    defaultsListPlaceholder: t('ModelConfig.surface.defaultsListPlaceholder'),
    defaultsLocalEffectivePlaceholder: (value) => t('ModelConfig.surface.defaultsLocalEffectivePlaceholder', { value }),
    defaultsCloudEffectivePlaceholder: t('ModelConfig.surface.defaultsCloudEffectivePlaceholder'),
    defaultsRandomValue: t('ModelConfig.surface.defaultsRandomValue'),
    localChoiceDescription: t('ModelConfig.surface.localChoiceDescription'),
    localSelectedLabel: t('ModelConfig.surface.localSelectedLabel'),
    localMissingLabel: t('ModelConfig.surface.localMissingLabel'),
    localBrokenLabel: t('ModelConfig.surface.localBrokenLabel'),
    localUnavailableLabel: t('ModelConfig.surface.localUnavailableLabel'),
    localMismatchLabel: (features) => t('ModelConfig.surface.localMismatchLabel', { features }),
    openMachineLabel: t('ModelConfig.surface.openMachineLabel'),
    cloudConnectorPickerLabel: t('ModelConfig.surface.cloudConnectorPickerLabel'),
    cloudConnectorPickerPlaceholder: t('ModelConfig.surface.cloudConnectorPickerPlaceholder'),
    cloudConnectorSelectionRequired: t('ModelConfig.surface.cloudConnectorSelectionRequired'),
    cloudNoConnectorsLabel: t('ModelConfig.surface.cloudNoConnectorsLabel'),
    openCloudConnectorsLabel: t('ModelConfig.surface.openCloudConnectorsLabel'),
    cloudImplementationLabel: t('ModelConfig.surface.cloudImplementationLabel'),
    cloudImplementationPlaceholder: t('ModelConfig.surface.cloudImplementationPlaceholder'),
    cloudTargetLabel: t('ModelConfig.surface.cloudTargetLabel'),
    cloudTargetPlaceholder: t('ModelConfig.surface.cloudTargetPlaceholder'),
    cloudTargetDialogTitle: t('ModelConfig.surface.cloudTargetDialogTitle'),
    cloudTargetDialogDescription: t('ModelConfig.surface.cloudTargetDialogDescription'),
    cloudNoticeLabel: t('ModelConfig.surface.cloudNoticeLabel'),
    cloudNoticeDescription: t('ModelConfig.surface.cloudNoticeDescription'),
    cloudConnectorLabel: t('ModelConfig.surface.cloudConnectorLabel'),
    cloudConnectorPlaceholder: t('ModelConfig.surface.cloudConnectorPlaceholder'),
    cloudLoadFailed: t('ModelConfig.surface.cloudLoadFailed'),
    retryLabel: t('ModelConfig.surface.retryLabel'),
    loadFailed: t('ModelConfig.surface.loadFailed'),
    saveFailed: t('ModelConfig.surface.saveFailed'),
    technicalDetailsLabel: t('ModelConfig.surface.technicalDetailsLabel'),
    unsupportedCapabilityLabel: t('ModelConfig.surface.unsupportedCapabilityLabel'),
    notConfiguredLabel: t('ModelConfig.surface.notConfiguredLabel'),
    configuredLabel: t('ModelConfig.surface.configuredLabel'),
    selectionRequiredLabel: t('ModelConfig.surface.selectionRequiredLabel'),
    blockedLabel: t('ModelConfig.surface.blockedLabel'),
    unavailableLabel: t('ModelConfig.surface.unavailableLabel'),
    mismatchLabel: t('ModelConfig.surface.mismatchLabel'),
    cancelLabel: t('ModelConfig.surface.cancelLabel'),
    confirmSelectionLabel: t('ModelConfig.surface.confirmSelectionLabel'),
    capabilityLabel: (capability, fallback) => {
      const labelKey = CAPABILITY_LABEL_KEYS[capability];
      return labelKey ? t(labelKey) : fallback;
    },
  };
}

export function StudioAIConfigPage() {
  const { locale, t } = useStudioI18n();
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
  const intents = (snapshot?.config?.capabilities ?? []).filter((intent) =>
    STUDIO_AI_CAPABILITIES.some((capability) => capability === intent.capabilityContract));
  const effectiveByCapability = new Map(
    snapshot?.effectiveSelections.map((selection) => [selection.capabilityContract, selection]),
  );
  const configured = intents.length > 0;
  const effectiveReady = configured && intents.every(
    (intent) => effectiveByCapability.get(intent.capabilityContract)?.state === 'ready',
  );
  const readErrorDetails = describeAIConfigFailure(configQuery.error);
  const navigationErrorDetails = describeAIConfigFailure(ownerConfigurationMutation.error);
  const modelConfigCopy = useMemo(() => buildStudioModelConfigCopy(t), [t]);

  return (
    <div className="ras-page">
      <Surface tone="card" padding="lg" className="ras-radius-xl">
        <div className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <NimiText as="h1" role="page-title" className="m-0">
              {t('aiConfig.title')}
            </NimiText>
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

        {configQuery.isSuccess && !configured ? (
          <InlineAlert tone="warning" className="mb-4">
            {t('aiConfig.notConfiguredDetail')}
          </InlineAlert>
        ) : null}
        <ModelConfigAIConfigSurface
          className="mb-4"
          context={{ owner: 'app-ai-config', appId: 'nimi.realm-persona-studio' }}
          capabilityContracts={STUDIO_AI_CAPABILITIES}
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
          copy={modelConfigCopy}
          language={locale}
        />

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
          <AIConfigFailureAlert details={navigationErrorDetails} />
        ) : null}
        {readErrorDetails ? (
          <AIConfigFailureAlert details={readErrorDetails} />
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

function AIConfigFailureAlert({ details }: { details: AIConfigFailureDetail }) {
  const { t } = useStudioI18n();

  const copyDiagnostics = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      nimiToast.danger(t('aiConfig.diagnosticsCopyFailed'));
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(details, null, 2));
      nimiToast.success(t('aiConfig.diagnosticsCopied'));
    } catch {
      nimiToast.danger(t('aiConfig.diagnosticsCopyFailed'));
    }
  };

  return (
    <InlineAlert tone="danger" className="mt-3">
      <div>{t(failureKindCopyKey(details.reasonCode ?? ''))}</div>
      <div className="mt-2">
        <Button tone="secondary" size="sm" onClick={() => void copyDiagnostics()}>
          {t('aiConfig.copyDiagnostics')}
        </Button>
      </div>
    </InlineAlert>
  );
}
