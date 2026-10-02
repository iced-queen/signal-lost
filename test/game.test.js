import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignmentAnswer, applyAction, createMission, DIFFICULTIES, frequencyAnswer, GLYPH_ORDERS,
  inspectModule, missionForRole, moduleAvailable, patchAnswer, pulseAnswer, recoveryPhase, syncAnswer, tickMission, wireAnswer,
} from '../lib/game.js';
import { repairSteps } from '../test-support/repairs.js';

function solve(mission, module) {
  for (const { stage, value } of repairSteps(module)) applyAction(mission, module.id, value, stage);
}

test('wire rules match the handbook for every five-wire combination and serial parity', () => {
  const colors = ['red', 'blue', 'amber', 'white'];
  for (let combination = 0; combination < 4 ** 5; combination++) {
    const wires = Array.from({ length: 5 }, (_, index) => colors[Math.floor(combination / 4 ** index) % 4]);
    for (const lastDigit of [0, 1]) {
      let expected;
      if (wires.filter((color) => color === 'red').length >= 2) expected = wires.lastIndexOf('red');
      else if (!wires.includes('blue')) expected = 1;
      else if (lastDigit === 0 && wires.includes('amber')) expected = wires.indexOf('amber');
      else expected = 4;
      assert.equal(wireAnswer(wires, `SL-123${lastDigit}`), expected);
    }
  }
});

test('pulse decoding reads A-B-C on even serials and reverses only on odd serials', () => {
  const beacons = [{ color: 'cyan', count: 1 }, { color: 'amber', count: 2 }, { color: 'magenta', count: 3 }];
  assert.equal(pulseAnswer(beacons, 'SL-1000'), '215');
  assert.equal(pulseAnswer(beacons, 'SL-1001'), '512');
});

test('frequency correction uses tenths to avoid floating-point comparisons', () => {
  assert.equal(frequencyAnswer('ECHO', 2, true), 910);
  assert.equal(frequencyAnswer('NOVA', 1, false), 884);
  assert.equal(frequencyAnswer('HALO', 3, true), 952);
});

test('all difficulties generate valid, solvable missions', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (let run = 0; run < 100; run++) {
      const mission = createMission(difficulty);
      assert.equal(mission.modules.length, DIFFICULTIES[difficulty].modules);
      assert.equal(mission.remaining, DIFFICULTIES[difficulty].seconds);
      assert.match(mission.serial, /^SL-\d{4}$/);
      assert.equal(new Set(mission.modules.map((module) => module.id)).size, mission.modules.length);
      for (const module of mission.modules) {
        if (module.type === 'glyphs') {
          assert.equal(new Set(module.glyphs).size, 4);
          assert.deepEqual(module.answer, GLYPH_ORDERS[module.band].filter((glyph) => module.glyphs.includes(glyph)));
        }
        solve(mission, module);
      }
      assert.equal(mission.phase, 'won');
      assert.equal(mission.strikes, 0);
    }
  }
});

test('wire and pulse mistakes accumulate strikes without accidentally solving modules', () => {
  const mission = createMission('hard');
  const module = { id: 'test', type: 'wires', stage: 'isolate', requires: [], cuts: [], colors: ['blue', 'red', 'amber', 'white'], answer: 1, secondaryAnswer: 'A', solved: false };
  mission.modules = [module];
  assert.equal(applyAction(mission, 'test', 0), false);
  assert.equal(module.solved, false);
  assert.equal(mission.strikes, 1);
  assert.throws(() => applyAction(mission, 'test', 0), /already been disconnected/);
  assert.equal(mission.strikes, 1);
  applyAction(mission, 'test', 2);
  applyAction(mission, 'test', 3);
  assert.equal(mission.phase, 'lost');
  assert.throws(() => applyAction(mission, 'test', 1), /not active/);
});

