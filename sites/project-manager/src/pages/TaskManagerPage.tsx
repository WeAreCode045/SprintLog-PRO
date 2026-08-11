import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { TaskList } from '../features/tasks/TaskList';
import type { PortalContext } from '../layouts/PortalLayout';

/** Company-wide tasks with developer, client, and requested tabs. */
export function TaskManagerPage() {
  const { role, enabledCompanyIds, companyById, isMultiCompany } =
    useOutletContext<PortalContext>();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <TaskList
      companyIds={enabledCompanyIds}
      companyById={companyById}
      isMultiCompany={isMultiCompany}
      userId={user.$id}
      role={role}
    />
  );
}
