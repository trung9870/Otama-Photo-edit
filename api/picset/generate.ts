import { handlePicsetGenerate } from '../_lib/picset.js';
import { withApiAuth } from '../_lib/auth.js';

export const config = { maxDuration: 60 };
const securedHandlePicsetGenerate = withApiAuth(handlePicsetGenerate, {
  scope: 'picset-generate', maxRequests: 3, anyPermission: ['canUsePicset'],
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return securedHandlePicsetGenerate(req, res);
}
