import { useMemo, useState, type FormEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useDeveloperProfiles } from '../profiles/hooks';
import { useAssignDeveloper, useProjectAssignments, useUnassignDeveloper } from './hooks';

interface ProjectAssignmentsPanelProps {
  companyId: string;
  projectId: string;
  teamId: string;
}

export function ProjectAssignmentsPanel({ companyId, projectId, teamId }: ProjectAssignmentsPanelProps) {
  const { t } = useLingui();
  const { data: assignments = [], isLoading: assignmentsLoading } = useProjectAssignments(projectId);
  const { data: developers = [], isLoading: developersLoading } = useDeveloperProfiles(true);
  const assignDeveloper = useAssignDeveloper(projectId);
  const unassignDeveloper = useUnassignDeveloper(projectId);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const assignedUserIds = useMemo(() => new Set(assignments.map((row) => row.userId)), [assignments]);

  const availableDevelopers = useMemo(
    () => developers.filter((profile) => !assignedUserIds.has(profile.userId)),
    [developers, assignedUserIds],
  );

  const profileByUserId = useMemo(
    () => new Map(developers.map((profile) => [profile.userId, profile])),
    [developers],
  );

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    if (!selectedUserId) return;
    setError(null);
    try {
      await assignDeveloper.mutateAsync({
        companyId,
        projectId,
        userId: selectedUserId,
        teamId,
      });
      setSelectedUserId('');
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : t`Toewijzen mislukt`);
    }
  }

  async function handleUnassign(userId: string) {
    setError(null);
    try {
      await unassignDeveloper.mutateAsync({
        companyId,
        projectId,
        userId,
        teamId,
      });
    } catch (unassignError) {
      setError(unassignError instanceof Error ? unassignError.message : t`Ontkoppelen mislukt`);
    }
  }

  if (assignmentsLoading || developersLoading) {
    return <p><Trans>Laden…</Trans></p>;
  }

  return (
    <div className="project-assignments-panel">
      <div className="pane-header">
        <h2><Trans>Developers toewijzen</Trans></h2>
      </div>

      <form className="form form-inline" onSubmit={(event) => void handleAssign(event)}>
        <select
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          required
        >
          <option value="">{t`Kies developer…`}</option>
          {availableDevelopers.map((profile) => (
            <option key={profile.userId} value={profile.userId}>
              {profile.displayName} ({profile.email})
            </option>
          ))}
        </select>
        <button type="submit" className="btn-accent" disabled={!selectedUserId || assignDeveloper.isPending}>
          <Trans>Toewijzen</Trans>
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {assignments.length === 0 ? (
        <p className="empty-state"><Trans>Nog geen developers toegewezen.</Trans></p>
      ) : (
        <ul className="members-list">
          {assignments.map((assignment) => {
            const profile = profileByUserId.get(assignment.userId);
            return (
              <li key={assignment.$id} className="member-item">
                <div className="member-identity">
                  <span className="member-name">{profile?.displayName ?? assignment.userId}</span>
                  <span className="member-email">{profile?.email ?? ''}</span>
                </div>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => void handleUnassign(assignment.userId)}
                  disabled={unassignDeveloper.isPending}
                >
                  <Trans>Ontkoppelen</Trans>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
