import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Query, type Models } from 'appwrite';
import { account, tablesDB, teams } from '../appwrite/client';
import { ADMIN_LABEL, DATABASE_ID, DEVELOPER_LABEL, TABLES } from '../appwrite/constants';
import type {
  AccessibleCompany,
  AccessibleProject,
  CompanyRow,
  ProjectAssignmentRow,
  ResolvedRole,
  TeamMemberRole,
} from '../appwrite/types';

interface AuthState {
  status: 'loading' | 'unauthenticated' | 'authenticated';
  user: Models.User<Models.Preferences> | null;
  isAdmin: boolean;
  isDeveloper: boolean;
  role: ResolvedRole | null;
  companies: AccessibleCompany[];
  assignedProjects: AccessibleProject[];
}

interface AuthContextValue extends AuthState {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const initialState: AuthState = {
  status: 'loading',
  user: null,
  isAdmin: false,
  isDeveloper: false,
  role: null,
  companies: [],
  assignedProjects: [],
};

async function listAssignedProjects(userId: string): Promise<AccessibleProject[]> {
  const result = await tablesDB.listRows<ProjectAssignmentRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.projectAssignments,
    queries: [Query.equal('userId', userId), Query.limit(500)],
  });
  return result.rows.map((row) => ({
    companyId: row.companyId,
    projectId: row.projectId,
  }));
}

async function resolveClientCompanies(): Promise<AccessibleCompany[]> {
  // teams.list() only returns teams the session user belongs to — sufficient for portal access.
  // Do not re-scan listMemberships and match userId: membership privacy can hide userId and
  // orphan memberships (userId "") never appear here anyway.
  const myTeams = await teams.list();
  if (myTeams.teams.length === 0) {
    return [];
  }

  const teamIds = myTeams.teams.map((team) => team.$id);
  const companyRows = await tablesDB.listRows<CompanyRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    queries: [Query.equal('teamId', teamIds), Query.limit(100)],
  });

  return companyRows.rows.map((company) => {
    const role: TeamMemberRole = 'client';
    return { companyId: company.$id, teamId: company.teamId, role };
  });
}

async function resolveAccess(user: Models.User<Models.Preferences>): Promise<Omit<AuthState, 'status' | 'user'>> {
  const labels = user.labels ?? [];
  const isAdmin = labels.includes(ADMIN_LABEL);
  const isDeveloper = isAdmin || labels.includes(DEVELOPER_LABEL);

  if (isAdmin) {
    return {
      isAdmin: true,
      isDeveloper: true,
      role: 'admin',
      companies: [],
      assignedProjects: [],
    };
  }

  if (isDeveloper) {
    const assignedProjects = await listAssignedProjects(user.$id);
    return {
      isAdmin: false,
      isDeveloper: true,
      role: 'developer',
      companies: [],
      assignedProjects,
    };
  }

  const companies = await resolveClientCompanies();
  return {
    isAdmin: false,
    isDeveloper: false,
    role: companies.length > 0 ? 'client' : null,
    companies,
    assignedProjects: [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading' }));
    try {
      const user = await account.get();
      const access = await resolveAccess(user);
      setState({ status: 'authenticated', user, ...access });
    } catch {
      setState({ ...initialState, status: 'unauthenticated' });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await account.deleteSession({ sessionId: 'current' });
    } finally {
      setState({ ...initialState, status: 'unauthenticated' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ ...state, refresh, logout }), [state, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
