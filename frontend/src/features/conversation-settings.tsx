'use client';
import { useState, type FormEvent } from 'react';
import { useAgora } from '@/components/store';
import { conversationSettingsSchema, type Room } from '@/domain/models';
import { t } from '@/i18n';

export function ConversationSettingsPanel({ room }: { room: Room }) {
  const { activeWorkspaceId, updateRoomSettings, notify, workspaces } = useAgora();
  const [settings, setSettings] = useState(() =>
    conversationSettingsSchema.parse(room.conversationSettings ?? {}),
  );
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState(() => ({
    name: room.name,
    description: room.description,
    topic: room.topic,
    rules: room.rules,
    mode: room.mode,
    budget: room.budget,
    maxMinutes: room.maxMinutes,
  }));
  const [tools, setTools] = useState(room.tools);
  const [permanent, setPermanent] = useState(room.temporalMode === 'permanent');
  const editable =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.role !== 'observer';
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!activeWorkspaceId || saving) return;
    setSaving(true);
    try {
      await updateRoomSettings({
        ...room,
        ...details,
        conversationSettings: settings,
        tools,
        temporalMode: permanent
          ? 'permanent'
          : room.temporalMode === 'permanent'
            ? 'live'
            : room.temporalMode,
      });
      notify(t.conversationSettings.saved);
    } catch (error) {
      notify(error instanceof Error ? error.message : t.shell.storageError);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="inspector-section">
      <form onSubmit={save} aria-busy={saving}>
        <fieldset disabled={saving || !editable} style={{ border: 0, padding: 0, minWidth: 0 }}>
          <p className="muted">{t.conversationSettings.liveHint}</p>
          <label className="field">
            {t.rooms.name}
            <input
              required
              minLength={2}
              maxLength={120}
              value={details.name}
              onChange={(event) => setDetails({ ...details, name: event.target.value })}
            />
          </label>
          {(['description', 'topic', 'rules'] as const).map((field) => (
            <label className="field" key={field}>
              {t.rooms[field]}
              <textarea
                required={field === 'topic'}
                minLength={field === 'topic' ? 5 : undefined}
                maxLength={field === 'description' ? 2000 : 10000}
                value={details[field]}
                onChange={(event) => setDetails({ ...details, [field]: event.target.value })}
              />
            </label>
          ))}
          <label className="field">
            {t.rooms.mode}
            <select
              value={details.mode}
              onChange={(event) =>
                setDetails({ ...details, mode: event.target.value as Room['mode'] })
              }
            >
              {Object.entries(t.rooms.modes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t.chat.budget}
            <input
              required
              type="number"
              min={Math.max(room.spent, 0.0001)}
              step="0.0001"
              value={details.budget}
              onChange={(event) => setDetails({ ...details, budget: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            {t.conversationSettings.duration}
            <input
              required
              type="number"
              min={1}
              max={43200}
              step={1}
              value={details.maxMinutes}
              onChange={(event) =>
                setDetails({ ...details, maxMinutes: Number(event.target.value) })
              }
            />
          </label>

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
                style={{ width: 'auto' }}
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
                  style={{ width: 'auto' }}
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
