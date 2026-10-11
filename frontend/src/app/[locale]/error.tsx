'use client';
import { t } from '@/i18n';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="standalone-error">
      <h1>{t.errors.title}</h1>
      <p>{t.errors.hint}</p>
      <button className="button primary" onClick={reset}>
        {t.errors.retry}
      </button>
    </div>
  );
}
