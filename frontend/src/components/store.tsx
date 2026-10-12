'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { transition, type Command, type Envelope } from '@/domain/engine';
import type {
  Agent,
  AgentDraft,
  AgoraState,
  AgoraUser,
  Provider,
  Room,
  RoomDraft,
  Message,
  Workspace,
} from '@/domain/models';
import { LocalAgoraRepository } from '@/data/repository';
import {
  authenticate,
  endSession,
  listWorkspaceData,
  listWorkspaces,
  persistMessage,
  persistParticipant,
  persistReaction,
  persistRoom,
  persistRoomStatus,
  persistAgent,
  persistProvider,
  readSession,
  readOlderRoomMessages,
  readRoom,
  subscribeRoom as subscribeRoomEvents,
  verifyProvider,
} from '@/data/http-api';
import { seed } from '@/data/seed';
import { t } from '@/i18n';

const repository = new LocalAgoraRepository();
const demoMode = process.env.NEXT_PUBLIC_DATA_MODE === 'demo';
const workspaceStorageKey = 'ai-agora.active-workspace';

type Store = {
  state: AgoraState;
  ready: boolean;
  mode: 'demo' | 'api';
  user: AgoraUser | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  dispatch: (command: Command) => void;
  login: (payload: { login: string; password: string }) => Promise<void>;
  register: (payload: { email: string; username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  saveProvider: (provider: Provider, apiKey?: string) => Promise<Provider>;
  testProvider: (provider: Provider) => Promise<{ reachable: boolean; message: string }>;
  saveAgent: (draft: AgentDraft, existing?: Agent) => Promise<Agent>;
  createRoom: (draft: RoomDraft, running: boolean) => Promise<Room>;
  loadRoom: (roomId: string) => Promise<{ nextCursor: string | null }>;
  loadOlderMessages: (
    roomId: string,
    before: string,
  ) => Promise<{ messages: Message[]; nextCursor: string | null }>;
  setRoomStatus: (room: Room, status: Room['status']) => Promise<Room>;
  setParticipant: (room: Room, agentId: string, present: boolean) => Promise<Room>;
  sendMessage: (roomId: string, content: string, replyToId?: string) => Promise<void>;
  setReaction: (message: Message, emoji: string, present: boolean) => Promise<Message>;
  subscribeRoom: (
    roomId: string,
    onTyping?: (agentId: string, typing: boolean) => void,
  ) => () => void;
  storageWarning: string;
  toast: string;
  notify: (text: string) => void;
};

type StoreAction =
  | Envelope
  | { hydrate: AgoraState }
  | { remote: Pick<AgoraState, 'agents' | 'providers' | 'rooms'> }
  | { agent: Agent }
  | { provider: Provider }
  | { room: Room }
  | { roomData: { room: Room; messages: Message[]; nextCursor: string | null } }
  | { olderMessages: Message[] }
  | { message: Message };

const Context = createContext<Store | null>(null);

function mergeMessages(current: Message[], incoming: Message[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => messages.set(message.id, message));
  return [...messages.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
}

function reducer(state: AgoraState, action: StoreAction): AgoraState {
  if ('hydrate' in action) return action.hydrate;
  if ('remote' in action) return { ...state, ...action.remote, messages: [], events: [] };
  if ('agent' in action) {
    const exists = state.agents.some((agent) => agent.id === action.agent.id);
    return {
      ...state,
      agents: exists
        ? state.agents.map((agent) => (agent.id === action.agent.id ? action.agent : agent))
        : [...state.agents, action.agent],
    };
  }
  if ('provider' in action) {
    const exists = state.providers.some((provider) => provider.id === action.provider.id);
    return {
      ...state,
      providers: exists
        ? state.providers.map((provider) =>
            provider.id === action.provider.id ? action.provider : provider,
          )
        : [...state.providers, action.provider],
    };
  }
  if ('roomData' in action) {
    return {
      ...state,
      rooms: state.rooms.some((room) => room.id === action.roomData.room.id)
        ? state.rooms.map((room) =>
            room.id === action.roomData.room.id ? action.roomData.room : room,
          )
        : [action.roomData.room, ...state.rooms],
      messages: mergeMessages(state.messages, action.roomData.messages),
    };
  }
  if ('olderMessages' in action)
    return { ...state, messages: mergeMessages(state.messages, action.olderMessages) };
  if ('room' in action) {
    const exists = state.rooms.some((room) => room.id === action.room.id);
    return {
      ...state,
      rooms: exists
        ? state.rooms.map((room) => (room.id === action.room.id ? action.room : room))
        : [action.room, ...state.rooms],
    };
  }
  if ('message' in action) {
    const exists = state.messages.some((message) => message.id === action.message.id);
    return {
      ...state,
      messages: exists
        ? state.messages.map((message) =>
            message.id === action.message.id ? action.message : message,
          )
        : [...state.messages, action.message],
    };
  }
  return transition(state, action);
}

export function AgoraProvider({ children }: { children: ReactNode }) {
  const [state, send] = useReducer(reducer, seed);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AgoraUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState('');
  const [toast, notify] = useState('');

  const loadAccount = useCallback(async () => {
    const available = await listWorkspaces();
    const remembered = window.localStorage.getItem(workspaceStorageKey);
    const selected = available.find((workspace) => workspace.id === remembered) ?? available[0];
    setWorkspaces(available);
    setActiveWorkspaceId(selected?.id ?? null);
    if (!selected) {
      send({ remote: { agents: [], providers: [], rooms: [] } });
      return;
    }
    window.localStorage.setItem(workspaceStorageKey, selected.id);
    send({ remote: await listWorkspaceData(selected.id) });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        if (demoMode) {
          const result = await repository.load();
          if (cancelled) return;
          send({ hydrate: result.state });
          if (result.recovered) setStorageWarning(t.shell.storageInvalid);
        } else {
          const currentUser = await readSession();
          if (cancelled) return;
          setUser(currentUser);
          if (currentUser) await loadAccount();
        }
      } catch (error) {
        if (!cancelled)
          setStorageWarning(error instanceof Error ? error.message : t.shell.storageError);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadAccount]);

  useEffect(() => {
    if (demoMode && ready)
      repository.save(state).catch(() => setStorageWarning(t.shell.storageError));
  }, [state, ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => notify(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const dispatch = useCallback((command: Command) => {
    send({ command, id: crypto.randomUUID(), now: new Date().toISOString() });
  }, []);

  async function establishSession(action: 'login' | 'register', payload: Record<string, string>) {
    setReady(false);
    try {
      setUser(await authenticate(action, payload));
      await loadAccount();
    } finally {
      setReady(true);
    }
  }

  async function logout() {
    await endSession();
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    send({ remote: { agents: [], providers: [], rooms: [] } });
  }

  async function selectWorkspace(id: string) {
    if (!workspaces.some((workspace) => workspace.id === id)) return;
    setReady(false);
    try {
      send({ remote: await listWorkspaceData(id) });
      setActiveWorkspaceId(id);
      window.localStorage.setItem(workspaceStorageKey, id);
    } finally {
      setReady(true);
    }
  }

  async function saveProvider(provider: Provider, apiKey?: string) {
    if (demoMode) {
      dispatch({ type: 'provider.save', provider });
      return provider;
    }
    if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
    const saved = await persistProvider(activeWorkspaceId, provider, apiKey);
    send({ provider: saved });
    return saved;
  }

  async function testProvider(provider: Provider) {
    if (demoMode) return { reachable: true, message: t.providers.testSuccessDemo };
    if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
    const result = await verifyProvider(activeWorkspaceId, provider.id);
    if (result.reachable && result.modelsDiscovered.length) {
      send({ provider: { ...provider, models: result.modelsDiscovered } });
    }
    return result;
  }

  async function saveAgent(draft: AgentDraft, existing?: Agent) {
    if (demoMode) {
      const saved: Agent = { ...draft, id: existing?.id ?? crypto.randomUUID(), version: 1 };
      dispatch({ type: 'agent.save', agent: saved });
      return saved;
    }
    if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
    const saved = await persistAgent(activeWorkspaceId, draft, existing);
    send({ agent: saved });
    return saved;
  }

  async function createRoom(draft: RoomDraft, running: boolean) {
    if (demoMode) {
      const now = new Date().toISOString();
      const room: Room = {
        ...draft,
        id: crypto.randomUUID(),
        status: running ? 'running' : 'paused',
        createdAt: now,
        startedAt: running ? now : null,
        spent: 0,
        tokens: 0,
        localTokens: 0,
        simulatedTurns: 0,
        version: 1,
      };
      dispatch({ type: 'room.create', room });
      return room;
    }
    if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
    const room = await persistRoom(activeWorkspaceId, draft, running);
    send({ room });
    return room;
  }

  const loadRoom = useCallback(
    async (roomId: string) => {
      if (demoMode) return { nextCursor: null };
      if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
      const roomData = await readRoom(activeWorkspaceId, roomId);
      send({ roomData });
      return { nextCursor: roomData.nextCursor };
    },
    [activeWorkspaceId],
  );

  const loadOlderMessages = useCallback(
    async (roomId: string, before: string) => {
      if (demoMode) return { messages: [], nextCursor: null };
      if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
      const page = await readOlderRoomMessages(activeWorkspaceId, roomId, before);
      send({ olderMessages: page.messages });
      return page;
    },
    [activeWorkspaceId],
  );

  async function setRoomStatus(room: Room, status: Room['status']) {
    if (demoMode) {
      dispatch({ type: 'room.status', roomId: room.id, status });
      return { ...room, status };
    }
    if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
    const saved = await persistRoomStatus(activeWorkspaceId, room, status);
    send({ room: saved });
    return saved;
  }

  async function setParticipant(room: Room, agentId: string, present: boolean) {
    if (demoMode) {
      dispatch({ type: 'room.participant', roomId: room.id, agentId, add: present });
      return room;
    }
    if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
    const saved = await persistParticipant(activeWorkspaceId, room, agentId, present);
    send({ room: saved });
    return saved;
  }

  async function sendMessage(roomId: string, content: string, replyToId?: string) {
    if (demoMode) {
      dispatch({ type: 'message.send', roomId, text: content, replyTo: replyToId });
      return;
    }
    if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
    const message = await persistMessage(activeWorkspaceId, roomId, content, replyToId);
    send({ message });
  }

  async function setReaction(message: Message, emoji: string, present: boolean) {
    if (demoMode) {
      dispatch({ type: 'message.react', messageId: message.id, emoji });
      return message;
    }
    if (!activeWorkspaceId) throw new Error(t.session.noWorkspace);
    const saved = await persistReaction(
      activeWorkspaceId,
      message.roomId,
      message.id,
      emoji,
      present,
    );
    send({ message: saved });
    return saved;
  }

  const subscribeRoom = useCallback(
    (roomId: string, onTyping?: (agentId: string, typing: boolean) => void) => {
      if (demoMode || !activeWorkspaceId) return () => undefined;
      const key = `ai-agora.room-cursor.${roomId}`;
      const cursor = window.sessionStorage.getItem(key) ?? '0';
      const refreshRoom = () => {
        void readRoom(activeWorkspaceId, roomId)
          .then((roomData) => send({ roomData }))
          .catch(() => undefined);
      };
      const unsubscribe = subscribeRoomEvents(activeWorkspaceId, roomId, cursor, (event) => {
        window.sessionStorage.setItem(key, event.cursor);
        if ((event.type === 'agent.typing' || event.type === 'agent.idle') && event.agentId) {
          onTyping?.(event.agentId, event.type === 'agent.typing');
          return;
        }
        refreshRoom();
      });
      // La relecture périodique couvre les suspensions longues du navigateur ou du réseau.
      const fallback = window.setInterval(refreshRoom, 15_000);
      return () => {
        unsubscribe();
        window.clearInterval(fallback);
      };
    },
    [activeWorkspaceId],
  );

  return (
    <Context.Provider
      value={{
        state,
        ready,
        mode: demoMode ? 'demo' : 'api',
        user,
        workspaces,
        activeWorkspaceId,
        dispatch,
        login: (payload) => establishSession('login', payload),
        register: (payload) => establishSession('register', payload),
        logout,
        selectWorkspace,
        saveProvider,
        testProvider,
        saveAgent,
        createRoom,
        loadRoom,
        loadOlderMessages,
        setRoomStatus,
        setParticipant,
        sendMessage,
        setReaction,
        subscribeRoom,
        storageWarning,
        toast,
        notify,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAgora() {
  const store = useContext(Context);
  if (!store) throw new Error('AgoraProvider missing');
  return store;
}
