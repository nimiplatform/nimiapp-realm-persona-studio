// @nimi-authority: rule.realm-persona-studio.asset.r003
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Image, Mic2, PlayCircle } from 'lucide-react';
import { Avatar, Button, FieldShell, InlineAlert, nimiToast, StatusBadge, Surface, TextareaField } from '@nimiplatform/kit/ui';
import {
  PersonaShell,
  WorkspaceIntro,
  useOpenPersonaVisualIdentityEditor,
  useOpenPersonaVoiceEditor,
} from '@renderer/features/persona-detail/persona-shell.js';
import { synthesizeReviewedVoiceDemo, type RuntimeVoiceDemoSynthesisResult } from '@renderer/features/portfolio/portfolio-client.js';
import { appendLocalCreativeAssetHistory } from '@renderer/features/portfolio/creative-asset-history.js';
import { buildReviewedVoiceDemoCandidatePayload, type VoiceDemoCandidateInput } from '@renderer/features/portfolio/media-voice-candidate.js';
import type { OwnerPortfolioPersonaDetail, SettingField } from '@renderer/features/portfolio/portfolio-data.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';

function translateVoiceFailure(
  result: Extract<RuntimeVoiceDemoSynthesisResult, { ok: false }>,
  t: ReturnType<typeof useStudioI18n>['t'],
): string {
  if (result.failure === 'runtime-payload-invalid') return t('assets.error.runtimeVoicePayloadInvalid');
  if (result.failure === 'runtime-transport-unavailable') return t('assets.error.runtimeVoiceTransportUnavailable');
  if (result.failure === 'runtime-route-unbound') return t('assets.error.runtimeVoiceConfigurationUnavailable');
  if (result.failure === 'runtime-capability-unavailable') {
    return t('assets.error.runtimeMediaCandidateUnavailable');
  }
  if (result.failure === 'runtime-output-malformed' || result.failure === 'runtime-output-missing') {
    return t('assets.error.runtimeVoiceMissingArtifact');
  }
  return t('assets.error.runtimeVoiceFailed');
}

function createVoiceDraft(persona: OwnerPortfolioPersonaDetail): VoiceDemoCandidateInput {
  return {
    scriptText: persona.greeting.value || persona.bio.value || '',
  };
}

function hasValue(field: SettingField): boolean {
  return field.status === 'available' && field.value.trim().length > 0;
}

function VisualIdentitySection({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const openVisualIdentityEditor = useOpenPersonaVisualIdentityEditor();
  const coverAvailable = hasValue(persona.profileCoverUrl);
  const coverSourceGap = persona.profileCoverUrl.status === 'source-unavailable';

  return (
    <Surface tone="card" padding="lg" className="ras-radius-xl">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            src={persona.avatarUrl ?? null}
            alt={persona.displayName.value || t('persona.header.personaCharacterAlt')}
            size="lg"
            shape="circle"
            tone="accent"
            fallback={<span className="text-2xl font-semibold">{(persona.displayName.value || persona.id).charAt(0).toUpperCase()}</span>}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Image size={17} strokeWidth={1.8} aria-hidden="true" />
              <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('identity.visual.title')}</h2>
            </div>
            <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
              {t('identity.visual.description')}
            </p>
          </div>
        </div>
        <Button tone="primary" onClick={openVisualIdentityEditor}>
          {t('identity.visual.open')}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge tone={persona.avatarUrl ? 'success' : 'neutral'}>
          {persona.avatarUrl ? t('identity.visual.avatarSet') : t('identity.visual.avatarMissing')}
        </StatusBadge>
        <StatusBadge tone={coverAvailable ? 'success' : coverSourceGap ? 'warning' : 'neutral'}>
          {coverAvailable
            ? t('identity.visual.coverAvailable')
            : coverSourceGap
              ? t('identity.visual.coverSourceUnavailable')
              : t('identity.visual.coverMissing')}
        </StatusBadge>
      </div>
    </Surface>
  );
}

