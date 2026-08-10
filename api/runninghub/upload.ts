import { handleRunninghubUpload } from '../_lib/runninghub.js';
import { withApiAuth } from '../_lib/auth.js';

export const config = { maxDuration: 60 };
const securedHandleRunninghubUpload = withApiAuth(handleRunninghubUpload, {
  scope: 'runninghub-upload', maxRequests: 20, anyPermission: ['canUseRunninghub'],
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return securedHandleRunninghubUpload(req, res);
}
