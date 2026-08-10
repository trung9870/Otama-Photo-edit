import { getToken } from 'firebase/app-check';
import { appCheck, auth } from '../firebase';

/** Calls a protected Otama API with the current Firebase ID token. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn cần đăng nhập để sử dụng tính năng này.');
  const token = await user.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (appCheck) {
    const appCheckToken = await getToken(appCheck, false);
    headers.set('X-Firebase-AppCheck', appCheckToken.token);
  }
  return fetch(input, { ...init, headers });
}
