import { useEffect, useRef } from 'react';
import type {
  CreateRealmPersonaDraftInput,
  NormalizedCreateRealmPersonaDraft,
} from '../create-persona-draft.js';
import {
  CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS,
  dispatchCreationDraftHistoryUpdated,
  persistCreationDraft,
  type CreationDraftPersistResult,
} from '../creation-draft-store.js';
import { upsertCreationDraftHistoryEntry } from '../creation-draft-history.js';
import { logCreateFlowFailure, translateCreateFlowFailure } from './create-flow-copy.js';
import type { AutosaveState, DraftLoadState, StudioTranslator } from './types.js';

type UseAutosaveDraftParams = {
  draftKey: string;
  draft: CreateRealmPersonaDraftInput;
  /** P0 dirty guard: a pristine, freshly loaded draft is never written back. */
  edited: boolean;
  draftLoadState: DraftLoadState;
  draftHistoryLabel: string;
  selectedWorldName: string | undefined;
  normalizedDraft: NormalizedCreateRealmPersonaDraft;
  t: StudioTranslator;
  setAutosave: (state: AutosaveState, failureMessage: string | null) => void;
};

/**
 * Debounced creation-draft autosave on protected JSON storage. Writes run
 * through a serialized promise queue; an ordering guard keeps stale write
 * outcomes from overwriting newer indicator state. Pristine drafts (loaded,
 * never edited) are never written and the indicator stays settled.
 */
export function useAutosaveDraft({
  draftKey,
  draft,
  edited,
  draftLoadState,
  draftHistoryLabel,
  selectedWorldName,
  normalizedDraft,
  t,
  setAutosave,
}: UseAutosaveDraftParams): void {
  const autosaveSequence = useRef(0);
  const autosaveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (draftLoadState !== 'ready') return undefined;
    if (!edited) return undefined;
    const sequence = autosaveSequence.current + 1;
    autosaveSequence.current = sequence;
    setAutosave('saving', null);
    const timeout = window.setTimeout(() => {
      autosaveQueue.current = autosaveQueue.current.catch(() => undefined).then(async () => {
        const result: CreationDraftPersistResult = await persistCreationDraft(draftKey, draft);
        if (!result.ok) {
          if (autosaveSequence.current === sequence) {
            logCreateFlowFailure('create-flow.autosave', result.failure);
            setAutosave('failed', translateCreateFlowFailure(result.failure, t));
          }
          return;
        }
        if (draftHistoryLabel) {
          const historyResult = await upsertCreationDraftHistoryEntry({
            draftKey,
            displayName: draftHistoryLabel,
            ...(selectedWorldName ? { worldName: selectedWorldName } : {}),
            ...(normalizedDraft.personaArchetype ? { archetype: normalizedDraft.personaArchetype } : {}),
            updatedAt: result.record.updatedAt,
          });
          if (!historyResult.ok) {
            if (autosaveSequence.current === sequence) {
              logCreateFlowFailure('create-flow.autosave', historyResult.failure);
              setAutosave('failed', translateCreateFlowFailure(historyResult.failure, t));
            }
            return;
          }
          dispatchCreationDraftHistoryUpdated();
        }
        if (autosaveSequence.current === sequence) {
          setAutosave('saved', null);
        }
      });
    }, CREATION_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [draft, draftHistoryLabel, draftKey, draftLoadState, edited, normalizedDraft, selectedWorldName, setAutosave, t]);
}
