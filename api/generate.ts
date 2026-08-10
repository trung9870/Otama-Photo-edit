import { handleGenerate } from './_lib/handlers.js';
import { withApiAuth } from './_lib/auth.js';

export const config = { maxDuration: 60 };
const securedHandleGenerate = withApiAuth(handleGenerate, {
  scope: 'generate', maxRequests: 6,
  anyPermission: ['canUseClothing', 'canUseEcom', 'canUseOfa', 'canUsePicset'],
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return securedHandleGenerate(req, res);
}
