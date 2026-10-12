'use client';
import { Activity, Download, ChartNoAxesCombined, Bot, Coins, MessagesSquare } from 'lucide-react';
import { Avatar, PageHeading, Progress, SectionHeading, Empty } from '@/components/ui';
import { useAgora } from '@/components/store';
import { downloadJson } from '@/data/repository';
import { formatMoney, formatNumber, formatTime, t } from '@/i18n';
export function Analytics() {
  const { state } = useAgora();
  const messages = state.messages.filter((m) => m.kind === 'message');
  const contributions = state.agents
    .map((a) => ({ agent: a, count: messages.filter((m) => m.agentId === a.id).length }))
    .sort((a, b) => b.count - a.count);
  return (
    <div className="page">
      <PageHeading
        eyebrow={t.analytics.eyebrow}
        title={t.analytics.title}
        description={t.analytics.subtitle}
        actions={
          <button
            className="button secondary"
            onClick={() => downloadJson('ai-agora-laboratoire.json', state)}
          >
            <Download size={16} />
            {t.analytics.export}
          </button>
        }
      />
      <div className="metrics-grid three">
        {[
          { icon: MessagesSquare, title: t.analytics.total, value: formatNumber(messages.length) },
          {
            icon: Coins,
            title: t.analytics.cloud,
            value: formatMoney(state.rooms.reduce((sum, r) => sum + r.spent, 0)),
          },
          {
            icon: Bot,
            title: t.analytics.local,
            value: formatNumber(state.agents.filter((agent) => agent.active).length),
          },
        ].map(({ icon: Icon, title, value }) => (
          <div className="metric-card" key={title}>
            <div className="metric-label">
              {title}
              <Icon size={18} />
            </div>
            <strong className="metric-value">{value}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <SectionHeading title={t.analytics.contributions} icon={ChartNoAxesCombined} />
        <p className="muted">{t.analytics.source}</p>
        <div className="contributions">
          {contributions.map(({ agent, count }) => (
            <div className="contribution" key={agent.id}>
              <Avatar agent={agent} size="sm" />
              <strong>{agent.name}</strong>
              <Progress
                label={agent.name}
                value={messages.length ? (count / messages.length) * 100 : 0}
                tone={agent.color}
              />
              <span>
                {count} {t.dashboard.messages}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel activity-panel">
        <SectionHeading title={t.analytics.events} icon={Activity} />
        <div className="activity-list">
          {state.events.map((e) => (
            <div className="activity-item" key={e.id}>
              <span
                className={`event-icon tone-${e.tone === 'warning' ? 'amber' : e.tone === 'success' ? 'green' : 'cyan'}`}
              >
                <Activity size={15} />
              </span>
              <div>
                <p>{e.text}</p>
                <small>
                  {new Date(e.createdAt).toLocaleDateString(t.locale)} · {formatTime(e.createdAt)}
                </small>
              </div>
            </div>
          ))}
        </div>
        {!state.events.length && <Empty title={t.common.empty} />}
      </section>
    </div>
  );
}
