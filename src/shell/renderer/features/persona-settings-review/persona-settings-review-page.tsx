import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  EmptyState,
  FieldShell,
  InlineAlert,
  nimiToast,
  StatusBadge,
  Surface,
  TextareaField,
} from '@nimiplatform/kit/ui';
import { PersonaShell, WorkspaceIntro } from '@renderer/features/persona-detail/persona-shell.js';
import {
  getOwnerPersonaSettings,
  proposeReviewedOwnerPersonaSettings,
  type RuntimeOwnerSettingsProposalResult,
} from '@renderer/features/portfolio/portfolio-client.js';
import {
  createOwnerPersonaSettingsDraft,
} from '@renderer/features/portfolio/setting-proposal.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';
import type { StudioTranslateOptions } from '@renderer/i18n/studio-i18n.js';

type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

const REVIEW_FIXED_MESSAGE_KEYS: Record<string, StudioCopyKey> = {
  'natural-language setting intent missing': 'settings.error.intentMissing',
  'Runtime settings proposal payload invalid.': 'settings.error.runtimeProposalPayloadInvalid',
  'Runtime runtime.ai.text.generate runtime transport unavailable: Tauri IPC runtime transport is required.': 'settings.error.runtimeProposalTransportUnavailable',
  'Runtime settings proposal output invalid.': 'settings.error.runtimeProposalOutputInvalid',
  'Runtime settings proposal returned no admitted setting changes.': 'settings.error.proposalNoChanges',
};

function translateReviewFixedMessage(message: string, t: StudioTranslator): string {
  if (message.startsWith('Runtime settings proposal rejected forbidden ')) return t('settings.error.proposalForbiddenField');
  if (message.startsWith('Runtime settings proposal rejected invalid ')) return t('settings.error.proposalInvalidField');
  if (message.startsWith('Runtime runtime.ai.text.generate failed:')) return t('settings.error.runtimeProposalFailed');
  const key = REVIEW_FIXED_MESSAGE_KEYS[message];
  return key ? t(key) : t('common.operationFailed');
}

export function PersonaSettingsReviewPage() {
  const { t } = useStudioI18n();
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();

  if (!personaId) {
    return (
      <Surface tone="panel" material="glass-regular" padding="lg">
        <InlineAlert tone="danger">{t('common.personaIdMissing')}</InlineAlert>
      </Surface>
    );
  }

  return (
    <PersonaShell personaId={personaId} current="settings">
      {() => <ConsistencyReviewBody personaId={personaId} onApplied={() => navigate(`/portfolio/${personaId}/settings`)} />}
    </PersonaShell>
  );
}

function ConsistencyReviewBody({ personaId, onApplied }: { personaId: string; onApplied: () => void }) {
  const { t } = useStudioI18n();
  const settingsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'owner-persona-settings', personaId],
    queryFn: () => getOwnerPersonaSettings(personaId),
  });
  const [intent, setIntent] = useState(() => t('persona.review.defaultPrompt'));
  const [result, setResult] = useState<RuntimeOwnerSettingsProposalResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  async function requestReview() {
    if (!settingsQuery.data) return;
    setIsReviewing(true);
    setResult(null);
    try {
      const draft = createOwnerPersonaSettingsDraft(settingsQuery.data);
      const review = await proposeReviewedOwnerPersonaSettings(personaId, { ...draft, naturalLanguageIntent: intent }, settingsQuery.data);
      setResult(review);
      if (!review.ok) {
        nimiToast.danger(translateReviewFixedMessage(review.message, t));
      }
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <>
      <WorkspaceIntro
        title={t('persona.review.title')}
        badges={
          <>
            <StatusBadge tone="info">{t('persona.review.advisory')}</StatusBadge>
            <StatusBadge tone="warning">{t('common.candidateOnly')}</StatusBadge>
          </>
        }
        description={t('persona.review.description')}
      />

      <Surface tone="panel" material="glass-regular" padding="lg" className="ras-radius-xl">
        {settingsQuery.isLoading ? (
          <EmptyState title={t('persona.review.loadingTitle')} description={t('persona.review.loadingDescription')} />
        ) : settingsQuery.isError ? (
          <InlineAlert tone="danger">
            {t('persona.review.unavailablePrefix')} {t('persona.review.readFailed')}
          </InlineAlert>
        ) : (
          <div className="ras-stack-tight" style={{ gap: 16 }}>
            <FieldShell label={t('persona.review.promptLabel')} message={t('persona.review.promptMessage')}>
              <TextareaField
                value={intent}
                placeholder={t('persona.review.promptLabel')}
                onChange={(event) => setIntent(event.currentTarget.value)}
              />
            </FieldShell>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Button
                tone="primary"
                onClick={() => void requestReview()}
                disabled={!intent.trim() || isReviewing || !settingsQuery.data}
                loading={isReviewing}
              >
                {t('persona.review.run')}
              </Button>
              <Button tone="ghost" onClick={onApplied}>
                {t('persona.review.backToSettings')}
              </Button>
            </div>
            {result?.ok ? (
              <Surface tone="card" padding="md" className="ras-radius-md">
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{t('persona.review.resultTitle')}</div>
                    <div className="ras-break-anywhere ras-text-muted ras-text-size-sm" style={{ marginTop: 4 }}>
                      {result.proposal.rationale}
                    </div>
                  </div>
                  <StatusBadge tone="info">{t('common.candidate')}</StatusBadge>
                </div>
                {result.proposal.changedSettingKeys.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {result.proposal.changedSettingKeys.map((key) => (
                      <StatusBadge key={key} tone="neutral">{key}</StatusBadge>
                    ))}
                  </div>
                ) : null}
                <div style={{ marginTop: 12 }}>
                  <InlineAlert tone="info">
                    {t('persona.review.candidateBoundary')}
                  </InlineAlert>
                </div>
                <details className="ras-technical-details" style={{ marginTop: 12 }}>
                  <summary>{t('persona.review.patchTitle')}</summary>
                  <pre className="ras-json-preview" style={{ margin: '12px 0 0', minHeight: 128, overflow: 'auto', borderRadius: 'var(--nimi-radius-field)', border: '1px solid var(--nimi-border-subtle)', background: 'var(--nimi-surface-panel)', padding: 12, fontSize: 12 }}>
                    {JSON.stringify(result.proposal.draftPatch, null, 2)}
                  </pre>
                </details>
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <Button tone="primary" onClick={onApplied}>{t('persona.review.goApply')}</Button>
                </div>
              </Surface>
            ) : null}
          </div>
        )}
      </Surface>
    </>
  );
}
