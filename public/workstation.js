import { GLYPHS, MODULE_NAMES, STAGE_NAMES, SYNC_MODES } from './rules.js';
import { renderManual } from './manual.js';
import { escapeHtml } from './ui.js';

const statusLabel = (system) => system.solved ? 'ONLINE' : system.available ? 'FAULT' : 'NO FEED';
const screw = '<i class="equipment-screw" aria-hidden="true"></i>';
const waveform = '<svg viewBox="0 0 400 70" class="device-waveform" aria-hidden="true"><path d="M0 36h75l8-6 7 13 10-28 9 38 10-46 10 38 8-16 10 8h32l9-13 7 20 9-10h28l8-5 8 8h100"/></svg>';

function miniature(type) {
  if (type === 'wires') return '<span class="mini-harness"><i></i><i></i><i></i><i></i><i></i></span>';
  if (type === 'glyphs') return '<span class="mini-keys"><i>◇</i><i>ϟ</i><i>◉</i><i>≈</i></span>';
  if (type === 'pulses') return '<span class="mini-scope"><i></i><i></i><i></i><b>— ·· —</b></span>';
  return '<span class="mini-receiver"><b>— — . —</b><i></i><span>FINAL CARRIER</span></span>';
}

function stationFacts(mission) {
  return `<section class="asset-tag" aria-label="Station details"><div><span>SERIAL NUMBER</span><strong>${mission.serial}</strong></div><div><span>BATTERY CELLS</span><strong>${mission.batteries} <b aria-hidden="true">${'▰'.repeat(mission.batteries)}</b></strong></div><div><span>LINK INDICATOR</span><strong><i class="tag-light ${mission.indicator ? 'lit' : ''}"></i>${mission.indicator ? 'LIT' : 'OFF'}</strong></div></section>`;
}

function systemMap(mission) {
  return `<ol class="signal-path" aria-label="Recovery sequence">${[
    ['power', '01', 'POWER BUS'], ['decode', '02', 'SIGNAL RECOVERY'], ['broadcast', '03', 'TRANSMIT'],
  ].map(([phase, number, label]) => `<li class="${mission.recoveryPhase === phase ? 'current' : ''}"><span>${number}</span>${label}</li>`).join('')}</ol>`;
}

function equipmentButton(module, index) {
  return `<button id="inspect-${module.id}" class="rack-device device-${module.type} ${module.solved ? 'device-online' : module.available ? 'device-fault' : 'device-unpowered'}" data-inspect="${module.id}" aria-label="Inspect ${MODULE_NAMES[module.type]} ${index + 1}: ${statusLabel(module)}">
    ${screw}<span class="device-nameplate"><b>${String(index + 1).padStart(2, '0')}</b>${MODULE_NAMES[module.type]}<i class="equipment-led"></i></span>
    ${miniature(module.type)}<span class="device-stencil">NL-${module.type.toUpperCase()} / ${statusLabel(module)}</span><span class="inspection-prompt">INSPECT ↗</span>
  </button>`;
}

function overview(mission) {
  return `<div class="relay-workbench">
    <div class="bench-rail">${screw}<span>RECOVERY RACK / DO NOT HOT-SWAP</span>${screw}</div>
    <div class="workbench-equipment rack-count-${mission.total}">${mission.modules.map(equipmentButton).join('')}</div>
    <div class="power-bus ${mission.recoveryPhase !== 'power' ? 'energized' : ''}"><i></i><span>${mission.recoveryPhase === 'power' ? 'BUS OFFLINE — INSPECT WIRE JUNCTION' : mission.recoveryPhase === 'broadcast' ? 'DECODERS READY — INSPECT FREQUENCY TUNER' : 'BUS LIVE — RECOVER THE SIGNAL DECODERS'}</span></div>
    ${stationFacts(mission)}<div class="bench-lip">${screw}<span>Choose a piece of equipment to lean in. Your analyst has the missing instructions.</span>${screw}</div>
  </div>`;
}

