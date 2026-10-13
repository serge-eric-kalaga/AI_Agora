'use client';
import { useState, type FormEvent } from 'react';
import { useAgora } from '@/components/store';
import { updateConversationSettings } from '@/data/http-api';
import { conversationSettingsSchema, type Room } from '@/domain/models';
import { t } from '@/i18n';

export function ConversationSettingsPanel({ room }: { room: Room }) {
  const { activeWorkspaceId, loadRoom, notify, workspaces } = useAgora();
  const [settings, setSettings] = useState(() =>
    conversationSettingsSchema.parse(room.conversationSettings ?? {}),
  );
  const [saving, setSaving] = useState(false);
  const [tools, setTools] = useState(room.tools);
  const [permanent, setPermanent] = useState(room.temporalMode === 'permanent');
  const editable =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.role !== 'observer';
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!activeWorkspaceId || saving) return;
    setSaving(true);
    try {
      await updateConversationSettings(
        activeWorkspaceId,
        room,
        settings,
        tools,
        permanent ? 'permanent' : room.temporalMode === 'permanent' ? 'live' : room.temporalMode,
      );
      await loadRoom(room.id);
      notify(t.conversationSettings.saved);
    } catch (error) {
      notify(error instanceof Error ? error.message : t.shell.storageError);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="inspector-section">
      <h3>{t.conversationSettings.title}</h3>
      <form onSubmit={save} aria-busy={saving}>
        <fieldset disabled={saving || !editable} style={{ border: 0, padding: 0, minWidth: 0 }}>
          <label className="field">
            {t.conversationSettings.pace}
            <select
              value={settings.pace}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  pace: conversationSettingsSchema.shape.pace.parse(event.target.value),
                })
              }
            >
              {Object.entries(t.conversationSettings.paces).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t.conversationSettings.autonomy}
            <select
              value={settings.autonomy}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  autonomy: conversationSettingsSchema.shape.autonomy.parse(event.target.value),
                })
              }
            >
              {Object.entries(t.conversationSettings.autonomies).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t.conversationSettings.length}
            <select
              value={settings.responseLength}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  responseLength: conversationSettingsSchema.shape.responseLength.parse(
                    event.target.value,
                  ),
                })
              }
            >
              {Object.entries(t.conversationSettings.lengths).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={permanent}
                onChange={(event) => setPermanent(event.target.checked)}
              />
              {t.conversationSettings.permanent}
            </span>
            <small>{t.conversationSettings.permanentHint}</small>
          </label>
          {(['files', 'web'] as const).map((tool) => (
            <label className="field" key={tool}>
              <span>
                <input
                  type="checkbox"
                  checked={tools.includes(tool)}
                  onChange={(event) =>
                    setTools((previous) =>
                      event.target.checked
                        ? [...previous, tool]
                        : previous.filter((value) => value !== tool),
                    )
                  }
                />
                {t.conversationSettings.tools[tool]}
              </span>
            </label>
          ))}
          <p className="muted">{t.conversationSettings.hint}</p>
          <button className="button secondary" type="submit">
            {saving ? t.conversationSettings.saving : t.conversationSettings.save}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
