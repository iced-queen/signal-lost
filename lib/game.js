import { randomInt, randomUUID } from 'node:crypto';
import { DIFFICULTIES, GLYPH_ORDERS, PULSE_TABLE, STATIONS } from '../public/rules.js';
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

export function createMission(difficulty = 'normal') {
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new Error('Unknown mission difficulty.');
  const settings = DIFFICULTIES[difficulty];
  const serial = `SL-${randomInt(100, 1000)}${randomInt(0, 10)}`;
  const batteries = randomInt(1, 4);
  const indicator = Boolean(randomInt(2));
  const types = shuffle(['wires', 'glyphs', 'pulses', 'frequency']);
  if (settings.modules === 5) types.push(pick(['wires', 'glyphs', 'pulses', 'frequency']));
  const modules = types.slice(0, settings.modules).map((type, index) => {
    const common = { id: `module-${index}`, type, solved: false };
    if (type === 'wires') {
      const colors = Array.from({ length: 5 }, () => pick(['red', 'blue', 'amber', 'white']));
      return { ...common, colors, answer: wireAnswer(colors, serial) };
    }
    if (type === 'glyphs') {
      const band = pick(Object.keys(GLYPH_ORDERS));
      const glyphs = shuffle(GLYPH_ORDERS[band]).slice(0, 4);
      return { ...common, band, glyphs, progress: [], answer: GLYPH_ORDERS[band].filter((glyph) => glyphs.includes(glyph)) };
    }
    if (type === 'pulses') {
      const beacons = Array.from({ length: 3 }, () => ({ color: pick(Object.keys(PULSE_TABLE)), count: randomInt(1, 4) }));
      return { ...common, beacons, answer: pulseAnswer(beacons, serial) };
    }
    const station = pick(Object.keys(STATIONS));
    return { ...common, station, answer: frequencyAnswer(station, batteries, indicator) };
  });
  return {
    id: randomUUID(), difficulty, serial, batteries, indicator, modules,
    remaining: settings.seconds, strikeLimit: settings.strikes, strikes: 0,
    elapsed: 0, phase: 'playing', feedback: null,
  };
}

export function applyAction(mission, moduleId, value) {
  if (mission.phase !== 'playing') throw new Error('This mission is not active.');
  const module = mission.modules.find((item) => item.id === moduleId);
  if (!module) throw new Error('Unknown console module.');
  if (module.solved) throw new Error('This module is already restored.');
  let correct;
  if (module.type === 'wires') {
    if (!Number.isInteger(value) || value < 0 || value >= module.colors.length) throw new Error('Select a valid wire.');
    correct = value === module.answer;
  } else if (module.type === 'glyphs') {
    if (!module.glyphs.includes(value)) throw new Error('Select a glyph on this panel.');
    if (module.progress.includes(value)) throw new Error('That glyph is already locked in.');
    correct = value === module.answer[module.progress.length];
    if (correct) module.progress.push(value);
    else module.progress = [];
  } else if (module.type === 'pulses') {
    if (typeof value !== 'string' || !/^\d{3}$/.test(value)) throw new Error('Enter exactly three digits.');
    correct = value === module.answer;
  } else {
    if (!Number.isInteger(value) || value < 880 || value > 960) throw new Error('Frequency must be between 88.0 and 96.0 MHz.');
    correct = value === module.answer;
  }
  if (correct) {
    module.solved = module.type !== 'glyphs' || module.progress.length === module.answer.length;
    mission.feedback = { id: randomUUID(), kind: 'success', text: module.solved ? 'Module restored. Nice teamwork.' : 'Glyph locked. Keep going.' };
    if (mission.modules.every((item) => item.solved)) mission.phase = 'won';
  } else {
    mission.strikes++;
    mission.feedback = { id: randomUUID(), kind: 'warning', text: module.type === 'glyphs' ? 'Sequence mismatch. Glyph order reset.' : 'Signal mismatch. Check the manual together.' };
    if (mission.strikes >= mission.strikeLimit) mission.phase = 'lost';
  }
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
  const { id, difficulty, remaining, strikeLimit, strikes, elapsed, phase, feedback } = mission;
  const common = {
    id, difficulty, remaining, strikeLimit, strikes, elapsed, phase, feedback,
    total: mission.modules.length, restored: mission.modules.filter((module) => module.solved).length,
  };
  if (role === 'reader') return common;
  return {
    ...common, serial: mission.serial, batteries: mission.batteries, indicator: mission.indicator,
    modules: mission.modules.map(({ answer, ...visible }) => visible),
  };
}
