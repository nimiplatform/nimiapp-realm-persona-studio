import { NimiText, StatusBadge } from '@nimiplatform/kit/ui';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';
import type { AutosaveState } from './types.js';

/**
 * Autosave indicator. A pristine, freshly loaded draft sits in the quiet idle
 * caption (nothing has been saved because nothing changed); once the first
 * real edit lands, the usual saved/saving/failed badge behavior applies.
 */
export function AutosaveIndicator({
  state,
  failureMessage,
  idle = false,
}: {
  state: AutosaveState;
  failureMessage: string | null;
  idle?: boolean;
}) {
  const { t } = useStudioI18n();
  if (idle) {
    return (
      <div className="flex min-w-0 flex-col items-end gap-1">
        <NimiText role="caption">{t('create.autosave.idle')}</NimiText>
      </div>
    );
  }
  const tone = state === 'saved' ? 'success' : state === 'saving' ? 'info' : 'danger';
  const label = state === 'saved' ? t('create.autosave.saved') : state === 'saving' ? t('create.autosave.saving') : t('create.autosave.failed');
  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <StatusBadge tone={tone}>{label}</StatusBadge>
      {state === 'failed' && failureMessage ? <span className="max-w-72 text-right text-xs text-[var(--nimi-status-danger)]">{failureMessage}</span> : null}
    </div>
  );
}
