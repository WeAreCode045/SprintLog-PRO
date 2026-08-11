rows only and keimport { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AdminUser, GlobalRole } from '../appwrite/types';
import { IconEdit, IconTrash } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import { EditUserDialog } from '../features/profiles/EditUserDialog';
import { NewUserDialog } from '../features/profiles/NewUserDialog';
import { useAdminUsers, useDeleteAdminUser } from '../features/profiles/hooks';

export function UsersAdminPage() {
  const { t } = useLingui();
  const ROLE_LABELS: Record<GlobalRole, string> = {
    admin: t`Admin`,
    developer: t`Developer`,
    client: t`Klant`,
  };
  const { data: users = [], isLoading, error: loadError } = useAdminUsers(true);
  const deleteAdminUser = useDeleteAdminUser();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(user: AdminUser) {
    const label = user.displayName || user.email || user.userId;
    if (!confirm(t`Gebruiker “${label}” permanent verwijderen?`)) return;
    setError(null);
    try {
      await deleteAdminUser.mutateAsync(user.userId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t`Verwijderen mislukt`);
    }
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Gebruikers</Trans>}
          description={<Trans>Beheer alle accounts: rol, naam, e-mail en bij klanten de gekoppelde bedrijven.</Trans>}
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Gebruikers` }]}
            />
          }
        />

        {(error || loadError) && (
          <p className="form-error">
            {error || (loadError instanceof Error ? loadError.message : t`Laden mislukt`)}
          </p>
        )}

        <div className="pane-header">
          <h2><Trans>Alle accounts</Trans></h2>
          <button
            type="button"
            className="btn-accent"
            onClick={() => setShowNewUser(true)}
          >
            <Trans>+ Gebruiker toevoegen</Trans>
          </button>
        </div>

        {isLoading && <p><Trans>Laden…</Trans></p>}
        {!isLoading && users.length === 0 && !loadError && (
          <p className="empty-state"><Trans>Nog geen gebruikers.</Trans></p>
        )}

        {!isLoading && users.length > 0 && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="data-table-col-wide"><Trans>Naam</Trans></th>
                  <th><Trans>E-mail</Trans></th>
                  <th><Trans>Rol</Trans></th>
                  <th><Trans>Bedrijven</Trans></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.userId}>
                    <td>{user.displayName}</td>
                    <td className="data-table-muted">{user.email}</td>
                    <td>{ROLE_LABELS[user.role]}</td>
                    <td className="data-table-muted">
                      {user.companies.length > 0
                        ? user.companies.map((c) => c.name).join(', ')
                        : '—'}
                      <div className="data-table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          title={t`Bewerken`}
                          onClick={() => setEditingUser(user)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title={t`Verwijderen`}
                          disabled={deleteAdminUser.isPending}
                          onClick={() => void handleDelete(user)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingUser && (
        <EditUserDialog user={editingUser} onClose={() => setEditingUser(null)} />
      )}
      {showNewUser && (
        <NewUserDialog onClose={() => setShowNewUser(false)} />
      )}
    </div>
  );
}
