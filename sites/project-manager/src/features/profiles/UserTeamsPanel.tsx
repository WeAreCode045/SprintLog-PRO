import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AdminUserCompany, AdminUserMembership } from '../../appwrite/types';
import { IconTrash } from '../../components/icons';

interface UserTeamsPanelProps {
  memberships: AdminUserMembership[];
  /** Used to link a membership's team to its company detail page (Klantgegevens/Invoicing/Accounts tabs). */
  companies: AdminUserCompany[];
  onRevoke: (membership: AdminUserMembership) => void;
  isRevoking?: boolean;
}

export function UserTeamsPanel({
  memberships,
  companies,
  onRevoke,
  isRevoking = false,
}: UserTeamsPanelProps) {
  const { t } = useLingui();

  const companyIdByTeamId = useMemo(
    () => new Map(companies.map((company) => [company.teamId, company.companyId])),
    [companies],
  );

  return (
    <aside className="user-teams-panel">
      <h3><Trans>Bedrijven</Trans></h3>
      {memberships.length === 0 ? (
        <p className="empty-state"><Trans>Geen teamlidmaatschappen.</Trans></p>
      ) : (
        <ul>
          {memberships.map((membership) => {
            const companyId = companyIdByTeamId.get(membership.teamId);
            return (
              <li key={membership.membershipId} className="user-teams-panel-item">
                <div className="user-teams-panel-item-identity">
                  {companyId ? (
                    <Link className="user-teams-panel-item-name" to={`/app/manage/${companyId}`}>
                      {membership.teamName}
                    </Link>
                  ) : (
                    <span className="user-teams-panel-item-name">{membership.teamName}</span>
                  )}
                  {!membership.confirm && (
                    <span className="user-teams-panel-item-status">
                      <Trans>Uitnodiging verzonden</Trans>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="icon-button"
                  title={t`Uit team verwijderen`}
                  disabled={isRevoking}
                  onClick={() => onRevoke(membership)}
                >
                  <IconTrash />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
