import type { LocalPostDraftRecord } from './local-post-draft-store.js';
import type { CreativeAssetHistoryRecord } from './creative-asset-history.js';
import { isLocalPostScheduleDue, type LocalPostScheduleRecord } from './local-post-schedule-store.js';

export type DraftBoxEntryKind =
  | 'identity-image'
  | 'avatar-package'
  | 'identity-upload'
  | 'voice-demo'
  | 'scheduled-post'
  | 'post-draft';

export type DraftBoxEntryDestination = 'identity' | 'voice' | 'content' | 'schedule';

export type DraftBoxEntryStatus = 'needs-review' | 'saved-locally' | 'ready-when-due';

export type DraftBoxTruthBoundary = 'local-only' | 'candidate-only';

export type DraftBoxEntry = {
  id: string;
  kind: DraftBoxEntryKind;
  destination: DraftBoxEntryDestination;
  status: DraftBoxEntryStatus;
  truthBoundary: DraftBoxTruthBoundary;
  title: string;
  detail: string;
  source: string;
  createdAt: string;
  actionPath: string;
};

function entryKindForHistory(record: CreativeAssetHistoryRecord): DraftBoxEntryKind {
  if (record.kind === 'avatar-package-candidate') return 'avatar-package';
  if (record.kind === 'identity-resource-upload') return 'identity-upload';
  if (record.kind === 'voice-demo-candidate') return 'voice-demo';
  return 'identity-image';
}

function destinationForHistory(record: CreativeAssetHistoryRecord): DraftBoxEntryDestination {
  return record.kind === 'voice-demo-candidate' ? 'voice' : 'identity';
}

export function buildDraftBoxEntries(input: {
  personaId: string;
  creativeHistory: readonly CreativeAssetHistoryRecord[];
  postDrafts: readonly LocalPostDraftRecord[];
  localSchedule: LocalPostScheduleRecord | null;
  now?: Date;
}): DraftBoxEntry[] {
  const assetEntries = input.creativeHistory.map((record): DraftBoxEntry => ({
    id: `creative:${record.id}`,
    kind: entryKindForHistory(record),
    destination: destinationForHistory(record),
    status: 'needs-review',
    truthBoundary: 'candidate-only',
    title: record.label,
    detail: record.detail,
    source: record.source,
    createdAt: record.createdAt,
    actionPath: `/portfolio/${input.personaId}/identity`,
  }));

  const postEntries = input.postDrafts.filter((record) => record.personaId === input.personaId)
    .map((record): DraftBoxEntry => ({
      id: `post:${record.id}`,
      kind: 'post-draft',
      destination: 'content',
      status: 'saved-locally',
      truthBoundary: 'local-only',
      title: record.caption.split('\n')[0]?.slice(0, 56) || record.caption,
      detail: record.caption,
      source: record.source,
      createdAt: record.updatedAt,
      actionPath: `/portfolio/${input.personaId}/posts?draft=${encodeURIComponent(record.id)}`,
    }));

  const scheduleEntry = input.localSchedule
    ? [{
      id: `schedule:${input.localSchedule.localKey}`,
      kind: 'scheduled-post' as const,
      destination: 'schedule' as const,
      status: isLocalPostScheduleDue(input.localSchedule, input.now) ? 'ready-when-due' as const : 'saved-locally' as const,
      truthBoundary: 'local-only' as const,
      title: 'draftBox.scheduledPostTitle',
      detail: input.localSchedule.candidate.postCandidate.realmCreatePost.caption || '',
      source: input.localSchedule.source,
      createdAt: input.localSchedule.savedAt,
      actionPath: `/portfolio/${input.personaId}/posts`,
    }]
    : [];

  return [...scheduleEntry, ...postEntries, ...assetEntries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
