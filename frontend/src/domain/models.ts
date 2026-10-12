import { z } from 'zod';

export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['cloud', 'local']),
  models: z.array(z.string()),
  connected: z.boolean(),
  endpoint: z.string(),
  color: z.string(),
  hasApiKey: z.boolean().default(false),
});
export const toolIds = ['web', 'files', 'code'] as const;
export type ToolId = (typeof toolIds)[number];
export const agentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.string(),
  description: z.string(),
  providerId: z.string(),
  model: z.string(),
  color: z.string(),
  active: z.boolean(),
  systemPrompt: z.string(),
  traits: z.object({
    creativity: z.number().min(0).max(100),
    rigor: z.number().min(0).max(100),
    humor: z.number().min(0).max(100),
    diplomacy: z.number().min(0).max(100),
  }),
  tools: z.array(z.enum(toolIds)),
  temperature: z.number(),
  maxTokens: z.number(),
  version: z.number().int().positive().default(1),
});
export const messageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  agentId: z.string().nullable(),
  kind: z.enum(['message', 'system']),
  text: z.string(),
  createdAt: z.string(),
  reactions: z.record(z.string(), z.array(z.string())),
  replyTo: z.string().optional(),
});
export const roomSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  topic: z.string(),
  mode: z.enum(['debate', 'brainstorm', 'solve', 'free']),
  temporalMode: z.enum(['live', 'background', 'permanent']),
  agentIds: z.array(z.string()),
  visibility: z.enum(['private', 'shared']),
  rules: z.string(),
  tools: z.array(z.enum(toolIds)),
  status: z.enum(['draft', 'running', 'paused', 'stopped']),
  budget: z.number().positive(),
  spent: z.number().nonnegative(),
  maxMessages: z.number().positive().nullable(),
  maxMinutes: z.number().positive(),
  tokens: z.number().nonnegative(),
  localTokens: z.number().nonnegative(),
  simulatedTurns: z.number().nonnegative(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  version: z.number().int().positive().default(1),
});
export const eventSchema = z.object({
  id: z.string(),
  roomId: z.string().nullable(),
  text: z.string(),
  createdAt: z.string(),
  tone: z.enum(['success', 'info', 'warning']),
});
export const stateSchema = z.object({
  version: z.literal(1),
  agents: z.array(agentSchema),
  rooms: z.array(roomSchema),
  providers: z.array(providerSchema),
  messages: z.array(messageSchema),
  events: z.array(eventSchema),
});
export type Agent = z.infer<typeof agentSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type Room = z.infer<typeof roomSchema>;
export type Message = z.infer<typeof messageSchema>;
export type AgoraState = z.infer<typeof stateSchema>;
export type RoomDraft = Omit<
  Room,
  | 'id'
  | 'status'
  | 'spent'
  | 'tokens'
  | 'localTokens'
  | 'simulatedTurns'
  | 'createdAt'
  | 'startedAt'
  | 'version'
>;
export type AgentDraft = Omit<Agent, 'id' | 'version'>;

export type AgoraUser = {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  createdAt: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: 'owner' | 'editor' | 'viewer' | null;
  createdAt: string;
};
