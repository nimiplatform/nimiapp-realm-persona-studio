import { useState } from 'react';
import { nimiToast } from '@nimiplatform/kit/ui';
import {
  normalizeCreateRealmPersonaDraft,
  type CreateRealmPersonaDraftInput,
  type NormalizedCreateRealmPersonaDraft,
} from '../create-persona-draft.js';
import {
  generatePersonaSeedFromDescription,
  type PersonaSeedGenerationResult,
  type PersonaSeedPromptSupplements,
} from '../persona-seed-generator.js';
import { generatePersonaDescriptionCandidate } from '../persona-description-generator.js';
import type { StudioLocale } from '../../../i18n/studio-i18n.js';
import { logCreateFlowFailure, translateCreateFlowFailure } from './create-flow-copy.js';
import type { StudioTranslator } from './types.js';

type SeedActions = {
  prepareSeedRun: () => void;
  setStageReviewViaSeed: (
    result: Extract<PersonaSeedGenerationResult, { ok: true }>,
    seedDescription: string,
  ) => void;
  setSeedResult: (result: PersonaSeedGenerationResult | null) => void;
};

// @nimi-authority: rule.realm-persona-studio.create-flow.r012
// @nimi-authority: rule.realm-persona-studio.create-flow.r013
/**
 * AI seed draft fill. Candidate output only completes fields the owner left
 * empty; owner-written description and supplements always win (r013). The
 * merged draft stays an owner-editable local candidate (r012).
 */
export function useSeedGeneration({
  draft,
  normalizedDraft,
  locale,
  t,
  actions,
}: {
  draft: CreateRealmPersonaDraftInput;
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  locale: StudioLocale;
  t: StudioTranslator;
  actions: SeedActions;
}): { isGeneratingSeed: boolean; runSeedGeneration: () => Promise<void> } {
  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);

  async function runSeedGeneration() {
    const seedDescription = normalizeCreateRealmPersonaDraft(draft).originalDescription;
    setIsGeneratingSeed(true);
    actions.prepareSeedRun();
    const supplements: PersonaSeedPromptSupplements = {
      speechSupplement: normalizedDraft.speechSupplement,
      boundarySupplement: normalizedDraft.boundarySupplement,
      visualSupplement: normalizedDraft.visualSupplement,
    };
    try {
      const result = await generatePersonaSeedFromDescription(seedDescription, undefined, supplements, { locale });
      if (result.ok) {
        actions.setStageReviewViaSeed(result, seedDescription);
      } else {
        actions.setSeedResult(result);
        logCreateFlowFailure('create-flow.seed-generation', result.cause);
        nimiToast.danger(t('create.seedGenerationFailed', { message: translateCreateFlowFailure(result.cause, t) }));
      }
    } finally {
      setIsGeneratingSeed(false);
    }
  }

  return { isGeneratingSeed, runSeedGeneration };
}

// @nimi-authority: rule.realm-persona-studio.create-flow.r015
/**
 * Description reroll ("gacha"). The candidate only rewrites the owner-editable
 * describe input; a failure preserves the owner's current text (r015).
 */
export function useDescriptionReroll({
  normalizedDraft,
  locale,
  t,
  isGeneratingSeed,
  updateDraft,
}: {
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  locale: StudioLocale;
  t: StudioTranslator;
  isGeneratingSeed: boolean;
  updateDraft: (patch: { originalDescription: string }) => void;
}): { isGeneratingDescription: boolean; runDescriptionReroll: () => Promise<void> } {
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  async function runDescriptionReroll() {
    if (isGeneratingDescription || isGeneratingSeed) return;
    setIsGeneratingDescription(true);
    try {
      const result = await generatePersonaDescriptionCandidate({
        previousDescription: normalizedDraft.originalDescription,
        supplements: {
          speechSupplement: normalizedDraft.speechSupplement,
          boundarySupplement: normalizedDraft.boundarySupplement,
          visualSupplement: normalizedDraft.visualSupplement,
        },
        locale,
      });
      if (result.ok) {
        updateDraft({ originalDescription: result.description });
      } else {
        logCreateFlowFailure('create-flow.description-reroll', result.cause);
        nimiToast.danger(t('create.descriptionGenerationFailed', { message: translateCreateFlowFailure(result.cause, t) }));
      }
    } finally {
      setIsGeneratingDescription(false);
    }
  }

  return { isGeneratingDescription, runDescriptionReroll };
}
