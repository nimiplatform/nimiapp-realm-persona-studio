import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('visual identity change dialog', () => {
  it('hard-cuts the visual action to the focused three-source dialog', () => {
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');

    expect(component).toContain('dataTestId="persona-visual-identity-dialog"');
    expect(component).toContain("type VisualIdentityMode = 'upload' | 'assets' | 'ai'");
    expect(component).toContain('fileInputRef.current?.click()');
    expect(component).toContain('data-testid="visual-existing-assets"');
    expect(component).toContain('data-testid="visual-ai-composer"');
    expect(component).toContain('generateReviewedVisualImageCandidate');
    expect(component).toContain('disabled={!prompt.trim() || isGenerating}');
  });

  it('uses the Tester-style composer without the removed candidate helper sentence', () => {
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');
    const copy = source('src/shell/renderer/i18n/studio-copy.ts');
    const styles = source('src/shell/renderer/styles.css');
    const removedCopy = '生成结果会作为候选，确认后才会成为当前形象';

    expect(component).toContain('ras-visual-change__composer');
    expect(component).toContain('ras-visual-change__intent-chip');
    expect(component).toContain('ras-visual-change__generate');
    expect(styles).toContain('.ras-visual-change__composer');
    expect(styles).toContain('min-height: 136px');
    expect(component).not.toContain(removedCopy);
    expect(copy).not.toContain(removedCopy);
  });

  it('keeps only the current-use status in the visual summary', () => {
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');

    expect(component).toContain("persona.avatarUrl ? 'assets.overview.currentlyUsed' : 'assets.overview.notConfigured'");
    expect(component).not.toContain('ras-asset-summary-card__facts');
    expect(component).not.toContain('formatImageAspectRatio');
  });

  it('preserves the admitted HTTPS avatar replace inside the refreshed visual editor', () => {
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');

    expect(component).toContain('data-testid="reviewed-avatar-url-editor"');
    expect(component).toContain('buildRealmSelectAvatarInput(avatarUrlDraft)');
    expect(component).toContain('selectReviewedPersonaAvatarUrl(persona, avatarUrlDraft)');
    expect(component).toContain('await onPersonaWrite()');
    expect(component).toContain("t('persona.failure.sanitized', { reason: result.failure })");
  });

  it('renders the selected development voice file as a playable local candidate', () => {
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');
    const styles = source('src/shell/renderer/styles.css');

    expect(component).toContain('data-testid="selected-voice-summary"');
    expect(component).toContain('data-development-fixture="true"');
    expect(component).toContain('voiceSummary.fileName');
    expect(component).toContain('voiceSummary.previewUrl');
    expect(component).toContain('preload="auto"');
    expect(component).toContain("'assets.overview.voice.localCandidate'");
    expect(styles).toContain('.ras-voice-summary__file');
    expect(styles).toContain('.ras-voice-summary__player');
    expect(styles).toContain('.ras-voice-summary__facts');
  });
});

describe('voice change dialog', () => {
  it('hard-cuts the voice action to the focused three-source dialog', () => {
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');
    const copy = source('src/shell/renderer/i18n/studio-copy.ts');
    const styles = source('src/shell/renderer/styles.css');

    expect(component).toContain('dataTestId="persona-voice-editor-dialog"');
    expect(component).toContain("type VoiceChangeMode = 'upload' | 'candidates' | 'ai'");
    expect(component).toContain('accept="audio/*"');
    expect(component).toContain('data-testid="voice-upload-selection"');
    expect(component).toContain('data-testid="voice-existing-candidates"');
    expect(component).toContain('data-testid="voice-ai-composer"');
    expect(component).toContain('synthesizeReviewedVoiceDemo');
    expect(component).toContain("kind: 'voice-demo-candidate'");
    expect(component).not.toContain('MediaVoiceCandidateEditor');
    expect(copy).toContain("'assets.voiceChange.title': '编辑声音'");
    expect(styles).toContain('.ras-voice-change__candidate');
    expect(styles).toContain('.ras-voice-change__player');
  });
});
