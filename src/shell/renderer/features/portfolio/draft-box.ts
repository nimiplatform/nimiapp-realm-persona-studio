import type { CreativeAssetHistoryRecord } from './creative-asset-history.js';
import { isLocalPostScheduleDue, type LocalPostScheduleRecord } from './local-post-schedule-store.js';

export type DraftBoxEntryKind =
  | 'identity-image'
  | 'avatar-package'
  | 'identity-upload'
  | 'voice-demo'
  | 'scheduled-post';

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
    actionPath: destinationForHistory(record) === 'voice'
      ? `/portfolio/${input.personaId}/assets/voice`
      : `/portfolio/${input.personaId}/assets`,
  }));

  const scheduleEntry = input.localSchedule
    ? [{
      id: `schedule:${input.localSchedule.localKey}`,
      kind: 'scheduled-post' as const,
      destination: 'schedule' as const,
      status: isLocalPostScheduleDue(input.localSchedule, input.now) ? 'ready-when-due' as const : 'saved-locally' as const,
      truthBoundary: 'local-only' as const,
      title: 'Scheduled post draft',
      detail: input.localSchedule.candidate.postCandidate.realmCreatePost.caption || 'Reviewed scheduled post',
      source: input.localSchedule.source,
      createdAt: input.localSchedule.savedAt,
      actionPath: `/portfolio/${input.personaId}/posts/schedule`,
    }]
    : [];

  return [...scheduleEntry, ...assetEntries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
