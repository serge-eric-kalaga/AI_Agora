'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useAgora } from '@/components/store';
import { Modal, PageHeading } from '@/components/ui';
import { t } from '@/i18n';
const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  isActive: z.boolean(),
  isSuperadmin: z.boolean(),
});
const roomSchema = z.object({
  id: z.string(),
  workspaceName: z.string(),
  name: z.string(),
  topic: z.string(),
  status: z.string(),
  messageCount: z.number(),
});
const messageSchema = z.object({
  id: z.string(),
  content: z.string(),
  authorUserName: z.string().nullable(),
  authorAgentId: z.string().nullable(),
  authorAgentName: z.string().nullable(),
  createdAt: z.string(),
  threadRootId: z.string().nullable(),
});
type User = z.infer<typeof userSchema>;
type Room = z.infer<typeof roomSchema>;
type Message = z.infer<typeof messageSchema>;
async function read<S extends z.ZodType>(path: string, schema: S) {
  const response = await fetch(`/api/backend/admin/${path}`, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? 'Lecture indisponible.');
  return schema.parse(body);
}
const pageUsers = z.object({ items: z.array(userSchema), nextCursor: z.string().nullable() });
const pageRooms = z.object({ items: z.array(roomSchema), nextCursor: z.string().nullable() });
const pageMessages = z.object({ items: z.array(messageSchema), nextCursor: z.string().nullable() });
export function Administration() {
  const { user, state } = useAgora();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [roomCursor, setRoomCursor] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user?.isSuperadmin) return;
    let cancelled = false;
    Promise.all([
      read(`users?q=${encodeURIComponent(search)}`, pageUsers),
      read(`rooms?q=${encodeURIComponent(search)}`, pageRooms),
    ])
      .then(([people, places]) => {
        if (!cancelled) {
          setUsers(people.items);
          setUserCursor(people.nextCursor);
          setRooms(places.items);
          setRoomCursor(places.nextCursor);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [search, user?.isSuperadmin]);
  async function more(kind: 'users' | 'rooms') {
    setBusy(true);
    try {
      const cursor = kind === 'users' ? userCursor : roomCursor;
      const path = `${kind}?q=${encodeURIComponent(search)}&cursor=${cursor}`;
      if (kind === 'users') {
        const page = await read(path, pageUsers);
        setUsers((previous) => [...previous, ...page.items]);
        setUserCursor(page.nextCursor);
      } else {
        const page = await read(path, pageRooms);
        setRooms((previous) => [...previous, ...page.items]);
        setRoomCursor(page.nextCursor);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture indisponible.');
    } finally {
      setBusy(false);
    }
  }
  async function openRoom(selected: Room, cursor?: string) {
    setBusy(true);
    try {
      const page = await read(
        `rooms/${selected.id}/messages${cursor ? `?cursor=${cursor}` : ''}`,
        pageMessages,
      );
      setMessages((previous) => (cursor ? [...previous, ...page.items] : page.items));
      setMessageCursor(page.nextCursor);
      setRoom(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture indisponible.');
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setSearch(query);
  }
  if (!user?.isSuperadmin)
    return <p role="alert">Cette page est réservée à l’administration globale.</p>;
  return (
    <>
      <PageHeading
        eyebrow={t.administration.superadmin}
        title={t.administration.title}
        description={t.administration.subtitle}
      />
      {error && <p role="alert">{error}</p>}
      <form onSubmit={submit}>
        <label className="field">
          <span>{t.administration.search}</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="button secondary">{t.administration.search}</button>
      </form>
      <section className="panel collaboration-panel">
        <h2>{t.administration.users}</h2>
        {users.map((u) => (
          <div className="collaborator-row" key={u.id}>
            <div>
              <strong>{u.username}</strong>
              <p>{u.email}</p>
            </div>
            <span>
              {u.isSuperadmin
                ? t.administration.superadmin
                : u.isActive
                  ? t.administration.active
                  : t.administration.inactive}
            </span>
          </div>
        ))}
        {!users.length && <p>{t.administration.empty}</p>}
        {userCursor && (
          <button disabled={busy} className="button secondary" onClick={() => void more('users')}>
            {t.administration.load}
          </button>
        )}
      </section>
      <section className="panel collaboration-panel">
        <h2>{t.administration.rooms}</h2>
        {rooms.map((r) => (
          <div className="collaborator-row" key={r.id}>
            <div>
              <strong>{r.name}</strong>
              <p>
                {r.workspaceName} · {r.topic}
              </p>
              <small>
                {r.messageCount} {t.administration.messages}
              </small>
            </div>
            <button className="button secondary" disabled={busy} onClick={() => void openRoom(r)}>
              {t.administration.open}
            </button>
          </div>
        ))}
        {!rooms.length && <p>{t.administration.empty}</p>}
        {roomCursor && (
          <button disabled={busy} className="button secondary" onClick={() => void more('rooms')}>
            {t.administration.load}
          </button>
        )}
      </section>
      <Modal
        open={!!room}
        onClose={() => setRoom(null)}
        title={room?.name ?? t.administration.rooms}
      >
        {messages.map((m) => (
          <article key={m.id} className="notification-item">
            <strong>
              {m.authorUserName ??
                m.authorAgentName ??
                state.agents.find((a) => a.id === m.authorAgentId)?.name ??
                'Agent'}
            </strong>
            <small> · {new Date(m.createdAt).toLocaleString(t.locale)}</small>
            <p style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>
          </article>
        ))}
        {messageCursor && room && (
          <button
            disabled={busy}
            className="button secondary"
            onClick={() => void openRoom(room, messageCursor)}
          >
            {t.administration.load}
          </button>
        )}
      </Modal>
    </>
  );
}
