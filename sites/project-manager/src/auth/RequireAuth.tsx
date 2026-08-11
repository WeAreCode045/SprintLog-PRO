import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return <div className="page-loading"><Trans>Laden…</Trans></div>;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
