'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  SlidersHorizontal,
  Copy,
  Pause,
  Play,
  Globe,
  FileText,
  Terminal,
  Server,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Bot,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { Avatar, Badge, Empty, Field, PageHeading, Progress } from '@/components/ui';
import { useAgora } from '@/components/store';
import { t } from '@/i18n';
import type { Agent, AgentDraft, ToolId } from '@/domain/models';
const toolIcons = { web: Globe, files: FileText, code: Terminal };
export function ToolChips({ tools }: { tools: ToolId[] }) {
  return (
    <div className="tool-chips">
      {tools.length ? (
        tools.map((tool) => {
          const Icon = toolIcons[tool];
          return (
            <span key={tool}>
              <Icon size={12} />
              {t.tools[tool]}
            </span>
          );
        })
      ) : (
        <span className="muted">{t.agents.noTools}</span>
      )}
    </div>
  );
}
export function Agents() {
  const { state, saveAgent, notify } = useAgora();
  const [query, setQuery] = useState(''),
    [provider, setProvider] = useState('all'),
    [status, setStatus] = useState('all');
  const agents = state.agents.filter(
    (a) =>
      `${a.name} ${a.role} ${a.model}`.toLowerCase().includes(query.toLowerCase()) &&
      (provider === 'all' || a.providerId === provider) &&
      (status === 'all' || a.active === (status === 'active')),
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow={t.agents.eyebrow}
        title={t.agents.title}
        description={t.agents.subtitle}
        actions={
          <Link href="/fr/agents/new" className="button primary">
            <Plus size={17} />
            {t.agents.create}
          </Link>
        }
      />
      <div className="filter-bar">
        <div className="search-input">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.agents.search}
            aria-label={t.agents.search}
          />
        </div>
        <label className="inline-filter">
          {t.agents.provider}
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="all">{t.common.all}</option>
            {state.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-filter">
          {t.agents.status}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t.common.all}</option>
            <option value="active">{t.common.active}</option>
            <option value="inactive">{t.common.inactive}</option>
          </select>
        </label>
        <Badge>
          {agents.length} {t.nav.agents.toLowerCase()}
        </Badge>
      </div>
      {agents.length ? (
        <div className="agent-grid">
          {agents.map((agent) => {
            const provider = state.providers.find((p) => p.id === agent.providerId);
            return (
              <article key={agent.id} className={`agent-card tone-${agent.color}`}>
                <div className="agent-card-header">
                  <Avatar agent={agent} size="lg" />
                  <div>
                    <h2>
                      {agent.name}
                      <span className={`status-dot ${agent.active ? 'text-green' : 'muted'}`} />
                    </h2>
                    <p>{agent.role}</p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`${t.common.duplicate} ${agent.name}`}
                    title={t.common.duplicate}
                    onClick={() => {
                      const { id, version, ...draft } = agent;
                      void id;
                      void version;
                      void saveAgent({ ...draft, name: `${agent.name} ${t.agents.cloneSuffix}` })
                        .then(() => notify(t.agents.cloned))
                        .catch((reason) => notify(reason.message));
                    }}
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <div className="agent-model">
                  <span className="status-dot" />
                  {agent.model}
                  <Badge tone={provider?.kind === 'local' ? 'green' : 'neutral'}>
                    {provider?.kind === 'local' ? t.common.local : t.common.cloud}
                  </Badge>
                </div>
                <p className="agent-description">{agent.description}</p>
                <div className="trait-bars">
                  {(['creativity', 'rigor', 'diplomacy'] as const).map((key) => (
                    <div key={key}>
                      <div>
                        <span>{t.editor[key]}</span>
                        <strong>{agent.traits[key]}%</strong>
                      </div>
                      <Progress
                        value={agent.traits[key]}
                        label={t.editor[key]}
                        tone={agent.color}
                      />
                    </div>
                  ))}
                </div>
                <div className="agent-tools">
                  <h4>{t.agents.capabilities}</h4>
                  <ToolChips tools={agent.tools} />
                </div>
                <div className="agent-card-footer">
                  <span>
                    {state.rooms.filter((r) => r.agentIds.includes(agent.id)).length}{' '}
                    {t.agents.rooms}
                  </span>
                  <Link href={`/fr/agents/${agent.id}`} className="button secondary small">
                    <SlidersHorizontal size={13} />
                    {t.agents.config}
                  </Link>
                  <button
                    className="icon-button bordered"
                    aria-label={`${agent.active ? t.agents.suspend : t.agents.activate} ${agent.name}`}
                    title={agent.active ? t.agents.suspend : t.agents.activate}
                    onClick={() => {
                      const { id, version, ...draft } = agent;
                      void id;
                      void version;
                      void saveAgent({ ...draft, active: !agent.active }, agent).catch((reason) =>
                        notify(reason.message),
                      );
                    }}
                  >
                    {agent.active ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title={t.agents.empty}
          description={t.agents.emptyHint}
          action={
            <button
              className="button secondary"
              onClick={() => {
                setQuery('');
                setProvider('all');
                setStatus('all');
              }}
            >
              {t.common.resetFilters}
            </button>
          }
        />
      )}
      <div className="local-banner">
        <span className="feature-icon tone-green">
          <Server size={23} />
        </span>
        <div>
          <strong>{t.agents.localNotice}</strong>
          <p>{t.agents.localHint}</p>
        </div>
        <Link href="/fr/providers" className="text-link">
          {t.agents.manageProviders}
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
const colors = ['violet', 'cyan', 'amber', 'blue', 'pink', 'green'];
const blank: AgentDraft = {
  name: '',
  role: '',
  description: '',
  providerId: 'openai',
  model: 'GPT-4.1',
  color: 'violet',
  active: true,
  systemPrompt: '',
  traits: { creativity: 65, rigor: 75, humor: 30, diplomacy: 80 },
  tools: [],
  temperature: 0.7,
  maxTokens: 1024,
};
export function AgentEditor({ id }: { id?: string }) {
  const { state } = useAgora();
  const existing = state.agents.find((a) => a.id === id);
  if (id && !existing)
    return (
      <div className="page">
        <Empty
          title={t.editor.missing}
          action={
            <Link className="button secondary" href="/fr/agents">
              {t.editor.back}
            </Link>
          }
        />
      </div>
    );
  return <EditorForm key={id ?? 'new'} existing={existing} />;
}
function EditorForm({ existing }: { existing?: Agent }) {
  const { state, saveAgent, notify } = useAgora();
  const router = useRouter();
  const [draft, setDraft] = useState<AgentDraft>(
      existing ?? {
        ...blank,
        providerId: state.providers[0]?.id ?? '',
        model: state.providers[0]?.models[0] ?? '',
      },
    ),
    [section, setSection] = useState(0),
    [profile, setProfile] = useState(0),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const update = <K extends keyof AgentDraft>(key: K, value: AgentDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const provider = state.providers.find((p) => p.id === draft.providerId);
  function applyProfile() {
    const profiles = [
      { creativity: 35, rigor: 95, humor: 15, diplomacy: 70 },
      { creativity: 95, rigor: 55, humor: 65, diplomacy: 75 },
      { creativity: 60, rigor: 75, humor: 40, diplomacy: 98 },
    ];
    setDraft((d) => ({
      ...d,
      role: t.editor.profiles[profile],
      traits: profiles[profile],
      systemPrompt: t.editor.profilePrompts[profile],
    }));
  }
  async function save() {
    if (!draft.name.trim() || !draft.role.trim() || !draft.systemPrompt.trim() || !provider) {
      setError(t.common.required);
      setSection(!draft.name.trim() || !draft.role.trim() ? 0 : 2);
      return;
    }
    setSaving(true);
    try {
      await saveAgent({ ...draft, name: draft.name.trim(), role: draft.role.trim() }, existing);
      notify(existing ? t.editor.updated : t.editor.created);
      router.push('/fr/agents');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.session.genericError);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page">
      <Link href="/fr/agents" className="back-link">
        <ArrowLeft size={15} />
        {t.editor.back}
      </Link>
      <PageHeading
        eyebrow={t.editor.eyebrow}
        title={existing ? t.editor.editTitle : t.editor.title}
        description={t.editor.subtitle}
      />
      <div className="editor-layout">
        <div>
          <div className="step-tabs" role="tablist" aria-label={t.editor.title}>
            {t.editor.sections.map((s, i) => (
              <button
                key={s}
                role="tab"
                tabIndex={section === i ? 0 : -1}
                onKeyDown={(event) => {
                  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    const next =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? 2
                          : (i + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
                    setSection(next);
                    document.getElementById(`editor-tab-${next}`)?.focus();
                  }
                }}
                aria-selected={section === i}
                aria-controls={`editor-panel-${i}`}
                id={`editor-tab-${i}`}
                className={section === i ? 'selected' : ''}
                onClick={() => setSection(i)}
              >
                <span>{i + 1}</span>
                {s}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div
            className="panel form-panel"
            role="tabpanel"
            id={`editor-panel-${section}`}
            aria-labelledby={`editor-tab-${section}`}
          >
            {section === 0 && (
              <>
                <h2>
                  <Bot size={19} />
                  {t.editor.identity}
                </h2>
                <div className="form-grid">
                  <Field label={`${t.common.name} *`}>
                    <input
                      maxLength={48}
                      value={draft.name}
                      onChange={(e) => update('name', e.target.value)}
                      placeholder={t.editor.namePlaceholder}
                      required
                    />
                  </Field>
                  <Field label={`${t.editor.role} *`}>
                    <input
                      maxLength={90}
                      value={draft.role}
                      onChange={(e) => update('role', e.target.value)}
                      placeholder={t.editor.rolePlaceholder}
                      required
                    />
                  </Field>
                </div>
                <Field label={t.common.description}>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={draft.description}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder={t.editor.descriptionPlaceholder}
                  />
                </Field>
                <div className="form-grid">
                  <Field label={t.editor.provider}>
                    <select
                      value={draft.providerId}
                      onChange={(e) => {
                        const p = state.providers.find((p) => p.id === e.target.value)!;
                        setDraft((d) => ({ ...d, providerId: p.id, model: p.models[0] }));
                      }}
                    >
                      {state.providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.kind === 'local' ? `· ${t.common.local}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t.editor.model}>
                    <select value={draft.model} onChange={(e) => update('model', e.target.value)}>
                      {provider?.models.map((model) => (
                        <option key={model}>{model}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <fieldset className="color-field">
                  <legend>{t.editor.color}</legend>
                  <div>
                    {colors.map((color, index) => (
                      <button
                        key={color}
                        className={`color-choice tone-${color} ${draft.color === color ? 'selected' : ''}`}
                        aria-label={`${t.editor.color} ${index + 1}`}
                        aria-pressed={draft.color === color}
                        onClick={() => update('color', color)}
                      >
                        {draft.color === color && <Check size={17} />}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="toggle-row">
                  <span>{t.editor.active}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={draft.active}
                    onChange={(e) => update('active', e.target.checked)}
                  />
                </label>
              </>
            )}
            {section === 1 && (
              <>
                <h2>
                  <Sparkles size={19} />
                  {t.editor.traits}
                </h2>
                <p className="muted">{t.editor.traitsHint}</p>
                <div className="profile-helper">
                  <strong>
                    <Sparkles size={16} />
                    {t.editor.assist}
                  </strong>
                  <p>{t.editor.assistHint}</p>
                  <div>
                    <select
                      aria-label={t.editor.choose}
                      value={profile}
                      onChange={(e) => setProfile(Number(e.target.value))}
                    >
                      {t.editor.profiles.map((p, i) => (
                        <option value={i} key={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <button className="button secondary" onClick={applyProfile}>
                      {t.editor.applyProfile}
                    </button>
                  </div>
                </div>
                <div className="trait-sliders">
                  {(Object.keys(draft.traits) as (keyof Agent['traits'])[]).map((key) => (
                    <label key={key}>
                      <span>
                        {t.editor[key]}
                        <strong>{draft.traits[key]}%</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={draft.traits[key]}
                        onChange={(e) =>
                          update('traits', { ...draft.traits, [key]: Number(e.target.value) })
                        }
                      />
                      <span className="range-caps">
                        <small>0</small>
                        <small>100</small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {section === 2 && (
              <>
                <h2>
                  <ShieldCheck size={19} />
                  {t.editor.prompt}
                </h2>
                <Field label={`${t.editor.prompt} *`} hint={t.editor.promptHint}>
                  <textarea
                    rows={7}
                    maxLength={8000}
                    value={draft.systemPrompt}
                    onChange={(e) => update('systemPrompt', e.target.value)}
                    placeholder={t.editor.promptPlaceholder}
                    required
                  />
                </Field>
                <h3>{t.editor.tools}</h3>
                <p className="muted">{t.editor.toolsHint}</p>
                <div className="permission-list">
                  {(['web', 'files', 'code'] as const).map((tool) => (
                    <label key={tool}>
                      <span>{t.tools[tool]}</span>
                      <input
                        type="checkbox"
                        checked={draft.tools.includes(tool)}
                        onChange={(e) =>
                          update(
                            'tools',
                            e.target.checked
                              ? [...draft.tools, tool]
                              : draft.tools.filter((x) => x !== tool),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <h3>{t.editor.advanced}</h3>
                <div className="form-grid">
                  <Field label={t.editor.temperature}>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={draft.temperature}
                      onChange={(e) =>
                        update('temperature', Math.min(2, Math.max(0, Number(e.target.value))))
                      }
                    />
                  </Field>
                  <Field label={t.editor.maxTokens}>
                    <select
                      value={draft.maxTokens}
                      onChange={(e) => update('maxTokens', Number(e.target.value))}
                    >
                      {[256, 512, 1024, 2048, 4096].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}
          </div>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => (section > 0 ? setSection(section - 1) : router.push('/fr/agents'))}
            >
              <ArrowLeft size={16} />
              {section > 0 ? t.common.back : t.common.cancel}
            </button>
            {section < 2 ? (
              <button className="button primary" onClick={() => setSection(section + 1)}>
                {t.common.next}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button className="button primary" onClick={() => void save()} disabled={saving}>
                <Save size={16} />
                {saving ? t.common.saving : t.editor.save}
              </button>
            )}
          </div>
        </div>
        <aside className="editor-preview panel">
          <div className="eyebrow">{t.common.preview}</div>
          <div className="preview-identity">
            <Avatar agent={draft} size="lg" />
            <h2>{draft.name || 'Nova'}</h2>
            <p>{draft.role || t.editor.profiles[0]}</p>
            <Badge tone={provider?.kind === 'local' ? 'green' : 'violet'}>{draft.model}</Badge>
          </div>
          <p>{draft.description || t.editor.descriptionPlaceholder}</p>
          <div className="radar-chart">
            <svg viewBox="0 0 240 200" role="img" aria-label={t.editor.preview}>
              {[1, 0.66, 0.33].map((scale) => (
                <polygon
                  key={scale}
                  points={`120,${100 - 76 * scale} ${120 + 80 * scale},100 120,${100 + 76 * scale} ${120 - 80 * scale},100`}
                  fill="none"
                  stroke="#34394e"
                />
              ))}
              <path d="M120 24v152M40 100h160" stroke="#34394e" />
              <polygon
                points={`120,${100 - draft.traits.creativity * 0.76} ${120 + draft.traits.rigor * 0.8},100 120,${100 + draft.traits.humor * 0.76} ${120 - draft.traits.diplomacy * 0.8},100`}
                fill="#a78bfa33"
                stroke="#b6a0ff"
                strokeWidth="2"
              />
              <text x="120" y="13" textAnchor="middle">
                {t.editor.creativity}
              </text>
              <text x="206" y="104">
                {t.editor.rigor}
              </text>
              <text x="120" y="195" textAnchor="middle">
                {t.editor.humor}
              </text>
              <text x="2" y="104">
                {t.editor.diplomacy}
              </text>
            </svg>
          </div>
          <div className="preview-message">
            <Badge tone="cyan">{t.common.simulated}</Badge>
            <p>
              {t.editor.previewText}{' '}
              {draft.traits.creativity > 75
                ? t.editor.previewTraits.creative
                : draft.traits.rigor > 80
                  ? t.editor.previewTraits.analytical
                  : t.editor.previewTraits.open}
              . {t.editor.previewEnd}
            </p>
          </div>
          <small className="muted">{t.editor.previewHint}</small>
        </aside>
      </div>
    </div>
  );
}
