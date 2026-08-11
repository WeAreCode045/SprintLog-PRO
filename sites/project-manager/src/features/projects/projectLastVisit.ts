const STORAGE_PREFIX = 'projectLastVisit';

export function projectLastVisitKey(userId: string, projectId: string) {
  return `${STORAGE_PREFIX}:${userId}:${projectId}`;
}

export function getProjectLastVisit(userId: string, projectId: string): string | null {
  try {
    return localStorage.getItem(projectLastVisitKey(userId, projectId));
  } catch {
    return null;
  }
}

export function markProjectLastVisit(userId: string, projectId: string, at = new Date()) {
  try {
    localStorage.setItem(projectLastVisitKey(userId, projectId), at.toISOString());
  } catch {
    // ignore quota / private mode
  }
}

export function isAfterLastVisit(isoDate: string | null | undefined, lastVisitIso: string | null) {
  if (!isoDate) return false;
  if (!lastVisitIso) return true;
  return isoDate > lastVisitIso;
}
