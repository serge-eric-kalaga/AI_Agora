'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  MessagesSquare,
  Bot,
  Coins,
  ArrowRight,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  Clock3,
} from 'lucide-react';
import { useAgora } from '@/components/store';
import { Avatar, Empty, PageHeading, SectionHeading, Status } from '@/components/ui';
import { t, formatMoney, formatNumber, formatTime } from '@/i18n';
import type { Room } from '@/domain/models';

function RoomPeople({ room }: { room: Room }) {
  const { state } = useAgora();
  const people = state.agents.filter((a) => room.agentIds.includes(a.id));
  return (
    <div
      className="avatar-stack"
      role="img"
      aria-label={people.map((agent) => agent.name).join(', ')}
    >
      {people.slice(0, 4).map((a) => (
        <Avatar key={a.id} agent={a} size="sm" />
      ))}
      {people.length > 4 && <span className="avatar sm more-avatar">+{people.length - 4}</span>}
    </div>
  );
}
function useMessageCount() {
  const { state, mode } = useAgora();
  return (room: Room) =>
    room.messageCount ??
    (mode === 'demo'
      ? state.messages.filter((m) => m.roomId === room.id && m.kind === 'message').length
      : undefined);
}
export function RoomCard({ room }: { room: Room }) {
  const count = useMessageCount()(room);
  return (
    <article className="room-card">
      <div className="card-top">
        <Status status={room.status} />
        <span className="muted tiny">{t.rooms.modes[room.mode]}</span>
      </div>
      <Link href={`/fr/rooms/${room.id}`} className="room-title">
        <h3>{room.name}</h3>
        <ArrowUpRight size={16} />
      </Link>
      <p className="room-description">{room.description || room.topic}</p>
      <div className="room-people">
        <RoomPeople room={room} />
        <span>
          {count === undefined ? '—' : formatNumber(count)} {t.dashboard.messages}
        </span>
        <Link
          href={`/fr/rooms/${room.id}`}
          aria-label={`${t.dashboard.open} ${room.name}`}
          className="text-link"
        >
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}
export function RoomTable({ rooms }: { rooms: Room[] }) {
  const { user, workspaces } = useAgora();
  const count = useMessageCount();
  return (
    <div className="panel table-scroll">
      <table className="room-table">
        <thead>
          <tr>
            <th scope="col">{t.nav.rooms}</th>
            {user?.isSuperadmin && <th scope="col">{t.design.laboratory}</th>}
            <th scope="col">{t.design.participant}</th>
            <th scope="col">{t.agents.status}</th>
            <th scope="col">{t.dashboard.messages}</th>
            <th scope="col">{t.design.lastActivity}</th>
            <th scope="col">
              <span className="sr-only">{t.dashboard.open}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>
                <Link className="table-title" href={`/fr/rooms/${room.id}`}>
                  {room.name}
                </Link>
                <small>
                  {t.rooms.modes[room.mode]} ·{' '}
                  {room.visibility === 'private' ? t.rooms.private : t.rooms.shared}
                </small>
              </td>
              {user?.isSuperadmin && (
                <td className="workspace-cell">
                  {workspaces.find((w) => w.id === room.workspaceId)?.name ?? '—'}
                </td>
              )}
              <td>
                <RoomPeople room={room} />
              </td>
              <td>
                <Status status={room.status} />
              </td>
              <td className="numeric">
                {count(room) === undefined ? '—' : formatNumber(count(room)!)}
              </td>
              <td>
                <time
                  dateTime={room.lastMessageAt ?? room.createdAt}
                  title={new Date(room.lastMessageAt ?? room.createdAt).toLocaleString(t.locale)}
                >
                  {new Date(room.lastMessageAt ?? room.createdAt).toLocaleDateString(t.locale, {
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  · {formatTime(room.lastMessageAt ?? room.createdAt)}
                </time>
              </td>
              <td>
                <Link
                  href={`/fr/rooms/${room.id}`}
                  className="button secondary small"
                  aria-label={`${t.dashboard.open} ${room.name}`}
                >
                  {t.dashboard.open}
                  <ArrowRight size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-footer">
        {rooms.length} {t.nav.rooms.toLowerCase()}
      </div>
    </div>
  );
}
export function Dashboard() {
  const { state, mode, user } = useAgora();
  const running = state.rooms.filter((r) => r.status === 'running');
  const featured = running[0] ?? state.rooms[0];
  const recent = state.rooms.filter((r) => r.id !== featured?.id).slice(0, 2);
  // Ne pas afficher zéro lorsque l’API n’a pas encore fourni ses compteurs.
  const completeCounts = state.rooms.every((r) => r.messageCount !== undefined);
  const total =
    mode === 'demo'
      ? state.messages.filter((m) => m.kind === 'message').length
      : completeCounts
        ? state.rooms.reduce((sum, r) => sum + r.messageCount!, 0)
        : undefined;
  const metrics = [
    {
      label: t.dashboard.metricRooms,
      value: running.length,
      hint: `${state.rooms.length} ${t.nav.rooms.toLowerCase()}`,
      icon: MessagesSquare,
    },
    {
      label: t.dashboard.metricMessages,
      value: total === undefined ? '—' : formatNumber(total),
      hint: t.dashboard.metricMessagesHint,
      icon: Sparkles,
    },
    {
      label: t.dashboard.metricAgents,
      value: state.agents.filter((a) => a.active).length,
      hint: t.dashboard.metricAgentsHint,
      icon: Bot,
    },
    {
      label: t.dashboard.metricCost,
      value: formatMoney(state.rooms.reduce((sum, r) => sum + r.spent, 0)),
      hint: t.dashboard.metricCostHint,
      icon: Coins,
    },
  ];
  return (
    <div className="page dashboard">
      <PageHeading
        eyebrow={`${t.dashboard.greeting} ${user?.username ?? t.appName}`}
        title={t.design.dashboardTitle}
        description={t.design.dashboardHint}
        actions={
          <Link className="button primary" href="/fr/rooms/new">
            <Plus size={17} />
            {t.dashboard.newRoom}
          </Link>
        }
      />
      <div className="metrics-grid">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <article className="metric-card" key={label}>
            <div className="metric-label">
              <span>{label}</span>
              <Icon size={17} />
            </div>
            <strong className="metric-value">{value}</strong>
            <p>{hint}</p>
          </article>
        ))}
      </div>
      {featured ? (
        <div className="dashboard-composition">
          <section>
            <SectionHeading title={t.design.featured} icon={MessagesSquare} href="/fr/rooms" />
            <article className="panel featured-room">
              <Status status={featured.status} />
              <h2>{featured.name}</h2>
              <p>{featured.description || featured.topic}</p>
              <div className="collective-orbit" aria-hidden="true">
                <Sparkles size={30} />
              </div>
              <div className="featured-footer">
                <div className="room-people">
                  <RoomPeople room={featured} />
                  <span>
                    {featured.agentIds.length} {t.dashboard.participants}
                  </span>
                </div>
                <Link className="button primary" href={`/fr/rooms/${featured.id}`}>
                  {featured.status === 'running' ? t.dashboard.join : t.dashboard.open}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
            {recent.length > 0 && (
              <>
                <SectionHeading title={t.design.resume} icon={Clock3} />
                <div className="room-grid compact-grid">
                  {recent.map((room) => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              </>
            )}
          </section>
          <aside className="dashboard-collective">
            <section className="panel">
              <SectionHeading title={t.design.collective} icon={Bot} href="/fr/agents" />
              <div className="favorites">
                {state.agents.slice(0, 4).map((agent) => (
                  <Link href={`/fr/agents/${agent.id}`} key={agent.id}>
                    <Avatar agent={agent} size="sm" />
                    <span>
                      <strong>{agent.name}</strong>
                      <small>{agent.role}</small>
                    </span>
                    <span className={`status-dot ${agent.active ? 'text-green' : 'muted'}`} />
                  </Link>
                ))}
              </div>
              <Link href="/fr/agents/new" className="text-link collective-create">
                <Plus size={15} />
                {t.agents.create}
              </Link>
            </section>
            <article className="panel editorial-note">
              <Sparkles size={20} />
              <h3>{t.design.introduce}</h3>
              <p>{t.design.introduceHint}</p>
              <Link className="button secondary" href="/fr/agents">
                {t.nav.agents}
                <ArrowRight size={15} />
              </Link>
            </article>
          </aside>
        </div>
      ) : (
        <Empty
          title={t.design.noRooms}
          description={t.design.noRoomsHint}
          action={
            <Link className="button primary" href="/fr/rooms/new">
              <Plus size={17} />
              {t.dashboard.newRoom}
            </Link>
          }
        />
      )}
    </div>
  );
}
export function Rooms() {
  const { state } = useAgora();
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [layout, setLayout] = useState<'cards' | 'table'>('cards');
  const rooms = state.rooms.filter(
    (r) =>
      (r.name + ' ' + r.topic).toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
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
      <div className="room-status-tabs">
        <button className={status === 'all' ? 'selected' : ''} onClick={() => setStatus('all')}>
          {t.common.all}
          <span>{state.rooms.length}</span>
        </button>
        {Object.entries(t.chat.status).map(([key, label]) => (
          <button
            key={key}
            className={status === key ? 'selected' : ''}
            onClick={() => setStatus(key)}
          >
            {label}
            <span>{state.rooms.filter((r) => r.status === key).length}</span>
          </button>
        ))}
      </div>
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
        <div className="view-switch" aria-label={t.nav.rooms}>
          <button
            className="icon-button"
            aria-label={t.design.cards}
            aria-pressed={layout === 'cards'}
            onClick={() => setLayout('cards')}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={t.design.table}
            aria-pressed={layout === 'table'}
            onClick={() => setLayout('table')}
          >
            <List size={17} />
          </button>
        </div>
      </div>
      {rooms.length ? (
        layout === 'cards' ? (
          <div className="room-grid">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : (
          <RoomTable rooms={rooms} />
        )
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
