import { handleKieCredits } from './_lib/handlers.js';
import { withApiAuth } from './_lib/auth.js';

export const config = { maxDuration: 10 };
const securedHandleKieCredits = withApiAuth(handleKieCredits, {
  scope: 'kie-credits',
  maxRequests: 20,
  admin: true,
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return securedHandleKieCredits(req, res);
}
