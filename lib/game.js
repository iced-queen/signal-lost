import { randomInt, randomUUID } from 'node:crypto';
import { BAND_DETENTS, DIFFICULTIES, GLYPH_ORDERS, OPERATIONS, PATCH_PORTS, PULSE_TABLE, STATIONS, SYNC_MODES } from '../public/rules.js';
export { DIFFICULTIES, GLYPH_ORDERS, PULSE_TABLE, STATIONS } from '../public/rules.js';

const pick = (values) => values[randomInt(values.length)];
const shuffle = (values) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export function wireAnswer(colors, serial) {
  const reds = colors.flatMap((color, index) => color === 'red' ? [index] : []);
  if (reds.length >= 2) return reds.at(-1);
  if (!colors.includes('blue')) return 1;
  if (Number(serial.at(-1)) % 2 === 0 && colors.includes('amber')) return colors.indexOf('amber');
  return colors.length - 1;
}

export function pulseAnswer(beacons, serial) {
  const digits = beacons.map(({ color, count }) => PULSE_TABLE[color][count - 1]);
  return Number(serial.at(-1)) % 2 ? digits.reverse().join('') : digits.join('');
}

export function frequencyAnswer(station, batteries, indicator) {
  return STATIONS[station] + batteries * 2 + (indicator ? 1 : 0);
}

export function patchAnswer(batteries, serial) {
  return PATCH_PORTS[Number(serial.at(-1)) % 2 ? 'odd' : 'even'][batteries - 1];
}

export function alignmentAnswer(band, indicator) {
  return (BAND_DETENTS[band] - 1 + Number(indicator)) % 3 + 1;
}

export function syncAnswer(beacons) {
  return SYNC_MODES[new Set(beacons.map((beacon) => beacon.color)).size - 1];
}

export function moduleAvailable(mission, module) {
  return module.requires.every((id) => mission.modules.some((item) => item.id === id && item.solved));
}

export function recoveryPhase(mission) {
  if (mission.modules.every((module) => module.solved)) return 'complete';
  if (mission.modules.some((module) => module.type === 'wires' && !module.solved)) return 'power';
  if (mission.modules.some((module) => module.type !== 'frequency' && !module.solved)) return 'decode';
  return 'broadcast';
}

export function createMission(difficulty = 'normal') {
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new Error('Unknown mission difficulty.');
  const settings = DIFFICULTIES[difficulty];
  const serial = `SL-${randomInt(100, 1000)}${randomInt(0, 10)}`;
  const batteries = randomInt(1, 4);
  const indicator = Boolean(randomInt(2));
  const decoders = settings.modules === 3 ? [pick(['glyphs', 'pulses'])] : shuffle(['glyphs', 'pulses']);
  if (settings.modules === 5) decoders.push(pick(['glyphs', 'pulses']));
  const types = ['wires', ...decoders, 'frequency'];
  const modules = types.map((type, index) => {
    const requires = type === 'wires' ? [] : type === 'frequency'
      ? types.slice(0, -1).map((_, dependency) => `module-${dependency}`) : ['module-0'];
    const common = { id: `module-${index}`, type, solved: false, requires };
    if (type === 'wires') {
      const colors = Array.from({ length: 5 }, () => pick(['red', 'blue', 'amber', 'white']));
      return { ...common, stage: 'isolate', colors, cuts: [], answer: wireAnswer(colors, serial), secondaryAnswer: patchAnswer(batteries, serial) };
    }
    if (type === 'glyphs') {
      const band = pick(Object.keys(GLYPH_ORDERS));
      const glyphs = shuffle(GLYPH_ORDERS[band]).slice(0, 4);
      return { ...common, stage: 'sequence', band, glyphs, progress: [], answer: GLYPH_ORDERS[band].filter((glyph) => glyphs.includes(glyph)), secondaryAnswer: alignmentAnswer(band, indicator) };
    }
    if (type === 'pulses') {
      const beacons = Array.from({ length: 3 }, () => ({ color: pick(Object.keys(PULSE_TABLE)), count: randomInt(1, 4) }));
      return { ...common, stage: 'decode', beacons, answer: pulseAnswer(beacons, serial), secondaryAnswer: syncAnswer(beacons) };
    }
    const station = pick(Object.keys(STATIONS));
    return { ...common, stage: 'tune', station, answer: frequencyAnswer(station, batteries, indicator), secondaryAnswer: Number(serial.at(-1)) % 2 ? 'wide' : 'narrow' };
  });
  return {
    id: randomUUID(), difficulty, serial, batteries, indicator, modules,
    remaining: settings.seconds, strikeLimit: settings.strikes, strikes: 0,
    elapsed: 0, phase: 'playing', feedback: null, revision: 0,
    operation: pick(OPERATIONS), focusedModuleId: null, log: [],
  };
}

export function inspectModule(mission, moduleId) {
  if (mission.phase !== 'playing') throw new Error('This mission is not active.');
  if (moduleId !== null && !mission.modules.some((module) => module.id === moduleId)) throw new Error('Unknown console module.');
  mission.focusedModuleId = moduleId;
}

