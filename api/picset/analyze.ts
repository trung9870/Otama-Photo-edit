import { handlePicsetAnalyze } from '../_lib/picset.js';
import { withApiAuth } from '../_lib/auth.js';

export const config = { maxDuration: 60 };
const securedHandlePicsetAnalyze = withApiAuth(handlePicsetAnalyze, {
  scope: 'picset-analyze', maxRequests: 10, anyPermission: ['canUsePicset'],
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return securedHandlePicsetAnalyze(req, res);
}
