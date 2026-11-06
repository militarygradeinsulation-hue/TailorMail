import { getAccessToken } from './googleAuth';

/** Only workspace API calls receive the in-memory Google OAuth access token. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error('Sign in with an authorized Google account to access TailorMail.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
