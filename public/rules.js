export const DIFFICULTIES = {
  cozy: { name: 'Quiet frequency', modules: 3, seconds: null, strikes: 5, description: 'Take your time. Find your rhythm.', tag: 'UNTIMED' },
  normal: { name: 'Night shift', modules: 4, seconds: 480, strikes: 3, description: 'A little pressure. A lot of teamwork.', tag: '8 MINUTES' },
  hard: { name: 'Solar storm', modules: 5, seconds: 360, strikes: 3, description: 'For crews who speak the same language.', tag: '6 MINUTES' },
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
