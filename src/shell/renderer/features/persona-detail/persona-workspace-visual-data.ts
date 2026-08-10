export type PersonaWorkspaceCandidateKind = 'avatar' | 'cover' | 'voice';

export type PersonaWorkspaceCandidate = {
  id: string;
  kind: PersonaWorkspaceCandidateKind;
  label: string;
  status: 'candidate-only' | 'owner-reviewed';
  imageUrl?: string;
  fileLabel?: string;
};

export type PersonaWorkspaceQueueItem = {
  id: string;
  title: string;
  state: 'needs-review' | 'local-draft' | 'local-schedule';
  editedLabel: string;
};

export type PersonaWorkspaceVisualData = {
  developmentFixture: boolean;
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
