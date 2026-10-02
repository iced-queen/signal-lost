import { BAND_DETENTS, GLYPH_ORDERS, GLYPHS, PATCH_PORTS, PULSE_TABLE, STATIONS, MODULE_NAMES } from './rules.js';

const pages = {
  wires: () => `
    <p class="manual-intro">Restore the power bus in two stages: isolate the faulty wire, then patch its bypass to a return terminal. Nothing downstream can operate until both are complete.</p>
    <div class="ask-box"><span>ASK YOUR OPERATOR</span>“What are the five colors, top to bottom? What's the last digit of the serial?”</div>
    <h4 class="procedure-heading">01 / ISOLATE THE FAULT</h4><p>Read top to bottom. <strong>Use the first rule that applies.</strong></p><ol class="rule-list">
      <li><span>01</span><div>If there are <strong>two or more red wires</strong>, cut the <strong>last red wire</strong>.</div></li>
      <li><span>02</span><div>Otherwise, if there are <strong>no blue wires</strong>, cut the <strong>second wire</strong>.</div></li>
      <li><span>03</span><div>Otherwise, if the serial ends in an <strong>even digit</strong> and there is an <strong>amber wire</strong>, cut the <strong>first amber wire</strong>.</div></li>
      <li><span>04</span><div>Otherwise, cut the <strong>last wire</strong>.</div></li>
    </ol><p class="manual-note">“First” and “last” always mean top to bottom. Zero is even. A disconnected wire stays open; the same wire cannot be cut twice.</p>
    <h4 class="procedure-heading">02 / PATCH THE BYPASS</h4><p>Ask for the <strong>battery cell count</strong> and the <strong>last serial digit</strong>. Connect the loose bypass cable to the table's return terminal.</p>
    <div class="table-wrap"><table><thead><tr><th>Serial last digit</th><th>1 cell</th><th>2 cells</th><th>3 cells</th></tr></thead><tbody>${Object.entries(PATCH_PORTS).map(([parity, ports]) => `<tr><th>${parity}</th>${ports.map((port) => `<td>${port}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
  glyphs: () => `
    <p class="manual-intro">Four symbols are out of order. The panel's band identifies the right reference row.</p>
    <div class="ask-box"><span>ASK YOUR OPERATOR</span>“Which band: Orbit, Horizon, or Zenith? Which four symbols do you see?”</div>
    <h4 class="procedure-heading">01 / RECOVER MEMORY</h4><p>Find the band below. <strong>Skip symbols that aren't on the panel.</strong> Press the four that are present in the row's left-to-right order.</p>
    <div class="glyph-reference">${Object.entries(GLYPH_ORDERS).map(([band, glyphs]) => `
      <div class="glyph-reference-row"><h3>${band}</h3><div>${glyphs.map((glyph) => `<span><b aria-hidden="true">${GLYPHS[glyph]}</b><small>${glyph}</small></span>`).join('')}</div></div>`).join('')}</div>
    <p class="manual-note">Read each reference row left to right; swipe on a narrow screen. A wrong symbol releases all memory contacts and causes a strike.</p>
    <h4 class="procedure-heading">02 / ALIGN THE COUPLER</h4><p>After all four contacts latch, use the band's base position:</p><div class="table-wrap"><table><thead><tr><th>Band</th><th>Base coupler position</th></tr></thead><tbody>${Object.entries(BAND_DETENTS).map(([band, position]) => `<tr><th>${band}</th><td>${['I', 'II', 'III'][position - 1]}</td></tr>`).join('')}</tbody></table></div>
    <div class="manual-callout">If the station's <strong>LINK indicator is lit</strong>, advance <strong>one position</strong>: I → II → III → I. If LINK is off, use the base position.</div>`,
  pulses: () => `
    <p class="manual-intro">The console records three beacons, A → B → C. Each shows a color and one, two, or three burst marks.</p>
    <div class="ask-box"><span>ASK YOUR OPERATOR</span>“What's the color and burst count for each beacon? Does the serial end odd or even?”</div>
    <h4 class="procedure-heading">01 / LATCH THE RECOVERY CODE</h4><p>Convert each beacon to a digit using this table:</p>
    <div class="table-wrap"><table><thead><tr><th>Beacon color</th><th>1 burst</th><th>2 bursts</th><th>3 bursts</th></tr></thead><tbody>${Object.entries(PULSE_TABLE).map(([color, digits]) => `<tr><th><span class="color-dot ${color}"></span>${color}</th>${digits.map((digit) => `<td>${digit}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="manual-callout"><strong>Even serial digit:</strong> enter A, B, C.<br><strong>Odd serial digit:</strong> reverse it — enter C, B, A.</div>
    <p class="manual-note">Latch exactly three digits. A wrong code causes one strike; you may retry.</p>
    <h4 class="procedure-heading">02 / SET THE SYNCHRONIZER</h4><p>Count the <strong>different beacon colors</strong> in this device's captured readout. Repeated colors count once.</p><div class="table-wrap"><table><thead><tr><th>Different colors</th><th>Routing mode</th></tr></thead><tbody><tr><td>1</td><td>LOCAL</td></tr><tr><td>2</td><td>CROSS</td></tr><tr><td>3</td><td>REMOTE</td></tr></tbody></table></div>`,
  frequency: () => `
    <p class="manual-intro">The final uplink is interlocked until every upstream device is restored. Tune the carrier and set its bandwidth, then operate the transmit lever.</p>
    <div class="ask-box"><span>ASK YOUR OPERATOR</span>“What's the station name? How many battery cells? Is the LINK indicator lit?”</div>
    <div class="table-wrap"><table><thead><tr><th>Station</th><th>Base frequency</th></tr></thead><tbody>${Object.entries(STATIONS).map(([station, base]) => `<tr><th>${station}</th><td>${(base / 10).toFixed(1)} MHz</td></tr>`).join('')}</tbody></table></div>
    <div class="manual-callout">Add <strong>0.2 MHz for each battery cell</strong>.<br>If LINK is <strong>lit</strong>, also add <strong>0.1 MHz</strong>.</div>
    <h4 class="procedure-heading">FINAL / SET CARRIER BANDWIDTH</h4><p>Ask for the serial's last digit. <strong>Even → NARROW.</strong> <strong>Odd → WIDE.</strong> Both the frequency and bandwidth must be correct.</p>
    <p class="manual-note">Example: 90.0 MHz + two cells + lit LINK = 90.5 MHz. The rotary knob can be dragged vertically or adjusted with arrow keys and the ± buttons.</p>`,
};

export function renderManual(tab) {
  return `<section class="manual-shell">
    <div class="manual-heading"><div><span class="eyebrow">TECHNICAL LIBRARY / REV. 02</span><h2>Signal recovery manual</h2></div><span class="manual-stamp">ANALYST<br>ACCESS</span></div>
    <nav class="manual-tabs" aria-label="Manual sections">${Object.entries(MODULE_NAMES).map(([type, name]) => `<button data-manual="${type}" aria-pressed="${tab === type}" class="${tab === type ? 'active' : ''}">${name}</button>`).join('')}</nav>
    <article class="manual-page"><div class="manual-page-title"><span class="eyebrow">SECTION ${String(Object.keys(pages).indexOf(tab) + 1).padStart(2, '0')}</span><h3>${MODULE_NAMES[tab]}</h3></div>${pages[tab]()}</article>
    <div class="manual-bottom">This guide can't see the console. Your partner is your eyes.</div>
  </section>`;
}
