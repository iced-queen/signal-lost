import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createGameServer } from '../server.js';
import { repairSteps } from '../test-support/repairs.js';

async function setup(t, options) {
  const game = createGameServer({ tickInterval: 50, ...options });
  game.server.listen(0, '127.0.0.1');
  await once(game.server, 'listening');
  const url = `http://127.0.0.1:${game.server.address().port}`;
  const clients = [];
  t.after(async () => {
    for (const client of clients) {
      client.dispose();
      client.socket.terminate();
    }
    for (const socket of game.wss.clients) socket.terminate();
    await new Promise((resolve, reject) => game.server.close((error) => error ? reject(error) : resolve()));
  });
  async function client() {
    const socket = new WebSocket(url.replace('http:', 'ws:') + '/socket');
    const messages = [];
    const waiting = new Set();
    socket.on('message', (data) => {
      const message = JSON.parse(data);
      const match = [...waiting].find((item) => item.predicate(message));
      if (match) {
        waiting.delete(match);
        clearTimeout(match.timer);
        match.resolve(message);
      } else messages.push(message);
    });
    await once(socket, 'open');
    const result = {
      socket,
      send: (message) => socket.send(JSON.stringify(message)),
      next(predicate) {
        const index = messages.findIndex(predicate);
        if (index !== -1) return Promise.resolve(messages.splice(index, 1)[0]);
        return new Promise((resolve, reject) => {
          const item = { predicate, resolve };
          item.timer = setTimeout(() => { waiting.delete(item); reject(new Error('Timed out waiting for server message')); }, 2500);
          waiting.add(item);
        });
      },
      dispose() { for (const item of waiting) clearTimeout(item.timer); waiting.clear(); },
    };
    clients.push(result);
    return result;
  }
  return { ...game, url, client };
}
const type = (name) => (message) => message.type === name;
const playing = (message) => message.type === 'state' && message.mission?.phase === 'playing';

async function crew(t, options) {
  const game = await setup(t, options);
  const operator = await game.client();
  operator.send({ type: 'create', name: 'Alex' });
  const session = await operator.next(type('session'));
  await operator.next(type('state'));
  const reader = await game.client();
  reader.send({ type: 'join', code: session.code, name: 'Sam' });
  const readerSession = await reader.next(type('session'));
  await reader.next(type('state'));
  return { ...game, operator, reader, session, readerSession };
}

async function start(game, difficulty = 'normal') {
  const previousId = game.lastMissionId;
  game.operator.send({ type: 'difficulty', value: difficulty });
  await game.operator.next((message) => message.type === 'state' && message.difficulty === difficulty && message.players.length === 2);
  game.operator.send({ type: 'ready' });
  game.reader.send({ type: 'ready' });
  await game.operator.next((message) => message.type === 'state' && message.players.every((player) => player.ready));
  game.operator.send({ type: 'start' });
  const state = await game.operator.next((message) => playing(message) && message.mission.id !== previousId);
  game.lastMissionId = state.mission.id;
  return state;
}

