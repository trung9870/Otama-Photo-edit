import { handleGenerateCheck } from './_lib/handlers.js';
import { withApiAuth } from './_lib/auth.js';

export const config = { maxDuration: 10 };
const securedHandleGenerateCheck = withApiAuth(handleGenerateCheck, {
  scope: 'generate-check', maxRequests: 180,
  anyPermission: ['canUseClothing', 'canUseEcom', 'canUseOfa', 'canUsePicset'],
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return securedHandleGenerateCheck(req, res);
}
