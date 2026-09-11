import { useId } from 'react';
import { FieldShell, TextareaField } from '@nimiplatform/kit/ui';
import { Compass, HeartHandshake, MessageCircle, Shield } from 'lucide-react';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import {
  CHARACTER_WRITING_LIMITS,
  characterWritingIssues,
  type CharacterWriting,
  type CharacterWritingField,
} from '../portfolio/persona-character-authoring.js';

const ICONS = {
  characterIdentity: Compass,
  behaviorText: HeartHandshake,
  speakingText: MessageCircle,
  boundariesText: Shield,
};

export function CharacterWritingFields({
  value,
  onChange,
  showErrors = false,
  includeIdentity = true,
}: {
  value: CharacterWriting;
  onChange: (patch: Partial<CharacterWriting>) => void;
  showErrors?: boolean;
  includeIdentity?: boolean;
}) {
  const { t } = useStudioI18n();
  const id = useId();
  const issues = characterWritingIssues(value);
  return (
    <div className="ras-character-writing">
      {(Object.keys(CHARACTER_WRITING_LIMITS) as CharacterWritingField[])
        .filter((key) => includeIdentity || key !== 'characterIdentity')
        .map((key) => {
          const limits = CHARACTER_WRITING_LIMITS[key];
          const invalid = issues.includes(key) && (showErrors || Boolean(value[key]));
          const Icon = ICONS[key];
          return (
            <div key={key} className="ras-character-writing__field">
              <FieldShell
                label={
                  <label htmlFor={`${id}-${key}`}>
                    <Icon size={16} aria-hidden="true" />
                    {t(`workshop.character.${key}`)}
                  </label>
                }
                message={
                  invalid
                    ? t('workshop.writing.invalid')
                    : key === 'characterIdentity'
                      ? t('workshop.character.identityHint')
                      : t('workshop.character.rowsHint', limits)
                }
                messageTone={invalid ? 'danger' : 'neutral'}
              >
                <TextareaField
                  id={`${id}-${key}`}
                  rows={key === 'characterIdentity' ? 3 : 4}
                  value={value[key]}
                  aria-invalid={invalid || undefined}
                  tone={invalid ? 'danger' : 'default'}
                  placeholder={t(`workshop.character.${key}Placeholder`)}
                  onChange={(event) => onChange({ [key]: event.currentTarget.value })}
                />
              </FieldShell>
            </div>
          );
        })}
    </div>
  );
}
