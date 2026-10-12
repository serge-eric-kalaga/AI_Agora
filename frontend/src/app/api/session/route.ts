import { cookies } from 'next/headers';
import { ACCESS_COOKIE, backendFetch, publicBackendResponse } from '@/server/backend';

export async function GET() {
  const response = await backendFetch('auth/me');
  if (response.status === 401) (await cookies()).delete(ACCESS_COOKIE);
  if (!response.ok) return publicBackendResponse(response);
  return Response.json(
    { user: await response.json() },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function DELETE() {
  (await cookies()).delete(ACCESS_COOKIE);
  return new Response(null, { status: 204 });
}
