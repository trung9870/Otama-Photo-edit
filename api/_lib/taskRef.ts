import { createHmac, timingSafeEqual } from 'node:crypto';

type Provider = 'kie' | 'runninghub';

function signingSecret(): string {
  const secret = process.env.TASK_REF_SECRET || process.env.KIE_API_KEY || process.env.RUNNINGHUB_API_KEY;
  if (!secret) throw new Error('Server chưa cấu hình TASK_REF_SECRET hoặc provider API key.');
  return secret;
}

function signature(payload: string): Buffer {
  return createHmac('sha256', signingSecret()).update(payload).digest();
}

export function sealTaskRef(provider: Provider, taskId: string, uid: string): string {
  if (!taskId || !uid) throw new Error('Không thể tạo task reference thiếu owner.');
  const payload = Buffer.from(JSON.stringify({ p: provider, t: taskId, u: uid }), 'utf8').toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

export function openTaskRef(reference: string, provider: Provider, uid: string): string {
  if (typeof reference !== 'string' || reference.length > 2_048) throw new Error('Task reference không hợp lệ.');
  const [payload, suppliedSignature, extra] = reference.split('.');
  if (!payload || !suppliedSignature || extra) throw new Error('Task reference không hợp lệ.');
  const expected = signature(payload);
  const supplied = Buffer.from(suppliedSignature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error('Task reference không hợp lệ.');
  }
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { p?: unknown; t?: unknown; u?: unknown };
  if (decoded.p !== provider || decoded.u !== uid || typeof decoded.t !== 'string' || decoded.t.length > 512) {
    throw new Error('Task reference không thuộc tài khoản hiện tại.');
  }
  return decoded.t;
}
