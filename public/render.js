import { DIFFICULTIES, GLYPHS, MODULE_NAMES } from './rules.js';
import { renderManual } from './manual.js';

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export const timeLabel = (seconds) => seconds === null ? '∞' : `${Math.floor(Math.ceil(seconds) / 60).toString().padStart(2, '0')}:${(Math.ceil(seconds) % 60).toString().padStart(2, '0')}`;
export const roleName = (role) => role === 'operator' ? 'Console operator' : 'Signal analyst';

export function renderHome({ name, invite, stats, mode = 'create' }) {
  const receiving = mode === 'join';
  return `<section class="radio-desk">
    <div class="desk-caption"><span>NORTHLINE // DUPLEX RECOVERY TERMINAL</span><span>UNIT NL–04</span></div>
    <section class="radio-unit" aria-label="Private channel connection console">
      <div class="rack-top"><span class="rack-screw" aria-hidden="true"></span><span>SHORTWAVE / CREW LINK</span><span class="rack-model">NL-04 · SERIES II</span><span class="rack-screw" aria-hidden="true"></span></div>
      <div class="radio-body">
        <div class="receiver-section">
          <div class="crt-frame"><div class="crt-screen">
            <div class="crt-topline"><span>CH — — — — — —</span><span>STANDBY</span></div>
            <h1>NO CARRIER<span class="terminal-cursor" aria-hidden="true">_</span></h1>
            <p>Two operators required.<br>Establish a private channel to begin.</p>
            <svg class="signal-trace" viewBox="0 0 480 75" aria-hidden="true"><path class="trace-grid" d="M0 15h480M0 35h480M0 55h480M40 0v75m80-75v75m80-75v75m80-75v75m80-75v75m80-75v75"/><path class="trace-line" d="M0 39h48l8-3 8 7 8-9 9 5h52l8-4 7 7 8-3h43l8-17 7 35 8-48 8 36 7-9 8 3h48l9-4 8 8 8-5h63l8-3 8 6 8-4h39"/></svg>
            <div class="crt-bottomline"><span>VOICE LINK: EXTERNAL</span><span>CREW: 00 / 02</span></div>
          </div></div>
          <div class="band-selector"><div><span class="hardware-label">CHANNEL MODE</span><p>${receiving ? 'Receive your partner’s channel.' : 'Transmit a new private channel.'}</p></div><div class="mode-switch" role="group" aria-label="Channel mode"><button type="button" data-mode="create" aria-pressed="${!receiving}" class="${!receiving ? 'selected' : ''}"><span class="switch-led"></span>TX<span>HOST</span></button><button type="button" data-mode="join" aria-pressed="${receiving}" class="${receiving ? 'selected' : ''}"><span class="switch-led"></span>RX<span>PARTNER</span></button></div></div>
          <div class="speaker-grille" aria-hidden="true"></div>
        </div>
        <form id="room-form" class="channel-controls" novalidate>
          <div class="control-heading"><span class="hardware-label">LINK CONFIGURATION</span><span class="control-index">0${receiving ? '2' : '1'}</span></div>
          <label for="player-name"><span>01</span> OPERATOR CALL SIGN</label><input id="player-name" name="name" maxlength="24" autocomplete="nickname" placeholder="YOUR NAME" required value="${escapeHtml(name)}">
          <div class="channel-entry"><label for="room-code"><span>02</span> PRIVATE CHANNEL</label>${receiving ? '' : '<div class="auto-channel"><span>AUTO ASSIGN</span><small>CODE GENERATED ON TRANSMIT</small></div>'}<input id="room-code" name="code" maxlength="6" minlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="— — — — — —" aria-describedby="channel-instruction" value="${escapeHtml(invite)}" ${receiving ? '' : 'hidden'}></div>
          <p id="channel-instruction" class="channel-instruction">${receiving ? 'Enter the six-character channel code your partner sent you.' : 'Open a channel, then send its code or invite link to your partner.'}</p>
          <button class="transmission-button" type="submit" name="intent" value="${mode}"><span class="transmit-indicator" aria-hidden="true"></span><span>${receiving ? 'CONNECT TO CHANNEL' : 'OPEN CHANNEL'}<small>${receiving ? 'RECEIVE / JOIN YOUR PARTNER' : 'TRANSMIT / START A PRIVATE GAME'}</small></span><span class="button-arrow" aria-hidden="true">↵</span></button>
          <div class="control-bottom"><span class="power-light" aria-hidden="true"></span><span>PRIVATE DUPLEX · 2 SEATS ONLY</span></div>
        </form>
      </div>
      <div class="rack-bottom"><span class="rack-screw" aria-hidden="true"></span><span>DO NOT CROSS-FEED CONSOLE AND ANALYST DISPLAYS</span><span class="rack-screw" aria-hidden="true"></span></div>
    </section>
    <div class="desk-notes"><div><span>BEFORE TRANSMITTING</span><p>Get on a voice call. One of you handles the console; the other reads the manual. Keep your screens to yourselves.</p></div><div><span>FIRST SHIFT?</span><p>Choose the untimed mission. Learn the equipment together, then swap seats for the next round.</p></div>${stats.wins ? `<div class="desk-log"><span>LOCAL LOGBOOK</span><strong>${String(stats.wins).padStart(2, '0')}</strong><small>successful links</small></div>` : '<div class="desk-log"><span>SHIFT LENGTH</span><strong>5–10</strong><small>minutes per mission</small></div>'}</div>
  </section>`;
}

