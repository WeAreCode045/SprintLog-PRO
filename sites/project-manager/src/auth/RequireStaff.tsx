import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { useAuth } from './AuthContext';

/** Admin or developer — same UI rights until developer restrictions land. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { status, isAdmin, isDeveloper } = useAuth();

  if (status === 'loading') {
    return <div className="page-loading"><Trans>Laden…</Trans></div>;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin && !isDeveloper) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function isStaffRole(role: string | null | undefined) {
  return role === 'admin' || role === 'developer';
}
