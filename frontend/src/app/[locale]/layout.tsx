import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n';
import { AgoraProvider } from '@/components/store';
import { Shell } from '@/components/shell';
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AgoraProvider>
      <Shell>{children}</Shell>
    </AgoraProvider>
  );
}
