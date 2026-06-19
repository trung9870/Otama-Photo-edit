import { handleRunninghubRun } from '../_lib/runninghub.js';

export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return handleRunninghubRun(req, res);
}
