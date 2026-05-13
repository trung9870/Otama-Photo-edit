import { handleProxyImage } from './_lib/handlers';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return handleProxyImage(req, res);
}