function wires(module) {
  const cutting = module.stage === 'isolate';
  return `<div class="junction-layout"><div class="harness-tray"><span class="etched-label">FAULT HARNESS / TOP → BOTTOM</span><div class="wire-list">${module.colors.map((color, index) => `
    <button id="cut-${module.id}-${index}" class="wire-row ${color} ${module.cuts.includes(index) ? 'wire-disconnected' : ''}" data-action="wire" data-module="${module.id}" data-value="${index}" ${!cutting || module.cuts.includes(index) ? 'disabled' : ''} aria-label="Disconnect wire ${index + 1}, ${color}">
      <span class="wire-number">${index + 1}</span><span class="wire-line" aria-hidden="true"></span><span class="wire-label">${color}</span><span class="wire-cut">${module.cuts.includes(index) ? 'OPEN' : 'CUT'}</span>
    </button>`).join('')}</div></div><div class="patch-bay ${cutting ? 'bay-offline' : ''}"><span class="etched-label">BYPASS RETURN</span><div class="patch-cord" aria-hidden="true"><i></i><b></b></div><p>${cutting ? 'ISOLATE FAULT FIRST' : module.solved ? 'BYPASS LATCHED' : 'SELECT RETURN TERMINAL'}</p><div class="patch-terminals">${['A', 'B', 'C'].map((port) => `<button id="port-${module.id}-${port}" data-action="port" data-module="${module.id}" data-value="${port}" ${cutting || module.solved ? 'disabled' : ''} aria-label="Patch bypass to terminal ${port}"><span class="socket-hole"></span>${port}</button>`).join('')}</div></div></div>`;
}

function glyphs(module) {
  const sequencing = module.stage === 'sequence';
  return `<div class="memory-hardware"><div class="memory-label"><span class="etched-label">REFERENCE BAND</span><strong>${module.band.toUpperCase()}</strong></div><div class="memory-contact-lights" aria-label="${module.progress.length} of 4 memory contacts latched">${Array.from({ length: 4 }, (_, index) => `<i class="${index < module.progress.length ? 'latched' : ''}"></i>`).join('')}</div>
    <div class="glyph-pad">${module.glyphs.map((glyph) => `<button id="glyph-${module.id}-${glyph}" class="glyph-button ${module.progress.includes(glyph) ? 'accepted' : ''}" data-action="glyph" data-module="${module.id}" data-value="${glyph}" ${!sequencing || module.progress.includes(glyph) ? 'disabled' : ''} aria-label="${glyph}"><span aria-hidden="true">${GLYPHS[glyph]}</span><small>${glyph}</small>${module.progress.includes(glyph) ? `<b class="glyph-index">${module.progress.indexOf(glyph) + 1}</b>` : ''}</button>`).join('')}</div>
    <div class="coupler-assembly ${sequencing ? 'coupler-locked' : ''}"><span class="etched-label">THREE-POSITION COUPLER</span><span class="coupler-spindle" aria-hidden="true"></span><div class="coupler-positions">${[1, 2, 3].map((position) => `<button id="align-${module.id}-${position}" data-action="align" data-module="${module.id}" data-value="${position}" ${sequencing || module.solved ? 'disabled' : ''}>${['I', 'II', 'III'][position - 1]}</button>`).join('')}</div><small>${sequencing ? 'INTERLOCK / RECOVER MEMORY FIRST' : 'ASK THE ANALYST FOR ALIGNMENT'}</small></div></div>`;
}