export function renderLobby(state) {
  const self = state.players.find((player) => player.id === state.self);
  const host = state.self === state.host;
  const canStart = state.players.length === 2 && state.players.every((player) => player.online && player.ready);
  return `<section class="lobby">
    <div class="section-heading"><div><span class="eyebrow">NORTHLINE / PERSONNEL</span><h1>Establish your crew.</h1><p>Share the link. Start a voice call. Keep your screens secret.</p></div><button class="text-button leave" data-command="leave">Leave room</button></div>
    <div class="lobby-grid"><section class="panel crew-panel"><div class="invite-block"><span class="eyebrow">YOUR ROOM CODE</span><div class="room-code">${state.code}</div><button class="button secondary wide" data-copy>Copy invite link <span aria-hidden="true">↗</span></button></div>
      <div class="crew-list">${state.players.map((player) => `<div class="crew-member"><span class="avatar ${player.role}">${player.role === 'operator' ? '01' : '02'}</span><div><strong>${escapeHtml(player.name)} ${player.id === state.self ? '<small>(you)</small>' : ''}</strong><span>${roleName(player.role)}</span></div><span class="crew-status ${player.ready ? 'ready' : ''}">${!player.online ? 'Offline' : player.ready ? 'Ready' : 'Joined'}</span></div>`).join('')}${state.players.length < 2 ? '<div class="crew-member waiting"><span class="avatar">--</span><div><strong>Second seat unoccupied</strong><span>Send your partner the invite link above</span></div></div>' : ''}</div>
      ${host ? '<button class="text-button swap-button" data-command="swap">⇄ Swap crew roles</button>' : '<p class="small-note">The host can swap your roles between missions.</p>'}
      <div class="role-brief"><span class="eyebrow">YOUR JOB / ${self.role === 'operator' ? '01' : '02'}</span><h3>${roleName(self.role)}</h3><p>${self.role === 'operator' ? 'You see the hardware. Describe your modules and station details. Follow your partner’s instructions to repair the signal.' : 'You have the recovery manual, not the hardware. Ask precise questions, interpret the rules, and guide your partner.'}</p></div>
    </section><section class="mission-select"><span class="eyebrow">DISPATCH / CONDITIONS</span><h2>Select a transmission.</h2><div class="difficulty-list">${Object.entries(DIFFICULTIES).map(([key, settings], index) => `<button class="difficulty-card ${state.difficulty === key ? 'selected' : ''}" data-difficulty="${key}" aria-pressed="${state.difficulty === key}" ${host ? '' : 'disabled'}><span class="difficulty-icon" aria-hidden="true">0${index + 1}</span><span class="difficulty-text"><strong>${settings.name}</strong><span>${settings.description}</span><small>${settings.modules} modules · ${settings.strikes} strikes allowed</small></span><span class="difficulty-tag">${settings.tag}</span></button>`).join('')}</div>
      <div class="preflight"><span aria-hidden="true">◉</span><p>No in-game voice chat. Use Discord, FaceTime, or any call you like. Don't share your screen—that's the fun part.</p></div>
      <div class="launch-controls"><button class="button ${self.ready ? 'secondary' : 'primary'}" data-command="ready">${self.ready ? '✓ Ready — click to undo' : 'I’m ready'}</button>${host ? `<button class="button primary" data-command="start" ${canStart ? '' : 'disabled'}>Begin transmission →</button>` : '<span class="small-note">Your host starts when you’re both ready.</span>'}</div><p class="small-note">The timer starts only when the host launches. New puzzles every mission.</p>
    </section></div></section>`;
}

