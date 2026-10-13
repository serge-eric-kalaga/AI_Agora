'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAgora } from '@/components/store';
import { PageHeading } from '@/components/ui';
import {
  acceptInvitation,
  inviteMember,
  listInvitations,
  listMembers,
  listNotifications,
  markNotificationRead,
  revokeInvitation,
  updateMemberRole,
  type CollaboratorRole,
  type Invitation,
  type Member,
  type Notification,
} from '@/data/collaboration-api';
import { t } from '@/i18n';

export function Collaborators() {
  const { activeWorkspaceId, workspaces, notify } = useAgora();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('member');
  const [link, setLink] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const actorRole = workspaces.find((w) => w.id === activeWorkspaceId)?.role;
  const admin = actorRole === 'owner' || actorRole === 'admin';
  const roles: CollaboratorRole[] =
    actorRole === 'owner' ? ['admin', 'member', 'observer'] : ['member', 'observer'];
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1)).get('invitation');
    if (hash) queueMicrotask(() => setToken(hash));
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!activeWorkspaceId) return;
    Promise.all([
      listMembers(activeWorkspaceId),
      admin ? listInvitations(activeWorkspaceId) : Promise.resolve([]),
    ])
      .then(([people, invites]) => {
        if (!cancelled) {
          setMembers(people);
          setInvitations(invites);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, admin]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action indisponible.');
    } finally {
      setBusy(false);
    }
  }
  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!activeWorkspaceId) return;
    await run(async () => {
      const result = await inviteMember(activeWorkspaceId, email, role);
      setLink(
        `${window.location.origin}/fr/members#invitation=${encodeURIComponent(result.token)}`,
      );
      setInvitations(await listInvitations(activeWorkspaceId));
    });
  }
  async function accept(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      let secret = token.trim();
      if (secret.startsWith('http'))
        secret = new URLSearchParams(new URL(secret).hash.slice(1)).get('invitation') ?? '';
      await acceptInvitation(secret);
      notify(t.collaboration.accepted);
      window.location.replace('/fr/members');
    });
  }
  return (
    <>
      <PageHeading
        eyebrow={t.workspaceCaption}
        title={t.collaboration.title}
        description={t.collaboration.subtitle}
      />
      {error && <p role="alert">{error}</p>}
      <section className="panel collaboration-panel">
        <h2>{t.collaboration.title}</h2>
        <ul>
          {members.map((member) => (
            <li key={member.userId} className="collaborator-row">
              <div>
                <strong>{member.username}</strong>
                <p>{member.email}</p>
              </div>
              <span>{t.collaboration.roles[member.role]}</span>
              {admin &&
                member.role !== 'owner' &&
                (actorRole === 'owner' || member.role !== 'admin') && (
                  <select
                    aria-label={`${t.collaboration.role} : ${member.username}`}
                    value={member.role}
                    disabled={busy}
                    onChange={(event) => {
                      const next = event.target.value as CollaboratorRole;
                      void run(async () => {
                        const saved = await updateMemberRole(
                          activeWorkspaceId!,
                          member.userId,
                          next,
                        );
                        setMembers((previous) =>
                          previous.map((m) => (m.userId === saved.userId ? saved : m)),
                        );
                      });
                    }}
                  >
                    {roles.map((value) => (
                      <option key={value} value={value}>
                        {t.collaboration.roles[value]}
                      </option>
                    ))}
                  </select>
                )}
            </li>
          ))}
        </ul>
      </section>
      {admin && (
        <section className="panel collaboration-panel">
          <form onSubmit={invite}>
            <fieldset disabled={busy}>
              <label className="field">
                <span>{t.collaboration.email}</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t.collaboration.role}</span>
                <select value={role} onChange={(e) => setRole(e.target.value as CollaboratorRole)}>
                  {roles.map((value) => (
                    <option key={value} value={value}>
                      {t.collaboration.roles[value]}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button primary">{t.collaboration.invite}</button>
              <p className="muted">{t.collaboration.noEmail}</p>
              {link && (
                <label className="field">
                  <span>{t.collaboration.link}</span>
                  <input value={link} readOnly onFocus={(e) => e.target.select()} />
                </label>
              )}
            </fieldset>
          </form>
          <h3>{t.collaboration.pending}</h3>
          {!invitations.length && <p>{t.collaboration.empty}</p>}
          {invitations.map((i) => (
            <div key={i.id} className="collaborator-row">
              <div>
                <strong>{i.email}</strong>
                <p>
                  {t.collaboration.expires} : {new Date(i.expiresAt).toLocaleDateString(t.locale)}
                </p>
              </div>
              <span>
                {i.acceptedAt
                  ? t.collaboration.acceptedStatus
                  : i.revokedAt
                    ? t.collaboration.revoked
                    : t.collaboration.roles[i.role as CollaboratorRole]}
              </span>
              {!i.acceptedAt && !i.revokedAt && (
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() =>
                    void run(async () => {
                      await revokeInvitation(activeWorkspaceId!, i.id);
                      setInvitations(await listInvitations(activeWorkspaceId!));
                    })
                  }
                >
                  {t.collaboration.revoke}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="panel collaboration-panel">
        <h2>{t.collaboration.acceptTitle}</h2>
        <form onSubmit={accept}>
          <fieldset disabled={busy}>
            <label className="field">
              <span>{t.collaboration.token}</span>
              <input
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button className="button secondary">{t.collaboration.accept}</button>
          </fieldset>
        </form>
      </section>
    </>
  );
}

export function Notifications() {
  const { activeWorkspaceId, notify } = useAgora();
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    let initialized = false;
    const refresh = () => {
      void listNotifications(activeWorkspaceId)
        .then((page) => {
          if (!cancelled) {
            setItems((previous) => {
              if (!initialized) return page.items;
              const newIds = new Set(page.items.map((n) => n.id));
              return [...page.items, ...previous.filter((n) => !newIds.has(n.id))];
            });
            if (!initialized) setCursor(page.nextCursor);
            initialized = true;
            setError('');
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    };
    queueMicrotask(() => {
      if (!cancelled) {
        setItems([]);
        setCursor(null);
      }
    });
    refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeWorkspaceId]);
  async function more() {
    if (!activeWorkspaceId || !cursor) return;
    setBusy(true);
    try {
      const page = await listNotifications(activeWorkspaceId, cursor);
      setItems((previous) => [
        ...previous,
        ...page.items.filter((n) => !previous.some((p) => p.id === n.id)),
      ]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action indisponible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow={t.workspaceCaption}
        title={t.collaboration.notifications}
        description={t.collaboration.alertsSubtitle}
      />
      {error && <p role="alert">{error}</p>}
      <section className="panel collaboration-panel">
        {!items.length && !error && <p>{t.collaboration.none}</p>}
        {items.map((n) => (
          <article key={n.id} className={`notification-item ${!n.readAt ? 'unread' : ''}`}>
            <strong>
              {n.authorName} {t.collaboration[n.kind]}
            </strong>
            <p>{n.excerpt}</p>
            <small>
              {n.roomName} · {new Date(n.createdAt).toLocaleString(t.locale)}
            </small>
            <div>
              <Link
                className="button secondary"
                href={`/fr/rooms/${n.roomId}?message=${n.messageId}${n.threadRootId ? `&thread=${n.threadRootId}` : ''}`}
              >
                {t.collaboration.open}
              </Link>
              {!n.readAt && (
                <button
                  className="button ghost"
                  onClick={async () => {
                    try {
                      await markNotificationRead(activeWorkspaceId!, n.id);
                      setItems((previous) =>
                        previous.map((p) =>
                          p.id === n.id ? { ...p, readAt: new Date().toISOString() } : p,
                        ),
                      );
                    } catch (e) {
                      notify(e instanceof Error ? e.message : 'Action indisponible.');
                    }
                  }}
                >
                  {t.collaboration.read}
                </button>
              )}
            </div>
          </article>
        ))}
        {cursor && (
          <button disabled={busy} className="button secondary" onClick={() => void more()}>
            {t.collaboration.more}
          </button>
        )}
      </section>
    </>
  );
}
