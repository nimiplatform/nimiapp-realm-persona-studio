import { useStudioScope } from '@renderer/app-shell/studio-scope.js';
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
  flushDraft,
}: {
  draftKey: string;
  draft: CreateRealmPersonaDraftInput;
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  locale: StudioLocale;
  actions: SeedActions;
  flushDraft: () => Promise<boolean>;
}): { isGeneratingSeed: boolean; runSeedGeneration: () => Promise<void> } {
  const appScope = useStudioScope();
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
      // Preserve the owner's input before a long model call can outlive this connection.
      if (!await flushDraft() || appScope.signal.aborted || !scope.current.mounted || scope.current !== requestScope) return;
      actions.prepareSeedRun();
      const result = await generatePersonaSeedFromDescription(appScope, seedDescription, undefined, supplements, { locale });
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
  flushDraft,
}: {
  draftKey: string;
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  locale: StudioLocale;
  t: StudioTranslator;
  isGeneratingSeed: boolean;
  updateDraft: (patch: { originalDescription: string }) => void;
  flushDraft: () => Promise<boolean>;
}): { isGeneratingDescription: boolean; runDescriptionReroll: () => Promise<void> } {
  const appScope = useStudioScope();
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
      if (!await flushDraft() || appScope.signal.aborted || !scope.current.mounted || scope.current !== requestScope) return;
      const result = await generatePersonaDescriptionCandidate(appScope, {
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
