import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'ai_agora_access';
export const REFRESH_COOKIE = 'ai_agora_refresh';

export async function storeSession(payload: {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  refreshExpiresIn?: number;
}) {
  const jar = await cookies();
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.AGORA_COOKIE_SECURE === 'true',
    path: '/',
    priority: 'high' as const,
  };
  jar.set(ACCESS_COOKIE, payload.accessToken, { ...options, maxAge: payload.expiresIn });
  if (payload.refreshToken)
    jar.set(REFRESH_COOKIE, payload.refreshToken, {
      ...options,
      maxAge: payload.refreshExpiresIn ?? 0,
    });
}

export function backendUrl(path: string) {
  const base = process.env.AGORA_API_INTERNAL_URL ?? 'http://127.0.0.1:8000/api/v1';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const publicHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    return new URL(origin).host === publicHost;
  } catch {
    return false;
  }
}

export async function backendFetch(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(backendUrl(path), { ...init, headers, cache: 'no-store' });
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (response.status !== 401 || !refreshToken) return response;
  // Un seul renouvellement et une seule répétition ; aucun échec métier n'est rejoué.
  const renewal = await fetch(backendUrl('auth/refresh'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!renewal.ok) {
    if (renewal.status === 401) {
      (await cookies()).delete(ACCESS_COOKIE);
      (await cookies()).delete(REFRESH_COOKIE);
    }
    return response;
  }
  const payload = await renewal.json();
  await storeSession(payload);
  headers.set('authorization', `Bearer ${payload.accessToken}`);
  return fetch(backendUrl(path), { ...init, headers, cache: 'no-store' });
}

export function publicBackendResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? 'application/json';
  const isEventStream = contentType.startsWith('text/event-stream');
  const headers = new Headers({
    'content-type': contentType,
    'cache-control': isEventStream ? 'no-cache, no-transform' : 'no-store',
  });
  if (isEventStream) headers.set('x-accel-buffering', 'no');
  const disposition = response.headers.get('content-disposition');
  if (disposition) headers.set('content-disposition', disposition);
  headers.set('x-content-type-options', 'nosniff');
  const requestId = response.headers.get('x-request-id');
  if (requestId) headers.set('x-request-id', requestId);
  return new Response(response.body, { status: response.status, headers });
}
