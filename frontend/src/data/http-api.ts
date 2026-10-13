import { z } from 'zod';
import { conversationSettingsSchema, type ConversationSettings } from '@/domain/models';
import type {
  Agent,
  AgentDraft,
  AgoraUser,
  Message,
  Provider,
  Room,
  RoomDraft,
  Workspace,
} from '@/domain/models';

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
const providerTestSchema = z.object({
  reachable: z.boolean(),
  message: z.string(),
  modelsDiscovered: z.array(z.string()),
  testedAt: z.string(),
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
const roomReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  topic: z.string(),
  mode: z.enum(['debate', 'brainstorm', 'solve', 'free']),
  temporalMode: z.enum(['live', 'background', 'permanent']),
  visibility: z.enum(['private', 'shared', 'public']),
  status: z.enum(['draft', 'running', 'paused', 'stopped']),
  rules: z.string(),
  tools: z.array(z.string()),
  budgetLimit: z.coerce.number(),
  amountSpent: z.coerce.number(),
  maxMessages: z.number().nullable(),
  maxDurationMinutes: z.number(),
  conversationSettings: conversationSettingsSchema,
  cloudTokens: z.number(),
  localTokens: z.number(),
  version: z.number().int().positive(),
  participants: z.array(
    z.object({ agentId: z.string(), instructions: z.string(), isActive: z.boolean() }),
  ),
  startedAt: z.string().nullable(),
  createdAt: z.string(),
});
const messageReadSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  authorAgentId: z.string().nullable(),
  replyToId: z.string().nullable(),
  threadRootId: z.string().nullable().optional(),
  kind: z.enum(['message', 'system']),
  content: z.string(),
  reactions: z.array(
    z.object({
      emoji: z.string(),
      count: z.number().int().nonnegative(),
      reactedByMe: z.boolean(),
      agentIds: z.array(z.string()).default([]),
      actors: z
        .array(
          z.object({
            id: z.string(),
            displayName: z.string(),
            kind: z.enum(['user', 'agent']),
            isMe: z.boolean(),
          }),
        )
        .default([]),
    }),
  ),
  createdAt: z.string(),
});
const workspaceAnalyticsSchema = z.object({
  totalMessages: z.number().int().nonnegative(),
  humanMessages: z.number().int().nonnegative(),
  agentMessages: z.number().int().nonnegative(),
  totalReactions: z.number().int().nonnegative(),
  cloudCost: z.coerce.number().nonnegative(),
  cloudTokens: z.number().int().nonnegative(),
  localTokens: z.number().int().nonnegative(),
  activeAgents: z.number().int().nonnegative(),
  contributions: z.array(
    z.object({ agentId: z.string(), messageCount: z.number().int().nonnegative() }),
  ),
  recentEvents: z.array(
    z.object({
      id: z.string(),
      roomId: z.string(),
      roomName: z.string(),
      eventType: z.string(),
      actorAgentId: z.string().nullable(),
      occurredAt: z.string(),
    }),
  ),
});

export type WorkspaceAnalytics = z.infer<typeof workspaceAnalyticsSchema>;

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

function mapRoom(value: z.infer<typeof roomReadSchema>): Room {
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    topic: value.topic,
    mode: value.mode,
    temporalMode: value.temporalMode,
    visibility: value.visibility === 'public' ? 'shared' : value.visibility,
    status: value.status,
    rules: value.rules,
    tools: value.tools.filter((tool): tool is Room['tools'][number] =>
      ['web', 'files', 'code'].includes(tool),
    ),
    budget: value.budgetLimit,
    spent: value.amountSpent,
    maxMessages: value.maxMessages,
    maxMinutes: value.maxDurationMinutes,
    conversationSettings: value.conversationSettings,
    tokens: value.cloudTokens,
    localTokens: value.localTokens,
    simulatedTurns: 0,
    agentIds: value.participants.filter((item) => item.isActive).map((item) => item.agentId),
    createdAt: value.createdAt,
    startedAt: value.startedAt,
    version: value.version,
  };
}

