import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Sparkles } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  FieldShell,
  InlineAlert,
  LoadingSkeleton,
  NimiTabs,
  SelectField,
  StatusBadge,
  Surface,
  TextareaField,
  TextField,
  nimiToast,
} from '@nimiplatform/kit/ui';
import {
  personaCharacterFailureReason,
  type OwnerPortfolioPersonaDetail,
} from './portfolio-data.js';
import { failureKindCopyKey } from './failure-copy.js';
import {
  getPortfolioPersonaSettings,
  listCreateRealmPersonaSelectableWorlds,
  proposeReviewedPortfolioPersonaSettings,
  updateReviewedPortfolioPersonaSettings,
  type RealmOwnerPersonaSettings,
  type RuntimeOwnerSettingsProposalResult,
} from './portfolio-client.js';
import {
  buildRealmOwnerPersonaSettingsUpdateInput,
  createOwnerPersonaSettingsDraft,
  adoptSettingsSuggestions,
  type OwnerPersonaSettingsDraft,
} from './setting-proposal.js';
import { CharacterPreview } from '../persona-workshop/character-preview.js';
import { CharacterWritingFields } from '../persona-workshop/character-writing-fields.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';

const SUGGESTION_LABELS = {
  displayName: 'settingField.displayName',
  description: 'workshop.profile.description',
  greeting: 'workshop.profile.greeting',
  characterIdentity: 'workshop.character.characterIdentity',
  behaviorText: 'workshop.character.behaviorText',
  speakingText: 'workshop.character.speakingText',
  boundariesText: 'workshop.character.boundariesText',
} as const satisfies Record<string, StudioCopyKey>;
type SuggestionField = keyof typeof SUGGESTION_LABELS;
const SAVED_FIELDS = [...Object.keys(SUGGESTION_LABELS), 'handle', 'worldId'] as Array<
  keyof OwnerPersonaSettingsDraft
>;

export function SettingsSectionHead({
  icon,
  title,
  description,
  badges,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ras-settings-section__head">
      <span className="ras-settings-section__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="ras-settings-section__heading">
        <h3 className="ras-settings-section__title">{title}</h3>
        {description ? <p className="ras-settings-section__description">{description}</p> : null}
      </div>
      {badges || actions ? (
        <div className="ras-settings-section__badges">
          {badges}
          {actions}
        </div>
      ) : null}
    </header>
  );
}

