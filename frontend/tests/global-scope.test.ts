import assert from 'node:assert/strict';
import test from 'node:test';
import { listWorkspaceData, scopedResourcePath } from '../src/data/http-api';
import { listMembers } from '../src/data/collaboration-api';

// Une salle étrangère doit conserver son espace pour le chat, les pièces jointes et le SSE.
test('la vue globale agrège les espaces et conserve le routage des ressources', async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    const path = String(input);
    requested.push(path);
    const workspaceId = path.includes('/espace-b/') ? 'espace-b' : 'espace-a';
    const room = {
      id: `salle-${workspaceId}`,
      workspaceId,
      name: workspaceId,
      description: '',
      topic: 'Sujet',
      mode: 'free',
      temporalMode: 'permanent',
      visibility: 'private',
      status: 'paused',
      rules: '',
      tools: [],
      budgetLimit: 5,
      amountSpent: 0,
      maxMessages: null,
      maxDurationMinutes: 60,
      cloudTokens: 0,
      localTokens: 0,
      version: 1,
      participants: [],
      startedAt: null,
      createdAt: '2026-10-13T12:00:00Z',
      conversationSettings: { pace: 'normal', autonomy: 'free', responseLength: 'brief' },
    };
    return Response.json({
      items: path.endsWith('/rooms')
        ? [room]
        : path.endsWith('/members')
          ? [{ userId: workspaceId, username: workspaceId, email: null, role: 'owner' }]
          : [],
      nextCursor: null,
    });
  };
  try {
    const workspaces = ['espace-a', 'espace-b'].map((id) => ({
      id,
      name: id,
      slug: id,
      ownerId: id,
      role: 'admin' as const,
      createdAt: '',
    }));
    const data = await listWorkspaceData('espace-a', workspaces);
    assert.equal(data.rooms.length, 2);
    assert.equal(requested.length, 6);
    const members = await listMembers('espace-a', workspaces);
    assert.deepEqual(
      members.map((member) => member.workspaceId),
      ['espace-a', 'espace-b'],
    );
    for (const suffix of ['messages', 'stream?cursor=0', 'resources/document/download']) {
      assert.equal(
        scopedResourcePath(`/api/backend/workspaces/espace-a/rooms/salle-espace-b/${suffix}`),
        `/api/backend/workspaces/espace-b/rooms/salle-espace-b/${suffix}`,
      );
    }
    assert.equal(
      scopedResourcePath('/api/backend/workspaces/espace-a/rooms'),
      '/api/backend/workspaces/espace-a/rooms',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
