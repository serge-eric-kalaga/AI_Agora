'use client';
import { useState } from 'react';
import {
  Check,
  Cable,
  Cpu,
  Server,
  SlidersHorizontal,
  Unplug,
  FlaskConical,
  Network,
  Plus,
} from 'lucide-react';
import { useAgora } from '@/components/store';
import { Badge, Field, Modal, PageHeading, SectionHeading } from '@/components/ui';
import { t } from '@/i18n';
import type { Provider } from '@/domain/models';
export function Providers() {
  const { state, mode, saveProvider, testProvider, notify } = useAgora();
  const [editing, setEditing] = useState<Provider | null>(null),
    [apiKey, setApiKey] = useState(''),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [testingId, setTestingId] = useState('');
  const blankProvider: Provider = {
    id: '',
    name: '',
    kind: 'cloud',
    models: [],
    connected: true,
    endpoint: '',
    color: 'violet',
    hasApiKey: false,
  };
  async function save() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.models.length) {
      setError(t.common.required);
      return;
    }
    if (editing.endpoint) {
      try {
        const url = new URL(editing.endpoint);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
          throw new Error();
      } catch {
        setError(t.providers.endpointInvalid);
        return;
      }
    }
    setSaving(true);
    try {
      await saveProvider({ ...editing, name: editing.name.trim() }, apiKey.trim() || undefined);
      notify(t.providers.saved);
      setEditing(null);
      setApiKey('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.session.genericError);
    } finally {
      setSaving(false);
    }
  }
  async function test(provider: Provider) {
    setTestingId(provider.id);
    try {
      const result = await testProvider(provider);
      notify(result.message);
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : t.session.genericError);
    } finally {
      setTestingId('');
    }
  }
  return (
    <div className="page">
      <PageHeading
        eyebrow={t.providers.eyebrow}
        title={t.providers.title}
        description={t.providers.subtitle}
        actions={
          <button
            className="button primary"
            onClick={() => {
              setEditing(blankProvider);
              setApiKey('');
              setError('');
            }}
          >
            <Plus size={17} />
            {t.providers.add}
          </button>
        }
      />
      <div className="info-box provider-notice">
        <FlaskConical size={23} />
        <div>
          <strong>{mode === 'api' ? t.session.connected : t.providers.notice}</strong>
          <p>{mode === 'api' ? t.providers.securityHint : t.providers.noticeHint}</p>
        </div>
        <Badge tone="cyan">{mode === 'api' ? t.session.connected : t.demo}</Badge>
      </div>
      <SectionHeading title={t.providers.cloud} icon={Network} />
      <div className="provider-grid">
        {state.providers
          .filter((p) => p.kind === 'cloud')
          .map((p) => (
            <article className="panel provider-card" key={p.id}>
              <div className="provider-card-top">
                <span className={`provider-logo tone-${p.color}`}>{p.name.slice(0, 2)}</span>
                <div>
                  <h2>{p.name}</h2>
                  <small>
                    {p.models.length} {t.providers.models}
                  </small>
                </div>
                <Badge tone={p.connected ? 'green' : 'neutral'} dot>
                  {p.connected ? t.providers.connected : t.providers.disconnected}
                </Badge>
              </div>
              <div className="model-tags">
                {p.models.map((model) => (
                  <span key={model}>{model}</span>
                ))}
              </div>
              <div className="provider-card-footer">
                <button
                  className={`button small ${p.connected ? 'secondary' : 'primary'}`}
                  onClick={() =>
                    void saveProvider({ ...p, connected: !p.connected }).catch((reason) =>
                      notify(reason.message),
                    )
                  }
                >
                  {p.connected ? <Unplug size={14} /> : <Cable size={14} />}{' '}
                  {p.connected ? t.providers.disconnect : t.providers.connect}
                </button>
                <button
                  className="icon-button bordered"
                  aria-label={`${t.providers.configure} ${p.name}`}
                  onClick={() => {
                    setEditing(p);
                    setError('');
                  }}
                >
                  <SlidersHorizontal size={16} />
                </button>
              </div>
            </article>
          ))}
      </div>
      <SectionHeading title={t.providers.local} icon={Server} />
      {state.providers
        .filter((p) => p.kind === 'local')
        .map((p) => (
          <section key={p.id} className="panel local-provider">
            <div className="local-provider-intro">
              <span className="feature-icon tone-green">
                <Server size={30} />
              </span>
              <div>
                <div className="eyebrow">{t.providers.localEyebrow}</div>
                <h2>{t.providers.localTitle}</h2>
                <p>{t.providers.localHint}</p>
              </div>
              <Badge tone={p.connected ? 'green' : 'neutral'} dot>
                {p.connected ? t.providers.connected : t.providers.disconnected}
              </Badge>
            </div>
            <div className="local-provider-body">
              <div>
                <h3>{t.providers.endpoint}</h3>
                <code>{p.endpoint}</code>
                <p className="muted">{t.providers.endpointHint}</p>
                <div className="button-group">
                  <button
                    className="button secondary"
                    aria-label={`${t.providers.configure} ${p.name}`}
                    onClick={() => {
                      setEditing(p);
                      setError('');
                    }}
                  >
                    <SlidersHorizontal size={15} />
                    {t.providers.configure}
                  </button>
                  <button
                    className="button secondary"
                    onClick={() =>
                      void saveProvider({ ...p, connected: !p.connected }).catch((reason) =>
                        notify(reason.message),
                      )
                    }
                  >
                    {p.connected ? t.providers.disconnect : t.providers.connect}
                  </button>
                  <button
                    className="button secondary"
                    disabled={testingId === p.id}
                    onClick={() => void test(p)}
                  >
                    <Cable size={15} />
                    {testingId === p.id ? t.providers.testing : t.providers.test}
                  </button>
                </div>
              </div>
              <div className="local-models">
                {p.models.map((model) => (
                  <div key={model}>
                    <Cpu size={18} />
                    <span>
                      {model}
                      <small>{t.common.local}</small>
                    </span>
                    <Badge tone="green">{t.common.local}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      <section className="panel model-catalog">
        <SectionHeading title={t.providers.modelCatalog} icon={Cpu} />
        <p className="muted">{t.providers.catalogHint}</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.editor.model}</th>
                <th>{t.editor.provider}</th>
                <th>{t.agents.status}</th>
              </tr>
            </thead>
            <tbody>
              {state.providers.flatMap((p) =>
                p.models.map((model) => (
                  <tr key={p.id + model}>
                    <td>
                      <Cpu size={14} />
                      {model}
                    </td>
                    <td>{p.name}</td>
                    <td>
                      <Badge tone={p.connected ? 'green' : 'neutral'}>
                        {p.connected ? t.providers.connected : t.providers.disconnected}
                      </Badge>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `${t.providers.configure} ${editing.name}` : t.providers.createTitle}
      >
        {editing && (
          <div className="modal-form">
            <div className="info-box">
              {mode === 'api' ? t.providers.apiKeyHint : t.providers.noticeHint}
            </div>
            <Field label={t.providers.name}>
              <input
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                required
              />
            </Field>
            {!editing.id && (
              <Field label={t.providers.kind}>
                <select
                  value={editing.kind}
                  onChange={(event) =>
                    setEditing({ ...editing, kind: event.target.value as Provider['kind'] })
                  }
                >
                  <option value="cloud">{t.common.cloud}</option>
                  <option value="local">{t.common.local}</option>
                </select>
              </Field>
            )}
            {(editing.kind === 'local' || editing.endpoint) && (
              <Field label={t.providers.endpoint} hint={t.providers.endpointHint}>
                <input
                  type="url"
                  value={editing.endpoint}
                  onChange={(e) => setEditing({ ...editing, endpoint: e.target.value })}
                />
              </Field>
            )}
            <Field label={t.providers.modelsInput}>
              <input
                value={editing.models.join(', ')}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    models: event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="gpt-4.1-mini, llama3.3"
              />
            </Field>
            {mode === 'api' && editing.kind === 'cloud' && (
              <Field
                label={t.providers.apiKey}
                hint={editing.hasApiKey ? t.providers.apiKeyHint : undefined}
              >
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            )}
            <label className="toggle-row">
              <span>{t.providers.connected}</span>
              <input
                type="checkbox"
                checked={editing.connected}
                onChange={(e) => setEditing({ ...editing, connected: e.target.checked })}
              />
            </label>
            {editing.id && (
              <button
                className="button secondary"
                disabled={testingId === editing.id}
                onClick={() => void test(editing)}
              >
                <Check size={16} />
                {testingId === editing.id ? t.providers.testing : t.providers.test}
              </button>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button className="button secondary" onClick={() => setEditing(null)}>
                {t.common.cancel}
              </button>
              <button className="button primary" onClick={() => void save()} disabled={saving}>
                {saving ? t.common.saving : t.common.save}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
