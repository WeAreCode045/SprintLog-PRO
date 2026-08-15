import { createClients, parseBody } from './lib/appwrite.js';
import { assertCallerIsAdmin } from './lib/auth.js';
import { handleAssignDeveloper } from './handlers/assignDeveloper.js';

export default async ({ req, res, log, error }) => {
  const { tablesDB, users } = createClients(req);

  try {
    const callerId = await assertCallerIsAdmin(users, req);
    const body = parseBody(req);
    const payload = await handleAssignDeveloper({ body, callerId, tablesDB, log });
    return res.json(payload);
  } catch (err) {
    const status = err.status ?? 500;
    error(`projects failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
