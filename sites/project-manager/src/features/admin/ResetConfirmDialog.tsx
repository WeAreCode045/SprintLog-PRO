import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import type { AdminDataResetPreviewItem } from './api';

function previewKindLabel(
  kind: AdminDataResetPreviewItem['kind'],
  t: ReturnType<typeof useLingui>['t'],
) {
  switch (kind) {
    case 'invoices':
      return t`Facturen`;
    case 'invoiceItems':
      return t`Factuurlijnen`;
    case 'invoicedEntriesReleased':
      return t`Gefactureerde uren (vrijgegeven)`;
    case 'approvedEntries':
      return t`Goedgekeurde uren`;
    case 'timeEntries':
      return t`Geboekte uren`;
    case 'tasks':
      return t`Taken`;
    case 'projects':
      return t`Projecten`;
    case 'taskGroups':
      return t`Taakgroepen`;
    case 'discussions':
      return t`Discussies`;
    case 'discussionReplies':
      return t`Discussie-reacties`;
    case 'projectAssignments':
      return t`Projecttoewijzingen`;
    case 'notifications':
      return t`Notificaties`;
    case 'projectFiles':
      return t`Projectbestanden`;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

interface ResetConfirmDialogProps {
  title: string;
  companyName: string;
  projectName?: string;
  items: AdminDataResetPreviewItem[];
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResetConfirmDialog({
  title,
  companyName,
  projectName,
  items,
  isPending,
  onClose,
  onConfirm,
}: ResetConfirmDialogProps) {
  const { t } = useLingui();
  const previewItems = items ?? [];
  const totalAffected = previewItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="admin-reset-confirm">
        <p className="admin-reset-confirm-scope">
          <Trans>Bedrijf:</Trans> <strong>{companyName}</strong>
          {projectName ? (
            <>
              {' · '}
              <Trans>Project:</Trans> <strong>{projectName}</strong>
            </>
          ) : (
            <>
              {' · '}
              <Trans>Alle projecten</Trans>
            </>
          )}
        </p>

        {previewItems.length === 0 ? (
          <p className="empty-state"><Trans>Geen data gevonden voor dit filter.</Trans></p>
        ) : (
          <>
            <p className="admin-reset-confirm-intro">
              <Trans>De volgende data wordt gewijzigd of verwijderd:</Trans>
            </p>
            <ul className="admin-reset-preview-list">
              {previewItems.map((item) => (
                <li key={item.kind}>
                  <span>{previewKindLabel(item.kind, t)}</span>
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
            <p className="admin-reset-confirm-total">
              <Trans>Totaal betrokken records:</Trans> <strong>{totalAffected}</strong>
            </p>
          </>
        )}

        <div className="form-actions admin-reset-confirm-actions">
          <button type="button" onClick={onClose} disabled={isPending}>
            <Trans>Annuleren</Trans>
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={isPending || previewItems.length === 0}
            onClick={onConfirm}
          >
            {isPending ? <Trans>Bezig…</Trans> : <Trans>Definitief verwijderen</Trans>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
