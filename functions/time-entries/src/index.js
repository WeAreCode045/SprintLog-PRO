import approve from './handlers/approve.js';
import unlock from './handlers/unlock.js';
import autoApprove from './handlers/autoApprove.js';
import { parseBody } from './lib/appwrite.js';

export default async (context) => {
  const body = parseBody(context.req);
  const action = body.action ?? 'approve';

  switch (action) {
    case 'approve':
      return approve(context);
    case 'unlock':
      return unlock(context);
    case 'autoApprove':
      return autoApprove(context);
    default: {
      const _exhaustive = action;
      return context.res.json({ success: false, message: `Unsupported action: ${_exhaustive}` }, 400);
    }
  }
};
