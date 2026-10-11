import Link from 'next/link';
import { t } from '@/i18n';
export default function NotFound() {
  return (
    <div className="standalone-error">
      <span>404</span>
      <h1>{t.errors.notFound}</h1>
      <p>{t.errors.notFoundHint}</p>
      <Link className="button primary" href="/fr">
        {t.errors.home}
      </Link>
    </div>
  );
}
