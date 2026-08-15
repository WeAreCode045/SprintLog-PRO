import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AdminUser, GlobalRole } from '../appwrite/types';
import { IconTrash } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import { NewUserDialog } from '../features/profiles/NewUserDialog';
import { useAdminUsers, useDeleteAdminUser } from '../features/profiles/hooks';

type UserTab = 'staff' | 'clients';

function isStaffUser(user: AdminUser) {
  return user.role === 'admin' || user.role === 'developer';
}

function formatLastLogin(lastLoginAt: string | null | undefined) {
  return lastLoginAt ? dayjs(lastLoginAt).format('D MMM YYYY HH:mm') : null;
}

export function UsersAdminPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const ROLE_LABELS: Record<GlobalRole, string> = {
    admin: t`Admin`,
    developer: t`Developer`,
    client: t`Klant`,
  };
  const { data: users = [], isLoading, error: loadError } = useAdminUsers(true);
  const deleteAdminUser = useDeleteAdminUser();
  const [tab, setTab] = useState<UserTab>('staff');
  const [showNewUser, setShowNewUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffUsers = useMemo(() => users.filter(isStaffUser), [users]);
  const clientUsers = useMemo(() => users.filter((user) => user.role === 'client'), [users]);
  const visibleUsers = tab === 'staff' ? staffUsers : clientUsers;

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
          description={<Trans>Beheer accounts: rol, naam, e-mail en bij klanten de gekoppelde bedrijven.</Trans>}
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Gebruikers` }]}
            />
          }
          tabs={
            <div className="task-view-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'staff'}
                className={`task-view-tab${tab === 'staff' ? ' active' : ''}`}
                onClick={() => setTab('staff')}
              >
                <span><Trans>Beheer & developers</Trans></span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'clients'}
                className={`task-view-tab${tab === 'clients' ? ' active' : ''}`}
                onClick={() => setTab('clients')}
              >
                <span><Trans>Klantaccounts</Trans></span>
              </button>
            </div>
          }
        />

        {(error || loadError) && (
          <p className="form-error">
            {error || (loadError instanceof Error ? loadError.message : t`Laden mislukt`)}
          </p>
        )}

        <div className="pane-header">
          <h2>
            {tab === 'staff' ? <Trans>Beheer & developers</Trans> : <Trans>Klantaccounts</Trans>}
          </h2>
          <button
            type="button"
            className="btn-accent"
            onClick={() => setShowNewUser(true)}
          >
            <Trans>+ Gebruiker toevoegen</Trans>
          </button>
        </div>

        <div className="tab-panel-body">
          {isLoading && <p><Trans>Laden…</Trans></p>}
          {!isLoading && visibleUsers.length === 0 && !loadError && (
            <p className="empty-state">
              {tab === 'staff' ? (
                <Trans>Nog geen beheerders of developers.</Trans>
              ) : (
                <Trans>Nog geen klantaccounts.</Trans>
              )}
            </p>
          )}

          {!isLoading && visibleUsers.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="data-table-col-wide"><Trans>Naam</Trans></th>
                    <th><Trans>E-mail</Trans></th>
                    {tab === 'staff' ? (
                      <th><Trans>Rol</Trans></th>
                    ) : (
                      <th><Trans>Bedrijven</Trans></th>
                    )}
                    <th><Trans>Status</Trans></th>
                    <th><Trans>Laatste login</Trans></th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => {
                    const lastLogin = formatLastLogin(user.lastLoginAt);
                    return (
                      <tr key={user.userId}>
                        <td>
                          <button
                            type="button"
                            className="data-table-title-button"
                            onClick={() => navigate(`/clients/users/${user.userId}`)}
                          >
                            {user.displayName}
                          </button>
                        </td>
                        <td className="data-table-muted">{user.email}</td>
                        {tab === 'staff' ? (
                          <td>{ROLE_LABELS[user.role]}</td>
                        ) : (
                          <td className="data-table-muted">
                            {user.companies.length > 0
                              ? user.companies.map((c) => c.name).join(', ')
                              : '—'}
                          </td>
                        )}
                        <td>
                          <span
                            className={`badge badge-status--${user.status === false ? 'archived' : 'active'}`}
                          >
                            {user.status === false ? <Trans>Geblokkeerd</Trans> : <Trans>Actief</Trans>}
                          </span>
                        </td>
                        <td className="data-table-muted">
                          {lastLogin ?? <Trans>Nog nooit ingelogd</Trans>}
                        </td>
                        <td>
                          <div className="data-table-actions">
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showNewUser && (
        <NewUserDialog onClose={() => setShowNewUser(false)} />
      )}
    </div>
  );
}
