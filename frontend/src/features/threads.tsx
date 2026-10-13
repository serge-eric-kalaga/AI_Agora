'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgora } from '@/components/store';
import {
  persistMessage,
  readMessageContext,
  readThreadMessages,
  subscribeRoom,
} from '@/data/http-api';
import type { Message, Room } from '@/domain/models';
import { t, formatTime } from '@/i18n';

function merge(previous: Message[], next: Message[]) {
  return [...new Map([...previous, ...next].map((message) => [message.id, message])).values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
export function ThreadPanel({
  room,
  rootId,
  focusId,
}: {
  room: Room;
  rootId: string;
  focusId?: string;
}) {
  const { activeWorkspaceId, state, notify } = useAgora();
  const [messages, setMessages] = useState<Message[]>([]);
  const [root, setRoot] = useState<Message | null>(null);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [olderPending, setOlderPending] = useState(false);
  const [away, setAway] = useState(false);
  const [typing, setTyping] = useState<string[]>([]);
  const initialized = useRef(false);
  const focusRestored = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const followsLatest = useRef(true);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!activeWorkspaceId) return;
      let page = await readThreadMessages(activeWorkspaceId, room.id, rootId, undefined, signal);
      const collected = [...page.messages];
      // Charger un trajet continu jusqu'à la cible, sans insérer de trou d'historique.
      while (
        !initialized.current &&
        focusId &&
        !collected.some((message) => message.id === focusId) &&
        page.nextCursor &&
        !signal?.aborted
      ) {
        page = await readThreadMessages(
          activeWorkspaceId,
          room.id,
          rootId,
          page.nextCursor,
          signal,
        );
        collected.push(...page.messages);
      }
      if (signal?.aborted) return;
      setMessages((previous) =>
        merge(
          previous,
          collected.filter((message) => message.id !== rootId),
        ),
      );
      if (!initialized.current) {
        initialized.current = true;
        setCursor(page.nextCursor);
      }
    },
    [activeWorkspaceId, room.id, rootId, focusId],
  );
  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => {
      void load(controller.signal).catch((error) => {
        if (!controller.signal.aborted)
          notify(error instanceof Error ? error.message : t.shell.storageError);
      });
      if (activeWorkspaceId)
        void readMessageContext(activeWorkspaceId, room.id, rootId)
          .then((rows) => {
            if (!controller.signal.aborted)
              setRoot(rows.find((message) => message.id === rootId) ?? null);
          })
          .catch((error) => {
            if (!controller.signal.aborted)
              notify(error instanceof Error ? error.message : t.shell.storageError);
          });
    }, 0);
    const unsubscribe = activeWorkspaceId
      ? subscribeRoom(activeWorkspaceId, room.id, '0', (event) => {
          if (event.threadRootId !== rootId) return;
          if (event.agentId && (event.type === 'agent.typing' || event.type === 'agent.idle'))
            setTyping((previous) =>
              event.type === 'agent.typing'
                ? [...new Set([...previous, event.agentId!])]
                : previous.filter((id) => id !== event.agentId),
            );
          else if (event.type === 'message.created')
            void load(controller.signal).catch(() => undefined);
        })
      : () => undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible')
        void load(controller.signal).catch(() => undefined);
    }, 5000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      unsubscribe();
      controller.abort();
    };
  }, [load, activeWorkspaceId, room.id, rootId, notify]);
  useEffect(() => {
    if (focusId && !focusRestored.current) {
      const target = document.getElementById(`thread-message-${focusId}`);
      if (target) {
        focusRestored.current = true;
        followsLatest.current = false;
        target.scrollIntoView({ block: 'center' });
      }
    }
    if (followsLatest.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length, focusId]);
  async function older() {
    if (!cursor || !activeWorkspaceId || olderPending) return;
    setOlderPending(true);
    const height = list.current?.scrollHeight ?? 0;
    followsLatest.current = false;
    try {
      const page = await readThreadMessages(activeWorkspaceId, room.id, rootId, cursor);
      setMessages((previous) =>
        merge(
          previous,
          page.messages.filter((message) => message.id !== rootId),
        ),
      );
      setCursor(page.nextCursor);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (list.current) list.current.scrollTop += list.current.scrollHeight - height;
        }),
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : t.shell.storageError);
    } finally {
      setOlderPending(false);
    }
  }
  async function navigate(messageId: string) {
    followsLatest.current = false;
    let target = document.getElementById(`thread-message-${messageId}`);
    let before = cursor;
    while (!target && before && activeWorkspaceId) {
      const page = await readThreadMessages(activeWorkspaceId, room.id, rootId, before);
      before = page.nextCursor;
      setCursor(before);
      setMessages((previous) =>
        merge(
          previous,
          page.messages.filter((message) => message.id !== rootId),
        ),
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      target = document.getElementById(`thread-message-${messageId}`);
    }
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!activeWorkspaceId || !text.trim() || sending) return;
    setSending(true);
    try {
      const message = await persistMessage(
        activeWorkspaceId,
        room.id,
        text.trim(),
        reply?.id ?? rootId,
        rootId,
      );
      followsLatest.current = true;
      setMessages((previous) => merge(previous, [message]));
      setText('');
      setReply(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : t.shell.storageError);
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="thread-panel">
      <div className="thread-root" id={`thread-message-${rootId}`}>
        <strong>
          {t.threads.root} ·{' '}
          {state.agents.find((agent) => agent.id === root?.agentId)?.name ??
            (root?.isMe === false ? (root.authorName ?? t.common.you) : t.common.you)}
        </strong>
        <p>{root?.text ?? t.threads.loading}</p>
      </div>
      <div
        ref={list}
        className="thread-messages"
        aria-label={t.threads.title}
        onScroll={() => {
          const element = list.current;
          if (element) {
            followsLatest.current =
              element.scrollHeight - element.scrollTop - element.clientHeight < 80;
            setAway(!followsLatest.current);
          }
        }}
      >
        {cursor && (
          <button className="button secondary" disabled={olderPending} onClick={() => void older()}>
            {t.threads.older}
          </button>
        )}
        {messages.map((message) => (
          <article
            id={`thread-message-${message.id}`}
            key={message.id}
            className={message.id === focusId ? 'message-highlighted' : undefined}
          >
            <strong>
              {state.agents.find((agent) => agent.id === message.agentId)?.name ??
                (message.isMe === false ? (message.authorName ?? t.common.you) : t.common.you)}
            </strong>{' '}
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
            {message.replyTo && (
              <button
                className="reply-context"
                onClick={() =>
                  void navigate(message.replyTo!).catch((error) =>
                    notify(error instanceof Error ? error.message : t.shell.storageError),
                  )
                }
              >
                <strong>
                  {message.replyAuthorIsMe
                    ? t.common.you
                    : (message.replyAuthorName ?? t.chat.quotedMessage)}
                </strong>
                {' · '}
                {message.replyExcerpt ??
                  messages.find((other) => other.id === message.replyTo)?.text.slice(0, 120) ??
                  root?.text.slice(0, 120)}
              </button>
            )}
            <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
            <button className="button secondary" onClick={() => setReply(message)}>
              {t.chat.reply}
            </button>
          </article>
        ))}
      </div>
      {away && (
        <button
          className="button secondary"
          onClick={() => {
            followsLatest.current = true;
            setAway(false);
            if (list.current) list.current.scrollTop = list.current.scrollHeight;
          }}
        >
          {t.threads.latest}
        </button>
      )}
      {typing.length > 0 && (
        <p role="status">
          {t.chat.typing.replace(
            '{names}',
            typing
              .map((id) => state.agents.find((agent) => agent.id === id)?.name)
              .filter(Boolean)
              .join(', '),
          )}
        </p>
      )}
      <form onSubmit={send}>
        {reply && (
          <button type="button" className="reply-context" onClick={() => setReply(null)}>
            {t.chat.replyTo}{' '}
            {state.agents.find((agent) => agent.id === reply.agentId)?.name ??
              (reply.isMe === false ? (reply.authorName ?? t.common.you) : t.common.you)}{' '}
            · {reply.text.slice(0, 100)} ×
          </button>
        )}
        <label className="field">
          <span>{t.threads.placeholder}</span>
          <textarea
            maxLength={8000}
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={sending || room.status !== 'running'}
          />
        </label>
        <button
          className="button primary"
          disabled={sending || !text.trim() || room.status !== 'running'}
        >
          {t.threads.send}
        </button>
      </form>
    </div>
  );
}
