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
import { t, formatMoney, formatNumber, formatTime } from '@/i18n';
import type { Message, Room } from '@/domain/models';
const emojis = ['👍', '❤️', '😂', '🤔'];
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
  const { state, dispatch, notify } = useAgora();
  const [text, setText] = useState(''),
    [replyTo, setReplyTo] = useState<Message | null>(null),
    [details, setDetails] = useState(false),
    [addOpen, setAddOpen] = useState(false),
    [agentId, setAgentId] = useState('');
  const end = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null);
  const messages = state.messages.filter((m) => m.roomId === room.id);
  const participants = state.agents.filter((a) => room.agentIds.includes(a.id));
  const available = state.agents.filter((a) => a.active && !room.agentIds.includes(a.id));
  useEffect(() => {
    if (room.status !== 'running') return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible')
        dispatch({ type: 'room.simulate', roomId: room.id, selection: Math.random() });
    }, 7000);
    return () => clearInterval(timer);
  }, [room.status, room.id, dispatch]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);
  function send(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    dispatch({ type: 'message.send', roomId: room.id, text, replyTo: replyTo?.id });
    setText('');
    setReplyTo(null);
    composer.current?.focus();
  }
  function exportRoom() {
    downloadJson(`agora-${room.id}.json`, {
      schemaVersion: 1,
      mode: 'demo',
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
                <small>{a.model}</small>
                <span
                  className={`tiny ${a.active && provider?.connected ? 'text-green' : 'text-amber'}`}
                >
                  {!a.active
                    ? t.chat.agentSuspended
                    : !provider?.connected
                      ? t.chat.providerOffline
                      : provider?.kind === 'local'
                        ? t.common.local
                        : t.common.cloud}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label={`${t.chat.remove} ${a.name}`}
                title={t.chat.remove}
                onClick={() =>
                  dispatch({ type: 'room.participant', roomId: room.id, agentId: a.id, add: false })
                }
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
            <dd>
              {room.simulatedTurns} / {room.maxMessages}
            </dd>
          </div>
          <div>
            <dt>{t.chat.localUsage}</dt>
            <dd>{formatNumber(room.localTokens)} tok</dd>
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
          <span>{t.demoDetail}</span>
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
            {t.chat.demo}
          </span>
          <div className="button-group">
            {room.status !== 'stopped' && (
              <>
                <button
                  className="button secondary small"
                  onClick={() =>
                    dispatch({
                      type: 'room.status',
                      roomId: room.id,
                      status: room.status === 'running' ? 'paused' : 'running',
                    })
                  }
                >
                  {room.status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                  <span>{room.status === 'running' ? t.chat.pause : t.chat.resume}</span>
                </button>
                <button
                  className="icon-button"
                  aria-label={t.chat.stop}
                  title={t.chat.stop}
                  onClick={() =>
                    dispatch({ type: 'room.status', roomId: room.id, status: 'stopped' })
                  }
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
        <div className="message-list" aria-label={t.chat.messages}>
          <div className="conversation-start">
            <span className="feature-icon tone-violet">
              <MessagesSquare size={24} />
            </span>
            <h2>{room.name}</h2>
            <p>{t.chat.demo}</p>
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
            const provider = state.providers.find((p) => p.id === agent?.providerId);
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
                    {agent && (
                      <Badge tone={provider?.kind === 'local' ? 'green' : 'neutral'}>
                        {agent.model}
                        {provider?.kind === 'local' ? ` · ${t.common.local}` : ''}
                      </Badge>
                    )}
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
                            dispatch({ type: 'message.react', messageId: message.id, emoji })
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
          {room.status === 'running' && (
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
          <form onSubmit={send} className="composer">
            <textarea
              ref={composer}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={8000}
              placeholder={t.chat.placeholder}
              aria-label={t.chat.placeholder}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
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
                    setText((value) => value + `@${e.target.value} `);
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
                disabled={!text.trim()}
                aria-label={t.chat.send}
              >
                <Send size={17} />
              </button>
            </div>
          </form>
          <div className="composer-foot">
            <ShieldCheck size={11} />
            {t.demoDetail}
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
                      {a.name} · {a.model}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary"
                disabled={!agentId}
                onClick={() => {
                  dispatch({ type: 'room.participant', roomId: room.id, agentId, add: true });
                  setAddOpen(false);
                  setAgentId('');
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
