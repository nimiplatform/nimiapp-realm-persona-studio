import { describe, expect, it } from 'vitest';
import {
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA,
  PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS,
} from '@renderer/features/persona-detail/persona-workspace.visual-fixture.js';
import {
  formatVoiceDuration,
  formatVoiceFileSize,
  formatVoiceMimeType,
  resolvePersonaVoiceSummary,
} from './persona-voice-summary.js';

describe('persona voice summary', () => {
  it('renders an explicitly selected development voice candidate without claiming Realm source truth', () => {
    const persona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS['visual-nanxing'];
    const visualData = PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA['visual-nanxing'];
    expect(persona).toBeDefined();
    expect(visualData).toBeDefined();

    expect(resolvePersonaVoiceSummary(persona!, visualData)).toMatchObject({
      kind: 'development-selected',
      fileName: 'nanxing_voice_v1.wav',
      mimeType: 'audio/wav',
      durationSeconds: 1,
      fileSizeBytes: 8044,
      sourceKind: 'imported',
      voiceStyle: '清醒、笃定、温暖',
    });
  });

  it('uses source-backed voice configuration only when no development selection is injected', () => {
    const persona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS['visual-nanxing'];
    expect(persona).toBeDefined();

    expect(resolvePersonaVoiceSummary(persona!)).toEqual({
      kind: 'source-configured',
      voiceId: 'nanxing-voice-v1',
      voiceStyle: '清醒、笃定、温暖',
    });
  });

  it('fails closed when neither source voice nor a development selection exists', () => {
    const persona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS['visual-chenwu'];
    const visualData = PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA['visual-chenwu'];
    expect(persona).toBeDefined();
    expect(visualData).toBeDefined();

    expect(resolvePersonaVoiceSummary(persona!, visualData)).toEqual({ kind: 'not-configured' });
  });

  it('formats only real candidate metadata', () => {
    expect(formatVoiceDuration(1)).toBe('00:01');
    expect(formatVoiceDuration(null)).toBeNull();
    expect(formatVoiceFileSize(8044)).toBe('7.9 KB');
    expect(formatVoiceMimeType('audio/wav')).toBe('WAV');
  });
});
