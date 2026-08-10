import { handleAnalyze } from './_lib/handlers.js';
import { withApiAuth } from './_lib/auth.js';

export const config = { maxDuration: 60 };
const securedHandleAnalyze = withApiAuth(handleAnalyze, {
  scope: 'analyze', maxRequests: 20,
  anyPermission: ['canUseClothing', 'canUseEcom'],
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return securedHandleAnalyze(req, res);
}
