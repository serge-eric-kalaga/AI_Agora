'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessagesSquare,
  Bot,
  Network,
  ChartNoAxesCombined,
  Search,
  Bell,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronsUpDown,
  FlaskConical,
  ArrowUpRight,
  Command,
  Menu,
  Check,
  X,
  LogOut,
} from 'lucide-react';
import { ThemeButton } from './theme';
import { useAgora } from './store';
import { listNotifications } from '@/data/collaboration-api';
import { usePersistentBoolean } from './persistent-state';
import { Avatar, Badge, Empty, Modal, Progress } from './ui';
import { formatMoney, formatTime, t } from '@/i18n';
const navigation = [
  { key: 'overview', path: '/fr', icon: LayoutDashboard },
  { key: 'rooms', path: '/fr/rooms', icon: MessagesSquare },
  { key: 'agents', path: '/fr/agents', icon: Bot },
  { key: 'analytics', path: '/fr/analytics', icon: ChartNoAxesCombined },
  { key: 'members', path: '/fr/members', icon: Network },
  { key: 'notifications', path: '/fr/notifications', icon: Bell },
  { key: 'providers', path: '/fr/providers', icon: Network },
] as const;
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    state,
    ready,
    mode,
    user,
    workspaces,
    activeWorkspaceId,
    selectWorkspace,
    logout,
    storageWarning,
    toast,
  } = useAgora();
  const [collapsed, setCollapsed] = usePersistentBoolean('ai-agora.ui.sidebar-collapsed', false),
    [mobile, setMobile] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(''),
    [activityOpen, setActivityOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  useEffect(() => {
    if (!activeWorkspaceId || !user || mode !== 'api') return;
    let cancelled = false;
    const refresh = () => {
      void listNotifications(activeWorkspaceId)
        .then((page) => {
          if (!cancelled) setHasUnread(page.items.some((n) => !n.readAt));
        })
        .catch(() => undefined);
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeWorkspaceId, mode, user]);
  const mobileMenu = useRef<HTMLElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    // Le menu hors écran ne doit pas recevoir le focus au clavier sur mobile.
    const query = window.matchMedia('(max-width: 760px)');
    const update = () => {
      if (mobileMenu.current) mobileMenu.current.inert = query.matches && !mobile;
    };
    update();
    const changed = () => {
      if (!query.matches) setMobile(false);
      update();
    };
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, [mobile]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const menu = mobileMenu.current;
    menu?.querySelector<HTMLButtonElement>('.mobile-close')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(
        menu?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled])',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    menu?.addEventListener('keydown', trap);
    return () => {
      menu?.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [mobile]);
  const isConnectionPage = pathname.endsWith('/connexion');
  useEffect(() => {
    if (!ready || mode === 'demo') return;
    if (!user && !isConnectionPage) router.replace('/fr/connexion');
    if (user && isConnectionPage) router.replace('/fr');
  }, [isConnectionPage, mode, ready, router, user]);

  if (mode === 'api' && isConnectionPage) return children;
  if (!ready || (mode === 'api' && !user)) {
    return (
      <div className="loading full-page">
        <span className="loader" />
        {t.common.loading}
      </div>
    );
  }
  const total = state.rooms.reduce((sum, r) => sum + r.spent, 0),
    budget = state.rooms.reduce((sum, r) => sum + r.budget, 0);
  const active = state.rooms.filter((r) => r.status === 'running').length;
  const filteredAgents = state.agents.filter((a) =>
    (a.name + ' ' + a.model + ' ' + a.role).toLowerCase().includes(query.toLowerCase()),
  );
  const filteredRooms = state.rooms.filter((r) =>
    (r.name + ' ' + r.topic).toLowerCase().includes(query.toLowerCase()),
  );
  const pageLabel =
    pathname === '/fr/agents/new'
      ? t.nav.newAgent
      : pathname === '/fr/rooms/new'
        ? t.nav.newRoom
        : pathname.startsWith('/fr/agents/')
          ? t.design.profile
          : pathname.startsWith('/fr/rooms/')
            ? t.nav.live
            : t.nav[navigation.find((n) => n.path === pathname)?.key ?? 'overview'];
  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <a className="skip-link" href="#main">
        {t.shell.skip}
      </a>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label={t.common.close}
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={mobileMenu}
        className={`sidebar ${mobile ? 'mobile-open' : ''}`}
        aria-label={t.workspace}
      >
        <div className="brand-row">
          <Link href="/fr" className="brand" onClick={() => setMobile(false)}>
            <div className="brand-mark">
              <OrbitMark />
            </div>
            <span>
              <strong>
                {t.appName} <small>{t.beta}</small>
              </strong>
              <small>{t.workspaceDetail}</small>
            </span>
          </Link>
          <button
            className="icon-button collapse-button"
            aria-label={collapsed ? t.common.expand : t.common.collapse}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            className="icon-button mobile-close"
            aria-label={t.common.close}
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <label className="workspace-switch">
          <span className="workspace-icon">
            <FlaskConical size={19} />
          </span>
          {mode === 'api' ? (
            <select
              aria-label={t.workspaceCaption}
              value={activeWorkspaceId ?? ''}
              onChange={(event) => void selectWorkspace(event.target.value)}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          ) : (
            <span>
              <strong>{t.workspace}</strong>
              <small>{t.workspaceDetail}</small>
            </span>
          )}
          <ChevronsUpDown size={14} />
        </label>
        <div className="nav-caption">
          {user?.isSuperadmin ? t.globalWorkspaceCaption : t.workspaceCaption}
        </div>
        <nav>
          {navigation.map(({ key, path, icon: Icon }) => {
            const href = path;
            const isActive =
              pathname === path ||
              (key === 'rooms' && pathname.startsWith('/fr/rooms/')) ||
              (key === 'agents' && pathname.startsWith('/fr/agents/'));
            return (
              <Link
                key={key}
                href={href}
                title={t.nav[key]}
                aria-label={t.nav[key]}
                className={`nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setMobile(false)}
              >
                <Icon size={19} />
                <span>{t.nav[key]}</span>
                {key === 'rooms' && active > 0 && <span className="nav-count">{active}</span>}
                {key === 'providers' && <span className="nav-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="budget-mini">
            <div>
              <span>{t.shell.budget}</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            <Progress value={budget ? (total / budget) * 100 : 0} label={t.shell.budget} />
            <small>{t.shell.budgetHint}</small>
          </div>
          <div className="demo-note">
            <FlaskConical size={14} />
            <span>{mode === 'api' ? t.session.connected : t.demo}</span>
          </div>
          <div className="profile">
            <span className="profile-avatar">
              {user?.username.slice(0, 2).toUpperCase() ?? 'EX'}
            </span>
            <div>
              <strong>{user?.username ?? t.shell.profile}</strong>
              <small>{mode === 'api' ? user?.email : t.shell.plan}</small>
            </div>
            {mode === 'api' ? (
              <button
                className="icon-button"
                title={t.session.logout}
                aria-label={t.session.logout}
                onClick={() => {
                  setMobile(false);
                  void logout().then(() => router.replace('/fr/connexion'));
                }}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <Badge tone="violet">FR</Badge>
            )}
          </div>
        </div>
      </aside>
      <div className="app-body" inert={mobile}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label={t.common.menu}
            >
              <Menu size={21} />
            </button>
            <span>Agora</span>
            <span className="slash">/</span>
            <strong>{pageLabel}</strong>
          </div>
          <button
            className="search-trigger"
            aria-label={t.shell.search}
            onClick={() => setSearchOpen(true)}
          >
            <Search size={16} />
            <span>{t.shell.search}</span>
            <kbd>
              <Command size={11} /> K
            </kbd>
          </button>
          <div className="topbar-actions">
            <ThemeButton />
            <Link href="/fr/providers" className="infrastructure-status">
              <span className="status-dot" />
              {mode === 'api' ? t.session.connected : t.common.simulated}
              <ChevronDown size={13} />
            </Link>
            <button
              className="icon-button notification-button"
              onClick={() => router.push('/fr/notifications')}
              aria-label={t.nav.notifications}
            >
              <Bell size={19} />
              {hasUnread && <i />}
            </button>
            <Link
              className="button primary topbar-create"
              aria-label={t.shell.newConversation}
              href="/fr/rooms/new"
            >
              <Plus size={17} />
              <span>{t.shell.newConversation}</span>
            </Link>
          </div>
        </header>
        {storageWarning && (
          <div className="storage-warning" role="alert">
            {storageWarning}
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {ready ? (
            children
          ) : (
            <div className="loading">
              <span className="loader" />
              {t.common.loading}
            </div>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title={t.shell.searchTitle}>
        <div className="search-input large">
          <Search size={18} />
          <input
            autoFocus
            aria-label={t.common.search}
            placeholder={t.shell.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="search-results">
          <h3>{t.nav.agents}</h3>
          {filteredAgents.slice(0, 5).map((a) => (
            <Link key={a.id} href={`/fr/agents/${a.id}`} onClick={() => setSearchOpen(false)}>
              <Avatar agent={a} size="sm" />
              <span>
                <strong>{a.name}</strong>
                <small>{a.role}</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
          <h3>{t.nav.rooms}</h3>
          {filteredRooms.slice(0, 5).map((r) => (
            <Link key={r.id} href={`/fr/rooms/${r.id}`} onClick={() => setSearchOpen(false)}>
              <MessagesSquare size={20} />
              <span>
                <strong>{r.name}</strong>
                <small>{r.topic}</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
          {!filteredAgents.length && !filteredRooms.length && <Empty title={t.common.noResults} />}
        </div>
      </Modal>
      <Modal
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        title={t.shell.notifications}
      >
        <div className="activity-list">
          {state.events.slice(0, 12).map((e) => (
            <div className="activity-item" key={e.id}>
              <span
                className={`event-icon tone-${e.tone === 'success' ? 'green' : e.tone === 'warning' ? 'amber' : 'violet'}`}
              >
                <Check size={14} />
              </span>
              <div>
                <p>{e.text}</p>
                <small>{formatTime(e.createdAt)}</small>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
function OrbitMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2 28 9v14l-12 7L4 23V9L16 2Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="m16 2 0 28M4 9l24 14M28 9 4 23" stroke="currentColor" opacity=".5" />
      <circle cx="16" cy="16" r="5" fill="#9e85ff" />
      <circle cx="4" cy="9" r="2.5" fill="#59dbea" />
      <circle cx="28" cy="23" r="2.5" fill="#59dbea" />
    </svg>
  );
}
