import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Send } from 'lucide-react';
import { IconTrash } from '../../components/icons';
import { useMembers, useResendInvite, useRevokeMember } from './hooks';
import { InviteDialog } from './InviteDialog';

interface MembersListProps {
  teamId: string;
  /** Staff can revoke access; clients viewing their own company's accounts can only add. */
  canRevoke?: boolean;
  /** Clients may only invite by email, not set a password directly for someone else. */
  allowDirectAdd?: boolean;
}

export function MembersList({ teamId, canRevoke = true, allowDirectAdd = true }: MembersListProps) {
  const { t } = useLingui();
  const { data: members = [] } = useMembers(teamId);
  const revokeMember = useRevokeMember(teamId);
  const resendInvite = useResendInvite(teamId);
  const [showInvite, setShowInvite] = useState(false);
  const [resentEmail, setResentEmail] = useState<string | null>(null);

  async function handleResend(membershipId: string, email: string) {
    setResentEmail(null);
    await resendInvite.mutateAsync({ membershipId, email });
    setResentEmail(email);
    window.setTimeout(() => setResentEmail((current) => (current === email ? null : current)), 3000);
  }

  return (
    <div className="members-list">
      <div className="pane-header">
        <h3><Trans>Gebruikers</Trans></h3>
        <button type="button" className="btn-accent" onClick={() => setShowInvite(true)}>
          <Trans>+ Gebruiker toevoegen</Trans>
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
            {!member.confirm && (
              <button
                type="button"
                className="icon-button"
                title={t`Uitnodiging opnieuw versturen`}
                disabled={resendInvite.isPending}
                onClick={() => void handleResend(member.$id, member.userEmail)}
              >
                <Send size={14} />
              </button>
            )}
            {!member.confirm && resentEmail === member.userEmail && (
              <span className="save-confirmation"><Trans>Opnieuw verstuurd</Trans></span>
            )}
            {canRevoke && (
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
            )}
          </li>
        ))}
      </ul>
      {showInvite && (
        <InviteDialog
          teamId={teamId}
          onClose={() => setShowInvite(false)}
          allowDirectAdd={allowDirectAdd}
        />
      )}
    </div>
  );
}
