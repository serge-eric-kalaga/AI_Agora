import { backendFetch, hasTrustedOrigin, publicBackendResponse } from '@/server/backend';

const allowedRoots = new Set(['workspaces', 'admin']);

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const source = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method) && !hasTrustedOrigin(request)) {
    return Response.json(
      { error: { code: 'invalid_origin', message: 'Origine de requête refusée.' } },
      { status: 403 },
    );
  }
  const { path } = await context.params;
  if (!path.length || !allowedRoots.has(path[0]) || path.some((part) => part === '..')) {
    return Response.json(
      { error: { code: 'not_found', message: 'Ressource inconnue.' } },
      { status: 404 },
    );
  }

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const idempotencyKey = request.headers.get('x-idempotency-key');
  const lastEventId = request.headers.get('last-event-id');
  const acceptsEvents = path.at(-1) === 'stream';
  if (contentType) headers.set('content-type', contentType);
  if (idempotencyKey) headers.set('x-idempotency-key', idempotencyKey);
  if (lastEventId) headers.set('last-event-id', lastEventId);
  if (acceptsEvents) headers.set('accept', 'text/event-stream');
  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
  const response = await backendFetch(`${path.join('/')}${source.search}`, {
    method,
    headers,
    body,
    signal: request.signal,
  });
  if (acceptsEvents && response.status === 401) {
    return new Response('event: session.expired\ndata: {}\n\n', {
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
    });
  }
  return publicBackendResponse(response);
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
