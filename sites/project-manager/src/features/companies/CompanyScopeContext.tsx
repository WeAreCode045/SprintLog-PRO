import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../auth/AuthContext';
import type { CompanyRow, ResolvedRole } from '../../appwrite/types';
import { useAllCompanies, useCompaniesByIds } from './hooks';

export interface PortalContext {
  role: ResolvedRole;
  isStaff: boolean;
  availableCompanies: CompanyRow[];
  enabledCompanyIds: string[];
  isMultiCompany: boolean;
  companyById: (id: string) => CompanyRow | undefined;
  setCompanyEnabled: (companyId: string, enabled: boolean) => void;
  setEnabledCompanyIds: (companyIds: string[]) => void;
  scopeReady: boolean;
}

const CompanyScopeContext = createContext<PortalContext | undefined>(undefined);

function storageKey(userId: string) {
  return `tt.enabledCompanies.${userId}`;
}

function readStoredIds(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return null;
  }
}

function writeStoredIds(userId: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function resolveRole(isAdmin: boolean, isDeveloper: boolean): ResolvedRole {
  if (isAdmin) return 'admin';
  if (isDeveloper) return 'developer';
  return 'client';
}

export function CompanyScopeProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, isDeveloper, companies: myAccess } = useAuth();
  const isStaff = isAdmin || isDeveloper;
  const role = resolveRole(isAdmin, isDeveloper);

  const { data: allCompanies = [], isLoading: allLoading } = useAllCompanies(isStaff);
  const clientIds = useMemo(
    () => myAccess.map((access) => access.companyId).filter((id, index, all) => all.indexOf(id) === index),
    [myAccess],
  );
  const { data: clientCompanies = [], isLoading: clientLoading } = useCompaniesByIds(
    isStaff ? [] : clientIds,
  );

  const availableCompanies = isStaff ? allCompanies : clientCompanies;
  const availableIds = useMemo(
    () => availableCompanies.map((company) => company.$id),
    [availableCompanies],
  );
  const scopeReady = Boolean(user) && !(isStaff ? allLoading : clientLoading);

  const [enabledCompanyIds, setEnabledState] = useState<string[]>([]);

  useEffect(() => {
    if (!user || availableIds.length === 0) {
      setEnabledState([]);
      return;
    }
    const stored = readStoredIds(user.$id);
    if (!stored || stored.length === 0) {
      setEnabledState(availableIds);
      return;
    }
    const valid = stored.filter((id) => availableIds.includes(id));
    setEnabledState(valid.length > 0 ? valid : availableIds);
  }, [user, availableIds]);

  const setEnabledCompanyIds = useCallback(
    (companyIds: string[]) => {
      if (!user) return;
      const next = companyIds.filter((id) => availableIds.includes(id));
      if (next.length === 0) return;
      setEnabledState(next);
      writeStoredIds(user.$id, next);
    },
    [user, availableIds],
  );

  const setCompanyEnabled = useCallback(
    (companyId: string, enabled: boolean) => {
      if (!availableIds.includes(companyId)) return;
      setEnabledCompanyIds(
        enabled
          ? [...new Set([...enabledCompanyIds, companyId])]
          : enabledCompanyIds.filter((id) => id !== companyId),
      );
    },
    [availableIds, enabledCompanyIds, setEnabledCompanyIds],
  );

  const companyMap = useMemo(
    () => new Map(availableCompanies.map((company) => [company.$id, company])),
    [availableCompanies],
  );

  const companyById = useCallback(
    (id: string) => companyMap.get(id),
    [companyMap],
  );

  const value = useMemo<PortalContext>(
    () => ({
      role,
      isStaff,
      availableCompanies,
      enabledCompanyIds,
      isMultiCompany: availableCompanies.length > 1,
      companyById,
      setCompanyEnabled,
      setEnabledCompanyIds,
      scopeReady,
    }),
    [
      role,
      isStaff,
      availableCompanies,
      enabledCompanyIds,
      companyById,
      setCompanyEnabled,
      setEnabledCompanyIds,
      scopeReady,
    ],
  );

  return <CompanyScopeContext.Provider value={value}>{children}</CompanyScopeContext.Provider>;
}

export function useCompanyScope() {
  const ctx = useContext(CompanyScopeContext);
  if (!ctx) {
    throw new Error('useCompanyScope must be used within CompanyScopeProvider');
  }
  return ctx;
}
