import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderHome, renderLobby, renderMission, timeLabel } from '../public/render.js';
import { applyAction, createMission, inspectModule, missionForRole } from '../lib/game.js';
import { renderManual } from '../public/manual.js';
import { MODULE_NAMES } from '../public/rules.js';
import { repairSteps } from '../test-support/repairs.js';

test('player text and attributes are escaped', () => {
  assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;');
  const home = renderHome({ name: '"><script>bad()</script>', invite: '', stats: { wins: 0 } });
  assert.equal(home.includes('<script>'), false);
  assert.match(home, /&quot;&gt;&lt;script&gt;/);
});

test('timer labels round up and handle untimed missions', () => {
  assert.equal(timeLabel(null), '∞');
  assert.equal(timeLabel(480), '08:00');
  assert.equal(timeLabel(59.2), '01:00');
  assert.equal(timeLabel(0), '00:00');
});

test('channel receiver presents one connection action and preserves drafts for each mode', () => {
  for (const mode of ['create', 'join']) {
    const html = renderHome({ name: 'Alex', invite: 'ABC234', stats: { wins: 0 }, mode });
    assert.equal((html.match(/type="submit"/g) ?? []).length, 1);
    assert.match(html, /value="ABC234"/);
    assert.ok(html.includes(`name="intent" value="${mode}"`));
    assert.ok(html.includes(mode === 'create' ? 'OPEN CHANNEL' : 'CONNECT TO CHANNEL'));
    assert.equal(html.includes('AUTO ASSIGN'), mode === 'create');
    assert.equal(html.includes('entry-card'), false);
  }
});

test('each manual page exists and has its reference data', () => {
  for (const type of Object.keys(MODULE_NAMES)) {
    const html = renderManual(type);
    assert.match(html, /ASK YOUR OPERATOR/);
    assert.ok(html.includes(MODULE_NAMES[type]));
    assert.equal(html.includes('undefined'), false);
  }
});

test('lobby and live console render without inline code or leaking hidden solutions', () => {
  const state = {
    code: 'ABC234', self: 'a', host: 'a', difficulty: 'normal', paused: false,
    players: [{ id: 'a', name: '<Alex>', role: 'operator', ready: true, online: true }, { id: 'b', name: 'Sam', role: 'reader', ready: true, online: true }],
    mission: null,
  };
  assert.match(renderLobby(state), /&lt;Alex&gt;/);
  state.mission = missionForRole(createMission(), 'operator');
  const html = renderMission(state, 'wires', {});
  assert.equal(html.includes('undefined'), false);
  assert.equal(/\sstyle=|\sonclick=/.test(html), false);
  assert.match(html, /SERIAL NUMBER/);
  state.self = 'b';
  state.mission = missionForRole(createMission(), 'reader');
  const manual = renderMission(state, 'pulses', {});
  assert.match(manual, /Signal recovery manual/);
  assert.equal(manual.includes('SERIAL NUMBER'), false);
});

test('inspection renders every stage, with native controls locked until their feed is available', () => {
  const mission = createMission('hard');
  const state = {
    code: 'ABC234', self: 'a', host: 'a', difficulty: 'hard', paused: false,
    players: [{ id: 'a', name: 'Alex', role: 'operator' }, { id: 'b', name: 'Sam', role: 'reader' }],
  };
  inspectModule(mission, mission.modules.at(-1).id);
  state.mission = missionForRole(mission, 'operator');
  assert.match(renderMission(state, 'frequency', {}), /No signal feed/);
  for (const module of mission.modules) {
    inspectModule(mission, module.id);
    for (const { stage, value } of repairSteps(module)) {
      state.mission = missionForRole(mission, 'operator');
      const html = renderMission(state, module.type, {});
      assert.equal(html.includes('undefined'), false);
      assert.equal(/\sstyle=|\sonclick=/.test(html), false);
      assert.match(html, /Step back/);
      if (module.type === 'frequency') {
        assert.match(html, /role="slider"/);
        assert.match(html, /CARRIER BANDWIDTH/);
      }
      applyAction(mission, module.id, value, stage);
    }
  }
  assert.equal(mission.phase, 'won');
});

test('analyst scratchpad text is escaped and the schematic does not expose device clues', () => {
  const mission = createMission();
  const state = {
    code: 'ABC234', self: 'b', host: 'a', difficulty: 'normal', paused: false,
    players: [{ id: 'a', name: 'Alex', role: 'operator' }, { id: 'b', name: 'Sam', role: 'reader' }],
    mission: missionForRole(mission, 'reader'),
  };
  const html = renderMission(state, 'glyphs', { notes: '</textarea><script>bad()</script>' });
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes(mission.serial), false);
  assert.match(html, /FEED SCHEMATIC/);
  assert.match(html, /PRIVATE SCRATCHPAD/);
});
