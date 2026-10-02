export const DIFFICULTIES = {
  cozy: { name: 'Quiet frequency', modules: 3, seconds: null, strikes: 5, description: 'Take your time. Find your rhythm.', tag: 'UNTIMED' },
  normal: { name: 'Night shift', modules: 4, seconds: 600, strikes: 3, description: 'Restore the full relay before the window closes.', tag: '10 MINUTES' },
  hard: { name: 'Solar storm', modules: 5, seconds: 480, strikes: 3, description: 'An extra decoder. A shorter transmission window.', tag: '8 MINUTES' },
};

export const GLYPH_ORDERS = {
  orbit: ['moon', 'diamond', 'wave', 'star', 'eye', 'bolt', 'sun', 'leaf'],
  horizon: ['leaf', 'star', 'bolt', 'moon', 'sun', 'wave', 'diamond', 'eye'],
  zenith: ['eye', 'sun', 'diamond', 'leaf', 'wave', 'moon', 'bolt', 'star'],
};
export const PULSE_TABLE = { cyan: [2, 7, 4], amber: [6, 1, 8], magenta: [9, 3, 5] };
export const STATIONS = { NOVA: 882, LUNA: 891, ECHO: 905, IRIS: 917, VEGA: 934, HALO: 945 };
export const GLYPHS = { moon: '☾', diamond: '◇', wave: '≈', star: '☆', eye: '◉', bolt: 'ϟ', sun: '☼', leaf: '❧' };
export const MODULE_NAMES = { wires: 'Wire junction', glyphs: 'Glyph lock', pulses: 'Pulse decoder', frequency: 'Frequency tuner' };
export const PATCH_PORTS = { even: ['A', 'B', 'C'], odd: ['B', 'C', 'A'] };
export const BAND_DETENTS = { orbit: 1, horizon: 2, zenith: 3 };
export const SYNC_MODES = ['local', 'cross', 'remote'];
export const STAGE_NAMES = {
  isolate: 'Isolate fault', patch: 'Route bypass', sequence: 'Unlock memory',
  align: 'Align coupler', decode: 'Decode beacons', sync: 'Synchronize',
  tune: 'Final transmission', complete: 'Restored',
};
export const OPERATIONS = [
  { location: 'North Head', weather: 'rain', title: 'The coastal relay has gone dark.', brief: 'Restore the power bus, recover the decoders, and transmit the weather station’s carrier before the next squall.' },
  { location: 'Pine Ridge', weather: 'wind', title: 'The ridge repeater is silent.', brief: 'Bypass the damaged harness, recover the station’s reference signal, and re-establish the mountain link.' },
  { location: 'Lowland 6', weather: 'fog', title: 'No response from the valley station.', brief: 'Bring the isolated equipment online, align its recovered signal, and send a clean carrier through the fog.' },
];
