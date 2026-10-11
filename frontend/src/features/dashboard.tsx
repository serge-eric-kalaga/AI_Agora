'use client';
import Link from 'next/link';
import {
  Plus,
  ArrowUpRight,
  MessagesSquare,
  Zap,
  Bot,
  Coins,
  Radio,
  Activity,
  Sparkles,
  Clock3,
  ArrowRight,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { useAgora } from '@/components/store';
import { Avatar, Badge, Empty, PageHeading, SectionHeading, Status } from '@/components/ui';
import { t, formatMoney, formatNumber, formatTime } from '@/i18n';
import type { Room } from '@/domain/models';

export function RoomCard({ room }: { room: Room }) {
  const { state } = useAgora();
  const agents = state.agents.filter((a) => room.agentIds.includes(a.id));
  const count = state.messages.filter((m) => m.roomId === room.id && m.kind === 'message').length;
  return (
    <article className={`room-card ${room.status === 'running' ? 'is-live' : ''}`}>
      <div className="card-top">
        <Status status={room.status} />
        <span className="muted tiny">
          <Clock3 size={12} />
          {t.rooms.temporalModes[room.temporalMode]}
        </span>
      </div>
      <Link href={`/fr/rooms/${room.id}`} className="room-title">
        <h3>{room.name}</h3>
        <ArrowUpRight size={17} />
      </Link>
      <p className="room-description">{room.description || room.topic}</p>
      <div className="room-tags">
        <span>{t.rooms.modes[room.mode]}</span>
        <span>{room.visibility === 'private' ? t.rooms.private : t.rooms.shared}</span>
      </div>
      <div className="room-people">
        <div className="avatar-stack">
          {agents.slice(0, 4).map((a) => (
            <Avatar key={a.id} agent={a} size="sm" />
          ))}
        </div>
        <span>
          {agents.length} {t.dashboard.participants}
          <span className="separator">·</span>
          {count} {t.dashboard.messages}
        </span>
        <span className="room-cost">{formatMoney(room.spent)}</span>
      </div>
      <div className="room-card-footer">
        <span className={`tiny ${room.status === 'running' ? 'text-green' : 'muted'}`}>
          <span className="status-dot" />
          {room.status === 'running' ? t.chat.live : t.chat.status[room.status]}
        </span>
        <Link
          className={`button small ${room.status === 'running' ? 'primary' : 'secondary'}`}
          href={`/fr/rooms/${room.id}`}
        >
          {room.status === 'running' ? t.dashboard.join : t.dashboard.open}
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
export function Dashboard() {
  const { state } = useAgora();
  const running = state.rooms.filter((r) => r.status === 'running').length;
  const messageCount = state.messages.filter((m) => m.kind === 'message').length;
  const metrics = [
    {
      title: t.dashboard.metricRooms,
      value: state.rooms.length,
      hint: t.dashboard.metricRoomsHint,
      icon: MessagesSquare,
      tone: 'green',
      spark: [12, 18, 16, 24, 20, 30, 38, 32, 45, 42],
    },
    {
      title: t.dashboard.metricMessages,
      value: formatNumber(messageCount),
      hint: t.dashboard.metricMessagesHint,
      icon: Zap,
      tone: 'cyan',
      spark: [5, 9, 8, 16, 14, 22, 20, 31, 28, 40],
    },
    {
      title: t.dashboard.metricAgents,
      value: state.agents.length,
      hint: t.dashboard.metricAgentsHint,
      icon: Bot,
      tone: 'violet',
      spark: [20, 20, 28, 28, 28, 34, 34, 42, 42, 42],
    },
    {
      title: t.dashboard.metricCost,
      value: formatMoney(state.rooms.reduce((s, r) => s + r.spent, 0)),
      hint: t.dashboard.metricCostHint,
      icon: Coins,
      tone: 'amber',
      spark: [8, 14, 14, 18, 22, 24, 30, 28, 32, 36],
    },
  ];
  return (
    <div className="page dashboard">
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">
            <span />
            {t.dashboard.eyebrow}
            <Badge tone="violet">{t.beta}</Badge>
          </div>
          <h1>
            {t.dashboard.greeting} <span className="gradient-text">AI Agora.</span>
          </h1>
          <p className="hero-subtitle">{t.dashboard.subtitle}</p>
          <div className="hero-details">
            <span>
              <i className="status-dot text-green" />
              {running} {t.dashboard.running}
            </span>
            <span>
              <Sparkles size={13} />
              {state.agents.filter((a) => a.active).length} {t.dashboard.ready}
            </span>
            <span className="muted">
              <span className="status-dot" />
              {t.dashboard.stored}
            </span>
          </div>
        </div>
        <div className="hero-actions">
          <Link className="button secondary" href="/fr/agents/new">
            <Bot size={16} />
            {t.nav.newAgent}
          </Link>
          <Link className="button primary" href="/fr/rooms/new">
            <Plus size={17} />
            {t.dashboard.newRoom}
          </Link>
        </div>
      </div>
      <div className="metrics-grid">
        {metrics.map(({ title, value, hint, icon: Icon, tone, spark }) => (
          <article className="metric-card" key={title}>
            <div className="metric-label">
              <span>{title}</span>
              <span className={`metric-icon tone-${tone}`}>
                <Icon size={17} />
              </span>
            </div>
            <strong className="metric-value">{value}</strong>
            <p>{hint}</p>
            <svg
              className={`sparkline tone-${tone}`}
              viewBox="0 0 160 50"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`g-${tone}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity=".2" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M 0 50 ${spark.map((n, i) => `L ${i * 18} ${50 - n}`).join(' ')} L 162 50 Z`}
                fill={`url(#g-${tone})`}
              />
              <polyline
                points={spark.map((n, i) => `${i * 18},${50 - n}`).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              />
            </svg>
          </article>
        ))}
      </div>
      <SectionHeading title={t.dashboard.conversations} icon={MessagesSquare} href="/fr/rooms" />
      <div className="room-grid">
        {state.rooms.slice(0, 4).map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <SectionHeading title={t.dashboard.recent} icon={Activity} href="/fr/analytics" />
          <div className="activity-list">
            {state.events.slice(0, 5).map((e) => (
              <div className="activity-item" key={e.id}>
                <span
                  className={`event-icon tone-${e.tone === 'success' ? 'green' : e.tone === 'warning' ? 'amber' : 'cyan'}`}
                >
                  <Radio size={15} />
                </span>
                <div>
                  <p>{e.text}</p>
                  <small>
                    {formatTime(e.createdAt)} · {t.common.simulated}
                  </small>
                </div>
              </div>
            ))}
          </div>
          <div className="panel-foot">
            <span className="status-dot text-green" />
            {t.demoDetail}
          </div>
        </section>
        <section className="panel">
          <SectionHeading title={t.dashboard.favorites} icon={Sparkles} href="/fr/agents" />
          <div className="favorites">
            {state.agents.slice(0, 4).map((a) => (
              <Link href={`/fr/agents/${a.id}`} key={a.id}>
                <Avatar agent={a} size="sm" />
                <span>
                  <strong>
                    {a.name}
                    <span className="muted">{a.model}</span>
                  </strong>
                  <small>{a.role}</small>
                </span>
                <span className={`status-dot ${a.active ? 'text-green' : 'muted'}`} />
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
          <Link href="/fr/agents/new" className="button secondary full-width">
            <Plus size={15} />
            {t.agents.create}
          </Link>
        </section>
      </div>
    </div>
  );
}
export function Rooms() {
  const { state } = useAgora();
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('all');
  const rooms = state.rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) &&
      (status === 'all' || r.status === status),
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow={t.nav.rooms}
        title={t.dashboard.roomCollection}
        description={t.dashboard.roomCollectionHint}
        actions={
          <Link className="button primary" href="/fr/rooms/new">
            <Plus size={17} />
            {t.dashboard.newRoom}
          </Link>
        }
      />
      <div className="filter-bar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label={t.common.search}
            placeholder={t.common.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label={t.agents.status}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">{t.common.all}</option>
          {Object.entries(t.chat.status).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {rooms.length ? (
        <div className="room-grid">
          {rooms.map((r) => (
            <RoomCard key={r.id} room={r} />
          ))}
        </div>
      ) : (
        <Empty
          title={t.common.noResults}
          action={
            <button
              className="button secondary"
              onClick={() => {
                setQuery('');
                setStatus('all');
              }}
            >
              {t.common.resetFilters}
            </button>
          }
        />
      )}
    </div>
  );
}
