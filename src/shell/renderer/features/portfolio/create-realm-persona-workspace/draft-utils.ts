import {
  normalizeCreateRealmPersonaDraft,
  type CreateRealmPersonaDraftInput,
  type SelectableRealmWorld,
} from '../create-persona-draft.js';
import { isCreationDraftKey } from '../creation-draft-store.js';
import type { CreateValidationField } from './types.js';

export function createEmptyDraft(): CreateRealmPersonaDraftInput {
  return {
    handle: '',
    displayName: '',
    concept: '',
    description: '',
    greeting: '',
    ruleText: '',
    selectedWorldId: '',
    visibility: 'private',
    personaArchetype: '',
    personaTraits: [],
    referenceImageUrl: '',
    referenceImagePrompt: '',
    originalDescription: '',
    speechSupplement: '',
    boundarySupplement: '',
    visualSupplement: '',
    referenceImageCandidates: [],
  };
}

export function isRealmReferenceImageUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function selectedDraftKey(search: string): string | null {
  const value = new URLSearchParams(search).get('draft');
  return isCreationDraftKey(value) ? value.trim() : null;
}

export function worldOptionLabel(world: SelectableRealmWorld): string {
  return world.name;
}

export function countCompletedCreationDraftFields(input: CreateRealmPersonaDraftInput): number {
  const draft = normalizeCreateRealmPersonaDraft(input);
  const scalarFields = [
    draft.originalDescription,
    draft.handle,
    draft.displayName,
    draft.concept,
    draft.description,
    draft.ruleText,
    draft.selectedWorldId,
    draft.visibility,
    draft.personaArchetype,
    draft.speechSupplement,
    draft.boundarySupplement,
    draft.visualSupplement,
    draft.referenceImagePrompt,
    draft.referenceImageUrl,
  ];
  return scalarFields.filter(Boolean).length
    + (draft.personaTraits.length > 0 ? 1 : 0)
    + (draft.referenceImageCandidates.length > 0 ? 1 : 0);
}

export function ownerPromptFromDraft(input: CreateRealmPersonaDraftInput): string {
  const draft = normalizeCreateRealmPersonaDraft(input);
  return [
    draft.originalDescription,
    draft.speechSupplement ? `Speaking style supplement:\n${draft.speechSupplement}` : '',
    draft.boundarySupplement ? `Behavior boundary supplement:\n${draft.boundarySupplement}` : '',
    draft.visualSupplement ? `Visual character supplement:\n${draft.visualSupplement}` : '',
  ].filter(Boolean).join('\n\n');
}

export function focusCreateField(field: CreateValidationField) {
  window.requestAnimationFrame(() => {
    const fieldRoot = document.querySelector<HTMLElement>(`[data-create-field="${field}"]`);
    if (!fieldRoot) return;
    const control = fieldRoot.matches('[data-create-field-control]')
      ? fieldRoot
      : fieldRoot.querySelector<HTMLElement>('[data-create-field-control], input, textarea, button');
    fieldRoot.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    control?.focus({ preventScroll: true });
  });
}
