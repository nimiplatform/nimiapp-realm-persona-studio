import { FieldShell, TextareaField } from '@nimiplatform/kit/ui';
import { useStudioI18n } from '../../../i18n/use-studio-i18n.js';
import type { CreateRealmPersonaDraftInput } from '../create-persona-draft.js';
import { translateCreateFlowFailure } from './create-flow-copy.js';
import type { CreateFieldErrors, CreateRealmPersonaDraftPatchInput } from './types.js';

export function BehaviorFields({ draft, fieldErrors, updateDraft }: {
  draft: CreateRealmPersonaDraftInput;
  fieldErrors: CreateFieldErrors;
  updateDraft: (patch: CreateRealmPersonaDraftPatchInput) => void;
}) {
  const { t } = useStudioI18n();
  return (
    <section className="ras-create-behavior-section" aria-labelledby="create-behavior-heading">
      <div>
        <h3 id="create-behavior-heading">{t('create.behavior.title')}</h3>
        <p>{t('create.behavior.description')}</p>
      </div>
      <div className="ras-create-behavior-grid">
        {(['ruleText', 'speechSupplement', 'boundarySupplement'] as const).map((field) => {
          const error = fieldErrors[field] ? translateCreateFlowFailure(fieldErrors[field], t) : null;
          const controlId = `create-${field}`;
          return (
            <div key={field} className={field === 'ruleText' ? 'ras-create-behavior-grid__rules' : 'min-w-0'} data-create-field={field}>
              <FieldShell
                label={<span>{t(`create.behavior.${field}.label`)} <span className="ras-create-required">{t('create.behavior.required')}</span></span>}
                message={error || t(`create.behavior.${field}.hint`)}
                messageTone={error ? 'danger' : 'neutral'}
              >
                <TextareaField
                  id={controlId}
                  required
                  aria-invalid={Boolean(error)}
                  data-create-field-control
                  tone={error ? 'danger' : 'default'}
                  rows={3}
                  value={draft[field] || ''}
                  placeholder={t(`create.behavior.${field}.placeholder`)}
                  onChange={(event) => updateDraft({ [field]: event.currentTarget.value })}
                />
              </FieldShell>
            </div>
          );
        })}
      </div>
    </section>
  );
}