function pulses(module, inputs) {
  const decoding = module.stage === 'decode';
  return `<div class="decoder-hardware"><div class="scope-screen"><div class="scope-label"><span>RECORDED BEACON BURSTS</span><span>CAPTURE / HOLD</span></div><div class="beacons">${module.beacons.map((beacon, index) => `<div class="beacon ${beacon.color}"><span>${['A', 'B', 'C'][index]}</span><div class="burst-marks" aria-label="${beacon.count} bursts">${'<i></i>'.repeat(beacon.count)}</div><small>${beacon.color}</small></div>`).join('')}</div>${waveform}</div>
    <form data-pulse="${module.id}" class="pulse-form"><label for="code-${module.id}">RECOVERY CODE</label><div><input id="code-${module.id}" name="digits" inputmode="numeric" autocomplete="off" maxlength="3" pattern="[0-9]{3}" placeholder="000" required value="${escapeHtml(inputs[module.id] ?? '')}" ${decoding ? '' : 'disabled'}><button id="decode-${module.id}" class="hardware-button" ${decoding ? '' : 'disabled'}>LATCH</button></div></form>
    <div class="synchronizer"><span class="etched-label">SIGNAL ROUTING / SYNCHRONIZER</span><div>${SYNC_MODES.map((mode, index) => `<button id="sync-${module.id}-${mode}" data-action="sync" data-module="${module.id}" data-value="${mode}" ${decoding || module.solved ? 'disabled' : ''}><i></i><span>0${index + 1}</span>${mode.toUpperCase()}</button>`).join('')}</div><small>${decoding ? 'INTERLOCK / DECODE FIRST' : 'ASK THE ANALYST HOW TO ROUTE THE BEACONS'}</small></div></div>`;
}

function frequency(module, inputs) {
  const value = inputs[module.id] ?? 880;
  const bandwidth = inputs[`${module.id}:bandwidth`] ?? 'narrow';
  return `<div class="receiver-hardware"><div class="receiver-screen"><span class="etched-label">DESTINATION / ${module.station}</span><div class="frequency-display"><output id="output-${module.id}">${(value / 10).toFixed(1)}</output><span>MHz</span></div>${waveform}<span class="carrier-caption">RECOVERED CARRIER / FINAL UPLINK</span></div>
    <div class="receiver-controls"><div class="rotary-control"><div id="knob-${module.id}" class="tuning-knob" role="slider" tabindex="${module.solved ? '-1' : '0'}" data-knob="${module.id}" aria-label="Tune carrier frequency" aria-valuemin="880" aria-valuemax="960" aria-valuenow="${value}" aria-valuetext="${(value / 10).toFixed(1)} MHz" aria-disabled="${module.solved}"><svg viewBox="0 0 160 160" aria-hidden="true"><circle class="knob-ring" cx="80" cy="80" r="69"/><circle class="knob-face" cx="80" cy="80" r="55"/><g id="needle-${module.id}" transform="rotate(${135 + (value - 880) * 3.375} 80 80)"><path d="M80 80V40"/><circle cx="80" cy="36" r="3"/></g><circle class="knob-cap" cx="80" cy="80" r="13"/></svg></div><span class="etched-label">TUNING / DRAG UP OR DOWN</span><div class="dial-controls">${[-10, -1, 1, 10].map((step) => `<button id="step-${module.id}-${step}" class="dial-step" data-step="${step}" data-module="${module.id}" ${module.solved ? 'disabled' : ''}>${step > 0 ? '+' : '−'}${(Math.abs(step) / 10).toFixed(1)}</button>`).join('')}</div></div>
    <div class="bandwidth-control"><span class="etched-label">CARRIER BANDWIDTH</span><div class="bandwidth-switch">${['narrow', 'wide'].map((band) => `<button id="band-${module.id}-${band}" data-bandwidth="${band}" data-module="${module.id}" aria-pressed="${bandwidth === band}" class="${bandwidth === band ? 'selected' : ''}" ${module.solved ? 'disabled' : ''}><i></i>${band.toUpperCase()}</button>`).join('')}</div><button id="transmit-${module.id}" class="broadcast-lever" data-action="frequency" data-module="${module.id}" ${module.solved ? 'disabled' : ''}><span class="lever-handle" aria-hidden="true"></span><span>TRANSMIT<small>FREQUENCY + BANDWIDTH</small></span></button></div></div></div>`;
}

