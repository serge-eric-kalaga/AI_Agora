'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MessageSquarePlus,
  Users,
  Shield,
  Timer,
  LockKeyhole,
  Coins,
  Rocket,
  Pause,
  Globe,
  Files,
  Terminal,
  Radio,
  Infinity,
  Moon,
} from 'lucide-react';
import { useAgora } from '@/components/store';
import { Avatar, Badge, Field, PageHeading } from '@/components/ui';
import { formatMoney, t } from '@/i18n';
import type { RoomDraft } from '@/domain/models';
const stepIcons = [MessageSquarePlus, Users, Shield, Timer, LockKeyhole, Coins];
export function RoomWizard() {
  const { state, createRoom, mode, notify } = useAgora();
  const router = useRouter();
  const [step, setStep] = useState(0),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RoomDraft>({
    name: '',
    description: '',
    topic: '',
    mode: 'debate',
    temporalMode: 'live',
    agentIds: [],
    visibility: 'private',
    rules: '',
    tools: [],
    budget: 5,
    maxMessages: null,
    maxMinutes: 60,
  });
  const update = <K extends keyof RoomDraft>(key: K, value: RoomDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  function validate(index: number) {
    if (index === 0 && (!draft.name.trim() || !draft.topic.trim())) return t.rooms.nameRequired;
    if (index === 1 && draft.agentIds.length < 2) return t.rooms.chooseTwo;
    if (
      index === 5 &&
      (!Number.isFinite(draft.budget) ||
        draft.budget <= 0 ||
        !Number.isFinite(draft.maxMinutes) ||
        draft.maxMinutes <= 0)
    )
      return t.rooms.limitsInvalid;
    return '';
  }
  function next() {
    const issue = validate(step);
    setError(issue);
    if (!issue) setStep(step + 1);
  }
  async function launch(running: boolean) {
    for (const index of [0, 1, 5]) {
      const issue = validate(index);
      if (issue) {
        setError(issue);
        setStep(index);
        return;
      }
    }
    setSaving(true);
    try {
      const room = await createRoom(
        { ...draft, name: draft.name.trim(), topic: draft.topic.trim() },
        running,
      );
      notify(t.rooms.created);
      router.push(`/fr/rooms/${room.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.shell.storageError);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page wizard-page">
      <Link href="/fr/rooms" className="back-link">
        <ArrowLeft size={15} />
        {t.chat.back}
      </Link>
      <PageHeading eyebrow={t.rooms.eyebrow} title={t.rooms.title} description={t.rooms.subtitle} />
      <div className="wizard-stepper">
        {t.rooms.steps.map((label, i) => {
          const Icon = stepIcons[i];
          return (
            <button
              key={label}
              className={`${step === i ? 'current' : ''} ${step > i ? 'done' : ''}`}
              disabled={i > step}
              aria-current={step === i ? 'step' : undefined}
              onClick={() => {
                setStep(i);
                setError('');
              }}
            >
              <span>{step > i ? <Check size={17} /> : <Icon size={17} />}</span>
              <small>{label}</small>
            </button>
          );
        })}
      </div>
      <div className="wizard-layout">
        <div className="panel wizard-content">
          <div className="wizard-section-title">
            <span>0{step + 1}</span>
            <div>
              <small>{t.rooms.steps[step]}</small>
              <h2>
                {
                  [
                    t.rooms.topic,
                    t.rooms.selectAgents,
                    t.rooms.rules,
                    t.rooms.temporal,
                    t.rooms.visibility,
                    t.rooms.steps[5],
                  ][step]
                }
              </h2>
            </div>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {step === 0 && (
            <>
              <Field label={`${t.rooms.name} *`}>
                <input
                  autoFocus
                  value={draft.name}
                  maxLength={90}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder={t.rooms.namePlaceholder}
                />
              </Field>
              <Field label={`${t.rooms.topic} *`}>
                <textarea
                  rows={4}
                  value={draft.topic}
                  maxLength={2000}
                  onChange={(e) => update('topic', e.target.value)}
                  placeholder={t.rooms.topicPlaceholder}
                />
              </Field>
              <Field label={t.rooms.description}>
                <textarea
                  rows={2}
                  value={draft.description}
                  maxLength={500}
                  onChange={(e) => update('description', e.target.value)}
                />
              </Field>
              <Field label={t.rooms.mode}>
                <select
                  value={draft.mode}
                  onChange={(e) => update('mode', e.target.value as RoomDraft['mode'])}
                >
                  {Object.entries(t.rooms.modes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          {step === 1 && (
            <>
              <p className="muted">{t.rooms.selectHint}</p>
              <div className="agent-picker">
                {state.agents
                  .filter((a) => a.active)
                  .map((a) => (
                    <label key={a.id} className={draft.agentIds.includes(a.id) ? 'selected' : ''}>
                      <Avatar agent={a} />
                      <span>
                        <strong>{a.name}</strong>
                        <small>{a.role}</small>
                      </span>
                      <input
                        type="checkbox"
                        aria-label={a.name}
                        checked={draft.agentIds.includes(a.id)}
                        onChange={(e) =>
                          update(
                            'agentIds',
                            e.target.checked
                              ? [...draft.agentIds, a.id]
                              : draft.agentIds.filter((id) => id !== a.id),
                          )
                        }
                      />
                    </label>
                  ))}
              </div>
              <p className="muted">
                {draft.agentIds.length} {t.rooms.selected}
              </p>
              {state.agents.filter((a) => a.active).length < 2 && (
                <p className="form-error">
                  {t.rooms.noAgents} <Link href="/fr/agents/new">{t.nav.newAgent}</Link>
                </p>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <Field label={t.rooms.rules}>
                <textarea
                  rows={5}
                  maxLength={4000}
                  value={draft.rules}
                  placeholder={t.rooms.rulesPlaceholder}
                  onChange={(e) => update('rules', e.target.value)}
                />
              </Field>
              <h3>{t.rooms.tools}</h3>
              <p className="muted">{t.rooms.toolsHint}</p>
              <div className="permission-list">
                {(['web', 'files', 'code'] as const).map((tool, i) => {
                  const Icon = [Globe, Files, Terminal][i];
                  return (
                    <label key={tool}>
                      <span>
                        <Icon size={17} />
                        {t.tools[tool]}
                      </span>
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
                  );
                })}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="choice-list">
                {(['live', 'background', 'permanent'] as const).map((mode, i) => {
                  const Icon = [Radio, Moon, Infinity][i];
                  return (
                    <label key={mode} className={draft.temporalMode === mode ? 'selected' : ''}>
                      <span className="feature-icon">
                        <Icon size={23} />
                      </span>
                      <span>
                        <strong>{t.rooms.temporalModes[mode]}</strong>
                        <small>{t.rooms.temporalDescriptions[mode]}</small>
                      </span>
                      <input
                        type="radio"
                        name="temporal"
                        value={mode}
                        checked={draft.temporalMode === mode}
                        onChange={() => update('temporalMode', mode)}
                      />
                    </label>
                  );
                })}
              </div>
              <div className="info-box">{t.rooms.temporalDemo}</div>
            </>
          )}
          {step === 4 && (
            <>
              <div className="choice-list">
                {(['private', 'shared'] as const).map((value) => (
                  <label key={value} className={draft.visibility === value ? 'selected' : ''}>
                    <span className="feature-icon">
                      {value === 'private' ? <LockKeyhole size={23} /> : <Users size={23} />}
                    </span>
                    <span>
                      <strong>{t.rooms[value]}</strong>
                      <small>
                        {value === 'private' ? t.rooms.privateHint : t.rooms.sharedHint}
                      </small>
                    </span>
                    <input
                      type="radio"
                      name="visibility"
                      checked={draft.visibility === value}
                      onChange={() => update('visibility', value)}
                    />
                  </label>
                ))}
              </div>
              <div className="info-box">{t.rooms.sharingDemo}</div>
            </>
          )}
          {step === 5 && (
            <>
              <Field label={t.rooms.budget}>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={draft.budget}
                  onChange={(e) => update('budget', Number(e.target.value))}
                />
              </Field>
              <Field label={t.rooms.maxMinutes}>
                <input
                  type="number"
                  min={1}
                  value={draft.maxMinutes}
                  onChange={(e) => update('maxMinutes', Number(e.target.value))}
                />
              </Field>
              <div className="info-box">
                <Shield size={19} />
                {t.rooms.limitsHint}
              </div>
              <div className="demo-disclosure">
                <Badge tone="cyan">{mode === 'demo' ? t.demo : t.chat.connected}</Badge>
                <p>{mode === 'demo' ? t.demoDetail : t.chat.connectedHint}</p>
              </div>
            </>
          )}
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => {
                if (step > 0) {
                  setStep(step - 1);
                  setError('');
                } else router.push('/fr/rooms');
              }}
            >
              <ArrowLeft size={16} />
              {step ? t.common.back : t.common.cancel}
            </button>
            {step < 5 ? (
              <button className="button primary" onClick={next}>
                {t.common.next}
                <ArrowRight size={16} />
              </button>
            ) : (
              <div className="button-group">
                <button
                  className="button secondary"
                  disabled={saving}
                  onClick={() => void launch(false)}
                >
                  <Pause size={15} />
                  {saving ? t.common.saving : t.rooms.savePaused}
                </button>
                <button
                  className="button primary"
                  disabled={saving}
                  onClick={() => void launch(true)}
                >
                  <Rocket size={16} />
                  {saving ? t.common.saving : t.rooms.launch}
                </button>
              </div>
            )}
          </div>
        </div>
        <aside className="panel wizard-recap">
          <div className="recap-art">
            <MessageSquarePlus size={38} strokeWidth={1} />
            <span />
            <i />
          </div>
          <h3>{t.rooms.recap}</h3>
          <h2>{draft.name || t.rooms.namePlaceholder.replace('Ex. ', '')}</h2>
          <p>{draft.topic || t.rooms.topicPlaceholder}</p>
          <div className="avatar-stack">
            {state.agents
              .filter((a) => draft.agentIds.includes(a.id))
              .map((a) => (
                <Avatar key={a.id} agent={a} size="sm" />
              ))}
          </div>
          <dl>
            <div>
              <dt>{t.rooms.mode}</dt>
              <dd>{t.rooms.modes[draft.mode]}</dd>
            </div>
            <div>
              <dt>{t.rooms.temporal}</dt>
              <dd>{t.rooms.temporalModes[draft.temporalMode]}</dd>
            </div>
            <div>
              <dt>{t.rooms.visibility}</dt>
              <dd>{t.rooms[draft.visibility]}</dd>
            </div>
            <div>
              <dt>{t.chat.budget}</dt>
              <dd>{formatMoney(draft.budget || 0)}</dd>
            </div>
          </dl>
          <small className="muted">{t.rooms.limitsHint}</small>
        </aside>
      </div>
    </div>
  );
}