function renderModule(module, index, inputs) {
  const disabled = module.solved ? 'disabled' : '';
  let content;
  if (module.type === 'wires') {
    content = `<p class="module-hint">Five wires. One correct cut. Describe them top to bottom.</p><div class="wire-list">${module.colors.map((color, wire) => `<button class="wire-row ${color}" data-action="wire" data-module="${module.id}" data-value="${wire}" ${disabled} aria-label="Cut wire ${wire + 1}, ${color}"><span class="wire-number">${String(wire + 1).padStart(2, '0')}</span><span class="wire-line" aria-hidden="true"></span><span class="wire-label">${color}</span><span class="wire-cut">CUT</span></button>`).join('')}</div>`;
  } else if (module.type === 'glyphs') {
    content = `<div class="module-hint">Reference band <strong class="band">${module.band}</strong></div><div class="glyph-pad">${module.glyphs.map((glyph) => `<button class="glyph-button ${module.progress.includes(glyph) ? 'accepted' : ''}" data-action="glyph" data-module="${module.id}" data-value="${glyph}" ${module.solved || module.progress.includes(glyph) ? 'disabled' : ''} aria-label="${glyph}"><span aria-hidden="true">${GLYPHS[glyph]}</span><small>${glyph}</small>${module.progress.includes(glyph) ? `<b class="glyph-index">${module.progress.indexOf(glyph) + 1}</b>` : ''}</button>`).join('')}</div><p class="small-note">Press in the order your analyst gives you.</p>`;
  } else if (module.type === 'pulses') {
    content = `<p class="module-hint">Read each beacon's color and burst marks.</p><div class="beacons">${module.beacons.map((beacon, beaconIndex) => `<div class="beacon ${beacon.color}"><span>${['A', 'B', 'C'][beaconIndex]}</span><div class="burst-marks" aria-label="${beacon.count} bursts">${'<i></i>'.repeat(beacon.count)}</div><small>${beacon.color}</small></div>`).join('')}</div><form data-pulse="${module.id}" class="pulse-form"><label for="code-${module.id}">DECODED SIGNAL</label><div><input id="code-${module.id}" name="digits" type="text" inputmode="numeric" autocomplete="off" maxlength="3" pattern="[0-9]{3}" placeholder="000" required value="${escapeHtml(inputs[module.id] ?? '')}" ${disabled}><button class="button secondary" ${disabled}>Send ↗</button></div></form>`;
  } else {
    const value = inputs[module.id] ?? 880;
    content = `<div class="station-label"><span>STATION CALL SIGN</span><strong>${module.station}</strong></div><div class="frequency-display"><output id="output-${module.id}">${(value / 10).toFixed(1)}</output><span>MHz</span></div><label class="sr-only" for="dial-${module.id}">Frequency in tenths of MHz</label><input id="dial-${module.id}" class="frequency-slider" type="range" min="880" max="960" step="1" value="${value}" data-dial="${module.id}" ${disabled}><div class="dial-controls">${[-10, -1, 1, 10].map((step) => `<button class="dial-step" data-step="${step}" data-module="${module.id}" ${disabled}>${step > 0 ? '+' : '−'}${(Math.abs(step) / 10).toFixed(1)}</button>`).join('')}</div><button class="button secondary wide" data-action="frequency" data-module="${module.id}" ${disabled}>Transmit frequency ↗</button>`;
  }
  return `<section class="console-module ${module.solved ? 'solved' : ''}" aria-label="${MODULE_NAMES[module.type]} ${index + 1}"><div class="module-top"><span class="module-number">${String(index + 1).padStart(2, '0')}</span><h3>${MODULE_NAMES[module.type]}</h3><span class="module-indicator" aria-label="${module.solved ? 'Restored' : 'Needs repair'}"></span></div>${module.solved ? '<div class="restored-label">✓ SIGNAL RESTORED</div>' : ''}${content}<div class="module-plate" aria-hidden="true">NL-04 / ${module.type.toUpperCase()} / SERVICE PANEL ${index + 1}</div></section>`;
}

