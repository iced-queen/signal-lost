import test from 'node:test';
import assert from 'node:assert/strict';
import { updateFrequency } from '../public/controls.js';
import { StationAudio } from '../public/audio.js';

test('tuning updates the readout, accessible value and needle with exact bounded tenths', () => {
  const input = {};
  const output = {};
  const knob = { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const needle = { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const elements = { '#output-test': output, '#knob-test': knob, '#needle-test': needle };
  const root = { querySelector: (selector) => elements[selector] };
  assert.equal(updateFrequency(root, input, 'test', 894), 894);
  assert.equal(output.textContent, '89.4');
  assert.equal(knob.attributes['aria-valuetext'], '89.4 MHz');
  assert.equal(input.test, 894);
  assert.match(needle.attributes.transform, /^rotate\(/);
  assert.equal(updateFrequency(root, input, 'test', 1000), 960);
  assert.equal(updateFrequency(root, input, 'test', 500), 880);
  assert.equal(updateFrequency(root, input, 'test', 895.6), 896);
});

test('audio is opt-in, uses bounded cues, and stops the room hum when paused', async (t) => {
  const original = globalThis.AudioContext;
  const oscillators = [];
  let errors = 0;
  class FakeContext {
    constructor() { this.currentTime = 1; this.destination = {}; }
    async resume() {}
    createOscillator() {
      const oscillator = {
        frequency: { value: 0, setValueAtTime(value) { this.value = value; } },
        connect: (node) => node, disconnect() {}, start() {},
        stop() { this.stopped = true; this.onended?.(); },
      };
      oscillators.push(oscillator);
      return oscillator;
    }
    createGain() {
      return {
        gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect: (node) => node, disconnect() {},
      };
    }
  }
  globalThis.AudioContext = FakeContext;
  t.after(() => { if (original) globalThis.AudioContext = original; else delete globalThis.AudioContext; });
  const audio = new StationAudio(() => errors++);
  audio.play('restored');
  assert.equal(oscillators.length, 0);
  assert.equal(await audio.toggle(), true);
  audio.setScene(true);
  const hum = audio.ambient.oscillator;
  assert.equal(hum.frequency.value, 55);
  audio.setScene(true);
  assert.equal(audio.ambient.oscillator, hum);
  const count = oscillators.length;
  audio.play('restored');
  assert.deepEqual(oscillators.slice(count).map((node) => node.frequency.value), [460, 690, 920]);
  audio.setScene(false);
  assert.equal(hum.stopped, true);
  assert.equal(audio.ambient, null);
  assert.equal(await audio.toggle(), false);
  assert.equal(errors, 0);
});
