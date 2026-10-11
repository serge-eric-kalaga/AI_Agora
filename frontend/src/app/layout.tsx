import type { Metadata } from 'next';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'AI Agora — Votre laboratoire multi-agents', template: '%s | AI Agora' },
  description:
    'Explorez les idées ensemble. Un laboratoire de démonstration multi-agents, du cloud aux modèles locaux.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
