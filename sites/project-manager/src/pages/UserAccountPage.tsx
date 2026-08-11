import { Trans } from '@lingui/react/macro';
import { ProfileInformationForm } from '../components/ProfileInformationForm';
import { ChangePasswordForm } from '../components/ChangePasswordForm';

export function UserAccountPage() {
  return (
    <div className="account-settings-page" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1><Trans>Accountinstellingen</Trans></h1>

      <section className="profile-information" style={{ marginBottom: '2rem' }}>
        <h2><Trans>Profielgegevens</Trans></h2>
        <ProfileInformationForm />
      </section>

      <section className="change-password">
        <h2><Trans>Wachtwoord wijzigen</Trans></h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
