import { handleRunninghubStatus } from '../_lib/runninghub.js';
import { withApiAuth } from '../_lib/auth.js';

export const config = { maxDuration: 10 };
const securedHandleRunninghubStatus = withApiAuth(handleRunninghubStatus, {
  scope: 'runninghub-status', maxRequests: 120, anyPermission: ['canUseRunninghub'],
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return securedHandleRunninghubStatus(req, res);
}
