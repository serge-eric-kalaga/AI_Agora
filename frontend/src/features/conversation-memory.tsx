'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { useAgora } from '@/components/store';
import { readMemory, refreshMemory, type ConversationMemory } from '@/data/http-api';
import { t } from '@/i18n';

export function ConversationMemoryPanel({
  roomId,
  onNavigate,
}: {
  roomId: string;
  onNavigate: (id: string) => Promise<void>;
}) {
  const { activeWorkspaceId, notify, state } = useAgora();
  const [memory, setMemory] = useState<ConversationMemory | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRevision = useRef<number | null>(null);
  const requestedAt = useRef(0);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!activeWorkspaceId) return;
      const data = await readMemory(activeWorkspaceId, roomId, signal);
      if (signal?.aborted) return;
      setMemory(data);
      if (pendingRevision.current !== null && data.revision > pendingRevision.current) {
        pendingRevision.current = null;
        setPending(false);
      } else if (pendingRevision.current !== null && Date.now() - requestedAt.current > 120_000) {
        pendingRevision.current = null;
        setPending(false);
        notify(t.memory.unchanged);
      }
    },
    [activeWorkspaceId, roomId, notify],
  );
  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => {
      void load(controller.signal).catch((error: unknown) => {
        if (!controller.signal.aborted)
          notify(error instanceof Error ? error.message : t.shell.storageError);
      });
    }, 0);
    // La mémoire évolue moins souvent que les messages ; éviter un appel par tour.
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === 'visible')
          void load(controller.signal).catch(() => undefined);
      },
      pending ? 4_000 : 30_000,
    );
    return () => {
      clearTimeout(initialLoad);
      controller.abort();
      clearInterval(timer);
    };
  }, [load, notify, pending]);
  async function update() {
    if (!activeWorkspaceId || pending) return;
    setPending(true);
    pendingRevision.current = memory?.revision ?? 0;
    requestedAt.current = Date.now();
    try {
      await refreshMemory(activeWorkspaceId, roomId);
      notify(t.memory.pending);
    } catch (error) {
      pendingRevision.current = null;
      setPending(false);
      notify(error instanceof Error ? error.message : t.shell.storageError);
    }
  }
  return (
    <section className="inspector-section" aria-busy={pending}>
      <h3>
        <BookOpen size={16} />
        {t.memory.title}
      </h3>
      {!memory ? (
        <p>{t.memory.loading}</p>
      ) : !memory.entries.length ? (
        <p>{t.memory.empty}</p>
      ) : (
        memory.entries.map((entry, index) => (
          <div key={`${entry.kind}-${index}`} className="memory-entry">
            <h4>{t.memory.kinds[entry.kind]}</h4>
            <p>{entry.text}</p>
            {entry.authorAgentIds.length > 0 && (
              <p className="muted">
                {entry.authorAgentIds
                  .map((id) => state.agents.find((agent) => agent.id === id)?.name)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {entry.messageIds.map((id, sourceIndex) => (
              <button
                key={id}
                className="button secondary"
                onClick={() =>
                  void onNavigate(id).catch((error) =>
                    notify(error instanceof Error ? error.message : t.shell.storageError),
                  )
                }
              >
                {t.memory.source} {sourceIndex + 1}
              </button>
            ))}
          </div>
        ))
      )}
      <button
        className="button secondary full-width"
        disabled={pending || !activeWorkspaceId}
        onClick={() => void update()}
      >
        <Sparkles size={15} />
        {pending ? t.memory.pending : t.memory.refresh}
      </button>
    </section>
  );
}
