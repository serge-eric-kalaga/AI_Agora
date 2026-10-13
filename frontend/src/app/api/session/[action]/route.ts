import {
  storeSession,
  backendUrl,
  hasTrustedOrigin,
  publicBackendResponse,
} from '@/server/backend';

const allowedActions = new Set(['login', 'register']);

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!hasTrustedOrigin(request)) {
    return Response.json(
      { error: { code: 'invalid_origin', message: 'Origine de requête refusée.' } },
      { status: 403 },
    );
  }
  const { action } = await context.params;
  if (!allowedActions.has(action)) {
    return Response.json(
      { error: { code: 'not_found', message: 'Action inconnue.' } },
      { status: 404 },
    );
  }

  const response = await fetch(backendUrl(`auth/${action}`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: await request.text(),
    cache: 'no-store',
  });
  if (!response.ok) return publicBackendResponse(response);

  const payload = (await response.json()) as {
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    refreshExpiresIn: number;
    user: unknown;
  };
  await storeSession(payload);
  return Response.json({ user: payload.user }, { status: response.status });
}
