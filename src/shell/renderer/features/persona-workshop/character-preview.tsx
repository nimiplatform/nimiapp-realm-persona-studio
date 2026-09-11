import { Quote, UserRound } from 'lucide-react';
import { StatusBadge } from '@nimiplatform/kit/ui';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';

// @nimi-authority: rule.realm-persona-studio.persona.r013
export function CharacterPreview({
  displayName,
  handle,
  description,
  greeting,
  identity,
  imageUrl,
  traits = [],
}: {
  displayName: string;
  handle?: string;
  description: string;
  greeting: string;
  identity?: string;
  imageUrl?: string | null;
  traits?: string[];
}) {
  const { t } = useStudioI18n();
  return (
    <aside className="ras-character-preview" aria-label={t('workshop.preview.title')}>
      <div className="ras-character-preview__heading">
        <span>{t('workshop.preview.title')}</span>
        <StatusBadge tone="neutral">{t('workshop.preview.badge')}</StatusBadge>
      </div>
      <div className="ras-character-preview__portrait">
        {imageUrl ? (
          <img src={imageUrl} alt="" />
        ) : (
          <UserRound size={38} strokeWidth={1.1} aria-hidden="true" />
        )}
      </div>
      <div className="ras-character-preview__body">
        <h2 data-empty={!displayName || undefined}>{displayName || t('workshop.preview.name')}</h2>
        {handle ? (
          <p className="ras-character-preview__handle">@{handle.replace(/^@/, '')}</p>
        ) : null}
        {traits.length ? (
          <div className="ras-character-preview__traits">
            {traits.map((trait) => (
              <span key={trait}>{trait}</span>
            ))}
          </div>
        ) : null}
        <p className="ras-character-preview__bio" data-empty={!description || undefined}>
          {description || t('workshop.preview.description')}
        </p>
        <div className="ras-character-preview__greeting">
          <span className="ras-character-preview__label">
            <Quote size={14} aria-hidden="true" />
            {t('workshop.preview.greeting')}
          </span>
          <blockquote data-empty={!greeting || undefined}>
            {greeting || t('workshop.preview.greetingEmpty')}
          </blockquote>
        </div>
        {identity ? (
          <div className="ras-character-preview__identity">
            <span className="ras-character-preview__label">{t('workshop.preview.character')}</span>
            <p>{identity}</p>
          </div>
        ) : null}
      </div>
      <p className="ras-character-preview__note">{t('workshop.preview.note')}</p>
    </aside>
  );
}