function VoiceDemoSection({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const openVoiceEditor = useOpenPersonaVoiceEditor();
  const [draft, setDraft] = useState<VoiceDemoCandidateInput>(() => createVoiceDraft(persona));
  const [result, setResult] = useState<RuntimeVoiceDemoSynthesisResult | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const payload = useMemo(() => buildReviewedVoiceDemoCandidatePayload(draft, persona), [persona, draft]);
  const previewUrl = result?.ok ? result.runtime.previewUrls[0] || '' : '';
  const voiceConfigured = Boolean(persona.voice?.voiceId || persona.voice?.description || persona.voice?.speechModelId);

  async function synthesizeVoiceDemo() {
    setIsSynthesizing(true);
    setResult(null);
    try {
      const next = await synthesizeReviewedVoiceDemo(draft, persona);
      setResult(next);
      if (next.ok) {
        nimiToast.success(t('voiceConfig.generated'));
        const persisted = await appendLocalCreativeAssetHistory(persona.id, {
          sourceContentHash: persona.contentHash,
          kind: 'voice-demo-candidate',
          sourceKind: 'generated',
          reviewState: 'candidate-only',
          label: 'assets.history.voiceDemoCandidate',
          source: next.source,
          ...(next.runtime.previewUrls[0] ? { previewUrl: next.runtime.previewUrls[0] } : {}),
          detail: next.runtime.previewUrls[0] || next.runtime.artifactIds[0] || next.runtime.jobId || 'voice artifact generated',
          artifactIds: next.runtime.artifactIds,
          ...(next.runtime.traceId ? { traceId: next.runtime.traceId } : {}),
        });
        if (!persisted.ok) nimiToast.danger(t('assets.history.persistFailed'));
      } else {
        if (
          next.failure === 'runtime-capability-unavailable'
          || next.failure === 'runtime-route-unbound'
          || next.failure === 'runtime-transport-unavailable'
        ) {
          nimiToast.info(translateVoiceFailure(next, t));
        } else {
          nimiToast.danger(translateVoiceFailure(next, t));
        }
      }
    } finally {
      setIsSynthesizing(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Surface tone="card" padding="lg" className="ras-radius-xl">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Mic2 size={19} strokeWidth={1.8} aria-hidden="true" />
            <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('voiceConfig.demo.title')}</h2>
            <StatusBadge tone={voiceConfigured ? 'success' : 'neutral'}>
              {voiceConfigured ? t('identity.voice.configured') : t('identity.voice.notConfigured')}
            </StatusBadge>
          </div>
          <Button tone="secondary" onClick={openVoiceEditor}>
            {t('assets.overview.editVoice')}
          </Button>
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
              <PlayCircle size={16} strokeWidth={1.8} aria-hidden="true" />
              {t('voiceConfig.playback')}
            </div>
            <audio src={previewUrl} controls className="w-full" />
          </div>
        ) : null}
        {result && !result.ok ? (
          <InlineAlert tone="danger" className="mt-3">
            {translateVoiceFailure(result, t)}
          </InlineAlert>
        ) : null}
      </Surface>

      <Surface tone="card" padding="md" className="content-start">
        <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('voiceConfig.boundary.title')}</h2>
        <p className="m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
          {t('voiceConfig.boundary.description')}
        </p>
        <InlineAlert tone="info" className="mt-3">
          {t('voiceConfig.boundary.alert')}
        </InlineAlert>
      </Surface>
    </div>
  );
}

function IdentityBody({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();

  return (
    <>
      <WorkspaceIntro
        title={t('identity.title')}
        badges={
          <StatusBadge tone="warning">{t('voiceConfig.localBadge')}</StatusBadge>
        }
        description={t('identity.description')}
      />
      <VisualIdentitySection persona={persona} />
      <VoiceDemoSection persona={persona} />
    </>
  );
}

export function PersonaIdentityPage() {
  const { t } = useStudioI18n();
  const { personaId } = useParams<{ personaId: string }>();

  if (!personaId) {
    return (
      <Surface tone="card" padding="lg">
        <InlineAlert tone="danger">{t('common.personaIdMissing')}</InlineAlert>
      </Surface>
    );
  }

  return (
    <PersonaShell personaId={personaId} current="identity">
      {(persona) => <IdentityBody persona={persona} />}
    </PersonaShell>
  );
}