function mapMessage(value: z.infer<typeof messageReadSchema>): Message {
  const reactions = Object.fromEntries(
    value.reactions.map((reaction) => {
      const actors = [
        ...reaction.agentIds,
        ...Array.from(
          { length: Math.max(0, reaction.count - reaction.agentIds.length) },
          (_, index) => `reaction-${index}`,
        ),
      ];
      if (reaction.reactedByMe && actors.length) actors[0] = 'human';
      return [reaction.emoji, actors];
    }),
  );
  const reactionActors = Object.fromEntries(
    value.reactions.map((reaction) => [
      reaction.emoji,
      reaction.actors.map((actor) => ({
        id: actor.id,
        name: actor.displayName,
        kind: actor.kind,
        isMe: actor.isMe,
      })),
    ]),
  );
  return {
    id: value.id,
    roomId: value.roomId,
    agentId: value.authorAgentId,
    kind: value.kind,
    text: value.content,
    createdAt: value.createdAt,
    reactions,
    reactionActors,
    ...(value.replyToId ? { replyTo: value.replyToId } : {}),
    ...(value.threadRootId ? { threadRootId: value.threadRootId } : {}),
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
  const response = await fetch('/api/session', { method: 'DELETE' });
  if (!response.ok)
    throw new ApiError('Impossible de fermer la session. Réessayez.', response.status);
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const result = await request('/api/backend/workspaces', pageOf(workspaceSchema));
  return result.items;
}

export async function listWorkspaceData(workspaceId: string) {
  const [providers, agents, rooms] = await Promise.all([
    request(`/api/backend/workspaces/${workspaceId}/providers`, pageOf(providerReadSchema)),
    request(`/api/backend/workspaces/${workspaceId}/agents`, pageOf(agentReadSchema)),
    request(`/api/backend/workspaces/${workspaceId}/rooms`, pageOf(roomReadSchema)),
  ]);
  return {
    providers: providers.items.map(mapProvider),
    agents: agents.items.map(mapAgent),
    rooms: rooms.items.map(mapRoom),
  };
}

export async function readWorkspaceAnalytics(workspaceId: string) {
  return request(`/api/backend/workspaces/${workspaceId}/analytics`, workspaceAnalyticsSchema);
}

export async function persistRoom(workspaceId: string, draft: RoomDraft, running: boolean) {
  const created = await request(`/api/backend/workspaces/${workspaceId}/rooms`, roomReadSchema, {
    method: 'POST',
    headers: { 'x-idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({
      name: draft.name,
      description: draft.description,
      topic: draft.topic,
      language: 'fr',
      mode: draft.mode,
      temporalMode: draft.temporalMode,
      visibility: draft.visibility,
      rules: draft.rules,
      tools: draft.tools,
      budgetLimit: draft.budget,
      maxMessages: draft.maxMessages,
      maxDurationMinutes: draft.maxMinutes,
      participantIds: draft.agentIds,
    }),
  });
  if (!running) return mapRoom(created);
  const started = await request(
    `/api/backend/workspaces/${workspaceId}/rooms/${created.id}/status`,
    roomReadSchema,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'running', expectedVersion: created.version }),
    },
  );
  return mapRoom(started);
}

export async function readRoom(workspaceId: string, roomId: string) {
  const [room, messages] = await Promise.all([
    request(`/api/backend/workspaces/${workspaceId}/rooms/${roomId}`, roomReadSchema),
    request(
      `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/messages?limit=50`,
      pageOf(messageReadSchema),
    ),
  ]);
  return {
    room: mapRoom(room),
    messages: messages.items.map(mapMessage),
    nextCursor: messages.nextCursor,
  };
}

