import type { FirebaseAuthContext } from './auth.js';

export const MIN_DAILY_CREDIT_LIMIT = 500;
export const MAX_DAILY_CREDIT_LIMIT = 1_000_000;

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'at-local-edit';
const PRIMARY_ADMIN_EMAIL = 'trungg9870@gmail.com';
const MAX_RESERVATION_ATTEMPTS = 6;

export class DailyCreditLimitError extends Error {
  readonly usedCredits: number;
  readonly requestedCredits: number;
  readonly dailyCreditLimit: number;

  constructor(usedCredits: number, requestedCredits: number, dailyCreditLimit: number) {
    const remaining = Math.max(0, dailyCreditLimit - usedCredits);
    super(`Đã đạt giới hạn credit hôm nay. Đã dùng ${usedCredits}/${dailyCreditLimit}, còn ${remaining} credit; lượt này cần ${requestedCredits} credit.`);
    this.name = 'DailyCreditLimitError';
    this.usedCredits = usedCredits;
    this.requestedCredits = requestedCredits;
    this.dailyCreditLimit = dailyCreditLimit;
  }
}

export function creditsPerImage(modelId: string, size?: string): number {
  const normalizedSize = (size || '1k').toLowerCase();
  if (modelId === 'nano-banana-pro' || modelId === 'gemini-3-pro-image-preview') {
    return normalizedSize === '4k' ? 24 : 18;
  }
  if (modelId === 'nano-banana-2' || modelId === 'gemini-3.1-flash-image-preview') {
    return normalizedSize === '4k' ? 18 : normalizedSize === '2k' ? 12 : 8;
  }
  if (modelId === 'gpt-image-2-image-to-image' || modelId === 'kie-ai-gpt2') {
    return normalizedSize === '4k' ? 16 : normalizedSize === '2k' ? 10 : 6;
  }
  if (modelId === 'seedream-4-5-edit' || modelId === 'seedream-4-5-text-to-image') {
    return normalizedSize === '4k' ? 8 : 7;
  }
  return 0;
}

function vietnamDay(now = Date.now()): string {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function firestoreInteger(fields: Record<string, any>, key: string): number {
  const raw = fields?.[key]?.integerValue;
  const value = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 0;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function isAdmin(auth: FirebaseAuthContext): boolean {
  return auth.email === PRIMARY_ADMIN_EMAIL ||
    auth.claims.admin === true ||
    auth.claims.role === 'admin' ||
    auth.userProfile?.role === 'admin';
}

function dailyLimit(auth: FirebaseAuthContext): number | null {
  if (isAdmin(auth) || auth.userProfile?.creditLimitEnabled !== true) return null;
  const configured = Number(auth.userProfile?.dailyCreditLimit);
  if (!Number.isSafeInteger(configured)) return MIN_DAILY_CREDIT_LIMIT;
  return Math.min(MAX_DAILY_CREDIT_LIMIT, Math.max(MIN_DAILY_CREDIT_LIMIT, configured));
}

function documentUrl(documentId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/dailyCreditUsage/${encodeURIComponent(documentId)}`;
}

function quotaFields(auth: FirebaseAuthContext, day: string, usedCredits: number): Record<string, any> {
  return {
    uid: { stringValue: auth.uid },
    email: { stringValue: auth.email || '' },
    day: { stringValue: day },
    usedCredits: { integerValue: String(usedCredits) },
    updatedAt: { timestampValue: new Date().toISOString() },
  };
}

export async function reserveDailyCredits(
  auth: FirebaseAuthContext,
  modelId: string,
  size: string | undefined,
  imageCount: number,
): Promise<{ limited: boolean; chargedCredits: number; usedCredits?: number; dailyCreditLimit?: number }> {
  const limit = dailyLimit(auth);
  const chargedCredits = creditsPerImage(modelId, size) * imageCount;
  if (limit === null || chargedCredits <= 0) return { limited: false, chargedCredits };
  if (!auth.email) throw new Error('Tài khoản thiếu email để ghi nhận quota.');

  const day = vietnamDay();
  const documentId = `${auth.uid}_${day}`;
  const endpoint = documentUrl(documentId);
  const headers = { Authorization: `Bearer ${auth.idToken}`, 'Content-Type': 'application/json' };

  for (let attempt = 0; attempt < MAX_RESERVATION_ATTEMPTS; attempt += 1) {
    const readResponse = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8_000) });
    if (readResponse.status !== 404 && !readResponse.ok) {
      throw new Error(`Không thể kiểm tra quota (${readResponse.status}).`);
    }

    let usedCredits = 0;
    let updateTime = '';
    if (readResponse.ok) {
      const document: any = await readResponse.json();
      usedCredits = firestoreInteger(document?.fields || {}, 'usedCredits');
      updateTime = typeof document?.updateTime === 'string' ? document.updateTime : '';
    }

    if (usedCredits + chargedCredits > limit) {
      throw new DailyCreditLimitError(usedCredits, chargedCredits, limit);
    }

    const nextUsedCredits = usedCredits + chargedCredits;
    const precondition = updateTime
      ? `currentDocument.updateTime=${encodeURIComponent(updateTime)}`
      : 'currentDocument.exists=false';
    const writeResponse = await fetch(`${endpoint}?${precondition}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: quotaFields(auth, day, nextUsedCredits) }),
      signal: AbortSignal.timeout(8_000),
    });

    if (writeResponse.ok) {
      return { limited: true, chargedCredits, usedCredits: nextUsedCredits, dailyCreditLimit: limit };
    }
    if (writeResponse.status === 409 || writeResponse.status === 412) continue;
    throw new Error(`Không thể ghi nhận quota (${writeResponse.status}).`);
  }

  throw new Error('Quota đang được cập nhật bởi một lượt Gen khác. Vui lòng thử lại.');
}

export function sendCreditQuotaError(error: unknown, res: any): boolean {
  if (error instanceof DailyCreditLimitError) {
    res.status(429).json({
      error: error.message,
      code: 'DAILY_CREDIT_LIMIT',
      usedCredits: error.usedCredits,
      requestedCredits: error.requestedCredits,
      dailyCreditLimit: error.dailyCreditLimit,
    });
    return true;
  }
  return false;
}
