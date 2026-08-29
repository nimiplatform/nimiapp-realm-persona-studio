import type { ReactNode } from 'react';
import { Check, Images, Sparkles, Upload } from 'lucide-react';
import { StatusBadge, Surface } from '@nimiplatform/kit/ui';
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
    <Surface
      as="button"
      type="button"
      tone="card"
      padding="sm"
      interactive
      active={active}
      aria-pressed={selectable ? active : undefined}
      disabled={disabled}
      onClick={onClick}
      className="relative grid min-h-[92px] min-w-0 place-content-center justify-items-center gap-1.5 text-center text-xs font-semibold text-[var(--nimi-text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nimi-action-primary-bg)] disabled:cursor-wait disabled:opacity-[var(--nimi-opacity-disabled)]"
    >
      <span className={`grid place-items-center ${active ? 'text-[var(--nimi-action-primary-bg)]' : 'text-[var(--nimi-text-muted)]'}`} aria-hidden="true">{icon}</span>
      <span>{title}</span>
      {active ? <span className="absolute right-2 top-2 grid h-[17px] w-[17px] place-items-center rounded-full bg-[var(--nimi-action-primary-bg)] text-[var(--nimi-action-primary-text)]" aria-hidden="true"><Check size={11} strokeWidth={2.2} /></span> : null}
    </Surface>
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
      {attached ? (
        <div className="flex items-center justify-end gap-3">
          <StatusBadge tone="success">{t('create.referenceAttached')}</StatusBadge>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('assets.visualChange.methodsAriaLabel')}>
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
