import { Permission, Role } from 'node-appwrite';
import { createClients, parseBody, DATABASE_ID } from './lib/appwrite.js';
import { assertCallerIsAdmin, ADMIN_LABEL } from './lib/auth.js';
import { handleCascadeDelete } from './handlers/cascadeDelete.js';
import { handleAddTeamClient } from './handlers/addTeamClient.js';
import { handleDataReset } from './handlers/dataReset.js';

const COMPANY_DELETE_EVENT = 'databases.main.tables.companies.rows.';
const FUNCTION_RESULTS_TABLE = 'functionResults';

/**
 * Appwrite's GET /executions/{id} (used by the client's async-execution poll) never returns
 * responseBody, and synchronous execution stalls ~30s on this project. The client instead reads
 * the payload from here directly once execution status confirms success. See functions/users for
 * the original writeup of this issue.
 */
async function persistResult(tablesDB, requestId, callerId, payload) {
  if (!requestId) return;
  const permissions = callerId
    ? [Permission.read(Role.user(callerId)), Permission.delete(Role.user(callerId))]
    : [Permission.read(Role.label(ADMIN_LABEL)), Permission.delete(Role.label(ADMIN_LABEL))];
  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: FUNCTION_RESULTS_TABLE,
    rowId: requestId,
    data: { data: JSON.stringify(payload) },
    permissions,
  });
}

export default async ({ req, res, log, error }) => {
  const { tablesDB, users, teams, storage } = createClients(req);

  try {
    const eventHeader = req.headers['x-appwrite-event'] || '';
    if (eventHeader.includes(COMPANY_DELETE_EVENT) && eventHeader.endsWith('.delete')) {
      const payload = await handleCascadeDelete({ req, tablesDB, teams, storage, log, error });
      return res.json(payload, payload.status ?? 200);
    }

    const callerId = await assertCallerIsAdmin(users, req);
    const body = parseBody(req);
    const action = body.action ?? 'addTeamClient';
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() || null : null;

    async function respond(payload, status) {
      await persistResult(tablesDB, requestId, callerId, payload);
      return res.json(payload, status);
    }

    switch (action) {
      case 'addTeamClient': {
        const payload = await handleAddTeamClient({ body, users, teams, tablesDB, log });
        return respond(payload);
      }
      case 'dataReset': {
        const payload = await handleDataReset({ body, tablesDB, storage, log, error });
        return respond(payload);
      }
      default: {
        const _exhaustive = action;
        return res.json({ success: false, message: `Unsupported action: ${_exhaustive}` }, 400);
      }
    }
  } catch (err) {
    const status =
      typeof err.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    error(`companies failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
