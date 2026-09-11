import { FieldShell, InlineAlert, StatusBadge, TextField } from '@nimiplatform/kit/ui';
import type { NormalizedRealmPersonaHandleAvailability } from '../create-persona-draft.js';
import type { RealmPersonaHandleAvailabilityResult } from '../portfolio-client.js';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';

export function HandleAvailabilityBadge({
  handle,
  query,
  availability,
}: {
  handle: string;
  query: { isFetching: boolean; isError: boolean; data?: RealmPersonaHandleAvailabilityResult };
  availability: NormalizedRealmPersonaHandleAvailability | null;
}) {
  const { t } = useStudioI18n();
  if (!handle || query.isFetching) return <StatusBadge tone="neutral">{t('create.handleStatus.pending')}</StatusBadge>;
  if (query.isError || (query.data && !query.data.ok)) return <StatusBadge tone="info">{t('create.handleStatus.unavailable')}</StatusBadge>;
  if (!query.data) return <StatusBadge tone="neutral">{t('create.handleStatus.pending')}</StatusBadge>;
  return availability?.available
    ? <StatusBadge tone="success">{t('create.handleStatus.available')}</StatusBadge>
    : <StatusBadge tone="danger">{t('create.handleStatus.occupied')}</StatusBadge>;
}

export function HandleField({
  handle,
  normalizedHandle,
  query,
  availability,
  handleError,
  updateDraft,
}: {
  handle: string;
  normalizedHandle: string;
  query: { isFetching: boolean; isError: boolean; data?: RealmPersonaHandleAvailabilityResult };
  availability: NormalizedRealmPersonaHandleAvailability | null;
  handleError: string | null;
  updateDraft: (patch: { handle: string }) => void;
}) {
  const { t } = useStudioI18n();
  return (
    <div className="min-w-0" data-create-field="handle">
      <FieldShell
        label={<span className="flex flex-wrap items-center gap-2">{t('create.handleLabel')}<HandleAvailabilityBadge handle={normalizedHandle} query={query} availability={availability} /></span>}
        message={handleError}
        messageTone={handleError ? 'danger' : 'neutral'}
      >
        <TextField tone={handleError ? 'danger' : 'default'} data-create-field-control value={handle} placeholder={t('create.handlePlaceholder')} onChange={(event) => updateDraft({ handle: event.currentTarget.value })} />
      </FieldShell>
      {query.isError ? <InlineAlert tone="danger">{t('create.handleCheckFailed')}</InlineAlert> : null}
    </div>
  );
}
