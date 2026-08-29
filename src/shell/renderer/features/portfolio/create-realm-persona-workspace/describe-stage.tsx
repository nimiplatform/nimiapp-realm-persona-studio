import { useState } from 'react';
import {
  Button,
  FieldShell,
  InlineAlert,
  Surface,
  TextareaField,
} from '@nimiplatform/kit/ui';
import { Dices, Pencil, Sparkles } from 'lucide-react';
import type {
  NormalizedCreateRealmPersonaDraft,
} from '../create-persona-draft.js';
import type { PersonaSeedGenerationResult } from '../persona-seed-generator.js';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../../i18n/studio-copy.js';
import { translateCreateFlowFailure } from './create-flow-copy.js';
import type { SupplementKey } from './types.js';

export function DescribeStage({
  originalDescription,
  normalizedDraft,
  seedResult,
  isGeneratingSeed,
  isGeneratingDescription,
  updateDraft,
  onRunSeedGeneration,
  onRunDescriptionReroll,
  onSkipSeed,
}: {
  originalDescription: string;
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  seedResult: PersonaSeedGenerationResult | null;
  isGeneratingSeed: boolean;
  isGeneratingDescription: boolean;
  updateDraft: (patch: Partial<Record<SupplementKey | 'originalDescription', string>>) => void;
  onRunSeedGeneration: () => void;
  onRunDescriptionReroll: () => void;
  onSkipSeed: () => void;
}) {
  const { t } = useStudioI18n();
  const [expandedSupplements, setExpandedSupplements] = useState<Record<SupplementKey, boolean>>({
    speechSupplement: false,
    boundarySupplement: false,
    visualSupplement: false,
  });

  const supplementButtons: Array<{ key: SupplementKey; labelKey: StudioCopyKey }> = [
    { key: 'speechSupplement', labelKey: 'create.supplement.speech' },
    { key: 'boundarySupplement', labelKey: 'create.supplement.boundary' },
    { key: 'visualSupplement', labelKey: 'create.supplement.visual' },
  ];
  const supplementLabels: Record<SupplementKey, { labelKey: StudioCopyKey; placeholderKey: StudioCopyKey }> = {
    speechSupplement: { labelKey: 'create.supplement.speechLabel', placeholderKey: 'create.supplement.speechPlaceholder' },
    boundarySupplement: { labelKey: 'create.supplement.boundaryLabel', placeholderKey: 'create.supplement.boundaryPlaceholder' },
    visualSupplement: { labelKey: 'create.supplement.visualLabel', placeholderKey: 'create.supplement.visualPlaceholder' },
  };

  return (
    <Surface tone="card" material="glass-thick" padding="none" className="ras-create-describe-card">
      <div className="ras-create-describe-card__body">
      <FieldShell
        label={(
          <span className="ras-create-describe-field-label">
            <span>{t('create.oneLineLabel')}</span>
            <span className="ras-create-describe-field-label__actions">
              <span className="ras-create-describe-field-label__hint">{t('create.oneLineOptional')}</span>
              <Button
                tone="secondary"
                size="sm"
                className="rounded-full"
                disabled={isGeneratingSeed}
                loading={isGeneratingDescription}
                leadingIcon={isGeneratingDescription ? undefined : <Dices size={14} aria-hidden="true" />}
                onClick={onRunDescriptionReroll}
              >
                {isGeneratingDescription ? t('create.descriptionReroll.generating') : t('create.descriptionReroll.label')}
              </Button>
            </span>
          </span>
        )}
      >
        <TextareaField
          rows={5}
          className="ras-create-describe-textarea"
          value={originalDescription}
          placeholder={t('create.oneLinePlaceholder')}
          onChange={(event) => updateDraft({ originalDescription: event.currentTarget.value })}
        />
      </FieldShell>
      <div className="grid gap-2">
        <p className="m-0 text-xs text-[var(--nimi-text-muted)]">{t('create.supplement.hint')}</p>
        <div className="ras-create-supplement-chips flex flex-wrap gap-2">
          {supplementButtons.map(({ key, labelKey }) => (
            <Button
              key={key}
              tone="secondary"
              size="sm"
              className="rounded-full"
              aria-expanded={expandedSupplements[key]}
              onClick={() => setExpandedSupplements((current) => ({ ...current, [key]: !current[key] }))}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>
      </div>
      {seedResult && !seedResult.ok ? (
        <InlineAlert tone="danger">
          {t('create.seedGenerationFailed', { message: translateCreateFlowFailure(seedResult.cause, t) })}
        </InlineAlert>
      ) : null}
      {supplementButtons.map(({ key }) => expandedSupplements[key] ? (
        <FieldShell key={key} label={t(supplementLabels[key].labelKey)}>
          <TextareaField
            rows={3}
            value={normalizedDraft[key]}
            placeholder={t(supplementLabels[key].placeholderKey)}
            onChange={(event) => updateDraft({ [key]: event.currentTarget.value })}
          />
        </FieldShell>
      ) : null)}

      <div className="ras-create-describe-divider" aria-hidden="true" />

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Button
            tone="primary"
            size="lg"
            fullWidth
            className="ras-create-ai-button min-h-14 rounded-xl"
            disabled={isGeneratingDescription}
            loading={isGeneratingSeed}
            leadingIcon={isGeneratingSeed ? undefined : <Sparkles size={18} aria-hidden="true" />}
            onClick={onRunSeedGeneration}
          >
            {isGeneratingSeed ? t('create.aiButton.generating') : t('create.aiButton.label')}
          </Button>
          <p className="m-0 text-center text-xs text-[var(--nimi-text-muted)]">{t('create.aiButton.helper')}</p>
        </div>
        <Button
          tone="secondary"
          size="lg"
          fullWidth
          className="ras-create-manual-button min-h-14 rounded-xl"
          leadingIcon={<Pencil size={18} aria-hidden="true" />}
          onClick={onSkipSeed}
        >
          {t('create.manualButton.label')}
        </Button>
      </div>
      </div>
    </Surface>
  );
}
