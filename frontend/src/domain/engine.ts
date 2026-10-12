import type { AgoraState, Agent, Message, Provider, Room, ToolId } from './models';
import { t } from '@/i18n';

export type Command =
  | { type: 'agent.save'; agent: Agent }
  | { type: 'room.create'; room: Room }
  | { type: 'room.status'; roomId: string; status: Room['status'] }
  | { type: 'room.participant'; roomId: string; agentId: string; add: boolean }
  | { type: 'message.send'; roomId: string; text: string; replyTo?: string }
  | { type: 'message.react'; messageId: string; emoji: string }
  | { type: 'room.simulate'; roomId: string; selection: number }
  | { type: 'room.summary'; roomId: string }
  | { type: 'provider.save'; provider: Provider };
export type Envelope = { command: Command; id: string; now: string };
export function effectiveTools(agent: Agent, room: Room): ToolId[] {
  return agent.tools.filter((tool) => room.tools.includes(tool));
}
export function eligibleAgents(state: AgoraState, room: Room): Agent[] {
  return state.agents.filter(
    (agent) =>
      room.agentIds.includes(agent.id) &&
      agent.active &&
      state.providers.some((p) => p.id === agent.providerId && p.connected),
  );
}
function event(
  state: AgoraState,
  env: Envelope,
  roomId: string | null,
  text: string,
  tone: 'info' | 'success' | 'warning' = 'info',
): AgoraState {
  return {
    ...state,
    events: [
      { id: env.id + '-event', roomId, text, createdAt: env.now, tone },
      ...state.events,
    ].slice(0, 500),
  };
}
function addMessage(
  state: AgoraState,
  env: Envelope,
  roomId: string,
  text: string,
  agentId: string | null,
  kind: Message['kind'] = 'message',
  replyTo?: string,
): AgoraState {
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        id: env.id,
        roomId,
        text,
        agentId,
        kind,
        createdAt: env.now,
        reactions: {},
        ...(replyTo ? { replyTo } : {}),
      },
    ],
  };
}
function stopAtLimit(state: AgoraState, env: Envelope, room: Room, reason: string): AgoraState {
  const next = {
    ...state,
    rooms: state.rooms.map((r) => (r.id === room.id ? { ...r, status: 'stopped' as const } : r)),
  };
  return event(
    addMessage(next, env, room.id, reason, null, 'system'),
    env,
    room.id,
    reason,
    'warning',
  );
}
// Pure domain transitions. A future API adapter can dispatch the same intent to FastAPI.
export function transition(state: AgoraState, env: Envelope): AgoraState {
  const { command: c } = env;
  if (c.type === 'agent.save') {
    const exists = state.agents.some((a) => a.id === c.agent.id);
    return event(
      {
        ...state,
        agents: exists
          ? state.agents.map((a) => (a.id === c.agent.id ? c.agent : a))
          : [...state.agents, c.agent],
      },
      env,
      null,
      `${c.agent.name} · ${exists ? t.editor.updated : t.editor.created}`,
      'success',
    );
  }
  if (c.type === 'provider.save')
    return event(
      {
        ...state,
        providers: state.providers.map((p) => (p.id === c.provider.id ? c.provider : p)),
      },
      env,
      null,
      `${c.provider.name} · ${t.providers.saved}`,
    );
  if (c.type === 'room.create')
    return event(
      { ...state, rooms: [c.room, ...state.rooms] },
      env,
      c.room.id,
      `${c.room.name} · ${t.rooms.created}`,
      'success',
    );
  if (c.type === 'message.react')
    return {
      ...state,
      messages: state.messages.map((m) => {
        if (m.id !== c.messageId || m.kind === 'system') return m;
        const actors = m.reactions[c.emoji] ?? [];
        return {
          ...m,
          reactions: {
            ...m.reactions,
            [c.emoji]: actors.includes('human')
              ? actors.filter((a) => a !== 'human')
              : [...actors, 'human'],
          },
        };
      }),
    };
  const room = state.rooms.find((r) => r.id === c.roomId);
  if (!room) return state;
  if (c.type === 'room.status') {
    if (room.status === 'stopped') return state;
    const text =
      c.status === 'running'
        ? t.chat.resumeEvent
        : c.status === 'paused'
          ? t.chat.pauseEvent
          : t.chat.stopEvent;
    return event(
      addMessage(
        {
          ...state,
          rooms: state.rooms.map((r) =>
            r.id === room.id
              ? {
                  ...r,
                  status: c.status,
                  startedAt: c.status === 'running' ? (r.startedAt ?? env.now) : r.startedAt,
                }
              : r,
          ),
        },
        env,
        room.id,
        text,
        null,
        'system',
      ),
      env,
      room.id,
      text,
    );
  }
  if (c.type === 'room.participant') {
    if (!state.agents.some((a) => a.id === c.agentId)) return state;
    if (c.add === room.agentIds.includes(c.agentId)) return state;
    const agent = state.agents.find((a) => a.id === c.agentId)!;
    const text = `${agent.name} · ${c.add ? t.chat.added : t.chat.removed}`;
    return event(
      addMessage(
        {
          ...state,
          rooms: state.rooms.map((r) =>
            r.id === room.id
              ? {
                  ...r,
                  agentIds: c.add
                    ? [...r.agentIds, c.agentId]
                    : r.agentIds.filter((id) => id !== c.agentId),
                }
              : r,
          ),
        },
        env,
        room.id,
        text,
        null,
        'system',
      ),
      env,
      room.id,
      text,
    );
  }
  if (c.type === 'message.send') {
    const text = c.text.trim().slice(0, 8000);
    if (!text) return state;
    const reply = state.messages.find((m) => m.id === c.replyTo && m.roomId === room.id)?.id;
    return addMessage(state, env, room.id, text, null, 'message', reply);
  }
  if (c.type === 'room.summary')
    return addMessage(
      state,
      env,
      room.id,
      t.chat.summaryText
        .replace('{topic}', room.topic)
        .replace(
          '{count}',
          String(state.messages.filter((m) => m.roomId === room.id && m.kind === 'message').length),
        ),
      null,
      'system',
    );
  if (c.type === 'room.simulate') {
    if (room.status !== 'running') return state;
    const minutes = room.startedAt ? (Date.parse(env.now) - Date.parse(room.startedAt)) / 60000 : 0;
    if (minutes >= room.maxMinutes) return stopAtLimit(state, env, room, t.chat.limitEvent);
    if (room.spent >= room.budget) return stopAtLimit(state, env, room, t.chat.budgetEvent);
    let eligible = eligibleAgents(state, room);
    if (!eligible.length)
      return event(
        {
          ...state,
          rooms: state.rooms.map((r) =>
            r.id === room.id ? { ...r, status: 'paused' as const } : r,
          ),
        },
        env,
        room.id,
        t.chat.noEligible,
        'warning',
      );
    // Prefer a different speaker without imposing a rigid round-robin order.
    const last = state.messages.filter((m) => m.roomId === room.id && m.agentId).at(-1)?.agentId;
    if (eligible.length > 1) eligible = eligible.filter((a) => a.id !== last);
    const agent =
      eligible[Math.floor(Math.max(0, Math.min(0.99999, c.selection)) * eligible.length)];
    const local = state.providers.find((p) => p.id === agent.providerId)?.kind === 'local';
    const cost = local ? 0 : 0.02;
    if (room.spent + cost > room.budget + 0.000001)
      return stopAtLimit(state, env, room, t.chat.budgetEvent);
    const text = t.chat.simulations[room.simulatedTurns % t.chat.simulations.length].replace(
      '{topic}',
      room.topic,
    );
    const updated: Room = {
      ...room,
      simulatedTurns: room.simulatedTurns + 1,
      spent: Math.round((room.spent + cost) * 10000) / 10000,
      tokens: room.tokens + (local ? 0 : 400),
      localTokens: room.localTokens + (local ? 400 : 0),
    };
    const reached = updated.spent >= updated.budget;
    if (reached) updated.status = 'stopped';
    const next = addMessage(
      { ...state, rooms: state.rooms.map((r) => (r.id === room.id ? updated : r)) },
      env,
      room.id,
      text,
      agent.id,
    );
    return reached
      ? event(
          next,
          env,
          room.id,
          updated.spent >= updated.budget ? t.chat.budgetEvent : t.chat.limitEvent,
          'warning',
        )
      : next;
  }
  return state;
}
