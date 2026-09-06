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
    expect(component).toContain("type VisualIdentityMode = 'upload' | 'assets' | 'ai' | 'url'");
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

  it('preserves the admitted HTTPS avatar replace inside the refreshed visual editor', () => {
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');

    expect(component).toContain('data-testid="reviewed-avatar-url-editor"');
    expect(component).toContain('buildRealmSelectAvatarInput(avatarUrlDraft)');
    expect(component).toContain('selectReviewedPersonaAvatarUrl(persona, avatarUrlDraft)');
    expect(component).toContain('await onPersonaWrite()');
    expect(component).toContain("t('persona.failure.sanitized', { reason: t(failureKindCopyKey(result.failure)) })");
  });
});

describe('persona hero visual identity entry', () => {
  it('opens the visual identity dialog from the hero avatar edit button', () => {
    const shell = source('src/shell/renderer/features/persona-detail/persona-shell.tsx');
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');
    const styles = source('src/shell/renderer/styles.css');

    expect(shell).toContain('data-testid="persona-avatar-edit"');
    expect(shell).toContain('ras-persona-hero__avatar-edit');
    expect(shell).toContain('useOpenPersonaVisualIdentityEditor');
    expect(shell).toContain('<PersonaVisualIdentityDialog');
    expect(component).toContain('export function PersonaVisualIdentityDialog');
    expect(styles).toContain('.ras-persona-hero__avatar-edit');
  });

  it('drops the old visual identity panel from the settings workspace', () => {
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');
    const copy = source('src/shell/renderer/i18n/studio-copy.ts');

    expect(component).not.toContain('ras-asset-block__visual-preview');
    expect(component).not.toContain('visual-preview-open-create');
    expect(component).not.toContain('assets.overview.visual.');
    expect(copy).not.toContain("'assets.overview.visual.");
  });

  it('keeps the local image editor one click away inside the visual dialog', () => {
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');
    const copy = source('src/shell/renderer/i18n/studio-copy.ts');

    expect(component).toContain('dataTestId="persona-visual-image-editor-dialog"');
    expect(component).toContain('onClick={() => setImageEditorOpen(true)}');
    expect(component).toContain("t('assets.visualChange.editImage')");
    expect(component).toContain('<VisualImageEditorWorkspace persona={persona} onHistoryUpdated={refreshCreativeHistory} />');
    expect(copy).toContain("'assets.visualChange.editImage': '编辑当前图片'");
  });
});

describe('persona hero voice entry', () => {
  it('drops the settings-rail voice panel and opens the voice dialog from the hero avatar voice button', () => {
    const shell = source('src/shell/renderer/features/persona-detail/persona-shell.tsx');
    const component = source('src/shell/renderer/features/portfolio/OwnerPortfolio.assets.tsx');
    const overview = source('src/shell/renderer/features/persona-settings/persona-settings-overview.tsx');
    const styles = source('src/shell/renderer/styles.css');

    expect(overview).not.toContain('PersonaVoiceAssetEntry');
    expect(component).not.toContain('PersonaVoiceAssetEntry');
    expect(component).not.toContain('ras-voice-row');
    expect(styles).not.toContain('.ras-voice-row');
    expect(shell).toContain('data-testid="persona-avatar-voice"');
    expect(shell).toContain('ras-persona-hero__avatar-voice');
    expect(shell).toContain('useOpenPersonaVoiceEditor');
    expect(shell).toContain('resolvePersonaVoiceSummary');
    expect(shell).toContain('<PersonaVoiceEditorDialog');
    expect(component).toContain('export function PersonaVoiceEditorDialog');
    expect(component).toContain('dataTestId="persona-voice-editor-dialog"');
    expect(styles).toContain('.ras-persona-hero__avatar-voice');
  });

  it('offers play and replace actions for a selected voice from the avatar voice menu', () => {
    const shell = source('src/shell/renderer/features/persona-detail/persona-shell.tsx');
    const copy = source('src/shell/renderer/i18n/studio-copy.ts');

    expect(shell).toContain("voiceSummary.kind === 'development-selected' ? voiceSummary.previewUrl : null");
    expect(shell).toContain('<Popover open={voiceMenuOpen} onOpenChange={setVoiceMenuOpen}>');
    expect(shell).toContain('PopoverTrigger');
    expect(shell).toContain('new Audio(voicePreviewUrl)');
    expect(shell).toContain("t('assets.overview.voice.play')");
    expect(shell).toContain("t('assets.overview.voice.pause')");
    expect(shell).toContain("t('assets.overview.replaceVoice')");
    expect(shell).toContain("nimiToast.info(t('assets.overview.voice.previewUnavailable'))");
    expect(shell).toContain("t('assets.overview.createVoice')");
    expect(shell).toContain("t('assets.overview.editVoice')");
    expect(copy).toContain("'assets.overview.voice.play': '播放声音'");
    expect(copy).toContain("'assets.overview.replaceVoice': '更换声音'");
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
