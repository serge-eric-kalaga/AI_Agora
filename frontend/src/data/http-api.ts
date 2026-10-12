import { z } from 'zod';
import type { Agent, AgentDraft, AgoraUser, Provider, Workspace } from '@/domain/models';

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  ownerId: z.string(),
  role: z.enum(['owner', 'editor', 'viewer']).nullable(),
  createdAt: z.string(),
});
const providerReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['cloud', 'local', 'openai_compatible']),
  baseUrl: z.string().nullable(),
  models: z.array(z.string()),
  isEnabled: z.boolean(),
  hasApiKey: z.boolean(),
});
const agentReadSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  name: z.string(),
  role: z.string(),
  description: z.string(),
  model: z.string(),
  color: z.string(),
  systemPrompt: z.string(),
  traits: z.record(z.string(), z.number()),
  tools: z.array(z.string()),
  generationConfig: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
  version: z.number().int().positive(),
});

const palette = ['violet', 'cyan', 'amber', 'blue', 'pink', 'green'];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = 'api_error',
  ) {
    super(message);
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      error?.message ?? 'Le serveur a refusé la requête.',
      response.status,
      error?.code,
    );
  }
  return schema.parse(payload);
}

function pageOf<T>(item: z.ZodType<T>) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

function mapProvider(value: z.infer<typeof providerReadSchema>, index = 0): Provider {
  return {
    id: value.id,
    name: value.name,
    kind: value.kind === 'local' ? 'local' : 'cloud',
    endpoint: value.baseUrl ?? '',
    models: value.models,
    connected: value.isEnabled,
    hasApiKey: value.hasApiKey,
    color: palette[index % palette.length],
  };
}

function boundedTrait(value: number | undefined, fallback: number) {
  return Math.max(0, Math.min(100, value ?? fallback));
}

function mapAgent(value: z.infer<typeof agentReadSchema>): Agent {
  const tools = value.tools.filter((tool): tool is Agent['tools'][number] =>
    ['web', 'files', 'code'].includes(tool),
  );
  return {
    id: value.id,
    providerId: value.providerId,
    name: value.name,
    role: value.role,
    description: value.description,
    model: value.model,
    color: value.color,
    systemPrompt: value.systemPrompt,
    traits: {
      creativity: boundedTrait(value.traits.creativity, 50),
      rigor: boundedTrait(value.traits.rigor, 50),
      humor: boundedTrait(value.traits.humor, 50),
      diplomacy: boundedTrait(value.traits.diplomacy, 50),
    },
    tools,
    temperature: Number(value.generationConfig.temperature ?? 0.7),
    maxTokens: Number(value.generationConfig.maxTokens ?? 1024),
    active: value.isActive,
    version: value.version,
  };
}

export async function readSession(): Promise<AgoraUser | null> {
  const response = await fetch('/api/session', { cache: 'no-store' });
  if (response.status === 401) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(payload?.error?.message ?? 'Session indisponible.', response.status);
  return userSchema.parse(payload.user);
}

export async function authenticate(
  action: 'login' | 'register',
  payload: Record<string, string>,
): Promise<AgoraUser> {
  const result = await request(`/api/session/${action}`, z.object({ user: userSchema }), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.user;
}

export async function endSession() {
  await fetch('/api/session', { method: 'DELETE' });
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const result = await request('/api/backend/workspaces', pageOf(workspaceSchema));
  return result.items;
}

export async function listWorkspaceData(workspaceId: string) {
  const [providers, agents] = await Promise.all([
    request(`/api/backend/workspaces/${workspaceId}/providers`, pageOf(providerReadSchema)),
    request(`/api/backend/workspaces/${workspaceId}/agents`, pageOf(agentReadSchema)),
  ]);
  return {
    providers: providers.items.map(mapProvider),
    agents: agents.items.map(mapAgent),
  };
}

export async function persistProvider(
  workspaceId: string,
  provider: Provider,
  apiKey?: string,
): Promise<Provider> {
  const creating = !provider.id;
  const body = {
    ...(creating ? { kind: provider.kind } : {}),
    name: provider.name,
    baseUrl: provider.endpoint || null,
    models: provider.models,
    isEnabled: provider.connected,
    ...(apiKey ? { apiKey } : {}),
  };
  const result = await request(
    `/api/backend/workspaces/${workspaceId}/providers${creating ? '' : `/${provider.id}`}`,
    providerReadSchema,
    { method: creating ? 'POST' : 'PATCH', body: JSON.stringify(body) },
  );
  return { ...mapProvider(result), color: provider.color };
}

export async function persistAgent(
  workspaceId: string,
  draft: AgentDraft,
  existing?: Agent,
): Promise<Agent> {
  const body = {
    name: draft.name,
    role: draft.role,
    description: draft.description,
    providerId: draft.providerId,
    model: draft.model,
    color: draft.color,
    systemPrompt: draft.systemPrompt,
    traits: draft.traits,
    tools: draft.tools,
    generationConfig: { temperature: draft.temperature, maxTokens: draft.maxTokens },
    isActive: draft.active,
    ...(existing ? { expectedVersion: existing.version } : {}),
  };
  const result = await request(
    `/api/backend/workspaces/${workspaceId}/agents${existing ? `/${existing.id}` : ''}`,
    agentReadSchema,
    {
      method: existing ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
      headers: { 'x-idempotency-key': crypto.randomUUID() },
    },
  );
  return mapAgent(result);
}
