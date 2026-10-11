'use client';
import { useState } from 'react';
import {
  Check,
  Cable,
  Cpu,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Unplug,
  FlaskConical,
  Network,
} from 'lucide-react';
import { useAgora } from '@/components/store';
import { Badge, Field, Modal, PageHeading, SectionHeading } from '@/components/ui';
import { t } from '@/i18n';
import type { Provider } from '@/domain/models';
export function Providers() {
  const { state, dispatch, notify } = useAgora();
  const [editing, setEditing] = useState<Provider | null>(null),
    [error, setError] = useState('');
  function save() {
    if (!editing) return;
    if (editing.kind === 'local') {
      try {
        const url = new URL(editing.endpoint);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
          throw new Error();
      } catch {
        setError(t.providers.endpointInvalid);
        return;
      }
    }
    dispatch({ type: 'provider.save', provider: editing });
    notify(t.providers.saved);
    setEditing(null);
  }
  return (
    <div className="page">
      <PageHeading
        eyebrow={t.providers.eyebrow}
        title={t.providers.title}
        description={t.providers.subtitle}
      />
      <div className="info-box provider-notice">
        <FlaskConical size={23} />
        <div>
          <strong>{t.providers.notice}</strong>
          <p>{t.providers.noticeHint}</p>
        </div>
        <Badge tone="cyan">{t.demo}</Badge>
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
                    dispatch({ type: 'provider.save', provider: { ...p, connected: !p.connected } })
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
                      dispatch({
                        type: 'provider.save',
                        provider: { ...p, connected: !p.connected },
                      })
                    }
                  >
                    {p.connected ? t.providers.disconnect : t.providers.connect}
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
                    <Badge tone="green">{t.common.simulated}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      <div className="local-banner">
        <span className="feature-icon tone-violet">
          <ShieldCheck size={24} />
        </span>
        <div>
          <strong>{t.providers.securityTitle}</strong>
          <p>{t.providers.securityHint}</p>
        </div>
      </div>
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
        title={`${t.providers.configure} ${editing?.name ?? ''}`}
      >
        {editing && (
          <div className="modal-form">
            <div className="info-box">{t.providers.noticeHint}</div>
            {editing.kind === 'local' && (
              <Field label={t.providers.endpoint} hint={t.providers.endpointHint}>
                <input
                  type="url"
                  value={editing.endpoint}
                  onChange={(e) => setEditing({ ...editing, endpoint: e.target.value })}
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
            <button className="button secondary" onClick={() => notify(t.providers.testSuccess)}>
              <Check size={16} />
              {t.providers.test}
            </button>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button className="button secondary" onClick={() => setEditing(null)}>
                {t.common.cancel}
              </button>
              <button className="button primary" onClick={save}>
                {t.common.save}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
