import { Navigate } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { useAuth } from '../auth/AuthContext';
import type { ResolvedRole } from '../appwrite/types';

export function HomeRedirect() {
  const { status, isAdmin, isDeveloper, role, companies, assignedProjects } = useAuth();

  if (status === 'loading') {
    return <div className="page-loading"><Trans>Laden…</Trans></div>;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  const resolvedRole: ResolvedRole | null = isAdmin
    ? 'admin'
    : isDeveloper
      ? 'developer'
      : role === 'client'
        ? 'client'
        : role;

  switch (resolvedRole) {
    case 'admin':
    case 'developer':
      return <Navigate to="/app/dashboard" replace />;
    case 'client': {
      if (companies.length > 0) {
        return <Navigate to="/app/dashboard" replace />;
      }
      return <div className="page"><Trans>Je account heeft nog geen toegang tot een klant.</Trans></div>;
    }
    case null: {
      if (assignedProjects.length > 0 || companies.length > 0) {
        return <Navigate to="/app/dashboard" replace />;
      }
      return <div className="page"><Trans>Je account heeft nog geen toegang tot een klant.</Trans></div>;
    }
    default: {
      const _exhaustive: never = resolvedRole;
      return _exhaustive;
    }
  }
}
