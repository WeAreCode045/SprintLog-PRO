import { Client, Account } from 'node-appwrite';

export const ADMIN_LABEL = 'admin';
export const DEVELOPER_LABEL = 'developer';
export const TEAM_CLIENT_ROLE = 'client';

function requestHeader(req, name) {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function callerFromJwt(req) {
  const jwt = requestHeader(req, 'x-appwrite-user-jwt');
  if (!jwt) return null;

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setJWT(jwt);

  const account = new Account(client);
  return account.get();
}

export async function assertCallerIsAdmin(users, req) {
  if (requestHeader(req, 'x-appwrite-key') && !requestHeader(req, 'x-appwrite-user-id')) {
    return null;
  }

  try {
    const accountUser = await callerFromJwt(req);
    if (accountUser) {
      const labels = accountUser.labels ?? [];
      if (!labels.includes(ADMIN_LABEL)) {
        const err = new Error('Caller is not an admin');
        err.status = 403;
        throw err;
      }
      return accountUser.$id;
    }
  } catch (jwtErr) {
    if (jwtErr.status === 403) throw jwtErr;
    // Fall back to server Users API when JWT is missing or unreadable.
  }

  const callerId = requestHeader(req, 'x-appwrite-user-id');
  if (!callerId) {
    const err = new Error('Authentication required');
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
