import type { Metadata } from 'next';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import './globals.css';
import './design.css';
export const metadata: Metadata = {
  title: { default: 'AI Agora — Votre laboratoire multi-agents', template: '%s | AI Agora' },
  description:
    'Explorez les idées ensemble. Conversations entre humains et agents, du cloud aux modèles locaux.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('ai-agora.ui.theme')==='light'?'light':'dark'}catch{}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