export function renderMission(state, tab, inputs) {
  const self = state.players.find((player) => player.id === state.self);
  const mission = state.mission;
  return `<section class="mission-view"><div class="mission-heading"><div><span class="eyebrow">NORTHLINE / LIVE CHANNEL ${state.code}</span><h1>${self.role === 'operator' ? 'Recovery console.' : 'Recovery desk.'}</h1></div><span class="role-pill">${roleName(self.role)}</span></div>
    <div class="mission-dashboard"><div class="timer-block"><span class="eyebrow">${mission.remaining === null ? 'NO RUSH' : 'TRANSMISSION WINDOW'}</span><strong id="mission-timer" class="${mission.remaining !== null && mission.remaining <= 60 ? 'urgent' : ''}">${timeLabel(mission.remaining)}</strong></div><div class="progress-block"><span class="eyebrow">MODULES RESTORED</span><strong>${mission.restored}<span> / ${mission.total}</span></strong><div class="progress-track"><div class="progress-fill progress-${mission.restored}-${mission.total}"></div></div></div><div class="strike-block"><span class="eyebrow">SIGNAL INTEGRITY</span><div class="strike-lights">${Array.from({ length: mission.strikeLimit }, (_, index) => `<span class="${index < mission.strikes ? 'used' : ''}">${index < mission.strikes ? '×' : '•'}</span>`).join('')}</div><small>${mission.strikeLimit - mission.strikes} mistake${mission.strikeLimit - mission.strikes === 1 ? '' : 's'} left</small></div></div>
    <div id="pause-banner" class="pause-banner" ${state.paused ? '' : 'hidden'}>Partner disconnected. The clock is paused and controls are locked until they return.</div>
    <div class="mission-feedback ${mission.feedback?.kind ?? ''}" role="status">${escapeHtml(mission.feedback?.text ?? 'Connection established. Describe your first module and work together.')}</div>
    ${self.role === 'operator' ? `<section class="console-facts" aria-label="Station details"><div><span>SERIAL NUMBER</span><strong>${mission.serial}</strong></div><div><span>BATTERY CELLS</span><strong>${mission.batteries} <span aria-hidden="true">${'▰'.repeat(mission.batteries)}</span></strong></div><div><span>LINK INDICATOR</span><strong><i class="color-dot ${mission.indicator ? 'cyan' : 'off'}"></i>${mission.indicator ? 'LIT' : 'OFF'}</strong></div><p>Your analyst needs these details.<br>They can't see your screen.</p></section><fieldset class="console-fieldset" ${state.paused ? 'disabled' : ''}><legend class="sr-only">Console controls</legend><div class="console-grid">${mission.modules.map((module, index) => renderModule(module, index, inputs)).join('')}</div></fieldset>` : renderManual(tab)}
    <div class="mission-bottom"><span>${escapeHtml(state.players.map((player) => player.name).join(' + '))} · ${DIFFICULTIES[state.difficulty].name}</span>${state.self === state.host ? '<button class="text-button" data-confirm-abort>End this mission</button>' : ''}</div>
  </section>`;
}

export function renderResult(state) {
  const mission = state.mission;
  const won = mission.phase === 'won';
  return `<section class="result-view"><div class="result-symbol ${won ? 'win' : 'loss'}" aria-hidden="true">${won ? 'RX' : '--'}</div><span class="eyebrow">${won ? 'TRANSMISSION RECEIVED' : 'TRANSMISSION INTERRUPTED'}</span><h1>${won ? 'Signal restored.' : 'Carrier lost.'}</h1><p>${won ? 'All systems responding. Nice work, crew. The next shift is yours whenever you’re ready.' : escapeHtml(mission.feedback?.text ?? 'Signal integrity reached its limit. Take a breath and try a fresh transmission.')}</p><div class="result-stats"><div><strong>${mission.restored}/${mission.total}</strong><span>MODULES RESTORED</span></div><div><strong>${timeLabel(mission.elapsed)}</strong><span>MISSION DURATION</span></div><div><strong>${mission.strikes}</strong><span>STRIKES</span></div></div>
    <div class="result-crew">${state.players.map((player) => `<span>${escapeHtml(player.name)}<small>${roleName(player.role)}</small></span>`).join('<b>+</b>')}</div>
    ${state.self === state.host ? '<button class="button primary" data-command="lobby">Another round? →</button>' : '<p class="small-note">Your host can take you back to the lobby for another round.</p>'}<p class="small-note">Try swapping roles for a completely different view.</p><button class="text-button leave" data-command="leave">Leave room</button>
  </section>`;
}
