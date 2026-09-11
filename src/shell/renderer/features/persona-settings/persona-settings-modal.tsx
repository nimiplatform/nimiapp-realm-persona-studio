import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ConfirmDialog, DialogTitle, InlineAlert, OverlayShell } from '@nimiplatform/kit/ui';
import { deleteOwnerPortfolioPersona } from '@renderer/features/portfolio/portfolio-client.js';
import { failureKindCopyKey } from '@renderer/features/portfolio/failure-copy.js';
import { removeDeletedOwnerPersonaReads } from '@renderer/features/persona-detail/use-persona-detail-query.js';
import { useStudioI18n } from '@renderer/i18n/use-studio-i18n.js';
import type { OwnerPortfolioPersonaDetail } from '@renderer/features/portfolio/portfolio-data.js';
import { PersonaSettingsForm } from '@renderer/features/portfolio/OwnerPortfolio.settings.js';

/**
 * Settings editor dialog opened from the entry points inside the persona
 * workspace frame (hero edit action, overview edit-profile action). Hosts the
 * editable public-profile form without a dialog header, so the profile
 * section is the first thing the owner sees; the settings tab itself stays a
 * read-only overview. Closing with unsaved changes asks before discarding.
 */
export function PersonaSettingsModal({
  persona,
  open,
  onClose,
  onPersonaWrite,
}: {
  persona: OwnerPortfolioPersonaDetail;
  open: boolean;
  onClose: () => void;
  onPersonaWrite: () => Promise<void>;
}) {
  const { t } = useStudioI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailure, setDeleteFailure] = useState<string | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const canDelete = persona.ownerScope === 'owner-created'
    && persona.visibility.status === 'available' && persona.visibility.value === 'private';

  function requestClose() {
    if (deleting) return;
    if (formDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  }

  async function deletePersona() {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setDeleteFailure(null);
    try {
      const result = await deleteOwnerPortfolioPersona(persona.id);
      if (!result.ok) {
        setDeleteFailure(result.failure);
        setConfirmOpen(false);
        return;
      }
      await removeDeletedOwnerPersonaReads(queryClient, persona.id);
      navigate('/portfolio', { replace: true });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <OverlayShell
        open={open}
        kind="dialog"
        size="md"
        onClose={requestClose}
        panelClassName="ras-settings-dialog"
        contentClassName="ras-settings-dialog__content"
        data-testid="persona-settings-dialog"
      >
        <DialogTitle className="sr-only">{t('settings.section.profile')}</DialogTitle>
        <PersonaSettingsForm persona={persona} onPersonaWrite={onPersonaWrite} onDirtyChange={setFormDirty} />
        {deleteFailure ? (
          <InlineAlert tone="danger">
            {t('persona.failure.sanitized', { reason: t(failureKindCopyKey(deleteFailure)) })}
          </InlineAlert>
        ) : null}
        {canDelete ? (
          <Button tone="danger" disabled={deleting} onClick={() => setConfirmOpen(true)}>
            {t('persona.delete.action')}
          </Button>
        ) : null}
      </OverlayShell>
      <ConfirmDialog
        open={confirmOpen}
        title={t('persona.delete.confirmTitle')}
        message={t('persona.delete.confirmDescription', { name: persona.displayName.value })}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        confirmTone="danger"
        loading={deleting}
        onConfirm={() => void deletePersona()}
        onClose={() => { if (!deleting) setConfirmOpen(false); }}
      />
      <ConfirmDialog
        open={discardConfirmOpen}
        title={t('persona.settings.discardTitle')}
        message={t('persona.settings.discardDescription')}
        confirmLabel={t('persona.settings.discardConfirm')}
        cancelLabel={t('common.cancel')}
        confirmTone="danger"
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          setFormDirty(false);
          onClose();
        }}
        onClose={() => setDiscardConfirmOpen(false)}
      />
    </>
  );
}