export function applyAction(mission, moduleId, value, expectedStage) {
  if (mission.phase !== 'playing') throw new Error('This mission is not active.');
  const module = mission.modules.find((item) => item.id === moduleId);
  if (!module) throw new Error('Unknown console module.');
  if (module.solved) throw new Error('This module is already restored.');
  if (!moduleAvailable(mission, module)) throw new Error('This device has no signal feed. Restore its upstream equipment first.');
  if (expectedStage !== undefined && expectedStage !== module.stage) throw new Error('This repair stage has changed. Use the current controls.');
  let correct;
  let successText = 'Calibration accepted. Device restored.';
  if (module.stage === 'isolate') {
    if (!Number.isInteger(value) || value < 0 || value >= module.colors.length) throw new Error('Select a valid wire.');
    if (module.cuts.includes(value)) throw new Error('That wire has already been disconnected.');
    module.cuts.push(value);
    correct = value === module.answer;
    if (correct) module.stage = 'patch';
    successText = 'Fault isolated. Ask your analyst which terminal should receive the bypass cable.';
  } else if (module.stage === 'patch') {
    if (!['A', 'B', 'C'].includes(value)) throw new Error('Choose bypass terminal A, B, or C.');
    correct = value === module.secondaryAnswer;
    module.solved = correct;
    successText = 'Bypass connected. The power bus is live; decoder equipment is now available.';
  } else if (module.stage === 'sequence') {
    if (!module.glyphs.includes(value)) throw new Error('Select a glyph on this panel.');
    if (module.progress.includes(value)) throw new Error('That glyph is already locked in.');
    correct = value === module.answer[module.progress.length];
    if (correct) module.progress.push(value);
    else module.progress = [];
    if (module.progress.length === module.answer.length) module.stage = 'align';
    successText = module.stage === 'align' ? 'Memory recovered. Align the three-position coupler to finish the repair.' : 'Memory contact latched.';
  } else if (module.stage === 'align') {
    if (!Number.isInteger(value) || value < 1 || value > 3) throw new Error('Choose coupler position I, II, or III.');
    correct = value === module.secondaryAnswer;
    module.solved = correct;
  } else if (module.stage === 'decode') {
    if (typeof value !== 'string' || !/^\d{3}$/.test(value)) throw new Error('Enter exactly three digits.');
    correct = value === module.answer;
    if (correct) module.stage = 'sync';
    successText = 'Beacon code accepted. Set the synchronizer to route the recovered signal.';
  } else if (module.stage === 'sync') {
    if (!SYNC_MODES.includes(value)) throw new Error('Choose a valid synchronization mode.');
    correct = value === module.secondaryAnswer;
    module.solved = correct;
  } else if (module.stage === 'tune') {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || !Number.isInteger(value.frequency) || value.frequency < 880 || value.frequency > 960) {
      throw new Error('Frequency must be between 88.0 and 96.0 MHz.');
    }
    if (!['narrow', 'wide'].includes(value.bandwidth)) throw new Error('Select narrow or wide bandwidth before transmitting.');
    correct = value.frequency === module.answer && value.bandwidth === module.secondaryAnswer;
    module.solved = correct;
    successText = 'Clean carrier received. The relay is back on the air.';
  } else {
    throw new Error('Unknown repair stage.');
  }
  mission.revision++;
  if (correct) {
    if (module.solved) module.stage = 'complete';
    mission.feedback = { id: randomUUID(), kind: 'success', moduleId, text: successText, cue: module.solved ? 'restored' : 'accepted' };
    if (mission.modules.every((item) => item.solved)) mission.phase = 'won';
  } else {
    mission.strikes++;
    mission.feedback = { id: randomUUID(), kind: 'warning', moduleId, cue: 'fault', text: module.stage === 'sequence' ? 'Memory order mismatch. Contacts released; sequence reset.' : 'Signal fault. Check the current stage in the manual before trying again.' };
    if (mission.strikes >= mission.strikeLimit) mission.phase = 'lost';
  }
  mission.log = [...mission.log.slice(-7), { revision: mission.revision, moduleId, kind: mission.feedback.kind, text: mission.feedback.text }];
  return correct;
}

export function tickMission(mission, seconds) {
  if (mission.phase !== 'playing') return;
  mission.elapsed += seconds;
  if (mission.remaining !== null) {
    mission.remaining = Math.max(0, mission.remaining - seconds);
    if (mission.remaining === 0) {
      mission.phase = 'lost';
      mission.feedback = { id: randomUUID(), kind: 'warning', text: 'The transmission window closed.' };
    }
  }
}

export function missionForRole(mission, role) {
  if (!mission) return null;
  const { id, difficulty, remaining, strikeLimit, strikes, elapsed, phase, feedback, operation, focusedModuleId, revision, log } = mission;
  const common = {
    id, difficulty, remaining, strikeLimit, strikes, elapsed, phase, feedback, operation, focusedModuleId, revision, log,
    recoveryPhase: recoveryPhase(mission),
    total: mission.modules.length, restored: mission.modules.filter((module) => module.solved).length,
    systems: mission.modules.map((module) => ({
      id: module.id, type: module.type, solved: module.solved, stage: module.stage,
      available: moduleAvailable(mission, module), requires: module.requires,
    })),
  };
  if (role === 'reader') return common;
  return {
    ...common, serial: mission.serial, batteries: mission.batteries, indicator: mission.indicator,
    modules: mission.modules.map(({ answer, secondaryAnswer, ...visible }) => ({ ...visible, available: moduleAvailable(mission, visible) })),
  };
}
