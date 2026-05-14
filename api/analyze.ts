import { handleAnalyze } from './_lib/handlers.js';

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return handleAnalyze(req, res);
}
