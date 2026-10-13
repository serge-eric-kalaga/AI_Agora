'use client';
import { useEffect, useMemo, useState } from 'react';
import { Download, ChartNoAxesCombined, Bot, Coins, MessagesSquare } from 'lucide-react';
import { Avatar, PageHeading, Progress, SectionHeading, Empty } from '@/components/ui';
import { useAgora } from '@/components/store';
import { readWorkspaceAnalytics, type WorkspaceAnalytics } from '@/data/http-api';
import { downloadJson } from '@/data/repository';
import { formatMoney, formatNumber, t } from '@/i18n';

export function Analytics() {
  const { state, mode, activeWorkspaceId, notify } = useAgora();
  const [remoteResult, setRemoteResult] = useState<{
    workspaceId: string;
    data: WorkspaceAnalytics;
  } | null>(null);
  const [failedWorkspaceId, setFailedWorkspaceId] = useState<string | null>(null);
  const messages = useMemo(
    () => state.messages.filter((message) => message.kind === 'message'),
    [state.messages],
  );
  const demoStats = useMemo<WorkspaceAnalytics>(() => {
    const contributions = state.agents.map((agent) => ({
      agentId: agent.id,
      messageCount: messages.filter((message) => message.agentId === agent.id).length,
    }));
    return {
      totalMessages: messages.length,
      humanMessages: messages.filter((message) => !message.agentId).length,
      agentMessages: messages.filter((message) => message.agentId).length,
      totalReactions: messages.reduce(
        (sum, message) =>
          sum +
          Object.values(message.reactions).reduce((count, actors) => count + actors.length, 0),
        0,
      ),
      cloudCost: state.rooms.reduce((sum, room) => sum + room.spent, 0),
      cloudTokens: state.rooms.reduce((sum, room) => sum + room.tokens, 0),
      localTokens: state.rooms.reduce((sum, room) => sum + room.localTokens, 0),
      activeAgents: state.agents.filter((agent) => agent.active).length,
      contributions,
      recentEvents: [],
    };
  }, [messages, state.agents, state.rooms]);

  useEffect(() => {
    if (mode !== 'api' || !activeWorkspaceId) return;
    let cancelled = false;
    readWorkspaceAnalytics(activeWorkspaceId)
      .then((analytics) => {
        if (!cancelled) {
          setFailedWorkspaceId(null);
          setRemoteResult({ workspaceId: activeWorkspaceId, data: analytics });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailedWorkspaceId(activeWorkspaceId);
          notify(t.session.genericError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, mode, notify]);

  const remote = remoteResult?.workspaceId === activeWorkspaceId ? remoteResult.data : null;
  const loading =
    mode === 'api' &&
    Boolean(activeWorkspaceId) &&
    !remote &&
    failedWorkspaceId !== activeWorkspaceId;
  const analytics = mode === 'api' ? remote : demoStats;
  const contributionCounts = new Map(
    analytics?.contributions.map((item) => [item.agentId, item.messageCount]) ?? [],
  );
  const contributions = state.agents
    .map((agent) => ({ agent, count: contributionCounts.get(agent.id) ?? 0 }))
    .sort((left, right) => right.count - left.count);
  const value = (number: number | undefined) =>
    loading || number === undefined ? '—' : formatNumber(number);

  return (
    <div className="page">
      <PageHeading
        eyebrow={t.analytics.eyebrow}
        title={t.analytics.title}
        description={t.analytics.subtitle}
        actions={
          <button
            className="button secondary"
            disabled={!analytics}
            onClick={() =>
              analytics &&
              downloadJson('ai-agora-statistiques.json', {
                generatedAt: new Date().toISOString(),
                analytics,
                agents: state.agents,
                rooms: state.rooms,
              })
            }
          >
            <Download size={16} />
            {t.analytics.export}
          </button>
        }
      />
      <div className="metrics-grid three">
        {[
          {
            icon: MessagesSquare,
            title: t.analytics.total,
            value: value(analytics?.totalMessages),
            detail: analytics
              ? t.analytics.details
                  .replace('{agents}', formatNumber(analytics.agentMessages))
                  .replace('{humans}', formatNumber(analytics.humanMessages))
              : '',
          },
          {
            icon: Coins,
            title: t.analytics.cloud,
            value: loading || !analytics ? '—' : formatMoney(analytics.cloudCost),
            detail: analytics ? `${formatNumber(analytics.cloudTokens)} jetons cloud` : '',
          },
          {
            icon: Bot,
            title: t.analytics.local,
            value: value(analytics?.activeAgents),
            detail: analytics
              ? t.analytics.reactions.replace('{count}', formatNumber(analytics.totalReactions))
              : '',
          },
        ].map(({ icon: Icon, title, value: metricValue, detail }) => (
          <div className="metric-card" key={title}>
            <div className="metric-label">
              {title}
              <Icon size={18} />
            </div>
            <strong className="metric-value">{metricValue}</strong>
            {detail && <small>{detail}</small>}
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
                value={analytics?.agentMessages ? (count / analytics.agentMessages) * 100 : 0}
                tone={agent.color}
              />
              <span>
                {count} {t.dashboard.messages}
              </span>
            </div>
          ))}
        </div>
        {!loading && !contributions.some(({ count }) => count > 0) && (
          <Empty title={t.analytics.noMessages} />
        )}
        {loading && <Empty title={t.analytics.loading} />}
      </section>
    </div>
  );
}
