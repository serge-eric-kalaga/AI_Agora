import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'ai_agora_access';

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