export async function readOlderRoomMessages(workspaceId: string, roomId: string, before: string) {
  const query = new URLSearchParams({ limit: '50', before });
  const page = await request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/messages?${query}`,
    pageOf(messageReadSchema),
  );
  return { messages: page.items.map(mapMessage), nextCursor: page.nextCursor };
}

export async function persistRoomStatus(workspaceId: string, room: Room, status: Room['status']) {
  const result = await request(
    `/api/backend/workspaces/${workspaceId}/rooms/${room.id}/status`,
    roomReadSchema,
    { method: 'PATCH', body: JSON.stringify({ status, expectedVersion: room.version }) },
  );
  return mapRoom(result);
}

export async function persistParticipant(
  workspaceId: string,
  room: Room,
  agentId: string,
  present: boolean,
) {
  const result = await request(
    `/api/backend/workspaces/${workspaceId}/rooms/${room.id}/participants/${agentId}`,
    roomReadSchema,
    {
      method: 'PUT',
      body: JSON.stringify({ present, instructions: '', expectedVersion: room.version }),
    },
  );
  return mapRoom(result);
}

export async function persistMessage(
  workspaceId: string,
  roomId: string,
  content: string,
  replyToId?: string,
  threadRootId?: string,
) {
  const result = await request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/messages`,
    messageReadSchema,
    {
      method: 'POST',
      headers: { 'x-idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({
        content,
        ...(replyToId ? { replyToId } : {}),
        ...(threadRootId ? { threadRootId } : {}),
      }),
    },
  );
  return mapMessage(result);
}

export async function persistReaction(
  workspaceId: string,
  roomId: string,
  messageId: string,
  emoji: string,
  present: boolean,
) {
  const result = await request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
    messageReadSchema,
    { method: 'PUT', body: JSON.stringify({ present }) },
  );
  return mapMessage(result);
}

