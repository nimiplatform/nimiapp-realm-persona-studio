import { useCallback, useEffect, useState } from 'react';
import { Button, FieldShell, InlineAlert, SelectField } from '@nimiplatform/kit/ui';
import type { NimiAIConfigOptionsResult } from '@nimiplatform/sdk/ai';
import { getStudioLocalAppClient } from '../../app-shell/studio-platform.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';

type PresetVoice = Extract<NimiAIConfigOptionsResult, { kind: 'preset-voices' }>['options'][number];

// @nimi-authority: rule.realm-persona-studio.runtime-ai.r012
export function useStudioVoicePresets() {
  const [voices, setVoices] = useState<readonly PresetVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    void Promise.resolve().then(() => getStudioLocalAppClient().aiConfig.listOptions({ kind: 'preset-voices' })).then((result) => {
      if (cancelled) return;
      if (result.kind !== 'preset-voices') throw new Error('Unexpected voice catalogue response.');
      setVoices(result.options);
    }).catch(() => {
      if (!cancelled) { setVoices([]); setUnavailable(true); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);
  return { voices, loading, unavailable, refresh };
}

export function StudioVoiceSelector({ catalogue, value, onChange, disabled = false }: {
  catalogue: ReturnType<typeof useStudioVoicePresets>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useStudioI18n();
  return <div className="grid gap-2"><FieldShell label={t('voiceConfig.preset.label')} message={t('voiceConfig.preset.hint')}>
    <SelectField
      aria-label={t('voiceConfig.preset.label')}
      value={catalogue.voices.some((voice) => voice.voiceId === value) ? value : ''}
      placeholder={t(catalogue.loading ? 'common.loading' : 'voiceConfig.preset.choose')}
      options={catalogue.voices.map((voice) => ({ value: voice.voiceId, label: voice.name }))}
      disabled={disabled || catalogue.loading || catalogue.unavailable || catalogue.voices.length === 0}
      onValueChange={onChange}
    />
    </FieldShell>
    {!catalogue.loading && (catalogue.unavailable || catalogue.voices.length === 0) ? <InlineAlert tone="warning"
      action={<Button tone="secondary" size="sm" onClick={catalogue.refresh}>{t('common.retry')}</Button>}>
      {t('voiceConfig.preset.unavailable')}
    </InlineAlert> : null}
  </div>;
}