// @nimi-authority: rule.realm-persona-studio.setting.r009
// @nimi-authority: rule.realm-persona-studio.setting.r012
// @nimi-authority: rule.realm-persona-studio.setting.r016
export function PersonaSettingsForm({
  persona,
  onPersonaWrite,
  onDirtyChange,
  mode = 'dialog',
}: {
  persona: OwnerPortfolioPersonaDetail;
  onPersonaWrite: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  mode?: 'page' | 'dialog';
}) {
  const { t, locale } = useStudioI18n();
  const navigate = useNavigate();
  const id = useId();
  const [tab, setTab] = useState('profile');
  const [base, setBase] = useState<RealmOwnerPersonaSettings | null>(null);
  const [draft, setDraft] = useState<OwnerPersonaSettingsDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [aiRequestFailed, setAiRequestFailed] = useState(false);
  const [reviewResult, setReviewResult] = useState<RuntimeOwnerSettingsProposalResult | null>(null);
  const [reviewBase, setReviewBase] = useState<OwnerPersonaSettingsDraft | null>(null);
  const [appliedKeys, setAppliedKeys] = useState<Set<SuggestionField>>(new Set());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const settingsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'persona-settings', persona.ownerScope, persona.id],
    queryFn: () => getPortfolioPersonaSettings(persona),
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
  const worldsQuery = useQuery({
    queryKey: ['realm-persona-studio', 'create-persona-worlds'],
    queryFn: () => listCreateRealmPersonaSelectableWorlds(),
  });
  // A refetch must not erase an owner's unsaved writing or silently advance its base hash.
  useEffect(() => {
    if (settingsQuery.isFetchedAfterMount && !settingsQuery.isError && settingsQuery.data && !base) {
      setBase(settingsQuery.data);
      setDraft(createOwnerPersonaSettingsDraft(settingsQuery.data));
    }
  }, [base, settingsQuery.data, settingsQuery.isError, settingsQuery.isFetchedAfterMount]);
  const built = useMemo(
    () => (draft && base ? buildRealmOwnerPersonaSettingsUpdateInput(draft, base) : null),
    [draft, base],
  );
  const dirty = useMemo(() => {
    if (!draft || !base) return false;
    const original = createOwnerPersonaSettingsDraft(base);
    return SAVED_FIELDS.some((key) => draft[key] !== original[key]);
  }, [draft, base]);
  const navigationBlocker = useBlocker(dirty || Boolean(draft?.naturalLanguageIntent.trim()));
  useEffect(() => {
    onDirtyChange?.(dirty || Boolean(draft?.naturalLanguageIntent.trim()));
  }, [dirty, draft?.naturalLanguageIntent, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function updateDraft(patch: Partial<OwnerPersonaSettingsDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setSaveMessage(null);
  }
  async function suggest() {
    if (!draft || !base || isReviewing || !draft.naturalLanguageIntent.trim()) return;
    setIsReviewing(true);
    setAiRequestFailed(false);
    setReviewResult(null);
    setAppliedKeys(new Set());
    setReviewBase({ ...draft });
    try {
      const result = await proposeReviewedPortfolioPersonaSettings(persona, draft, base, undefined, locale);
      if (mounted.current) setReviewResult(result);
    } catch {
      if (mounted.current) setAiRequestFailed(true);
    } finally {
      if (mounted.current) setIsReviewing(false);
    }
  }
  const suggestions = reviewResult?.ok ? reviewResult.proposal.draftPatch : {};
  const suggestionKeys = Object.keys(suggestions) as SuggestionField[];
  function apply(keys: SuggestionField[]) {
    if (!draft || !reviewBase) return;
    const adopted = adoptSettingsSuggestions(
      draft,
      reviewBase,
      suggestions,
      keys.filter((key) => !appliedKeys.has(key)),
    );
    setDraft(adopted.draft);
    setSaveMessage(null);
    setAppliedKeys((current) => new Set([...current, ...adopted.applied]));
  }
  async function save() {
    if (!draft || !base || !built?.ok || isSaving) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const result = await updateReviewedPortfolioPersonaSettings(persona, draft, base);
      if (!mounted.current) return;
      if (!result.ok) {
        setSaveMessage(
          result.failure === 'content-conflict'
            ? t('workshop.save.conflict')
            : t('persona.failure.sanitized', { reason: t(failureKindCopyKey(result.failure)) }),
        );
        return;
      }
      const refreshed = await settingsQuery.refetch();
      if (!mounted.current) return;
      if (refreshed.isError || !refreshed.data) {
        // The write succeeded; do not offer another write from the old hash.
        setBase(result.settings);
        setDraft(createOwnerPersonaSettingsDraft(result.settings));
        setSaveMessage(t('workshop.save.refreshFailed'));
      } else {
        setBase(refreshed.data);
        setDraft(createOwnerPersonaSettingsDraft(refreshed.data));
        nimiToast.success(t('workshop.save.success'));
      }
      setReviewResult(null);
      await onPersonaWrite();
    } catch {
      if (mounted.current) setSaveMessage(t('common.operationFailed'));
    } finally {
      if (mounted.current) setIsSaving(false);
    }
  }
  if (!draft || !base) {
    return settingsQuery.isError ? (
      <InlineAlert
        tone="danger"
        action={
          <Button tone="secondary" size="sm" onClick={() => void settingsQuery.refetch()}>
            {t('common.retry')}
          </Button>
        }
      >
        {t('persona.failure.sanitized', {
          reason: t(failureKindCopyKey(personaCharacterFailureReason(settingsQuery.error))),
        })}
      </InlineAlert>
    ) : (
      <LoadingSkeleton lines={5} label={t('settings.loadingTitle')} />
    );
  }
  const worldOptions = (worldsQuery.data || []).map((world) => ({
    value: world.id,
    label: world.name,
  }));
  if (draft.worldId && !worldOptions.some((option) => option.value === draft.worldId))
    worldOptions.unshift({ value: draft.worldId, label: persona.world.value || draft.worldId });
  const invalidWriting = built && !built.ok && built.errors.includes('character-writing-invalid');
  return (
    <div className={`ras-maintenance ras-maintenance--${mode}`}>
      <ConfirmDialog
        open={navigationBlocker.state === 'blocked'}
        title={t('persona.settings.discardTitle')}
        message={t('persona.settings.discardDescription')}
        confirmLabel={t('persona.settings.discardConfirm')}
        cancelLabel={t('common.cancel')}
        confirmTone="danger"
        loading={isSaving}
        onConfirm={() => {
          if (!isSaving && navigationBlocker.state === 'blocked') navigationBlocker.proceed();
        }}
        onClose={() => {
          if (navigationBlocker.state === 'blocked') navigationBlocker.reset();
        }}
      />
      <div className="ras-workshop-heading">
        <span className="ras-workshop-eyebrow">{t('workshop.hub.eyebrow')}</span>
        <h2>{t('workshop.maintain.title')}</h2>
        <p>{t('workshop.maintain.description')}</p>
      </div>
      <footer className="ras-maintenance-savebar">
        <span role="status">{t(dirty ? 'workshop.save.dirty' : 'workshop.save.clean')}</span>
        <Button
          tone="primary"
          disabled={!built?.ok || isSaving}
          loading={isSaving}
          onClick={() => void save()}
        >
          {t('workshop.save.action')}
        </Button>
      </footer>
      {saveMessage ? (
        <InlineAlert tone="warning" className="ras-workshop-save-message">
          {saveMessage}
        </InlineAlert>
      ) : null}
      <div className="ras-workshop-layout">
        <div className="ras-maintenance__main">
          <Surface tone="panel" padding="none" className="ras-writing-partner">
            <div className="ras-writing-partner__heading">
              <Sparkles size={20} strokeWidth={1.7} aria-hidden="true" />
              <div>
                <h3>{t('workshop.ai.title')}</h3>
                <p>{t('workshop.ai.description')}</p>
              </div>
            </div>
            <div className="ras-writing-partner__presets">
              {(['warmer', 'distinct', 'greeting'] as const).map((key) => (
                <Button
                  key={key}
                  tone="secondary"
                  size="sm"
                  disabled={isReviewing || isSaving}
                  onClick={() =>
                    updateDraft({ naturalLanguageIntent: t(`workshop.ai.${key}Intent`) })
                  }
                >
                  {t(`workshop.ai.${key}`)}
                </Button>
              ))}
            </div>
            <FieldShell label={<label htmlFor={`${id}-intent`}>{t('workshop.ai.intent')}</label>}>
              <TextareaField
                id={`${id}-intent`}
                rows={3}
                value={draft.naturalLanguageIntent}
                readOnly={isReviewing || isSaving}
                placeholder={t('workshop.ai.placeholder')}
                onChange={(event) =>
                  updateDraft({ naturalLanguageIntent: event.currentTarget.value })
                }
              />
            </FieldShell>
            <div className="ras-writing-partner__actions">
              <Button
                tone="primary"
                loading={isReviewing}
                disabled={isSaving || !draft.naturalLanguageIntent.trim()}
                leadingIcon={<Sparkles size={15} aria-hidden="true" />}
                onClick={() => void suggest()}
              >
                {t(isReviewing ? 'workshop.ai.generating' : 'workshop.ai.generate')}
              </Button>
            </div>
            {aiRequestFailed || (reviewResult && !reviewResult.ok) ? (
              <InlineAlert
                tone="warning"
                action={
                  <Button tone="secondary" size="sm" onClick={() => navigate('/ai-config')}>
                    {t('workshop.ai.configure')}
                  </Button>
                }
              >
                {t('workshop.ai.failed')}
              </InlineAlert>
            ) : null}
          </Surface>
          {reviewResult?.ok ? (
            <section className="ras-writing-suggestions" aria-label={t('workshop.ai.suggestions')}>
              <div className="ras-section-head">
                <h3>{t('workshop.ai.suggestions')}</h3>
                <StatusBadge tone="info">{t('common.candidate')}</StatusBadge>
              </div>
              <p>{reviewResult.proposal.rationale}</p>
              {suggestionKeys.map((key) => {
                const applied = appliedKeys.has(key);
                const stale = !applied && draft[key] !== reviewBase?.[key];
                return (
                  <Surface key={key} tone="card" padding="md" className="ras-writing-suggestion">
                    <div className="ras-section-head">
                      <h4>{t(SUGGESTION_LABELS[key])}</h4>
                      {applied ? (
                        <StatusBadge tone="success">
                          <Check size={13} aria-hidden="true" />
                          {t('workshop.ai.adopted')}
                        </StatusBadge>
                      ) : (
                        <Button
                          size="sm"
                          tone="secondary"
                          disabled={stale || isSaving}
                          onClick={() => apply([key])}
                        >
                          {t('workshop.ai.adopt')}
                        </Button>
                      )}
                    </div>
                    <div className="ras-writing-suggestion__comparison">
                      <div>
                        <span>{t('workshop.ai.current')}</span>
                        <p>{reviewBase?.[key] || t('common.notSet')}</p>
                      </div>
                      <div>
                        <span>{t('workshop.ai.proposed')}</span>
                        <p>{suggestions[key]}</p>
                      </div>
                    </div>
                    {stale ? <p className="ras-workshop-help">{t('workshop.ai.stale')}</p> : null}
                  </Surface>
                );
              })}
              <div className="ras-writing-partner__actions">
                {suggestionKeys.length > 1 ? (
                  <Button
                    disabled={
                      isSaving ||
                      suggestionKeys.every(
                        (key) => appliedKeys.has(key) || draft[key] !== reviewBase?.[key],
                      )
                    }
                    onClick={() => apply(suggestionKeys)}
                  >
                    {t('workshop.ai.adoptAll')}
                  </Button>
                ) : null}
                <Button tone="ghost" onClick={() => setReviewResult(null)}>
                  {t('workshop.ai.discard')}
                </Button>
              </div>
            </section>
          ) : null}

          <Surface tone="card" padding="none" className="ras-workshop-editor">
            <NimiTabs
              value={tab}
              onValueChange={setTab}
              items={[
                { value: 'profile', label: t('workshop.tab.profile') },
                { value: 'character', label: t('workshop.tab.character') },
              ]}
              ariaLabel={t('workshop.maintain.title')}
            />
            <fieldset disabled={isSaving} className="ras-workshop-fieldset">
              <div hidden={tab !== 'profile'} className="ras-workshop-panel">
                <div className="ras-create-identity-grid">
                  <FieldShell
                    label={<label htmlFor={`${id}-name`}>{t('settingField.displayName')}</label>}
                    message={!draft.displayName.trim() ? t('workshop.save.required') : null}
                    messageTone="danger"
                  >
                    <TextField
                      id={`${id}-name`}
                      value={draft.displayName}
                      onChange={(event) => updateDraft({ displayName: event.currentTarget.value })}
                    />
                  </FieldShell>
                  <FieldShell
                    label={<label htmlFor={`${id}-handle`}>{t('settingField.handle')}</label>}
                  >
                    <TextField
                      id={`${id}-handle`}
                      leading={<span aria-hidden="true">@</span>}
                      value={draft.handle}
                      onChange={(event) => updateDraft({ handle: event.currentTarget.value })}
                    />
                  </FieldShell>
                </div>
                <FieldShell
                  label={<label htmlFor={`${id}-bio`}>{t('workshop.profile.description')}</label>}
                  message={
                    !draft.description.trim()
                      ? t('workshop.save.required')
                      : t('workshop.profile.descriptionHint')
                  }
                  messageTone={!draft.description.trim() ? 'danger' : 'neutral'}
                >
                  <TextareaField
                    id={`${id}-bio`}
                    value={draft.description}
                    rows={4}
                    onChange={(event) => updateDraft({ description: event.currentTarget.value })}
                  />
                </FieldShell>
                <FieldShell
                  label={<label htmlFor={`${id}-greeting`}>{t('workshop.profile.greeting')}</label>}
                  message={t('workshop.profile.greetingHint')}
                >
                  <TextareaField
                    id={`${id}-greeting`}
                    value={draft.greeting}
                    rows={3}
                    placeholder={t('workshop.profile.greetingPlaceholder')}
                    onChange={(event) => updateDraft({ greeting: event.currentTarget.value })}
                  />
                </FieldShell>
                <details className="ras-workshop-world-details">
                  <summary>{t('settings.worldLabel')}</summary>
                  <SelectField
                    aria-label={t('settings.worldLabel')}
                    value={draft.worldId}
                    options={worldOptions}
                    disabled={worldsQuery.isLoading || worldsQuery.isError}
                    contentLayer={mode === 'dialog' ? 'dialog' : undefined}
                    onValueChange={(value) => updateDraft({ worldId: value })}
                  />
                  {worldsQuery.isError ? <p>{t('settings.worldUnavailable')}</p> : null}
                </details>
              </div>
              <div hidden={tab !== 'character'} className="ras-workshop-panel">
                {!base.lorebookDeclaration ? (
                  <InlineAlert tone="info">{t('workshop.save.unavailable')}</InlineAlert>
                ) : null}
                <CharacterWritingFields
                  value={draft}
                  onChange={updateDraft}
                  showErrors={Boolean(invalidWriting)}
                />
              </div>
            </fieldset>
            {invalidWriting && tab !== 'character' ? (
              <InlineAlert
                tone="warning"
                action={
                  <Button tone="ghost" onClick={() => setTab('character')}>
                    {t('workshop.tab.character')}
                  </Button>
                }
              >
                {t('workshop.writing.invalid')}
              </InlineAlert>
            ) : null}
          </Surface>
        </div>
        <CharacterPreview
          displayName={draft.displayName}
          handle={draft.handle}
          description={draft.description}
          greeting={draft.greeting}
          identity={draft.characterIdentity}
          imageUrl={persona.avatarUrl}
        />
      </div>
    </div>
  );
}
