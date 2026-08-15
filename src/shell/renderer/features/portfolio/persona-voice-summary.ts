import type { PersonaWorkspaceVisualData } from '@renderer/features/persona-detail/persona-workspace-visual-data.js';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';

export type PersonaVoiceSummary =
  | {
    kind: 'development-selected';
    candidateId: string;
    fileName: string;
    mimeType: string | null;
    durationSeconds: number | null;
    fileSizeBytes: number | null;
    previewUrl: string | null;
    sourceKind: 'generated' | 'imported';
    selectedAt: string | null;
    voiceStyle: string | null;
  }
  | {
    kind: 'source-configured';
    voiceId: string;
    voiceStyle: string | null;
  }
  | {
    kind: 'not-configured';
  };

function normalizedText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizedPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizedPreviewUrl(value: unknown): string | null {
  const text = normalizedText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return ['http:', 'https:', 'data:', 'blob:'].includes(url.protocol) ? text : null;
  } catch {
    return null;
  }
}

/**
 * Development fixtures may drive the review UI, but never become Realm source
 * truth. Production callers omit developmentVisualData and stay fail-closed.
 */
export function resolvePersonaVoiceSummary(
  persona: OwnerPortfolioPersonaDetail,
  developmentVisualData?: PersonaWorkspaceVisualData,
): PersonaVoiceSummary {
  const selectedDevelopmentCandidate = developmentVisualData?.developmentFixture === true
    ? developmentVisualData.candidates.find((candidate) => candidate.kind === 'voice' && candidate.selected === true)
    : undefined;
  const fileName = normalizedText(selectedDevelopmentCandidate?.fileName);

  if (selectedDevelopmentCandidate && fileName) {
    return {
      kind: 'development-selected',
      candidateId: selectedDevelopmentCandidate.id,
      fileName,
      mimeType: normalizedText(selectedDevelopmentCandidate.mimeType),
      durationSeconds: normalizedPositiveNumber(selectedDevelopmentCandidate.durationSeconds),
      fileSizeBytes: normalizedPositiveNumber(selectedDevelopmentCandidate.fileSizeBytes),
      previewUrl: normalizedPreviewUrl(selectedDevelopmentCandidate.previewUrl),
      sourceKind: selectedDevelopmentCandidate.sourceKind === 'generated' ? 'generated' : 'imported',
      selectedAt: normalizedText(selectedDevelopmentCandidate.selectedAt),
      voiceStyle: normalizedText(selectedDevelopmentCandidate.voiceStyle),
    };
  }

  const voiceId = normalizedText(persona.voice?.voiceId);
  if (voiceId) {
    return {
      kind: 'source-configured',
      voiceId,
      voiceStyle: normalizedText(persona.voice?.description),
    };
  }

  return { kind: 'not-configured' };
}

export function formatVoiceDuration(durationSeconds: number | null): string | null {
  if (!durationSeconds) return null;
  const totalSeconds = Math.max(1, Math.round(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatVoiceFileSize(fileSizeBytes: number | null): string | null {
  if (!fileSizeBytes) return null;
  if (fileSizeBytes < 1024) return `${Math.round(fileSizeBytes)} B`;
  if (fileSizeBytes < 1024 * 1024) return `${(fileSizeBytes / 1024).toFixed(1)} KB`;
  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatVoiceMimeType(mimeType: string | null): string | null {
  if (!mimeType) return null;
  const labels: Record<string, string> = {
    'audio/aac': 'AAC',
    'audio/flac': 'FLAC',
    'audio/m4a': 'M4A',
    'audio/mpeg': 'MP3',
    'audio/ogg': 'OGG',
    'audio/wav': 'WAV',
    'audio/x-wav': 'WAV',
  };
  return labels[mimeType.toLowerCase()] ?? mimeType.replace(/^audio\//i, '').toUpperCase();
}
