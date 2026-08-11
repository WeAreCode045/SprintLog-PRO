import { Navigate, useLocation, useParams } from 'react-router-dom';

/** Map legacy `/w/:companyId/...` URLs onto `/app/...`. */
export function WorkspaceLegacyRedirect() {
  const { companyId } = useParams<{ companyId: string }>();
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  // ["w", companyId, ...rest]
  const rest = segments.slice(2);
  const target = rest.length > 0 ? `/app/${rest.join('/')}` : '/app/dashboard';
  void companyId;
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}
