import send from './handlers/send.js';
import createCredit from './handlers/createCredit.js';
import { createClients, parseBody } from './lib/appwrite.js';
import { assertCallerIsAdmin } from './lib/auth.js';

export default async (context) => {
  const { users } = createClients(context.req);

  try {
    await assertCallerIsAdmin(users, context.req);
    const body = parseBody(context.req);
    const action = body.action ?? 'send';

    switch (action) {
      case 'send':
        return send(context);
      case 'regenerate':
        return send(context);
      case 'createCredit':
        return createCredit(context);
      default: {
        const _exhaustive = action;
        return context.res.json({ success: false, message: `Unsupported action: ${_exhaustive}` }, 400);
      }
    }
  } catch (err) {
    const status = err.status ?? 500;
    context.error(`invoices failed: ${err.message}`);
    return context.res.json({ success: false, message: err.message }, status);
  }
};
