'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Plus,
  MessagesSquare,
  Pause,
  Play,
  Square,
  Download,
  Send,
  Reply,
  X,
  Users,
  ShieldCheck,
  Coins,
  Cpu,
  Sparkles,
  AtSign,
  ArrowLeft,
  Info,
  UserRoundMinus,
  FileText,
} from 'lucide-react';
import { useAgora } from '@/components/store';
import { Avatar, Badge, Empty, Modal, Progress, Status } from '@/components/ui';
import { ToolChips } from './agents';
import { effectiveTools } from '@/domain/engine';
import { downloadJson } from '@/data/repository';
import { t, formatMoney, formatTime } from '@/i18n';
import type { Message, Room } from '@/domain/models';
const emojis = ['👍', '❤️', '🎯', '🤔'];
export function Chat({ id }: { id: string }) {
  const { state } = useAgora();
  const room = state.rooms.find((r) => r.id === id);
  if (!room)
    return (
      <div className="page">
        <Empty
          title={t.chat.missing}
          action={
            <Link className="button secondary" href="/fr/rooms">
              {t.chat.back}
            </Link>
          }
        />
      </div>
    );
  return <ChatRoom key={id} room={room} />;
}
function ChatRoom({ room }: { room: Room }) {
  const {
    state,
    dispatch,
    mode,
    loadRoom,
    setRoomStatus,
    setParticipant,
    sendMessage,
    setReaction,
    subscribeRoom,
    notify,
  } = useAgora();
  const [text, setText] = useState(''),
    [replyTo, setReplyTo] = useState<Message | null>(null),
    [mention, setMention] = useState<{ start: number; end: number; query: string } | null>(null),
    [activeMention, setActiveMention] = useState(0),
    [typingAgentIds, setTypingAgentIds] = useState<string[]>([]),
    [details, setDetails] = useState(false),
    [addOpen, setAddOpen] = useState(false),
    [agentId, setAgentId] = useState(''),
    [submitting, setSubmitting] = useState(false);
  const end = useRef<HTMLDivElement>(null),
    messageList = useRef<HTMLDivElement>(null),
    followsLatest = useRef(true),
    composer = useRef<HTMLTextAreaElement>(null);
  const messages = state.messages.filter((m) => m.roomId === room.id);
  const participants = state.agents.filter((a) => room.agentIds.includes(a.id));
  const mentionSuggestions = mention
    ? participants.filter((agent) =>
        agent.name
          .toLocaleLowerCase(t.locale)
          .startsWith(mention.query.toLocaleLowerCase(t.locale)),
      )
    : [];
  const available = state.agents.filter((a) => a.active && !room.agentIds.includes(a.id));
  useEffect(() => {
    if (mode !== 'demo' || room.status !== 'running') return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible')
        dispatch({ type: 'room.simulate', roomId: room.id, selection: Math.random() });
    }, 7000);
    return () => clearInterval(timer);
  }, [mode, room.status, room.id, dispatch]);
  useEffect(() => {
    if (mode === 'demo') return;
    const unsubscribe = subscribeRoom(room.id, (id, typing) => {
      setTypingAgentIds((current) =>
        typing
          ? current.includes(id)
            ? current
            : [...current, id]
          : current.filter((agentId) => agentId !== id),
      );
    });
    void loadRoom(room.id).catch((cause) =>
      notify(cause instanceof Error ? cause.message : t.shell.storageError),
    );
    return unsubscribe;
  }, [loadRoom, mode, notify, room.id, subscribeRoom]);
  useEffect(() => {
    if (followsLatest.current)
      end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);
  async function send(e?: FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || room.status !== 'running' || submitting) return;
    followsLatest.current = true;
    setSubmitting(true);
    try {
      await sendMessage(room.id, content, replyTo?.id);
      setText('');
      setReplyTo(null);
      composer.current?.focus();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t.shell.storageError);
    } finally {
      setSubmitting(false);
    }
  }
  function updateComposer(value: string, cursor: number) {
    setText(value);
    const match = value.slice(0, cursor).match(/(?:^|\s)@([^\s@]*)$/u);
    if (!match) {
      setMention(null);
      return;
    }
    setMention({ start: cursor - match[1].length - 1, end: cursor, query: match[1] });
    setActiveMention(0);
  }
  function insertMention(name: string) {
    if (!mention) return;
    const next = `${text.slice(0, mention.start)}@${name} ${text.slice(mention.end)}`;
    const cursor = mention.start + name.length + 2;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      composer.current?.focus();
      composer.current?.setSelectionRange(cursor, cursor);
    });
  }
  function report(operation: Promise<unknown>) {
    void operation.catch((cause) =>
      notify(cause instanceof Error ? cause.message : t.shell.storageError),
    );
  }
  function exportRoom() {
    downloadJson(`agora-${room.id}.json`, {
      schemaVersion: 1,
      mode,
      room,
      agents: participants,
      messages,
      events: state.events.filter((e) => e.roomId === room.id),
    });
  }
  const info = (
    <>
      <div className="inspector-heading">
        <h3>
          <Users size={16} />
          {t.chat.participants}
          <Badge>{participants.length}</Badge>
        </h3>
        <button className="icon-button" aria-label={t.chat.add} onClick={() => setAddOpen(true)}>
          <Plus size={17} />
        </button>
      </div>
      <div className="participants">
        {participants.map((a) => {
          const provider = state.providers.find((p) => p.id === a.providerId);
          return (
            <div className="participant" key={a.id}>
              <Avatar agent={a} size="sm" />
              <div>
                <Link href={`/fr/agents/${a.id}`}>{a.name}</Link>
                <small>{a.role}</small>
                <span
                  className={`tiny ${a.active && provider?.connected ? 'text-green' : 'text-amber'}`}
                >
                  {!a.active
                    ? t.chat.agentSuspended
                    : !provider?.connected
                      ? t.chat.providerOffline
                      : t.common.available}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label={`${t.chat.remove} ${a.name}`}
                title={t.chat.remove}
                onClick={() => report(setParticipant(room, a.id, false))}
              >
                <UserRoundMinus size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="inspector-section">
        <h3>
          <Coins size={16} />
          {t.chat.budget}
        </h3>
        <div className="budget-amount">
          <strong>{formatMoney(room.spent)}</strong>
          <span>/ {formatMoney(room.budget)}</span>
        </div>
        <Progress value={(room.spent / room.budget) * 100} label={t.chat.budget} />
        <dl>
          <div>
            <dt>{t.chat.turns}</dt>
            <dd>{messages.filter((message) => message.agentId).length}</dd>
          </div>
          <div>
            <dt>{t.rooms.maxMinutes}</dt>
            <dd>{room.maxMinutes}</dd>
          </div>
        </dl>
      </div>
      <div className="inspector-section">
        <h3>
          <ShieldCheck size={16} />
          {t.chat.overview}
        </h3>
        <Badge tone="violet">{t.rooms.temporalModes[room.temporalMode]}</Badge>
        <h4>{t.chat.topic}</h4>
        <p>{room.topic}</p>
        <h4>{t.chat.rules}</h4>
        <p>{room.rules || t.chat.noRules}</p>
      </div>
      <div className="inspector-section">
        <h3>
          <Cpu size={16} />
          {t.chat.tools}
        </h3>
        {participants.map((a) => (
          <div className="effective-tools" key={a.id}>
            <strong>{a.name}</strong>
            <ToolChips tools={effectiveTools(a, room)} />
          </div>
        ))}
      </div>
      {mode === 'demo' && (
        <button
          className="button secondary full-width"
          onClick={() => {
            dispatch({ type: 'room.summary', roomId: room.id });
            notify(t.chat.summaryHint);
          }}
        >
          <Sparkles size={15} />
          {t.chat.summary}
        </button>
      )}
    </>
  );
  return (
    <div className="chat-layout">
      <aside className="room-sidebar">
        <div className="room-sidebar-heading">
          <h2>
            <MessagesSquare size={17} />
            {t.chat.rooms}
          </h2>
          <Link className="icon-button" href="/fr/rooms/new" aria-label={t.nav.newRoom}>
            <Plus size={17} />
          </Link>
        </div>
        <div className="room-list">
          {state.rooms.map((r) => (
            <Link
              key={r.id}
              href={`/fr/rooms/${r.id}`}
              className={room.id === r.id ? 'selected' : ''}
            >
              <Status status={r.status} />
              <strong>{r.name}</strong>
              <p>{r.topic}</p>
              <small>
                {r.agentIds.length} {t.dashboard.participants}
                <span>{t.rooms.modes[r.mode]}</span>
              </small>
            </Link>
          ))}
        </div>
        <div className="room-sidebar-foot">
          <FlaskIcon />
          <span>{mode === 'demo' ? t.demoDetail : t.chat.connectedHint}</span>
        </div>
      </aside>
      <section className="conversation">
        <header className="conversation-header">
          <div>
            <div className="conversation-title">
              <h1>{room.name}</h1>
              <Status status={room.status} />
            </div>
            <p>{room.topic}</p>
          </div>
          <button
            className="icon-button details-toggle"
            aria-label={t.chat.overview}
            onClick={() => setDetails(true)}
          >
            <Info size={20} />
          </button>
        </header>
        <div className="conversation-toolbar">
          <span className="demo-label">
            <span className="status-dot" />
            {mode === 'demo' ? t.chat.demo : t.chat.connected}
          </span>
          <div className="button-group">
            {room.status !== 'stopped' && (
              <>
                <button
                  className="button secondary small"
                  onClick={() =>
                    report(setRoomStatus(room, room.status === 'running' ? 'paused' : 'running'))
                  }
                >
                  {room.status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                  <span>{room.status === 'running' ? t.chat.pause : t.chat.resume}</span>
                </button>
                <button
                  className="icon-button"
                  aria-label={t.chat.stop}
                  title={t.chat.stop}
                  onClick={() => report(setRoomStatus(room, 'stopped'))}
                >
                  <Square size={14} />
                </button>
              </>
            )}
            <button
              className="icon-button"
              aria-label={t.chat.export}
              title={t.chat.export}
              onClick={exportRoom}
            >
              <Download size={16} />
            </button>
          </div>
        </div>
        <div
          className="message-list"
          aria-label={t.chat.messages}
          ref={messageList}
          onScroll={() => {
            const list = messageList.current;
            if (list)
              followsLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
          }}
        >
          <div className="conversation-start">
            <span className="feature-icon tone-violet">
              <MessagesSquare size={24} />
            </span>
            <h2>{room.name}</h2>
            <p>{mode === 'demo' ? t.chat.demo : t.chat.connectedHint}</p>
            <span className="date-divider">
              {new Date(room.createdAt).toLocaleDateString(t.locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          {!messages.length && <Empty title={t.chat.empty} description={t.chat.emptyHint} />}
          {messages.map((message) => {
            if (message.kind === 'system')
              return (
                <div className="system-message" key={message.id}>
                  <Info size={13} />
                  <span>{message.text}</span>
                </div>
              );
            const agent = state.agents.find((a) => a.id === message.agentId);
            const reply = messages.find((m) => m.id === message.replyTo);
            return (
              <article
                className={`message ${!message.agentId ? 'human-message' : ''}`}
                key={message.id}
              >
                {agent ? <Avatar agent={agent} /> : <span className="human-avatar">EX</span>}
                <div className="message-content">
                  <div className="message-meta">
                    <strong>{agent?.name ?? t.common.you}</strong>
                    <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                    <button
                      className="icon-button message-reply"
                      aria-label={`${t.chat.reply} ${agent?.name ?? t.common.you}`}
                      onClick={() => {
                        setReplyTo(message);
                        composer.current?.focus();
                      }}
                    >
                      <Reply size={14} />
                    </button>
                  </div>
                  {reply && (
                    <blockquote>
                      <Reply size={12} />
                      {reply.text.slice(0, 160)}
                    </blockquote>
                  )}
                  <div className="message-text">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ children, ...props }) => (
                          <a {...props} target="_blank" rel="noreferrer noopener">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {message.text}
                    </Markdown>
                  </div>
                  <div className="reaction-row">
                    {emojis.map((emoji) => {
                      const count = message.reactions[emoji]?.length ?? 0;
                      return (
                        <button
                          key={emoji}
                          className={`reaction ${message.reactions[emoji]?.includes('human') ? 'selected' : ''} ${count ? 'has-count' : ''}`}
                          aria-label={`${t.chat.react} ${emoji}`}
                          aria-pressed={message.reactions[emoji]?.includes('human') ?? false}
                          onClick={() =>
                            report(
                              setReaction(
                                message,
                                emoji,
                                !message.reactions[emoji]?.includes('human'),
                              ),
                            )
                          }
                        >
                          {emoji}
                          {count > 0 && <span>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
          <div ref={end} />
        </div>
        <div className="composer-area">
          {typingAgentIds.length > 0 && (
            <div className="typing-indicator" role="status" aria-live="polite">
              <span className="typing-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {t.chat.typing.replace(
                '{names}',
                typingAgentIds
                  .map((id) => state.agents.find((agent) => agent.id === id)?.name)
                  .filter(Boolean)
                  .join(', '),
              )}
            </div>
          )}
          {mode === 'demo' && room.status === 'running' && (
            <div className="simulation-running">
              <span className="status-dot text-green" />
              {t.common.simulated}
              <button
                onClick={() =>
                  dispatch({ type: 'room.simulate', roomId: room.id, selection: Math.random() })
                }
              >
                {t.chat.simulate}
                <ArrowLeft size={12} />
              </button>
            </div>
          )}
          {room.status === 'stopped' && <p className="tiny muted">{t.chat.stopped}</p>}
          {replyTo && (
            <div className="reply-preview">
              <Reply size={14} />
              <span>
                <strong>
                  {t.chat.replyTo}{' '}
                  {state.agents.find((a) => a.id === replyTo.agentId)?.name ?? t.common.you}
                </strong>
                <small>{replyTo.text.slice(0, 140)}</small>
              </span>
              <button
                className="icon-button"
                aria-label={t.chat.clearReply}
                onClick={() => setReplyTo(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {mentionSuggestions.length > 0 && (
            <div
              className="mention-suggestions"
              id={`mention-suggestions-${room.id}`}
              role="listbox"
              aria-label={t.chat.mentionSuggestions}
            >
              {mentionSuggestions.map((agent, index) => (
                <button
                  type="button"
                  role="option"
                  id={`mention-${agent.id}`}
                  aria-selected={index === activeMention}
                  className={index === activeMention ? 'active' : ''}
                  key={agent.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertMention(agent.name);
                  }}
                >
                  <Avatar agent={agent} size="sm" />
                  <span>
                    <strong>{agent.name}</strong>
                    <small>{agent.role}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(event) => void send(event)} className="composer">
            <textarea
              ref={composer}
              value={text}
              onChange={(event) =>
                updateComposer(
                  event.target.value,
                  event.target.selectionStart ?? event.target.value.length,
                )
              }
              maxLength={8000}
              placeholder={t.chat.placeholder}
              aria-label={t.chat.placeholder}
              rows={2}
              aria-autocomplete="list"
              disabled={room.status !== 'running' || submitting}
              onKeyDown={(e) => {
                if (mentionSuggestions.length > 0) {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const direction = e.key === 'ArrowDown' ? 1 : -1;
                    setActiveMention(
                      (current) =>
                        (current + direction + mentionSuggestions.length) %
                        mentionSuggestions.length,
                    );
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    insertMention(mentionSuggestions[activeMention].name);
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setMention(null);
                    return;
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="composer-bottom">
              <div className="mention-controls">
                <AtSign size={15} />
                <select
                  aria-label={t.chat.participants}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setText((value) => value + `@${e.target.value} `);
                    composer.current?.focus();
                  }}
                >
                  <option value="">{t.chat.participants}</option>
                  {participants.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="composer-count">{text.length}/8000</span>
              <button
                type="submit"
                className="button primary send-button"
                disabled={!text.trim() || room.status !== 'running' || submitting}
                aria-label={t.chat.send}
              >
                <Send size={17} />
              </button>
            </div>
          </form>
          <div className="composer-foot">
            <ShieldCheck size={11} />
            {mode === 'demo' ? t.demoDetail : t.chat.connectedHint}
          </div>
        </div>
      </section>
      <aside className="room-inspector">{info}</aside>
      <Modal open={details} onClose={() => setDetails(false)} title={t.chat.overview}>
        <div className="mobile-inspector">{info}</div>
      </Modal>
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t.chat.add}>
        <div className="modal-form">
          {available.length ? (
            <>
              <label className="field">
                <span>{t.chat.addSelect}</span>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  <option value="">{t.chat.addSelect}</option>
                  {available.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.role}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary"
                disabled={!agentId}
                onClick={() => {
                  report(
                    setParticipant(room, agentId, true).then(() => {
                      setAddOpen(false);
                      setAgentId('');
                    }),
                  );
                }}
              >
                <Plus size={16} />
                {t.chat.addButton}
              </button>
            </>
          ) : (
            <p>{t.chat.noMore}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
function FlaskIcon() {
  return <FileText size={16} />;
}
