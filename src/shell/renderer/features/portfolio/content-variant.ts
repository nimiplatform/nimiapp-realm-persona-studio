import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import type { LocalPostDraftInput } from './post-draft.js';

export type ContentVariant = {
  key: 'announcement' | 'process-note' | 'conversation-starter';
  title: string;
  caption: string;
  tagsText: string;
  imagePrompt: string;
  attachmentPlan: 'none' | 'optional-ready-resource';
  reviewChecklist: string[];
  candidate: true;
  publicTruth: false;
};

export type ContentVariantBuildResult =
  | {
    changed: true;
    errors: [];
    source: 'realm-persona-studio.content-variant-board';
    variants: ContentVariant[];
  }
  | {
    changed: false;
    errors: string[];
    source: 'realm-persona-studio.content-variant-board';
    variants: [];
  };

function value(text: string | undefined): string {
  return (text || '').trim();
}

function fieldValue(field: { status: string; value: string }): string {
  return field.status === 'available' && field.value.trim() ? field.value.trim() : '';
}

function tagSlug(valueToSlug: string): string {
  return valueToSlug
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function tags(...items: string[]): string {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const normalized = tagSlug(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.join(', ');
}

export function buildContentVariantsFromPersona(
  persona: OwnerPortfolioPersonaDetail,
  draft: LocalPostDraftInput,
  ownerIntent: string,
): ContentVariantBuildResult {
  const displayName = fieldValue(persona.displayName);
  const handle = fieldValue(persona.handle);
  const bio = fieldValue(persona.bio);
  const greeting = fieldValue(persona.greeting);
  const intent = value(ownerIntent);
  const existingCaption = value(draft.caption);
  const anchor = intent || existingCaption || bio || greeting;
  const errors: string[] = [];
  if (!displayName && !handle) errors.push('persona identity source unavailable or empty');
  if (!anchor) errors.push('owner intent, draft caption, profile description, or greeting required');
  if (errors.length > 0) {
    return {
      changed: false,
      errors,
      source: 'realm-persona-studio.content-variant-board',
      variants: [],
    };
  }

  const name = displayName || `@${handle}`;
  const voice = greeting || bio;
  const core = intent || existingCaption || bio || greeting;
  const baseTagInputs = [handle, name, 'realm-persona', 'studio'];

  return {
    changed: true,
    errors: [],
    source: 'realm-persona-studio.content-variant-board',
    variants: [
      {
        key: 'announcement',
        title: 'Announcement',
        caption: `${name}: ${core}`,
        tagsText: tags(...baseTagInputs, 'update'),
        imagePrompt: `${name} announcement visual. Source voice: ${voice}. No embedded text.`,
        attachmentPlan: 'optional-ready-resource',
        reviewChecklist: ['caption reviewed', 'tags reviewed', 'optional READY Resource selected before publish'],
        candidate: true,
        publicTruth: false,
      },
      {
        key: 'process-note',
        title: 'Process Note',
        caption: `${name} shares a process note: ${core}`,
        tagsText: tags(...baseTagInputs, 'process'),
        imagePrompt: `${name} process note image style. Show workspace context and evidence review. No embedded text.`,
        attachmentPlan: 'optional-ready-resource',
        reviewChecklist: ['source-backed voice checked', 'no private state included', 'human review required'],
        candidate: true,
        publicTruth: false,
      },
      {
        key: 'conversation-starter',
        title: 'Conversation Starter',
        caption: `${name} asks: ${core}`,
        tagsText: tags(...baseTagInputs, 'question'),
        imagePrompt: `${name} conversation starter visual. Clear focal subject, social feed crop, no embedded text.`,
        attachmentPlan: 'none',
        reviewChecklist: ['question tone reviewed', 'tags reviewed', 'publish result must return Realm post id'],
        candidate: true,
        publicTruth: false,
      },
    ],
  };
}