test('serves the game, health checks, assets and proper HTTP errors', async (t) => {
  const { url } = await setup(t);
  const home = await fetch(url);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Signal Lost/);
  assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.deepEqual(await (await fetch(`${url}/health`)).json(), { status: 'ok' });
  assert.equal((await fetch(`${url}/app.js`)).headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal((await fetch(`${url}/missing`)).status, 404);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${url}/%zz`)).status, 400);
  assert.equal((await fetch(url, { method: 'HEAD' })).status, 200);
});

test('private rooms accept exactly two players and never send console data to the analyst', async (t) => {
  const game = await crew(t);
  const extra = await game.client();
  extra.send({ type: 'join', code: game.session.code, name: 'Third' });
  assert.match((await extra.next(type('error'))).text, /two players/);
  game.operator.send({ type: 'start' });
  assert.match((await game.operator.next(type('error'))).text, /connected and ready/);
  const state = await start(game);
  const manual = await game.reader.next(playing);
  assert.equal(state.mission.modules.length, 4);
  assert.equal(Object.hasOwn(manual.mission, 'modules'), false);
  assert.equal(Object.hasOwn(manual.mission, 'serial'), false);
  assert.equal(JSON.stringify(state).includes('"answer"'), false);
  game.reader.send({ type: 'action', moduleId: state.mission.modules[0].id, value: 0 });
  assert.match((await game.reader.next(type('error'))).text, /Only the operator/);
  game.reader.send({ type: 'abort' });
  assert.match((await game.reader.next(type('error'))).text, /Only the host/);
  game.operator.send({ type: 'swap' });
  assert.match((await game.operator.next(type('error'))).text, /Finish this mission/);
});

test('a crew can win, return to the lobby, swap roles and launch another mission', async (t) => {
  const game = await crew(t);
  await start(game, 'cozy');
  const mission = game.rooms.get(game.session.code).mission;
  for (const module of mission.modules) {
    for (const { stage, value } of repairSteps(module)) {
      game.operator.send({ type: 'action', missionId: mission.id, moduleId: module.id, stage, value });
    }
  }
  const won = await game.reader.next((message) => message.type === 'state' && message.mission?.phase === 'won');
  assert.equal(won.mission.restored, 3);
  assert.equal(won.mission.strikes, 0);
  game.operator.send({ type: 'lobby' });
  await game.operator.next((message) => message.type === 'state' && message.mission === null && message.players.every((player) => !player.ready));
  game.operator.send({ type: 'swap' });
  const swapped = await game.operator.next((message) => message.type === 'state' && message.players.find((player) => player.id === message.self).role === 'reader');
  assert.equal(swapped.players.filter((player) => player.role === 'operator').length, 1);
  const second = await start(game);
  assert.equal(Object.hasOwn(second.mission, 'modules'), false);
});

test('disconnect pauses the clock and authenticated reconnect restores the same role and mission', async (t) => {
  const game = await crew(t);
  await start(game);
  game.reader.socket.close();
  await once(game.reader.socket, 'close');
  await game.operator.next((message) => playing(message) && message.paused);
  const mission = game.rooms.get(game.session.code).mission;
  const remaining = mission.remaining;
  await new Promise((resolve) => setTimeout(resolve, 170));
  assert.equal(mission.remaining, remaining);
  game.operator.send({ type: 'action', moduleId: mission.modules[0].id, value: 0 });
  assert.match((await game.operator.next(type('error'))).text, /reconnect/);
  const resumed = await game.client();
  resumed.send({ ...game.readerSession, type: 'resume' });
  await resumed.next(type('session'));
  const state = await resumed.next(playing);
  assert.equal(state.paused, false);
  assert.equal(state.mission.id, mission.id);
  assert.equal(state.players.find((player) => player.id === state.self).role, 'reader');
  const invalid = await game.client();
  invalid.send({ type: 'resume', code: game.session.code, token: 'not-the-token' });
  assert.match((await invalid.next(type('error'))).text, /expired/);
});

test('reconnecting in a new tab retires the old transport without disconnecting the player', async (t) => {
  const game = await crew(t);
  const oldClosed = once(game.reader.socket, 'close');
  const replacement = await game.client();
  replacement.send({ ...game.readerSession, type: 'resume' });
  await replacement.next(type('session'));
  const [code] = await oldClosed;
  assert.equal(code, 4001);
  const state = await replacement.next(type('state'));
  assert.equal(state.players.every((player) => player.online), true);
});

test('explicit leave ends the active mission and transfers hosting; a new partner fills the vacant role', async (t) => {
  const game = await crew(t);
  await start(game);
  game.operator.send({ type: 'leave' });
  await game.operator.next(type('left'));
  const left = await game.reader.next((message) => message.type === 'state' && message.players.length === 1);
  assert.equal(left.mission.phase, 'lost');
  assert.equal(left.host, left.self);
  const next = await game.client();
  next.send({ type: 'join', code: game.session.code, name: 'New operator' });
  await next.next(type('session'));
  const state = await next.next(type('state'));
  assert.equal(state.players.find((player) => player.id === state.self).role, 'operator');
});

test('expired empty rooms and capacity limits are explicit', async (t) => {
  const game = await setup(t, { maxRooms: 1, roomLifetime: 80 });
  const first = await game.client();
  first.send({ type: 'create', name: 'A' });
  const session = await first.next(type('session'));
  const second = await game.client();
  second.send({ type: 'create', name: 'B' });
  assert.match((await second.next(type('error'))).text, /full/);
  first.socket.close();
  await once(first.socket, 'close');
  await new Promise((resolve) => setTimeout(resolve, 200));
  second.send({ type: 'join', code: session.code, name: 'B' });
  assert.match((await second.next(type('error'))).text, /not found/);
});

test('malformed messages and invalid lobby values return errors without changing state', async (t) => {
  const game = await setup(t);
  const client = await game.client();
  client.socket.send('{');
  assert.match((await client.next(type('error'))).text, /Invalid message/);
  client.send({ type: 'create', name: ' ' });
  assert.match((await client.next(type('error'))).text, /name/);
  client.send({ type: 'join', code: '../../', name: 'A' });
  assert.match((await client.next(type('error'))).text, /six-character/);
  client.send({ type: 'create', name: 'A' });
  await client.next(type('session'));
  client.send({ type: 'difficulty', value: 'invalid' });
  assert.match((await client.next(type('error'))).text, /valid mission/);
  client.send({ type: 'mystery' });
  assert.match((await client.next(type('error'))).text, /Unknown/);
});

test('a timed transmission fails at zero and relaxed mode keeps no deadline', async (t) => {
  const game = await crew(t);
  await start(game);
  game.rooms.get(game.session.code).mission.remaining = 0.08;
  const result = await game.reader.next((message) => message.type === 'state' && message.mission?.phase === 'lost');
  assert.equal(result.mission.remaining, 0);
  assert.match(result.mission.feedback.text, /window closed/);
});

test('the action deadline is authoritative even between periodic clock broadcasts', async (t) => {
  const game = await crew(t, { tickInterval: 10000 });
  await start(game);
  const mission = game.rooms.get(game.session.code).mission;
  mission.remaining = 0.02;
  await new Promise((resolve) => setTimeout(resolve, 50));
  const module = mission.modules.find((item) => item.type === 'wires');
  game.operator.send({ type: 'action', moduleId: module.id, value: module.answer });
  assert.match((await game.operator.next(type('error'))).text, /transmission has ended/);
  assert.equal(mission.phase, 'lost');
  assert.equal(module.solved, false);
  const state = await game.reader.next((message) => message.type === 'state' && message.mission?.phase === 'lost');
  assert.equal(state.mission.remaining, 0);
});

test('operator inspections reach the analyst without clues; analyst inspections are rejected', async (t) => {
  const game = await crew(t);
  const state = await start(game);
  const moduleId = state.mission.modules[1].id;
  game.operator.send({ type: 'inspect', missionId: state.mission.id, moduleId });
  const reader = await game.reader.next((message) => playing(message) && message.mission.focusedModuleId === moduleId);
  assert.equal(reader.mission.systems.find((system) => system.id === moduleId).available, false);
  assert.equal(Object.hasOwn(reader.mission, 'modules'), false);
  game.reader.send({ type: 'inspect', missionId: state.mission.id, moduleId: null });
  assert.match((await game.reader.next(type('error'))).text, /Only the operator/);
  game.operator.send({ type: 'inspect', missionId: state.mission.id, moduleId: null });
  await game.reader.next((message) => playing(message) && message.mission.focusedModuleId === null && message.mission.revision === 0);
});

test('stale missions, stale stages and unpowered actions never spend a strike', async (t) => {
  const game = await crew(t);
  await start(game);
  const mission = game.rooms.get(game.session.code).mission;
  const power = mission.modules[0];
  game.operator.send({ type: 'action', missionId: 'old-mission', moduleId: power.id, stage: 'isolate', value: power.answer });
  assert.match((await game.operator.next(type('error'))).text, /mission has changed/);
  const final = mission.modules.at(-1);
  game.operator.send({ type: 'action', missionId: mission.id, moduleId: final.id, stage: 'tune', value: { frequency: final.answer, bandwidth: final.secondaryAnswer } });
  assert.match((await game.operator.next(type('error'))).text, /upstream/);
  game.operator.send({ type: 'action', missionId: mission.id, moduleId: power.id, stage: 'isolate', value: power.answer });
  await game.operator.next((message) => playing(message) && message.mission.revision === 1);
  game.operator.send({ type: 'action', missionId: mission.id, moduleId: power.id, stage: 'isolate', value: power.answer });
  assert.match((await game.operator.next(type('error'))).text, /stage has changed/);
  assert.equal(mission.strikes, 0);
  assert.equal(mission.revision, 1);
});
