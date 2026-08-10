import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';
const MAX_PROMPT_CHARS = 20_000;

function encryptionKey(): Buffer {
  const secret = process.env.PROMPT_ENCRYPTION_KEY || process.env.TASK_REF_SECRET || process.env.KIE_API_KEY;
  if (!secret) throw new Error('PROMPT_ENCRYPTION_KEY chưa được cấu hình trên server.');
  return createHash('sha256').update(`otama-prompt-v1:${secret}`).digest();
}

export function isEncryptedPrompt(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptPrompt(plaintext: string): string {
  if (typeof plaintext !== 'string' || !plaintext.trim() || plaintext.length > MAX_PROMPT_CHARS) {
    throw new Error('Nội dung prompt không hợp lệ.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64url')}`;
}

export function decryptPrompt(encrypted: string): string {
  if (!isEncryptedPrompt(encrypted)) throw new Error('Prompt chưa được mã hóa đúng định dạng.');
  const payload = Buffer.from(encrypted.slice(ENCRYPTED_PREFIX.length), 'base64url');
  if (payload.length < 29) throw new Error('Dữ liệu prompt mã hóa không hợp lệ.');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function firestoreString(fields: Record<string, any>, key: string): string {
  return typeof fields?.[key]?.stringValue === 'string' ? fields[key].stringValue : '';
}

export interface ResolvedPrompt {
  plaintext: string;
  protectedPrompt?: string;
}

export async function resolveSharedPrompt(promptId: string, uid: string, idToken: string): Promise<ResolvedPrompt> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(promptId)) throw new Error('Prompt ID không hợp lệ.');
  const endpoint = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID || 'at-local-edit'}/databases/(default)/documents/prompts/${encodeURIComponent(promptId)}`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(response.status === 404 ? 'Prompt đã lưu không tồn tại.' : 'Không thể tải prompt đã lưu.');
  const document: any = await response.json();
  const fields = document?.fields || {};
  const ownerUid = firestoreString(fields, 'uid');
  const isDefault = fields?.isDefault?.booleanValue === true;
  if (!isDefault && ownerUid !== uid) throw new Error('Bạn không có quyền sử dụng prompt này.');
  const storedPrompt = firestoreString(fields, 'prompt');
  if (!isDefault) return { plaintext: storedPrompt };
  if (!isEncryptedPrompt(storedPrompt)) throw new Error('Prompt dùng chung chưa được bảo mật. Vui lòng liên hệ Admin.');
  return { plaintext: decryptPrompt(storedPrompt), protectedPrompt: storedPrompt };
}

export async function handlePromptCrypto(req: any, res: any) {
  try {
    const { action, prompt, promptId } = req.body || {};
    if (action === 'encrypt') return res.json({ prompt: encryptPrompt(prompt) });
    if (action === 'decrypt') return res.json({ prompt: decryptPrompt(prompt) });
    if (action === 'resolve') {
      if (!req.auth?.uid || !req.auth?.idToken) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
      const resolved = await resolveSharedPrompt(promptId, req.auth.uid, req.auth.idToken);
      return res.json({ prompt: resolved.plaintext });
    }
    return res.status(400).json({ error: 'Thao tác prompt không hợp lệ.' });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Không thể xử lý prompt.' });
  }
}
