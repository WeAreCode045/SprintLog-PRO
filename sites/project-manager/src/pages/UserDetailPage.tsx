import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import { EditUserForm } from '../features/profiles/EditUserForm';
import { useAdminUser } from '../features/profiles/hooks';

export function UserDetailPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { data: user, isLoading } = useAdminUser(userId, Boolean(userId));

  if (!userId) {
    return <Navigate to="/clients/users" replace />;
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={isLoading ? t`Gebruiker` : (user?.displayName ?? t`Gebruiker`)}
          description={user?.email}
          breadcrumb={
            <PageBreadcrumb
              items={[
                { label: t`Dashboard`, to: '/app/dashboard' },
                { label: t`Gebruikers`, to: '/clients/users' },
                { label: user?.displayName ?? t`Gebruiker` },
              ]}
            />
          }
        />

        {isLoading && !user ? (
          <p><Trans>Laden…</Trans></p>
        ) : !user ? (
          <>
            <p className="form-error"><Trans>Gebruiker niet gevonden.</Trans></p>
            <Link to="/clients/users" className="btn-link">
              <Trans>← Terug naar gebruikers</Trans>
            </Link>
          </>
        ) : (
          <EditUserForm
            userId={userId}
            onCancel={() => navigate('/clients/users')}
            onDeleted={() => navigate('/clients/users')}
          />
        )}
      </div>
    </div>
  );
}
