import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EyeOff, Globe, Lock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { nimiToast, SelectField, type SelectFieldOption } from '@nimiplatform/kit/ui';
import { useRefreshPersonaReads } from '@renderer/features/persona-detail/use-persona-detail-query.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { failureKindCopyKey } from '@renderer/features/portfolio/failure-copy.js';
import {
  getPersonaVisibilitySettings,
  PERSONA_VISIBILITY_VALUES,
  updateReviewedPersonaVisibility,
} from '@renderer/features/portfolio/portfolio-client.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '@renderer/i18n/studio-copy.js';

/**
 * Compact source-unavailable marker. Fields that read normally render no
 * status decoration at all; only a genuine source gap gets this inline chip,
 * keeping the fail-closed state explicit without turning the page into a
 * debug panel.
 */
export function FieldSourceAlert() {
  const { t } = useStudioI18n();
  return (
    <span className="ras-field-alert" role="status">
      <TriangleAlert size={13} strokeWidth={2} aria-hidden="true" />
      {t('common.sourceUnavailable')}
    </span>
  );
}

const VISIBILITY_SELECT_ICONS = {
  public: Globe,
  unlisted: EyeOff,
  private: Lock,
  system: ShieldCheck,
} as const;

function visibilityOptionLabel(icon: typeof Globe, text: string) {
  const Icon = icon;
  return (
    <span className="ras-visibility-option-label">
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

/**
 * Inline visibility select in the persona hero header. Picking an option runs
 * the reviewed Realm replace write immediately (same client path the old
 * dialog section used), then refreshes the persona reads so the portfolio
 * list and other persona surfaces follow. The control is disabled while the write context is
 * unreadable, while saving, or for platform-managed system visibility; a
 * source gap renders the compact alert chip instead of a fake value.
 */
export function VisibilityInlineSelect({
  persona,
}: {
  persona: OwnerPortfolioPersonaDetail;
}) {
  const { t } = useStudioI18n();
  const refreshPersonaReads = useRefreshPersonaReads(persona.id, 'owner');
  const visibilityQuery = useQuery({
    queryKey: ['realm-persona-studio', 'owner-persona-visibility', persona.id],
    queryFn: () => getPersonaVisibilitySettings(persona.id),
  });
  const [isSaving, setIsSaving] = useState(false);

  if (persona.visibility.status !== 'available') {
    return <FieldSourceAlert />;
  }
  const currentValue = visibilityQuery.data?.visibility ?? persona.visibility.value;
  const knownValue = currentValue === 'system'
    || (PERSONA_VISIBILITY_VALUES as readonly string[]).includes(currentValue);
  if (!knownValue) {
    return <FieldSourceAlert />;
  }

  async function changeVisibility(next: string) {
    const current = visibilityQuery.data;
    if (!current || next === current.visibility) {
      return;
    }
    setIsSaving(true);
    try {
      const result = await updateReviewedPersonaVisibility(persona.id, { visibility: next }, current);
      if (result.ok) {
        nimiToast.success(t('visibility.saved'));
        await visibilityQuery.refetch();
        await refreshPersonaReads();
      } else {
        nimiToast.danger(t('persona.failure.sanitized', { reason: t(failureKindCopyKey(result.failure)) }));
      }
    } finally {
      setIsSaving(false);
    }
  }

  const options: SelectFieldOption[] = PERSONA_VISIBILITY_VALUES.map((value) => ({
    value,
    label: visibilityOptionLabel(
      VISIBILITY_SELECT_ICONS[value],
      t(`visibility.value.${value}` as StudioCopyKey),
    ),
  }));
  if (currentValue === 'system') {
    options.push({
      value: 'system',
      label: visibilityOptionLabel(ShieldCheck, t('visibility.value.system')),
      disabled: true,
    });
  }

  return (
    <SelectField
      aria-label={t('settingField.visibility')}
      value={currentValue}
      options={options}
      disabled={isSaving || currentValue === 'system' || !visibilityQuery.data}
      onValueChange={(next) => void changeVisibility(next)}
      selectClassName="ras-visibility-select-field"
    />
  );
}
