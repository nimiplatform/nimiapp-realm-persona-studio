import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, CircleDashed, Image, MessageSquareText, Settings2, Sparkles, UserRound } from 'lucide-react';
import { Button, InlineAlert, StatusBadge, Surface } from '@nimiplatform/kit/ui';
import { PersonaShell, WorkspaceIntro } from '@renderer/features/persona-detail/persona-shell.js';
import type { OwnerPortfolioPersonaDetail, SettingField } from '@renderer/features/portfolio/portfolio-data.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';

type LaunchStep = {
  key: 'profile' | 'identity' | 'voice' | 'first-post' | 'preview' | 'draft-box';
  titleKey: StudioCopyKey;
  descriptionKey: StudioCopyKey;
  status: 'ready' | 'needs-work' | 'next';
  actionKey: StudioCopyKey;
  path: string;
  Icon: typeof Settings2;
};

function hasValue(field: SettingField): boolean {
  return field.status === 'available' && field.value.trim().length > 0;
}

function hasProfileBasics(persona: OwnerPortfolioPersonaDetail): boolean {
  return hasValue(persona.displayName) && hasValue(persona.handle) && hasValue(persona.bio) && hasValue(persona.greeting);
}

function hasIdentityStart(persona: OwnerPortfolioPersonaDetail): boolean {
  return Boolean(persona.avatarUrl) || hasValue(persona.profileCoverUrl);
}

function hasVoiceStart(persona: OwnerPortfolioPersonaDetail): boolean {
  return Boolean(persona.voice?.voiceId || persona.voice?.description || persona.voice?.speechModelId);
}

function statusTone(status: LaunchStep['status']): 'success' | 'warning' | 'info' {
  if (status === 'ready') return 'success';
  if (status === 'next') return 'info';
  return 'warning';
}

function statusKey(status: LaunchStep['status']): StudioCopyKey {
  if (status === 'ready') return 'launch.status.ready';
  if (status === 'next') return 'launch.status.next';
  return 'launch.status.needsWork';
}

function buildLaunchSteps(persona: OwnerPortfolioPersonaDetail): LaunchStep[] {
  const profileReady = hasProfileBasics(persona);
  const identityReady = hasIdentityStart(persona);
  const voiceReady = hasVoiceStart(persona);
  return [{
    key: 'profile',
    titleKey: 'launch.step.profile.title',
    descriptionKey: 'launch.step.profile.description',
    status: profileReady ? 'ready' : 'next',
    actionKey: 'launch.step.profile.action',
    path: `/portfolio/${persona.id}/settings`,
    Icon: Settings2,
  }, {
    key: 'identity',
    titleKey: 'launch.step.identity.title',
    descriptionKey: 'launch.step.identity.description',
    status: identityReady ? 'ready' : profileReady ? 'next' : 'needs-work',
    actionKey: 'launch.step.identity.action',
    path: `/portfolio/${persona.id}/assets`,
    Icon: Image,
  }, {
    key: 'voice',
    titleKey: 'launch.step.voice.title',
    descriptionKey: 'launch.step.voice.description',
    status: voiceReady ? 'ready' : identityReady ? 'next' : 'needs-work',
    actionKey: 'launch.step.voice.action',
    path: `/portfolio/${persona.id}/assets/voice`,
    Icon: Sparkles,
  }, {
    key: 'first-post',
    titleKey: 'launch.step.firstPost.title',
    descriptionKey: 'launch.step.firstPost.description',
    status: profileReady ? 'next' : 'needs-work',
    actionKey: 'launch.step.firstPost.action',
    path: `/portfolio/${persona.id}/posts`,
    Icon: MessageSquareText,
  }, {
    key: 'preview',
    titleKey: 'launch.step.preview.title',
    descriptionKey: 'launch.step.preview.description',
    status: profileReady ? 'next' : 'needs-work',
    actionKey: 'launch.step.preview.action',
    path: `/portfolio/${persona.id}/preview`,
    Icon: UserRound,
  }, {
    key: 'draft-box',
    titleKey: 'launch.step.draftBox.title',
    descriptionKey: 'launch.step.draftBox.description',
    status: 'next',
    actionKey: 'launch.step.draftBox.action',
    path: `/portfolio/${persona.id}/posts/manage`,
    Icon: CircleDashed,
  }];
}

function LaunchBody({ persona }: { persona: OwnerPortfolioPersonaDetail }) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const steps = buildLaunchSteps(persona);
  const readyCount = steps.filter((step) => step.status === 'ready').length;
  const nextStep = steps.find((step) => step.status === 'next') ?? steps[0];

  if (!nextStep) {
    return null;
  }

  return (
    <>
      <WorkspaceIntro
        title={t('launch.title')}
        badges={
          <>
            <StatusBadge tone="info">{t('launch.badge')}</StatusBadge>
            <StatusBadge tone={readyCount > 0 ? 'success' : 'warning'}>
              {t('launch.readyCount', { count: readyCount, total: steps.length })}
            </StatusBadge>
          </>
        }
        description={t('launch.description')}
        actions={
          <>
            <Button tone="primary" onClick={() => navigate(nextStep.path)}>
              {t(nextStep.actionKey)}
            </Button>
            <Button tone="ghost" onClick={() => navigate(`/portfolio/${persona.id}`)}>
              {t('launch.openCockpit')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3">
          {steps.map((step, index) => (
            <Surface key={step.key} tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--nimi-radius-field)] bg-[var(--nimi-surface-card)] text-[var(--nimi-text-secondary)]">
                  {step.status === 'ready' ? <CheckCircle2 size={20} strokeWidth={1.9} /> : <step.Icon size={20} strokeWidth={1.9} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-[length:var(--nimi-type-body-xs-size)] font-semibold uppercase text-[var(--nimi-text-muted)]">
                      {t('launch.stepNumber', { number: index + 1 })}
                    </span>
                    <StatusBadge tone={statusTone(step.status)}>{t(statusKey(step.status))}</StatusBadge>
                  </div>
                  <h2 className="m-0 mt-2 text-[length:var(--nimi-type-body-size)] font-semibold">{t(step.titleKey)}</h2>
                  <p className="m-0 mt-1 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
                    {t(step.descriptionKey)}
                  </p>
                </div>
                <Button tone={step.status === 'next' ? 'primary' : 'secondary'} onClick={() => navigate(step.path)}>
                  {t(step.actionKey)}
                </Button>
              </div>
            </Surface>
          ))}
        </div>

        <Surface tone="card" padding="md" className="content-start">
          <h2 className="m-0 text-[length:var(--nimi-type-body-size)] font-semibold">{t('launch.boundary.title')}</h2>
          <p className="m-0 mt-2 text-[length:var(--nimi-type-body-sm-size)] text-[var(--nimi-text-muted)]">
            {t('launch.boundary.description')}
          </p>
          <InlineAlert tone="info" className="mt-3">
            {t('launch.boundary.alert')}
          </InlineAlert>
        </Surface>
      </div>
    </>
  );
}

export function PersonaLaunchPage() {
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
    <PersonaShell personaId={personaId} current="detail">
      {(persona) => <LaunchBody persona={persona} />}
    </PersonaShell>
  );
}
