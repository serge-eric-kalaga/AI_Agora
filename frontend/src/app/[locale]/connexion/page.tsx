'use client';
import { useState, type FormEvent } from 'react';
import { LockKeyhole, Orbit, ShieldCheck } from 'lucide-react';
import { useAgora } from '@/components/store';
import { t } from '@/i18n';

export default function ConnectionPage() {
  const { login, register, ready } = useAgora();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError('');
    try {
      const password = String(data.get('password') ?? '');
      if (mode === 'login') {
        await login({ login: String(data.get('login') ?? ''), password });
      } else {
        await register({
          email: String(data.get('email') ?? ''),
          username: String(data.get('username') ?? ''),
          password,
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.session.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span>
            <Orbit size={28} />
          </span>
          <strong>{t.appName}</strong>
          <small>{t.beta}</small>
        </div>
        <div className="auth-heading">
          <span className="feature-icon tone-violet">
            <LockKeyhole size={24} />
          </span>
          <div>
            <h1 id="auth-title">{t.session.title}</h1>
            <p>{t.session.subtitle}</p>
          </div>
        </div>
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={mode === 'login' ? 'selected' : ''}
            onClick={() => setMode('login')}
          >
            {t.session.login}
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'selected' : ''}
            onClick={() => setMode('register')}
          >
            {t.session.register}
          </button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'login' ? (
            <label>
              {t.session.loginLabel}
              <input name="login" autoComplete="username" required />
            </label>
          ) : (
            <>
              <label>
                {t.session.email}
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                {t.session.username}
                <input name="username" autoComplete="username" minLength={3} required />
              </label>
            </>
          )}
          <label>
            {t.session.password}
            <input
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 12 : 1}
              required
            />
            {mode === 'register' && <small>{t.session.passwordHint}</small>}
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary auth-submit" disabled={submitting || !ready}>
            {submitting
              ? t.common.loading
              : mode === 'login'
                ? t.session.submitLogin
                : t.session.submitRegister}
          </button>
        </form>
        <p className="auth-security">
          <ShieldCheck size={16} />
          {t.session.secureHint}
        </p>
      </section>
    </main>
  );
}
