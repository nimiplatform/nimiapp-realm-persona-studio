import { useState } from 'react';
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@nimiplatform/kit/ui';
import { ChevronDown } from 'lucide-react';
import {
  PERSONA_TRAITS,
  PERSONA_TRAIT_MAX,
  type PersonaTrait,
} from '../create-persona-draft.js';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';
import { translatePersonaTraitLabel } from '../../../i18n/studio-i18n.js';
import { PERSONA_TRAIT_DESCRIPTION_KEYS } from './create-flow-copy.js';

/**
 * Persona trait multi-select (hard cap PERSONA_TRAIT_MAX). The trigger keeps
 * the field-styled chip display; the option list is a kit Popover with a
 * checkbox list so outside-click, Escape, and focus handling come from the
 * kit overlay primitive instead of hand-rolled document listeners.
 */
export function TraitsMultiSelect({
  value,
  error,
  onChange,
}: {
  value: PersonaTrait[];
  error: string | null;
  onChange: (next: PersonaTrait[]) => void;
}) {
  const { t } = useStudioI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-create-field-control
          aria-invalid={Boolean(error) || undefined}
          className={`ras-create-trait-trigger ${error ? 'ras-create-trait-trigger--error' : ''}`}
        >
          <span className="ras-create-trait-trigger__selection">
            {value.length > 0 ? value.map((trait) => (
              <span key={trait} className="ras-create-trait-chip">
                {translatePersonaTraitLabel(trait, t).split(' · ')[0]}
              </span>
            )) : (
              <span className="ras-create-trait-trigger__placeholder">{t('create.personaTraitsPlaceholder', { max: PERSONA_TRAIT_MAX })}</span>
            )}
          </span>
          <ChevronDown className={`ras-create-trait-trigger__chevron ${open ? 'rotate-180' : ''}`} size={15} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <ScrollArea className="max-h-64">
          <div className="grid gap-0.5 p-2" role="group" aria-label={t('create.personaTraitsLabel', { max: PERSONA_TRAIT_MAX })}>
            {PERSONA_TRAITS.map((trait) => {
              const active = value.includes(trait);
              const disabled = !active && value.length >= PERSONA_TRAIT_MAX;
              const label = translatePersonaTraitLabel(trait, t);
              return (
                <Checkbox
                  key={trait}
                  checked={active}
                  disabled={disabled}
                  aria-label={label}
                  onChange={() => onChange(active ? value.filter((item) => item !== trait) : [...value, trait])}
                  className="rounded-[var(--nimi-radius-sm)] px-2 py-1.5 transition-colors hover:bg-[var(--nimi-surface-active)]"
                  label={<span title={t(PERSONA_TRAIT_DESCRIPTION_KEYS[trait])}>{label}</span>}
                />
              );
            })}
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--nimi-border-subtle)] px-3 py-1.5 text-xs text-[var(--nimi-text-muted)]">
          <span>{t('create.personaTraitsSelectedCount', { count: value.length, max: PERSONA_TRAIT_MAX })}</span>
          <Button tone="ghost" size="sm" disabled={value.length === 0} onClick={() => onChange([])}>
            {t('create.personaTraitsClear')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
