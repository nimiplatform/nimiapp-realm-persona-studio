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
};

export type PersonaWorkspaceVisualData = {
  developmentFixture: true;
  traits: string[];
  candidates: PersonaWorkspaceCandidate[];
  recentDraft: {
    title: string;
    savedLabel: string;
    imageUrl?: string;
  } | null;
  localPlan: {
    title: string;
    runLabel: string;
  } | null;
  initialPostCaption: string;
  initialPostTags: string;
  postQueue: PersonaWorkspaceQueueItem[];
};
