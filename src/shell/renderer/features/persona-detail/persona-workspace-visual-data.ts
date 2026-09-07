export type PersonaWorkspaceCandidateKind = 'avatar' | 'cover' | 'voice';

export type PersonaWorkspaceCandidate = {
  id: string;
  kind: PersonaWorkspaceCandidateKind;
  label: string;
  status: 'candidate-only' | 'owner-reviewed';
  imageUrl?: string;
  selected?: boolean;
  fileName?: string;
  mimeType?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  previewUrl?: string;
  sourceKind?: 'generated' | 'imported';
  selectedAt?: string;
  voiceStyle?: string;
};

export type PersonaWorkspaceQueueItem = {
  id: string;
  title: string;
  state: 'needs-review' | 'local-draft' | 'local-schedule';
  editedLabel: string;
  body?: string;
  tagsText?: string;
  categoryLabel?: string;
  /** Stable id of the persisted local draft behind this item, when one exists. */
  draftId?: string;
  attachmentCount?: number;
};

export type PersonaWorkspaceVisualData = {
  developmentFixture: true;
  traits: string[];
  candidates: PersonaWorkspaceCandidate[];
  initialPostCaption: string;
  initialPostTags: string;
  postQueue: PersonaWorkspaceQueueItem[];
};
