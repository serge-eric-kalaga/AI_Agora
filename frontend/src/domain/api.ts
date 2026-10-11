/**
 * Proposed boundary for the later FastAPI integration, not an active HTTP client.
 * Credentials are deliberately absent from frontend entities and event payloads.
 */
import type { Agent, AgentDraft, Message, Provider, Room, RoomDraft } from './models';

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CommandContext {
  idempotencyKey: string;
  expectedVersion?: number;
}

export type RoomEventPayload =
  | { type: 'message.created'; message: Message }
  | { type: 'reaction.created'; messageId: string; reactions: Message['reactions'] }
  | { type: 'agent.joined'; agentId: string }
  | { type: 'agent.left'; agentId: string }
  | { type: 'room.started' | 'room.paused' | 'room.stopped'; room: Room }
  | { type: 'budget.threshold'; spent: number; budget: number }
  | { type: 'error'; code: string; message: string; retryable: boolean };

export interface RoomEvent {
  schemaVersion: 1;
  id: string;
  roomId: string;
  cursor: string;
  occurredAt: string;
  payload: RoomEventPayload;
}

export interface AgoraApi {
  listAgents(signal?: AbortSignal): Promise<PageResult<Agent>>;
  saveAgent(draft: AgentDraft, context: CommandContext, id?: string): Promise<Agent>;
  listProviders(signal?: AbortSignal): Promise<Provider[]>;
  listRooms(cursor?: string, signal?: AbortSignal): Promise<PageResult<Room>>;
  createRoom(draft: RoomDraft, context: CommandContext): Promise<Room>;
  getRoom(id: string, signal?: AbortSignal): Promise<Room>;
  setRoomStatus(id: string, status: Room['status'], context: CommandContext): Promise<Room>;
  getMessages(roomId: string, cursor?: string, signal?: AbortSignal): Promise<PageResult<Message>>;
  sendMessage(
    roomId: string,
    draft: { text: string; replyTo?: string },
    context: CommandContext,
  ): Promise<Message>;
  setParticipant(
    roomId: string,
    agentId: string,
    present: boolean,
    context: CommandContext,
  ): Promise<Room>;
  setReaction(
    roomId: string,
    messageId: string,
    emoji: string,
    present: boolean,
    context: CommandContext,
  ): Promise<Message>;
  /** Return an unsubscribe function; reconnect from the last processed cursor. */
  subscribe(roomId: string, onEvent: (event: RoomEvent) => void, cursor?: string): () => void;
}
