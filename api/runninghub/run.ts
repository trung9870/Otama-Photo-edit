import { handleRunninghubRun } from '../_lib/runninghub.js';
import { withApiAuth } from '../_lib/auth.js';

export const config = { maxDuration: 30 };
const securedHandleRunninghubRun = withApiAuth(handleRunninghubRun, {
  scope: 'runninghub-run', maxRequests: 5, anyPermission: ['canUseRunninghub'],
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return securedHandleRunninghubRun(req, res);
}
