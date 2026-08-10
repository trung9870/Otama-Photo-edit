import { handleKieCredits } from './_lib/handlers.js';
import { withApiAuth } from './_lib/auth.js';
import { handlePromptCrypto } from './_lib/promptVault.js';

export const config = { maxDuration: 10 };
const securedAdminTools = withApiAuth(async (req: any, res: any) => {
  if (req.method === 'GET') return handleKieCredits(req, res);
  if (req.method === 'POST') return handlePromptCrypto(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}, {
  scope: 'admin-tools',
  maxRequests: 140,
  admin: true,
});

export default async function handler(req: any, res: any) {
  return securedAdminTools(req, res);
}
