import { useId, useState } from 'react';
import {
  Button,
  FieldShell,
  InlineAlert,
  TextareaField,
} from '@nimiplatform/kit/ui';
import { ArrowRight, BookOpen, Compass, Radio, Check, ChevronDown, Dices, MessageCircle, Pencil, ScanFace, Shield, Sparkles } from 'lucide-react';
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
  const id = useId();
  const busy = isGeneratingSeed || isGeneratingDescription;
  const [expandedSupplements, setExpandedSupplements] = useState<Record<SupplementKey, boolean>>({
    speechSupplement: Boolean(normalizedDraft.speechSupplement),
    boundarySupplement: Boolean(normalizedDraft.boundarySupplement),
    visualSupplement: Boolean(normalizedDraft.visualSupplement),
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

  const supplementIcons = { speechSupplement: MessageCircle, boundarySupplement: Shield, visualSupplement: ScanFace };

  return (
    <section className="ras-create-studio" aria-labelledby={`${id}-heading`}>
      <div className="ras-create-studio__intro">
        <span className="ras-workshop-eyebrow">{t('workshop.eyebrow')}</span>
        <h2 id={`${id}-heading`}>{t('workshop.idea.title')}</h2>
        <p>{t('workshop.idea.description')}</p>
      </div>

      <ol className="ras-creation-journey" aria-label={t('create.title')}>
        {(['step1', 'step2', 'step3'] as const).map((step, index) => <li key={step} aria-current={index === 0 ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{t(`workshop.idea.${step}`)}</li>)}
      </ol>
      {!originalDescription.trim() && !busy ? <div className="ras-idea-starters">
        <p>{t('workshop.idea.inspiration')}</p>
        <div>{([{ key: 'bookshop', Icon: BookOpen }, { key: 'explorer', Icon: Compass }, { key: 'radio', Icon: Radio }] as const).map(({ key, Icon }) => (
          <button type="button" key={key} onClick={() => updateDraft({ originalDescription: t(`workshop.idea.starter.${key}Text`) })}>
            <Icon size={19} strokeWidth={1.6} aria-hidden="true" /><span>{t(`workshop.idea.starter.${key}`)}</span><ArrowRight size={15} aria-hidden="true" />
          </button>
        ))}</div>
      </div> : null}
      <div className="ras-create-describe-card">
        {isGeneratingSeed ? <div className="ras-creation-progress" role="status"><Sparkles size={18} aria-hidden="true" /><div><strong>{t('workshop.idea.busy')}</strong><p>{t('workshop.idea.busyHint')}</p></div></div> : null}
        <div className="ras-create-describe-card__body">
          <div className="ras-create-composer">
            <div className="ras-create-describe-field-label">
              <label htmlFor={`${id}-description`}>{t('create.oneLineLabel')}</label>
              <Button
                tone="ghost"
                size="sm"
                disabled={isGeneratingSeed}
                loading={isGeneratingDescription}
                leadingIcon={isGeneratingDescription ? undefined : <Dices size={14} aria-hidden="true" />}
                onClick={onRunDescriptionReroll}
              >
                {isGeneratingDescription ? t('create.descriptionReroll.generating') : t('create.descriptionReroll.label')}
              </Button>
            </div>
            <TextareaField
              id={`${id}-description`}
              rows={5}
              tone="quiet"
              className="ras-create-describe-textarea"
              value={originalDescription}
              readOnly={busy}
              placeholder={t('create.oneLinePlaceholder')}
              onChange={(event) => updateDraft({ originalDescription: event.currentTarget.value })}
            />
          </div>

          <aside className="ras-create-directions" aria-labelledby={`${id}-details`}>
            <div className="ras-create-directions__heading">
              <h3 id={`${id}-details`}>{t('create.supplement.hint')}</h3>
              <span>{t('create.studio.optional')}</span>
            </div>
            <p className="ras-create-directions__intro">{t('create.studio.detailsHint')}</p>
            <div className="ras-create-directions__list">
              {supplementButtons.map(({ key, labelKey }) => {
                const Icon = supplementIcons[key];
                const expanded = expandedSupplements[key];
                return (
                  <div key={key} className="ras-create-direction" data-expanded={expanded}>
                    <button
                      type="button"
                      className="ras-create-direction__toggle"
                      aria-expanded={expanded}
                      aria-controls={`${id}-${key}`}
                      onClick={() => setExpandedSupplements((current) => ({ ...current, [key]: !current[key] }))}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{t(labelKey)}</span>
                      {normalizedDraft[key].trim() ? <Check size={14} className="ras-create-direction__check" aria-hidden="true" /> : null}
                      <ChevronDown size={15} className="ras-create-direction__chevron" aria-hidden="true" />
                    </button>
                    <div id={`${id}-${key}`} hidden={!expanded} className="ras-create-direction__field">
                      <FieldShell label={t(supplementLabels[key].labelKey)}>
                        <TextareaField
                          id={`${id}-${key}-input`}
                          rows={3}
                          readOnly={busy}
                          value={normalizedDraft[key]}
                          placeholder={t(supplementLabels[key].placeholderKey)}
                          onChange={(event) => updateDraft({ [key]: event.currentTarget.value })}
                        />
                      </FieldShell>
                    </div>
                    {!expanded && normalizedDraft[key].trim() ? <p className="ras-create-direction__hint">{normalizedDraft[key]}</p> : null}
                  </div>
                );
              })}
            </div>
            <div className="ras-create-directions__next">
              <ArrowRight size={16} aria-hidden="true" />
              <p>{t('create.studio.nextHint')}</p>
            </div>
          </aside>
        </div>

        {seedResult && !seedResult.ok ? (
          <div className="ras-create-studio__failure" role="status">
            <InlineAlert tone={seedResult.cause.kind === 'runtime-route-unbound' ? 'info' : 'danger'}>
              {seedResult.cause.kind === 'runtime-route-unbound'
                ? translateCreateFlowFailure(seedResult.cause, t)
                : t('create.seedGenerationFailed', { message: translateCreateFlowFailure(seedResult.cause, t) })}
            </InlineAlert>
          </div>
        ) : null}

        <div className="ras-create-describe-divider" aria-hidden="true" />
        <footer className="ras-create-describe-actions">
          <p className="ras-create-describe-actions__helper">{t('create.aiButton.helper')}</p>
          <div className="ras-create-describe-actions__buttons">
            <Button
              tone="ghost"
              size="md"
              className="ras-create-manual-button"
              disabled={busy}
              leadingIcon={<Pencil size={18} aria-hidden="true" />}
              onClick={onSkipSeed}
            >
              {t('create.manualButton.label')}
            </Button>
            <Button
              tone="primary"
              size="lg"
              className="ras-create-ai-button"
              disabled={isGeneratingDescription}
              loading={isGeneratingSeed}
              leadingIcon={isGeneratingSeed ? undefined : <Sparkles size={18} aria-hidden="true" />}
              onClick={onRunSeedGeneration}
            >
              {isGeneratingSeed ? t('create.aiButton.generating') : t('create.aiButton.label')}
            </Button>
          </div>
        </footer>
      </div>
    </section>
  );
}