test('glyph mistakes reset only their sequence and accepted glyphs cannot be replayed', () => {
  const mission = createMission();
  const module = { id: 'glyph', type: 'glyphs', stage: 'sequence', requires: [], glyphs: ['moon', 'star', 'eye', 'sun'], progress: [], answer: ['moon', 'star', 'eye', 'sun'], secondaryAnswer: 2, solved: false };
  mission.modules = [module];
  applyAction(mission, 'glyph', 'moon');
  assert.throws(() => applyAction(mission, 'glyph', 'moon'), /already locked/);
  assert.equal(mission.strikes, 0);
  applyAction(mission, 'glyph', 'sun');
  assert.equal(mission.strikes, 1);
  assert.deepEqual(module.progress, []);
  solve(mission, module);
  assert.equal(mission.phase, 'won');
});

test('invalid inputs fail explicitly without affecting signal integrity', () => {
  const mission = createMission();
  mission.modules = [
    { id: 'wire', type: 'wires', stage: 'isolate', requires: [], cuts: [], colors: ['red', 'blue'], answer: 1, solved: false },
    { id: 'pulse', type: 'pulses', stage: 'decode', requires: [], answer: '123', solved: false },
    { id: 'dial', type: 'frequency', stage: 'tune', requires: [], answer: 900, solved: false },
  ];
  for (const [id, value] of [['unknown', 0], ['wire', -1], ['wire', '0'], ['pulse', '12'], ['pulse', 123], ['dial', 900.1], ['dial', 1000]]) {
    assert.throws(() => applyAction(mission, id, value));
  }
  assert.equal(mission.strikes, 0);
  assert.throws(() => createMission('unknown'), /Unknown/);
});

test('operator snapshots never include answers; analyst snapshots exclude the console entirely', () => {
  const mission = createMission();
  const operator = missionForRole(mission, 'operator');
  const reader = missionForRole(mission, 'reader');
  assert.equal(operator.modules.length, 4);
  assert.equal(operator.serial, mission.serial);
  assert.equal(JSON.stringify(operator).includes('"answer"'), false);
  assert.equal(JSON.stringify(operator).includes('"secondaryAnswer"'), false);
  for (const key of ['modules', 'serial', 'batteries', 'indicator']) assert.equal(Object.hasOwn(reader, key), false);
  assert.equal(reader.total, 4);
  assert.equal(missionForRole(null, 'operator'), null);
});

test('timers end missions at zero, while relaxed missions track elapsed time without a deadline', () => {
  const timed = createMission();
  tickMission(timed, DIFFICULTIES.normal.seconds - 0.5);
  assert.equal(timed.phase, 'playing');
  tickMission(timed, 1);
  assert.equal(timed.remaining, 0);
  assert.equal(timed.phase, 'lost');
  const elapsed = timed.elapsed;
  tickMission(timed, 10);
  assert.equal(timed.elapsed, elapsed);
  const relaxed = createMission('cozy');
  tickMission(relaxed, 3600);
  assert.equal(relaxed.remaining, null);
  assert.equal(relaxed.elapsed, 3600);
  assert.equal(relaxed.phase, 'playing');
});

test('restored modules reject further actions and completing all modules ends the mission', () => {
  const mission = createMission();
  const first = mission.modules[0];
  solve(mission, first);
  assert.throws(() => applyAction(mission, first.id, first.answer), /already restored/);
  assert.equal(mission.phase, 'playing');
  for (const module of mission.modules.slice(1)) solve(mission, module);
  assert.equal(mission.phase, 'won');
});

