import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic2, PlayCircle } from 'lucide-react';
import { Button, FieldShell, InlineAlert, nimiToast, StatusBadge, Surface, TextareaField } from '@nimiplatform/kit/ui';
import { PersonaShell, WorkspaceIntro } from '@renderer/features/persona-detail/persona-shell.js';
import { synthesizeReviewedVoiceDemo, type RuntimeVoiceDemoSynthesisResult } from '@renderer/features/portfolio/portfolio-client.js';
import { appendLocalCreativeAssetHistory } from '@renderer/features/portfolio/creative-asset-history.js';
import { buildReviewedVoiceDemoCandidatePayload, type VoiceDemoCandidateInput } from '@renderer/features/portfolio/media-voice-candidate.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

function createVoiceDraft(persona: OwnerPortfolioPersonaDetail): VoiceDemoCandidateInput {
  return {
    scriptText: persona.greeting.value || persona.bio.value || '',
  };
}

function VoiceConfigBody({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<VoiceDemoCandidateInput>(() => createVoiceDraft(persona));
  const [result, setResult] = useState<RuntimeVoiceDemoSynthesisResult | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const payload = useMemo(() => buildReviewedVoiceDemoCandidatePayload(draft, persona), [persona, draft]);
  const previewUrl = result?.ok ? result.runtime.previewUrls[0] || '' : '';

  async function synthesizeVoiceDemo() {
    setIsSynthesizing(true);
    setResult(null);
    try {
      const next = await synthesizeReviewedVoiceDemo(draft, persona);
      setResult(next);
      if (next.ok) {
        nimiToast.success(t('voiceConfig.generated'));
        appendLocalCreativeAssetHistory(persona.id, {
          kind: 'voice-demo-candidate',
          label: 'Voice demo candidate',
          source: next.source,
          detail: next.runtime.previewUrls[0] || next.runtime.artifactIds[0] || next.runtime.jobId || 'voice artifact generated',
          artifactIds: next.runtime.artifactIds,
          ...(next.runtime.traceId ? { traceId: next.runtime.traceId } : {}),
        });
      } else {
        nimiToast.danger(next.message);
      }
    } finally {
      setIsSynthesizing(false);
    }
  }

  return (
    <>
      <WorkspaceIntro
        title={t('voiceConfig.title')}
        badges={
          <>
            <StatusBadge tone="info">{t('voiceConfig.badge')}</StatusBadge>
            <StatusBadge tone="warning">{t('voiceConfig.localBadge')}</StatusBadge>
          </>
        }
        description={t('voiceConfig.description')}
        actions={
          <>
            <Button tone="secondary" onClick={() => navigate(`/portfolio/${persona.id}/preview`)}>
              {t('voiceConfig.openPreview')}
            </Button>
            <Button tone="ghost" onClick={() => navigate(`/portfolio/${persona.id}/assets`)}>
              {t('voiceConfig.backToIdentity')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
          <div className="flex items-center gap-2">
            <Mic2 size={19} strokeWidth={1.8} />
            <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('voiceConfig.demo.title')}</h2>
          </div>
          <p className="m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {t('voiceConfig.demo.description')}
          </p>
          <FieldShell label={t('voiceConfig.script.label')} message={t('voiceConfig.script.message')}>
            <TextareaField
              value={draft.scriptText}
              rows={5}
              placeholder={t('voiceConfig.script.placeholder')}
              onChange={(event) => {
                setDraft({ scriptText: event.currentTarget.value });
                setResult(null);
              }}
            />
          </FieldShell>
          <InlineAlert tone={payload.changed ? 'info' : 'warning'}>
            {payload.changed ? t('voiceConfig.ready') : payload.errors.join('; ') || t('voiceConfig.scriptRequired')}
          </InlineAlert>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              tone="primary"
              disabled={!payload.changed || isSynthesizing}
              loading={isSynthesizing}
              onClick={() => void synthesizeVoiceDemo()}
            >
              {t('voiceConfig.generate')}
            </Button>
            <Button tone="secondary" onClick={() => navigate(`/portfolio/${persona.id}/posts/manage`)}>
              {t('voiceConfig.openDraftBox')}
            </Button>
          </div>
          {previewUrl ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                <PlayCircle size={16} strokeWidth={1.8} />
                {t('voiceConfig.playback')}
              </div>
              <audio src={previewUrl} controls className="w-full" />
            </div>
          ) : null}
        </Surface>

        <Surface tone="card" padding="md" className="content-start">
          <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('voiceConfig.boundary.title')}</h2>
          <p className="m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {t('voiceConfig.boundary.description')}
          </p>
          <InlineAlert tone="warning" className="mt-3">
            {t('voiceConfig.boundary.alert')}
          </InlineAlert>
        </Surface>
      </div>
    </>
  );
}

export function PersonaVoiceConfigPage() {
  const { t } = useStudioI18n();
  const { personaId } = useParams<{ personaId: string }>();

  if (!personaId) {
    return (
      <Surface tone="panel" material="glass-regular" padding="lg">
        <InlineAlert tone="danger">{t('common.personaIdMissing')}</InlineAlert>
      </Surface>
    );
  }

  return (
    <PersonaShell personaId={personaId} current="assets">
      {(persona) => <VoiceConfigBody persona={persona} />}
    </PersonaShell>
  );
}
