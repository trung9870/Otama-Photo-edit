import { handleGenerateCheck } from './_lib/handlers.js';

export const config = { maxDuration: 10 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return handleGenerateCheck(req, res);
}
