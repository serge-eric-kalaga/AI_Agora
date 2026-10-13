'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAgora } from '@/components/store';
import { usePersistentBoolean } from '@/components/persistent-state';
import { searchRoomMessages } from '@/data/http-api';
import type { Message, Room } from '@/domain/models';
import { t, formatTime } from '@/i18n';

export function MessageSearchPanel({
  room,
  onNavigate,
}: {
  room: Room;
  onNavigate: (id: string) => Promise<void>;
}) {
  const { activeWorkspaceId, state, user, notify } = useAgora();
  const [expanded, setExpanded] = usePersistentBoolean(
    `ai-agora.search-expanded:${room.id}`,
    false,
  );
  const [text, setText] = useState('');
  const [participant, setParticipant] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [results, setResults] = useState<Message[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const filters = useRef<Record<string, string>>({});
  useEffect(() => () => controller.current?.abort(), []);
  async function search(more = false) {
    if (!activeWorkspaceId || pending) return;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    if (!more)
      filters.current = {
        q: text,
        ...(participant === 'me' ? { user_id: user?.id ?? '' } : { agent_id: participant }),
        since: from ? new Date(`${from}T00:00:00`).toISOString() : '',
        until: to ? new Date(`${to}T23:59:59.999`).toISOString() : '',
      };
    setPending(true);
    try {
      const page = await searchRoomMessages(
        activeWorkspaceId,
        room.id,
        { ...filters.current, before: more ? (cursor ?? '') : '' },
        requestController.signal,
      );
      if (requestController.signal.aborted) return;
      setResults((previous) => (more ? [...(previous ?? []), ...page.messages] : page.messages));
      setCursor(page.nextCursor);
    } catch (error) {
      if (!requestController.signal.aborted)
        notify(error instanceof Error ? error.message : t.shell.storageError);
    } finally {
      if (!requestController.signal.aborted) setPending(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void search();
  }
  return (
    <section className="inspector-section">
      <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>{t.messageSearch.title}</summary>
        <form onSubmit={submit} aria-busy={pending}>
          <label className="field">
            {t.messageSearch.text}
            <input maxLength={300} value={text} onChange={(event) => setText(event.target.value)} />
          </label>
          <label className="field">
            {t.messageSearch.participant}
            <select value={participant} onChange={(event) => setParticipant(event.target.value)}>
              <option value="">{t.messageSearch.all}</option>
              <option value="me">{t.messageSearch.me}</option>
              {state.agents
                .filter((agent) => room.agentIds.includes(agent.id))
                .map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            {t.messageSearch.from}
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            {t.messageSearch.to}
            <input
              type="date"
              min={from}
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <button className="button secondary" disabled={pending}>
            {pending ? t.messageSearch.loading : t.messageSearch.search}
          </button>
        </form>
        <div aria-live="polite">
          {results?.length === 0 && <p>{t.messageSearch.empty}</p>}
          {results?.map((message) => (
            <article key={message.id}>
              <strong>
                {state.agents.find((agent) => agent.id === message.agentId)?.name ??
                  t.messageSearch.me}
              </strong>{' '}
              <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
              <p>
                {message.text.slice(0, 240)}
                {message.text.length > 240 ? '…' : ''}
              </p>
              <button
                className="button secondary"
                onClick={() =>
                  void onNavigate(message.id).catch((error) =>
                    notify(error instanceof Error ? error.message : t.shell.storageError),
                  )
                }
              >
                {t.messageSearch.open}
              </button>
            </article>
          ))}
        </div>
        {cursor && (
          <button className="button secondary" disabled={pending} onClick={() => void search(true)}>
            {t.messageSearch.more}
          </button>
        )}
      </details>
    </section>
  );
}