export function subscribeRoom(
  workspaceId: string,
  roomId: string,
  cursor: string,
  onEvent: (event: {
    cursor: string;
    type: string;
    agentId?: string;
    threadRootId?: string | null;
  }) => void,
) {
  let source: EventSource | null = null;
  let currentCursor = cursor;
  let lastActivity = Date.now();
  let reconnectTimer: number | undefined;
  let stopped = false;
  const eventTypes = [
    'room.created',
    'room.running',
    'room.paused',
    'room.stopped',
    'agent.joined',
    'agent.left',
    'message.created',
    'reaction.updated',
    'agent.failed',
    'agent.typing',
    'agent.idle',
  ];

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== undefined) return;
    source?.close();
    source = null;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, 1_500);
  };

  const connect = () => {
    if (stopped) return;
    const candidate = new EventSource(
      `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/stream?cursor=${encodeURIComponent(currentCursor)}`,
    );
    source = candidate;
    candidate.addEventListener('session.expired', () => {
      stopped = true;
      candidate.close();
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      const locale = window.location.pathname.split('/')[1] || 'fr';
      // Une navigation complète efface aussi les données privées conservées en mémoire.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/${locale}/connexion`);
    });
    candidate.onopen = () => {
      lastActivity = Date.now();
    };
    candidate.addEventListener('heartbeat', () => {
      lastActivity = Date.now();
    });
    const listener = (event: Event) => {
      const message = event as MessageEvent;
      lastActivity = Date.now();
      currentCursor = message.lastEventId || currentCursor;
      let agentId: string | undefined;
      let threadRootId: string | null | undefined;
      try {
        const data = JSON.parse(message.data) as {
          payload?: { agentId?: string; threadRootId?: string | null };
        };
        agentId = data.payload?.agentId;
        threadRootId = data.payload?.threadRootId;
      } catch {
        // Un événement métier reste exploitable même si sa charge utile est absente.
      }
      onEvent({ cursor: currentCursor, type: event.type, agentId, threadRootId });
    };
    eventTypes.forEach((type) => candidate.addEventListener(type, listener));
    candidate.onerror = () => {
      if (source === candidate) scheduleReconnect();
    };
  };

  connect();
  const watchdog = window.setInterval(() => {
    if (Date.now() - lastActivity > 45_000) {
      scheduleReconnect();
    }
  }, 15_000);

  return () => {
    stopped = true;
    source?.close();
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    window.clearInterval(watchdog);
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

export async function verifyProvider(workspaceId: string, providerId: string) {
  return request(
    `/api/backend/workspaces/${workspaceId}/providers/${providerId}/test`,
    providerTestSchema,
    { method: 'POST' },
  );
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

const memorySchema = z.object({
  entries: z.array(
    z.object({
      kind: z.enum(['position', 'question', 'engagement', 'accord', 'desaccord']),
      text: z.string(),
      messageIds: z.array(z.string()),
      authorAgentIds: z.array(z.string()),
    }),
  ),
  updatedAt: z.string().nullable(),
  throughMessageId: z.string().nullable(),
  revision: z.number(),
});
export type ConversationMemory = z.infer<typeof memorySchema>;
export function readMemory(workspaceId: string, roomId: string, signal?: AbortSignal) {
  return request(`/api/backend/workspaces/${workspaceId}/rooms/${roomId}/memory`, memorySchema, {
    signal,
  });
}
export function refreshMemory(workspaceId: string, roomId: string) {
  return request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/memory`,
    z.object({ status: z.string() }),
    { method: 'POST' },
  );
}

export async function updateConversationSettings(
  workspaceId: string,
  room: Room,
  settings: ConversationSettings,
  tools?: Room['tools'],
) {
  return mapRoom(
    await request(
      `/api/backend/workspaces/${workspaceId}/rooms/${room.id}/conversation-settings`,
      roomReadSchema,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...settings,
          expectedVersion: room.version,
          ...(tools ? { tools } : {}),
        }),
      },
    ),
  );
}

export async function searchRoomMessages(
  workspaceId: string,
  roomId: string,
  filters: Record<string, string>,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const page = await request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/messages/search?${query}`,
    pageOf(messageReadSchema),
    { signal },
  );
  return { messages: page.items.map(mapMessage), nextCursor: page.nextCursor };
}
export async function readMessageContext(workspaceId: string, roomId: string, messageId: string) {
  const page = await request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/messages/${messageId}/context`,
    pageOf(messageReadSchema),
  );
  return page.items.map(mapMessage);
}

export async function readThreadMessages(
  workspaceId: string,
  roomId: string,
  rootId: string,
  before?: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    thread_root_id: rootId,
    limit: '50',
    ...(before ? { before } : {}),
  });
  const page = await request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/messages?${query}`,
    pageOf(messageReadSchema),
    { signal },
  );
  return { messages: page.items.map(mapMessage), nextCursor: page.nextCursor };
}

const resourceSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  kind: z.enum(['document', 'source']),
  title: z.string(),
  url: z.string().nullable(),
  filename: z.string().nullable(),
  excerpt: z.string(),
  createdAt: z.string(),
});
export type RoomResource = z.infer<typeof resourceSchema>;
export function listRoomResources(workspaceId: string, roomId: string, signal?: AbortSignal) {
  return request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/resources`,
    pageOf(resourceSchema),
    { signal },
  );
}
export function addRoomSource(workspaceId: string, roomId: string, url: string) {
  return request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/resources/sources`,
    resourceSchema,
    { method: 'POST', body: JSON.stringify({ url }) },
  );
}
export function readRoomResource(workspaceId: string, roomId: string, id: string) {
  return request(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/resources/${id}`,
    resourceSchema.extend({ content: z.string() }),
  );
}
export async function uploadRoomDocument(workspaceId: string, roomId: string, file: File) {
  const form = new FormData();
  form.set('file', file);
  const response = await fetch(
    `/api/backend/workspaces/${workspaceId}/rooms/${roomId}/resources/documents`,
    { method: 'POST', body: form },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? 'Le document n’a pas pu être importé.');
  return resourceSchema.parse(data);
}