test('secondary calibrations match the reference tables, including coupler wrapping', () => {
  for (const [batteries, even, odd] of [[1, 'A', 'B'], [2, 'B', 'C'], [3, 'C', 'A']]) {
    assert.equal(patchAnswer(batteries, 'SL-1000'), even);
    assert.equal(patchAnswer(batteries, 'SL-1001'), odd);
  }
  assert.equal(alignmentAnswer('orbit', false), 1);
  assert.equal(alignmentAnswer('horizon', true), 3);
  assert.equal(alignmentAnswer('zenith', true), 1);
  assert.equal(syncAnswer([{ color: 'cyan' }, { color: 'cyan' }, { color: 'cyan' }]), 'local');
  assert.equal(syncAnswer([{ color: 'cyan' }, { color: 'amber' }, { color: 'cyan' }]), 'cross');
  assert.equal(syncAnswer([{ color: 'cyan' }, { color: 'amber' }, { color: 'magenta' }]), 'remote');
});

test('power gates decoders and all upstream equipment gates final transmission', () => {
  const mission = createMission();
  const [power, ...downstream] = mission.modules;
  assert.equal(recoveryPhase(mission), 'power');
  for (const module of downstream) {
    assert.equal(moduleAvailable(mission, module), false);
    assert.throws(() => applyAction(mission, module.id, repairSteps(module)[0].value), /upstream/);
  }
  applyAction(mission, power.id, power.answer);
  assert.equal(power.stage, 'patch');
  assert.equal(power.solved, false);
  assert.equal(moduleAvailable(mission, downstream[0]), false);
  applyAction(mission, power.id, power.secondaryAnswer);
  assert.equal(recoveryPhase(mission), 'decode');
  assert.equal(moduleAvailable(mission, downstream[0]), true);
  const final = downstream.at(-1);
  assert.equal(moduleAvailable(mission, final), false);
  for (const decoder of downstream.slice(0, -1)) solve(mission, decoder);
  assert.equal(recoveryPhase(mission), 'broadcast');
  assert.equal(moduleAvailable(mission, final), true);
  solve(mission, final);
  assert.equal(recoveryPhase(mission), 'complete');
});

test('stage changes reject stale commands without strikes and calibration failures can be retried', () => {
  const mission = createMission();
  const power = mission.modules[0];
  applyAction(mission, power.id, power.answer, 'isolate');
  const revision = mission.revision;
  assert.throws(() => applyAction(mission, power.id, power.answer, 'isolate'), /stage has changed/);
  assert.equal(mission.strikes, 0);
  assert.equal(mission.revision, revision);
  const wrongPort = ['A', 'B', 'C'].find((port) => port !== power.secondaryAnswer);
  applyAction(mission, power.id, wrongPort, 'patch');
  assert.equal(power.stage, 'patch');
  assert.equal(mission.strikes, 1);
  applyAction(mission, power.id, power.secondaryAnswer, 'patch');
  assert.equal(power.solved, true);
});

test('final transmission validates frequency and bandwidth together', () => {
  const mission = createMission();
  for (const module of mission.modules.slice(0, -1)) solve(mission, module);
  const final = mission.modules.at(-1);
  assert.throws(() => applyAction(mission, final.id, { frequency: final.answer, bandwidth: 'invalid' }), /bandwidth/);
  assert.equal(mission.strikes, 0);
  applyAction(mission, final.id, { frequency: final.answer, bandwidth: final.secondaryAnswer === 'wide' ? 'narrow' : 'wide' });
  assert.equal(final.solved, false);
  assert.equal(mission.strikes, 1);
  solve(mission, final);
  assert.equal(mission.phase, 'won');
});

test('inspection is shared without exposing live clues to the analyst', () => {
  const mission = createMission();
  inspectModule(mission, mission.modules[1].id);
  const reader = missionForRole(mission, 'reader');
  assert.equal(reader.focusedModuleId, mission.modules[1].id);
  assert.equal(reader.systems[1].available, false);
  for (const key of ['modules', 'serial', 'batteries', 'indicator']) assert.equal(Object.hasOwn(reader, key), false);
  assert.throws(() => inspectModule(mission, 'not-a-device'), /Unknown/);
  inspectModule(mission, null);
  assert.equal(mission.focusedModuleId, null);
});
