import assignAssignees from './handlers/assignAssignees.js';
import notifyOnEvents from './handlers/notifyOnEvents.js';
import { createClients, parseBody } from './lib/appwrite.js';
import { assertCallerIsAdmin } from './lib/auth.js';

const TASK_EVENT_PREFIXES = [
  'databases.main.tables.tasks.rows.',
  'databases.main.tables.discussionReplies.rows.',
  'databases.main.tables.projectFiles.rows.',
];

export default async (context) => {
  const eventHeader = context.req.headers['x-appwrite-event'] || '';
  const isEvent = TASK_EVENT_PREFIXES.some((prefix) => eventHeader.includes(prefix));

  if (isEvent) {
    return notifyOnEvents(context);
  }

  const { users } = createClients(context.req);
  try {
    await assertCallerIsAdmin(users, context.req);
    const body = parseBody(context.req);
    const action = body.action ?? 'assignAssignees';

    switch (action) {
      case 'assignAssignees':
        return assignAssignees(context);
      default: {
        const _exhaustive = action;
        return context.res.json({ success: false, message: `Unsupported action: ${_exhaustive}` }, 400);
      }
    }
  } catch (err) {
    const status = err.status ?? 500;
    context.error(`tasks failed: ${err.message}`);
    return context.res.json({ success: false, message: err.message }, status);
  }
};
