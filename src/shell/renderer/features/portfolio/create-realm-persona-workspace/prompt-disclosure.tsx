import { useState } from 'react';
import { Button, InlineAlert, Surface } from '@nimiplatform/kit/ui';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';
import type { PromptCopyTarget } from './types.js';

function PromptReadOnly({
  label,
  text,
  target,
  copied,
  onCopy,
}: {
  label: string;
  text: string;
  target: PromptCopyTarget;
  copied: boolean;
  onCopy: (target: PromptCopyTarget, text: string) => void;
}) {
  const { t } = useStudioI18n();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{label}</span><Button tone="secondary" size="sm" disabled={!text.trim()} onClick={() => void onCopy(target, text)} leadingIcon={copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}>{copied ? t('create.prompt.copied') : t('create.prompt.copy')}</Button></div>
      <pre className="ras-break-anywhere m-0 max-h-40 overflow-auto whitespace-pre-wrap rounded-[var(--nimi-radius-field)] border border-[var(--nimi-border-subtle)] bg-[var(--nimi-surface-card)] p-3 text-xs text-[var(--nimi-text-secondary)]">{text || t('create.prompt.empty')}</pre>
    </div>
  );
}

export function PromptDisclosure({
  seedPrompt,
  imagePrompt,
}: {
  seedPrompt: string;
  imagePrompt: string;
}) {
  const { t } = useStudioI18n();
  const [promptPanelOpen, setPromptPanelOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState<PromptCopyTarget | null>(null);
  const [promptCopyFailed, setPromptCopyFailed] = useState(false);

  async function copyPrompt(target: PromptCopyTarget, text: string) {
    setPromptCopyFailed(false);
    if (!text.trim() || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setPromptCopyFailed(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setPromptCopied(target);
      window.setTimeout(() => setPromptCopied((current) => current === target ? null : current), 1500);
    } catch {
      setPromptCopyFailed(true);
    }
  }

  return (
    <div className="ras-create-prompt-panel">
      <Button
        tone="ghost"
        size="sm"
        aria-expanded={promptPanelOpen}
        leadingIcon={<ChevronDown size={15} aria-hidden="true" className={promptPanelOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />}
        onClick={() => setPromptPanelOpen((open) => !open)}
      >
        {t('create.prompt.title')}
      </Button>
      {promptPanelOpen ? (
        <Surface tone="panel" padding="md" className="mt-2 grid gap-3">
          <p className="m-0 text-sm text-[var(--nimi-text-muted)]">{t('create.prompt.description')}</p>
          <PromptReadOnly label={t('create.prompt.ownerLabel')} text={seedPrompt} target="seed" copied={promptCopied === 'seed'} onCopy={copyPrompt} />
          <PromptReadOnly label={t('create.prompt.imageLabel')} text={imagePrompt} target="image" copied={promptCopied === 'image'} onCopy={copyPrompt} />
          {promptCopyFailed ? <InlineAlert tone="warning">{t('create.prompt.copyFailed')}</InlineAlert> : null}
        </Surface>
      ) : null}
    </div>
  );
}
