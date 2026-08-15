import type { ReactNode } from 'react';
import { Check, Images, Sparkles, Upload } from 'lucide-react';
import { StatusBadge } from '@nimiplatform/kit/ui';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';

export type ReferenceImageSourceMode = 'assets' | 'ai';

type ReferenceImageSourceChooserProps = {
  value: ReferenceImageSourceMode | null;
  attached: boolean;
  uploadDisabled?: boolean;
  onUploadRequest: () => void;
  onValueChange: (value: ReferenceImageSourceMode) => void;
};

function SourceButton({
  active,
  icon,
  title,
  selectable = true,
  disabled = false,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  selectable?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ras-create-visual-source__method"
      data-active={active}
      aria-pressed={selectable ? active : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="ras-create-visual-source__method-icon" aria-hidden="true">{icon}</span>
      <span>{title}</span>
      {active ? <span className="ras-create-visual-source__method-check" aria-hidden="true"><Check size={11} strokeWidth={2.2} /></span> : null}
    </button>
  );
}

export function ReferenceImageSourceChooser({
  value,
  attached,
  uploadDisabled = false,
  onUploadRequest,
  onValueChange,
}: ReferenceImageSourceChooserProps) {
  const { t } = useStudioI18n();
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold text-[var(--nimi-text-primary)]">{t('create.reference.sourceTitle')}</h3>
        {attached ? <StatusBadge tone="success">{t('create.referenceAttached')}</StatusBadge> : null}
      </div>
      <p className="m-0 text-xs leading-5 text-[var(--nimi-text-muted)]">{t('create.reference.sourceDescription')}</p>
      <div className="ras-create-visual-source__methods" role="group" aria-label={t('assets.visualChange.methodsAriaLabel')}>
        <SourceButton
          active={false}
          icon={<Upload size={22} strokeWidth={1.8} />}
          title={t('assets.visualChange.upload')}
          selectable={false}
          disabled={uploadDisabled}
          onClick={onUploadRequest}
        />
        <SourceButton
          active={value === 'assets'}
          icon={<Images size={22} strokeWidth={1.8} />}
          title={t('assets.visualChange.assets')}
          onClick={() => onValueChange('assets')}
        />
        <SourceButton
          active={value === 'ai'}
          icon={<Sparkles size={23} strokeWidth={1.8} />}
          title={t('assets.visualChange.ai')}
          onClick={() => onValueChange('ai')}
        />
      </div>
    </div>
  );
}
