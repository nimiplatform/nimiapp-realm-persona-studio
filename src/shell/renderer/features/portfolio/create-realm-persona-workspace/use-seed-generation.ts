import { useEffect, useRef, useState } from 'react';
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
  draftKey,
  draft,
  normalizedDraft,
  locale,
  actions,
}: {
  draftKey: string;
  draft: CreateRealmPersonaDraftInput;
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  locale: StudioLocale;
  actions: SeedActions;
}): { isGeneratingSeed: boolean; runSeedGeneration: () => Promise<void> } {
  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const scope = useRef({ key: draftKey, mounted: true });
  // Returning to the same key starts a new editing scope; old requests stay stale.
  if (scope.current.key !== draftKey) scope.current = { key: draftKey, mounted: true };
  useEffect(() => { scope.current.mounted = true; return () => { scope.current.mounted = false; }; }, []);
  useEffect(() => { setIsGeneratingSeed(false); }, [draftKey]);

  async function runSeedGeneration() {
    if (isGeneratingSeed) return;
    const requestScope = scope.current;
    const seedDescription = normalizeCreateRealmPersonaDraft(draft).originalDescription;
    setIsGeneratingSeed(true);
    actions.prepareSeedRun();
    const supplements: PersonaSeedPromptSupplements = {
      speechSupplement: normalizedDraft.speechSupplement,
      boundarySupplement: normalizedDraft.boundarySupplement,
      visualSupplement: normalizedDraft.visualSupplement,
      ownerWriting: {
        ...Object.fromEntries((['displayName', 'concept', 'description', 'greeting', 'ruleText', 'personaArchetype'] as const)
          .filter((key) => normalizedDraft[key].trim()).map((key) => [key, normalizedDraft[key]])),
        ...(normalizedDraft.personaTraits.length ? { personaTraits: normalizedDraft.personaTraits } : {}),
      },
    };
    try {
      const result = await generatePersonaSeedFromDescription(seedDescription, undefined, supplements, { locale });
      if (!scope.current.mounted || scope.current !== requestScope) return;
      if (result.ok) {
        actions.setStageReviewViaSeed(result, seedDescription);
      } else {
        actions.setSeedResult(result);
        logCreateFlowFailure('create-flow.seed-generation', result.cause);

      }
    } finally {
      if (scope.current.mounted && scope.current === requestScope) setIsGeneratingSeed(false);
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
  draftKey,
  normalizedDraft,
  locale,
  t,
  isGeneratingSeed,
  updateDraft,
}: {
  draftKey: string;
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  locale: StudioLocale;
  t: StudioTranslator;
  isGeneratingSeed: boolean;
  updateDraft: (patch: { originalDescription: string }) => void;
}): { isGeneratingDescription: boolean; runDescriptionReroll: () => Promise<void> } {
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const scope = useRef({ key: draftKey, mounted: true });
  // Returning to the same key starts a new editing scope; old requests stay stale.
  if (scope.current.key !== draftKey) scope.current = { key: draftKey, mounted: true };
  useEffect(() => { scope.current.mounted = true; return () => { scope.current.mounted = false; }; }, []);
  useEffect(() => { setIsGeneratingDescription(false); }, [draftKey]);

  async function runDescriptionReroll() {
    if (isGeneratingDescription || isGeneratingSeed) return;
    const requestScope = scope.current;
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
      if (!scope.current.mounted || scope.current !== requestScope) return;
      if (result.ok) {
        updateDraft({ originalDescription: result.description });
      } else {
        logCreateFlowFailure('create-flow.description-reroll', result.cause);
        if (result.cause.kind === 'runtime-route-unbound') {
          nimiToast.info(translateCreateFlowFailure(result.cause, t));
        } else {
          nimiToast.danger(t('create.descriptionGenerationFailed', { message: translateCreateFlowFailure(result.cause, t) }));
        }
      }
    } finally {
      if (scope.current.mounted && scope.current === requestScope) setIsGeneratingDescription(false);
    }
  }

  return { isGeneratingDescription, runDescriptionReroll };
}
