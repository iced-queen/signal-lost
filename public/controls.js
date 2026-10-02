export function updateFrequency(root, inputs, moduleId, frequency) {
  const value = Math.max(880, Math.min(960, Math.round(frequency)));
  inputs[moduleId] = value;
  const output = root.querySelector(`#output-${moduleId}`);
  const knob = root.querySelector(`#knob-${moduleId}`);
  const needle = root.querySelector(`#needle-${moduleId}`);
  if (output) output.textContent = (value / 10).toFixed(1);
  if (knob) {
    knob.setAttribute('aria-valuenow', String(value));
    knob.setAttribute('aria-valuetext', `${(value / 10).toFixed(1)} MHz`);
  }
  if (needle) needle.setAttribute('transform', `rotate(${135 + (value - 880) * 3.375} 80 80)`);
  return value;
}

export function installKnobControls(root, inputs, onTick) {
  let drag = null;
  const enabled = (knob) => knob?.isConnected && knob.getAttribute('aria-disabled') !== 'true' && !knob.closest('fieldset')?.disabled;
  root.addEventListener('pointerdown', (event) => {
    const knob = event.target.closest('[data-knob]');
    if (!enabled(knob) || event.button !== 0) return;
    event.preventDefault();
    knob.focus();
    knob.setPointerCapture(event.pointerId);
    drag = { knob, pointerId: event.pointerId, y: event.clientY, value: Number(knob.getAttribute('aria-valuenow')) };
  });
  root.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId || !enabled(drag.knob)) return;
    const before = Number(drag.knob.getAttribute('aria-valuenow'));
    const after = updateFrequency(root, inputs, drag.knob.dataset.knob, drag.value + Math.round((drag.y - event.clientY) / 3));
    if (before !== after) onTick();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    root.addEventListener(name, (event) => {
      if (drag?.pointerId === event.pointerId) drag = null;
    });
  }
  root.addEventListener('keydown', (event) => {
    const knob = event.target.closest('[data-knob]');
    if (!enabled(knob)) return;
    const current = Number(knob.getAttribute('aria-valuenow'));
    const changes = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
    const value = event.key === 'Home' ? 880 : event.key === 'End' ? 960 : Object.hasOwn(changes, event.key) ? current + changes[event.key] : null;
    if (value === null) return;
    event.preventDefault();
    updateFrequency(root, inputs, knob.dataset.knob, value);
    onTick();
  });
}
