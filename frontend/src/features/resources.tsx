'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAgora } from '@/components/store';
import { usePersistentBoolean } from '@/components/persistent-state';
import {
  addRoomSource,
  listRoomResources,
  readRoomResource,
  uploadRoomDocument,
  type RoomResource,
} from '@/data/http-api';
import { t } from '@/i18n';

export function ResourcesPanel({ roomId }: { roomId: string }) {
  const { activeWorkspaceId, notify } = useAgora();
  const [expanded, setExpanded] = usePersistentBoolean(
    `ai-agora.resources-expanded:${roomId}`,
    false,
  );
  const [resources, setResources] = useState<RoomResource[]>([]);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState<{ id: string; text: string } | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!activeWorkspaceId) return;
      const data = await listRoomResources(activeWorkspaceId, roomId, signal);
      if (!signal?.aborted) setResources(data.items);
    },
    [activeWorkspaceId, roomId],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void load(controller.signal).catch((error) => {
        if (!controller.signal.aborted)
          notify(error instanceof Error ? error.message : t.shell.storageError);
      });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load, notify]);
  async function add(event: FormEvent, kind: 'document' | 'source') {
    event.preventDefault();
    if (!activeWorkspaceId || pending) return;
    setPending(true);
    try {
      if (kind === 'document' && file) await uploadRoomDocument(activeWorkspaceId, roomId, file);
      else if (kind === 'source') await addRoomSource(activeWorkspaceId, roomId, url);
      await load();
      setUrl('');
      setFile(null);
      notify(t.resources.added);
    } catch (error) {
      notify(error instanceof Error ? error.message : t.shell.storageError);
    } finally {
      setPending(false);
    }
  }
  async function read(id: string) {
    if (!activeWorkspaceId) return;
    try {
      const data = await readRoomResource(activeWorkspaceId, roomId, id);
      setContent({ id, text: data.content });
    } catch (error) {
      notify(error instanceof Error ? error.message : t.shell.storageError);
    }
  }
  return (
    <section className="inspector-section">
      <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>{t.resources.title}</summary>
        <p className="muted">{t.resources.hint}</p>
        <form onSubmit={(event) => void add(event, 'document')} aria-busy={pending}>
          <label className="field">
            <span>{t.resources.document}</span>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={pending}
            />
            <small>{t.resources.limits}</small>
          </label>
          <button className="button secondary" disabled={pending || !file}>
            {pending ? t.resources.pending : t.resources.import}
          </button>
        </form>
        <form onSubmit={(event) => void add(event, 'source')} aria-busy={pending}>
          <label className="field">
            <span>{t.resources.url}</span>
            <input
              type="url"
              required
              value={url}
              maxLength={2000}
              onChange={(event) => setUrl(event.target.value)}
              disabled={pending}
            />
          </label>
          <button className="button secondary" disabled={pending || !url}>
            {pending ? t.resources.pending : t.resources.consult}
          </button>
        </form>
        {!resources.length && <p>{t.resources.empty}</p>}
        {resources.map((resource) => (
          <article key={resource.id}>
            <h4>{resource.title}</h4>
            <p className="muted">
              {t.resources.date} {new Date(resource.createdAt).toLocaleDateString(t.locale)}
            </p>
            <p>{resource.excerpt}</p>
            {resource.url && (
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                {t.resources.original}
              </a>
            )}
            <button className="button secondary" onClick={() => void read(resource.id)}>
              {t.resources.read}
            </button>
            {activeWorkspaceId && (
              <a
                className="button secondary"
                href={`/api/backend/workspaces/${activeWorkspaceId}/rooms/${roomId}/resources/${resource.id}/download`}
              >
                {t.resources.download}
              </a>
            )}
            {content?.id === resource.id && (
              <div className="resource-content">
                <button className="button secondary" onClick={() => setContent(null)}>
                  {t.resources.close}
                </button>
                <p>{content.text}</p>
              </div>
            )}
          </article>
        ))}
      </details>
    </section>
  );
}
