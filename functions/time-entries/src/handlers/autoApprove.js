import { Client, TablesDB, Users, Permission, Role } from 'node-appwrite';

const DATABASE_ID = 'main';
const TABLES = {
  companies: 'companies',
  timeEntries: 'timeEntries',
};
const ADMIN_LABEL = 'admin';

/** Mirrors sites/project-manager/src/appwrite/permissions.ts#lockedTimeEntryPermissions. */
function lockedTimeEntryPermissions(teamId) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    Permission.read(Role.team(teamId)),
  ];
}

/**
 * Called right after a client-side createTimeEntry — approves the just-created entry when the
 * company has autoApproveHours enabled. Runs with the function's API key so it can grant the
 * admin-label permission that a non-admin caller (typically the developer who logged the hours)
 * could never grant themselves. The company flag is re-checked server-side rather than trusted
 * from the request, and the caller must own the entry (or be an admin) so this can't be used to
 * approve someone else's hours.
 */
export default async function autoApprove({ req, res, log, error }) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const users = new Users(client);
  const tablesDB = new TablesDB(client);

  try {
    const body = req.bodyJson ?? {};
    const entryId = typeof body.entryId === 'string' ? body.entryId.trim() : '';
    if (!entryId) {
      return res.json({ success: false, message: 'entryId is required' }, 400);
    }

    const callerId = req.headers['x-appwrite-user-id'];
    if (!callerId) {
      return res.json({ success: false, message: 'Missing x-appwrite-user-id header' }, 401);
    }

    const entry = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.timeEntries,
      rowId: entryId,
    });

    if (entry.userId !== callerId) {
      const caller = await users.get({ userId: callerId });
      if (!(caller.labels ?? []).includes(ADMIN_LABEL)) {
        return res.json({ success: false, message: 'Not authorized to approve this entry' }, 403);
      }
    }

    if (entry.approved || entry.freeOfCharge) {
      return res.json({ success: true, approved: false });
    }

    const company = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.companies,
      rowId: entry.companyId,
    });
    if (!company.autoApproveHours) {
      return res.json({ success: true, approved: false });
    }

    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.timeEntries,
      rowId: entryId,
      data: { approved: true },
      permissions: lockedTimeEntryPermissions(company.teamId),
    });

    log(`Auto-approved time entry ${entryId} for company ${company.$id}`);
    return res.json({ success: true, approved: true });
  } catch (err) {
    const status = err.status ?? err.code ?? 500;
    error(`auto-approve failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
}
