import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

type ApiRequest = {
  headers?: Record<string, string | string[] | undefined>;
  auth?: FirebaseAuthContext;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => unknown;
  setHeader?: (name: string, value: string) => unknown;
};

export interface FirebaseAuthContext {
  uid: string;
  idToken: string;
  email: string | null;
  emailVerified: boolean;
  claims: JWTPayload;
  userProfile: Record<string, unknown> | null;
}

export interface ApiAuthOptions {
  admin?: boolean;
  anyPermission?: string[];
  scope: string;
  maxRequests?: number;
  windowMs?: number;
}

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'at-local-edit';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);
const APP_CHECK_JWKS = createRemoteJWKSet(new URL('https://firebaseappcheck.googleapis.com/v1/jwks'));
const FIREBASE_PROJECT_NUMBER = process.env.FIREBASE_PROJECT_NUMBER || '1021570129163';
const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || '1:1021570129163:web:8d796d211216cba84d960e';
const APP_CHECK_REQUIRED = process.env.FIREBASE_APPCHECK_REQUIRED === 'true';
const PRIMARY_ADMIN_EMAIL = 'trungg9870@gmail.com';

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

function hasAnyFeaturePermission(profile: Record<string, unknown> | null): boolean {
  return Boolean(
    profile?.canUseClothing === true ||
    profile?.canUseEcom === true ||
    profile?.canUseOfa === true ||
    profile?.canUsePicset === true ||
    profile?.canUseRunninghub === true
  );
}

function decodeFirestoreValue(value: any): unknown {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  return null;
}

async function loadUserProfile(uid: string, idToken: string): Promise<Record<string, unknown> | null> {
  const endpoint = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404 || response.status === 403) {
    return null;
  }
  if (!response.ok) throw new Error(`profile-http-${response.status}`);
  const document: any = await response.json();
  const profile: Record<string, unknown> = {};
  Object.entries(document?.fields || {}).forEach(([key, value]) => {
    profile[key] = decodeFirestoreValue(value);
  });
  return profile;
}

function headerValue(req: ApiRequest, name: string): string {
  const headers = req.headers || {};
  const raw = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return Array.isArray(raw) ? raw[0] || '' : raw || '';
}

async function verifyAppCheckRequest(req: ApiRequest): Promise<void> {
  const token = headerValue(req, 'x-firebase-appcheck');
  if (!token) {
    if (APP_CHECK_REQUIRED) throw new Error('missing-app-check');
    return;
  }
  const { payload, protectedHeader } = await jwtVerify(token, APP_CHECK_JWKS, {
    algorithms: ['RS256'],
    typ: 'JWT',
    issuer: `https://firebaseappcheck.googleapis.com/${FIREBASE_PROJECT_NUMBER}`,
    audience: `projects/${FIREBASE_PROJECT_NUMBER}`,
  });
  if (protectedHeader.typ !== 'JWT' || payload.sub !== FIREBASE_APP_ID) {
    throw new Error('invalid-app-check-app');
  }
}

function applyRateLimit(
  req: ApiRequest,
  res: ApiResponse,
  auth: FirebaseAuthContext,
  options: ApiAuthOptions,
): boolean {
  const now = Date.now();
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 30;
  const key = `${auth.uid}:${options.scope}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  res.setHeader?.('X-RateLimit-Limit', String(maxRequests));
  res.setHeader?.('X-RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
  res.setHeader?.('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count <= maxRequests) return true;
  res.status(429).json({ error: 'Bạn thao tác quá nhanh. Vui lòng đợi một phút rồi thử lại.' });
  return false;
}

export async function verifyFirebaseRequest(req: ApiRequest): Promise<FirebaseAuthContext> {
  const authorization = headerValue(req, 'authorization');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('missing-token');

  const idToken = match[1];
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    algorithms: ['RS256'],
    audience: FIREBASE_PROJECT_ID,
    issuer: FIREBASE_ISSUER,
  });
  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  if (!uid) throw new Error('missing-uid');
  const email = typeof payload.email === 'string' ? payload.email : null;
  const emailVerified = payload.email_verified === true;
  const tokenAdmin = payload.admin === true || payload.role === 'admin';
  const primaryAdmin = email === PRIMARY_ADMIN_EMAIL && emailVerified;
  const userProfile = tokenAdmin || primaryAdmin ? await loadUserProfile(uid, idToken).catch(() => null) : await loadUserProfile(uid, idToken);
  return {
    uid,
    idToken,
    email,
    emailVerified,
    claims: payload,
    userProfile,
  };
}

export async function authorizeApiRequest(
  req: ApiRequest,
  res: ApiResponse,
  options: ApiAuthOptions,
): Promise<boolean> {
  try {
    await verifyAppCheckRequest(req);
    const auth = await verifyFirebaseRequest(req);
    const customAdmin = auth.claims.admin === true || auth.claims.role === 'admin';
    const primaryAdmin = auth.email === PRIMARY_ADMIN_EMAIL && auth.emailVerified;
    const profileAdmin = auth.userProfile?.role === 'admin';
    const admin = customAdmin || primaryAdmin || profileAdmin;
    if (!admin && !auth.userProfile) {
      res.status(403).json({ error: 'Tài khoản chưa được quản trị viên cấp quyền sử dụng.' });
      return false;
    }
    if (!admin && !hasAnyFeaturePermission(auth.userProfile)) {
      res.status(403).json({ error: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' });
      return false;
    }
    if (options.admin && !admin) {
      res.status(403).json({ error: 'Chỉ quản trị viên được phép thực hiện thao tác này.' });
      return false;
    }
    if (!admin && options.anyPermission?.length) {
      const allowed = options.anyPermission.some((permission) => auth.userProfile?.[permission] === true);
      if (!allowed) {
        res.status(403).json({ error: 'Tài khoản không có quyền dùng tính năng này.' });
        return false;
      }
    }
    if (!applyRateLimit(req, res, auth, options)) return false;
    req.auth = auth;
    return true;
  } catch (error) {
    console.warn(`[auth] ${options.scope} rejected:`, error instanceof Error ? error.message : error);
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return false;
  }
}

export function withApiAuth(
  handler: (req: any, res: any) => unknown | Promise<unknown>,
  options: ApiAuthOptions,
) {
  return async (req: any, res: any) => {
    if (!await authorizeApiRequest(req, res, options)) return;
    return handler(req, res);
  };
}
