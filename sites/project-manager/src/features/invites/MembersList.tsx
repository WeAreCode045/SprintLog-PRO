import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconTrash } from '../../components/icons';
import { useMembers, useRevokeMember } from './hooks';
import { InviteDialog } from './InviteDialog';

interface MembersListProps {
  teamId: string;
}

export function MembersList({ teamId }: MembersListProps) {
  const { t } = useLingui();
  const { data: members = [] } = useMembers(teamId);
  const revokeMember = useRevokeMember(teamId);
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="members-list">
      <div className="pane-header">
        <h3><Trans>Klanten</Trans></h3>
        <button type="button" className="btn-accent" onClick={() => setShowInvite(true)}>
          <Trans>+ Klant toevoegen</Trans>
        </button>
      </div>
      {members.length === 0 && <p className="empty-state"><Trans>Nog niemand uitgenodigd.</Trans></p>}
      <ul>
        {members.map((member) => (
          <li key={member.$id} className="member-item">
            <div className="member-identity">
              <span className="member-name">{member.userName || t`(geen naam)`}</span>
              <span className="member-email">{member.userEmail}</span>
            </div>
            <span className="member-role"><Trans>Klant</Trans></span>
            <span className="member-status">
              {member.confirm ? <Trans>Actief</Trans> : <Trans>Uitnodiging verzonden</Trans>}
            </span>
            <button
              type="button"
              className="icon-button"
              title={t`Toegang intrekken`}
              onClick={() => {
                if (confirm(t`Toegang voor ${member.userEmail} intrekken?`)) {
                  void revokeMember.mutateAsync(member.$id);
                }
              }}
            >
              <IconTrash />
            </button>
          </li>
        ))}
      </ul>
      {showInvite && <InviteDialog teamId={teamId} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
