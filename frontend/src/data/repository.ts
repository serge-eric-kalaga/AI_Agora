import { stateSchema, type AgoraState } from '@/domain/models';
import { seed } from './seed';

export interface AgoraRepository {
  load(): Promise<{ state: AgoraState; recovered: boolean }>;
  save(state: AgoraState): Promise<void>;
}
const STORAGE_KEY = 'ai-agora:workspace:v1';
/** Browser-only adapter. No provider credentials enter this contract. */
export class LocalAgoraRepository implements AgoraRepository {
  async load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: structuredClone(seed), recovered: false };
    try {
      const parsed = stateSchema.parse(JSON.parse(raw));
      // Never resume a simulator implicitly after a refresh or browser restart.
      return {
        state: {
          ...parsed,
          rooms: parsed.rooms.map((r) =>
            r.status === 'running' ? { ...r, status: 'paused' as const } : r,
          ),
        },
        recovered: false,
      };
    } catch {
      try {
        localStorage.setItem(`${STORAGE_KEY}:recovery`, raw);
      } catch {
        /* Read-only/full storage is reported on save. */
      }
      return { state: structuredClone(seed), recovered: true };
    }
  }
  async save(state: AgoraState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
