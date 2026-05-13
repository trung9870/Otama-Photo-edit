import { handleGenerate } from './_lib/handlers';

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return handleGenerate(req, res);
}
