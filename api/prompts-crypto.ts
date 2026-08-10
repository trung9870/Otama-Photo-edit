import { withApiAuth } from './_lib/auth.js';
import { handlePromptCrypto } from './_lib/promptVault.js';

const securedHandler = withApiAuth(handlePromptCrypto, {
  scope: 'prompts-crypto',
  maxRequests: 120,
  admin: true,
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return securedHandler(req, res);
}
