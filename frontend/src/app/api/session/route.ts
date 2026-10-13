import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  backendUrl,
  hasTrustedOrigin,
  backendFetch,
  publicBackendResponse,
} from '@/server/backend';

export async function GET() {
  const response = await backendFetch('auth/me');
  if (response.status === 401) (await cookies()).delete(ACCESS_COOKIE);
  if (!response.ok) return publicBackendResponse(response);
  return Response.json(
    { user: await response.json() },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function DELETE(request: Request) {
  if (!hasTrustedOrigin(request))
    return Response.json({ error: { message: 'Origine de requête refusée.' } }, { status: 403 });
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const response = await fetch(backendUrl('auth/logout'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!response.ok) return publicBackendResponse(response);
  }
  (await cookies()).delete(REFRESH_COOKIE);
  (await cookies()).delete(ACCESS_COOKIE);
  return new Response(null, { status: 204 });
}
