import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../src/data/seed';
import { transition, effectiveTools } from '../src/domain/engine';
import { stateSchema } from '../src/domain/models';
const now = '2026-10-11T09:04:00.000Z';
function running() {
  const state = structuredClone(seed);
  state.rooms[0].status = 'running';
  state.rooms[0].startedAt = now;
  return state;
}
test('initial fixtures satisfy the persisted schema', () => {
  assert.equal(stateSchema.safeParse(seed).success, true);
});
test('paused and stopped rooms cannot generate new responses', () => {
  for (const status of ['paused', 'stopped'] as const) {
    const state = running();
    state.rooms[0].status = status;
    assert.deepEqual(
      transition(state, {
        id: 'x',
        now,
        command: { type: 'room.simulate', roomId: 'ethique-ia', selection: 0 },
      }),
      state,
    );
  }
});
test('budget blocks a cloud response before charging beyond the ceiling', () => {
  const state = running();
  state.rooms[0].budget = 0.13;
  state.rooms[0].agentIds = ['atlas'];
  const after = transition(state, {
    id: 'x',
    now,
    command: { type: 'room.simulate', roomId: 'ethique-ia', selection: 0 },
  });
  assert.equal(after.rooms[0].spent, 0.12);
  assert.equal(after.rooms[0].status, 'stopped');
  assert.equal(
    after.messages.filter((m) => m.agentId === 'atlas').length,
    state.messages.filter((m) => m.agentId === 'atlas').length,
  );
});
test('local responses consume tokens without charging cloud costs', () => {
  const state = running();
  state.rooms[0].agentIds = ['loki'];
  const after = transition(state, {
    id: 'x',
    now,
    command: { type: 'room.simulate', roomId: 'ethique-ia', selection: 0 },
  });
  assert.equal(after.rooms[0].spent, state.rooms[0].spent);
  assert.equal(after.rooms[0].localTokens, state.rooms[0].localTokens + 400);
});
test('conversation remains open after successive agent responses', () => {
  const state = running();
  state.rooms[0].maxMessages = null;
  const after = transition(state, {
    id: 'x',
    now,
    command: { type: 'room.simulate', roomId: 'ethique-ia', selection: 0 },
  });
  assert.equal(after.rooms[0].status, 'running');
  assert.equal(after.rooms[0].simulatedTurns, state.rooms[0].simulatedTurns + 1);
});
test('expired session stops before a model response', () => {
  const state = running();
  state.rooms[0].maxMinutes = 1;
  const after = transition(state, {
    id: 'x',
    now: '2026-10-11T09:06:00.000Z',
    command: { type: 'room.simulate', roomId: 'ethique-ia', selection: 0 },
  });
  assert.equal(after.rooms[0].status, 'stopped');
  assert.equal(after.rooms[0].simulatedTurns, state.rooms[0].simulatedTurns);
});
test('effective tool permissions are the intersection of room and agent permissions', () => {
  const state = running();
  assert.deepEqual(
    effectiveTools(
      { ...state.agents[0], tools: ['web', 'code'] },
      { ...state.rooms[0], tools: ['files', 'code'] },
    ),
    ['code'],
  );
});
test('offline agents are skipped without preventing eligible agents from responding', () => {
  const state = running();
  state.rooms[0].agentIds = ['atlas', 'nova'];
  state.providers[0].connected = false;
  const after = transition(state, {
    id: 'x',
    now,
    command: { type: 'room.simulate', roomId: 'ethique-ia', selection: 0 },
  });
  assert.equal(after.messages.at(-1)?.agentId, 'nova');
});
test('no eligible participant pauses the room with a visible event', () => {
  const state = running();
  state.rooms[0].agentIds = [];
  const after = transition(state, {
    id: 'x',
    now,
    command: { type: 'room.simulate', roomId: 'ethique-ia', selection: 0 },
  });
  assert.equal(after.rooms[0].status, 'paused');
  assert.equal(after.events[0].tone, 'warning');
});
test('a cross-room reply is rejected while the message is preserved', () => {
  const after = transition(seed, {
    id: 'x',
    now,
    command: { type: 'message.send', roomId: 'ethique-ia', text: 'Bonjour', replyTo: 'm4' },
  });
  assert.equal(after.messages.at(-1)?.replyTo, undefined);
  assert.equal(after.messages.at(-1)?.text, 'Bonjour');
  assert.deepEqual(
    after.messages.filter((m) => m.roomId === 'architecture'),
    seed.messages.filter((m) => m.roomId === 'architecture'),
  );
});
test('reaction toggle does not remove other participants', () => {
  const first = transition(seed, {
    id: 'x',
    now,
    command: { type: 'message.react', messageId: 'm1', emoji: '👍' },
  });
  const second = transition(first, {
    id: 'y',
    now,
    command: { type: 'message.react', messageId: 'm1', emoji: '👍' },
  });
  assert.deepEqual(first.messages[0].reactions['👍'], ['nova', 'human']);
  assert.deepEqual(second.messages[0].reactions['👍'], ['nova']);
});
test('removing a participant preserves history and records an event', () => {
  const after = transition(seed, {
    id: 'x',
    now,
    command: { type: 'room.participant', roomId: 'ethique-ia', agentId: 'atlas', add: false },
  });
  assert.ok(!after.rooms[0].agentIds.includes('atlas'));
  assert.deepEqual(after.messages.slice(0, seed.messages.length), seed.messages);
  assert.equal(after.events[0].roomId, 'ethique-ia');
});