function inspection(mission, module, inputs) {
  const index = mission.modules.indexOf(module);
  const blockedBy = mission.modules.filter((item) => module.requires.includes(item.id) && !item.solved);
  const renderers = { wires, glyphs, pulses, frequency };
  return `<div class="inspection-header"><button class="return-to-bench" id="back-to-bench" data-inspect="">← Step back</button><span>INSPECTION / EQUIPMENT ${String(index + 1).padStart(2, '0')}</span></div>
    <section class="inspected-device ${module.solved ? 'inspection-restored' : ''}" aria-label="${MODULE_NAMES[module.type]} inspection">${screw}${screw}<div class="inspection-nameplate"><div><span class="etched-label">NORTHLINE / ${module.type.toUpperCase()} ASSEMBLY</span><h2>${MODULE_NAMES[module.type]}</h2></div><span class="stage-readout">${STAGE_NAMES[module.stage]}</span></div>
    ${!module.available ? `<div class="device-interlock"><span class="interlock-symbol" aria-hidden="true">⊘</span><h3>No signal feed.</h3><p>This device is interlocked until you restore ${blockedBy.map((item) => MODULE_NAMES[item.type]).join(' + ')}.</p><button class="hardware-button" data-inspect="${blockedBy[0].id}">Inspect upstream equipment →</button></div>` : `<fieldset class="inspection-controls" data-locked="${module.solved}" ${module.solved ? 'disabled' : ''}><legend class="sr-only">${MODULE_NAMES[module.type]} controls</legend>${renderers[module.type](module, inputs)}</fieldset>`}
    ${module.solved ? '<div class="service-seal">RESTORED / VERIFIED</div>' : ''}<div class="inspection-footer"><span>DO NOT GUESS / CONSULT TECHNICAL DESK</span><span>ASSET NL–${index + 1}</span></div></section>
    ${stationFacts(mission)}`;
}

export function renderWorkstation(mission, inputs) {
  const focused = mission.modules.find((module) => module.id === mission.focusedModuleId);
  return `<div class="station-room weather-${mission.operation.weather}">
    <div class="room-header"><div class="night-window" aria-hidden="true"><span class="distant-tower"></span><i></i><i></i><i></i></div><div><span class="etched-label">OPERATOR / ${mission.operation.location.toUpperCase()}</span><p>${focused ? 'You lean over the service panel.' : 'The relay is waiting for your hands.'}</p></div><span class="room-clock">NIGHT SHIFT</span></div>
    ${systemMap(mission)}<div class="workstation-scene ${focused ? 'scene-inspection' : ''}">${focused ? inspection(mission, focused, inputs) : overview(mission)}</div>
  </div>`;
}

export function renderAnalystDesk(mission, tab, inputs) {
  const focused = mission.systems.find((system) => system.id === mission.focusedModuleId);
  const activeSystem = focused ? `${MODULE_NAMES[focused.type]} / ${STAGE_NAMES[focused.stage]}` : 'Operator is surveying the workstation.';
  return `<div class="analyst-workspace"><aside class="technical-sidebar"><div class="desk-radio"><span class="etched-label">OPERATOR LINE / CONNECTED</span><div class="radio-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p>${activeSystem}</p></div><div class="desk-system-board"><span class="etched-label">FEED SCHEMATIC</span><div class="schematic-trunk"></div>${mission.systems.map((system, index) => `<button id="reference-${system.id}" data-manual="${system.type}" class="${system.solved ? 'schematic-online' : system.available ? 'schematic-fault' : 'schematic-blocked'}"><i></i><span><b>${String(index + 1).padStart(2, '0')} / ${MODULE_NAMES[system.type]}</b><small>${statusLabel(system)} / ${STAGE_NAMES[system.stage]}</small></span></button>`).join('')}</div><label class="etched-label" for="analyst-notes">PRIVATE SCRATCHPAD</label><textarea id="analyst-notes" maxlength="2000" placeholder="Serial? Cells? LINK?&#10;Keep your working notes here.">${escapeHtml(inputs.notes ?? '')}</textarea><p class="scratchpad-note">Your notes stay on this browser tab.</p></aside><div class="reference-desk">${renderManual(tab)}<div class="desk-book-edge" aria-hidden="true"></div></div></div>`;
}
