export const ADMIN_LABEL = 'admin';
export const DEVELOPER_LABEL = 'developer';
export const TEAM_CLIENT_ROLE = 'client';

export async function assertCallerIsAdmin(users, req) {
  const callerId = req.headers['x-appwrite-user-id'];
  if (!callerId) {
    const err = new Error('Missing x-appwrite-user-id header');
    err.status = 401;
    throw err;
  }
  const caller = await users.get({ userId: callerId });
  const labels = caller.labels ?? [];
  if (!labels.includes(ADMIN_LABEL)) {
    const err = new Error('Caller is not an admin');
    err.status = 403;
    throw err;
  }
  return callerId;
}
