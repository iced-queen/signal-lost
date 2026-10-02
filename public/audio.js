export class StationAudio {
  constructor(onError) {
    this.enabled = false;
    this.context = null;
    this.ambient = null;
    this.sceneActive = false;
    this.onError = onError;
    this.lastTick = -Infinity;
  }

  async toggle() {
    if (this.enabled) {
      this.enabled = false;
      this.setScene(false);
      return false;
    }
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) {
      this.onError('This browser does not support equipment audio. The game still works without it.');
      return false;
    }
    try {
      if (!this.context) this.context = new AudioContext();
      await this.context.resume();
      this.enabled = true;
      this.play('switch');
      return true;
    } catch (error) {
      console.error('Equipment audio could not start:', error);
      this.onError('Equipment audio could not start. Check browser audio permissions; gameplay is unaffected.');
      return false;
    }
  }

  setScene(active) {
    this.sceneActive = active;
    if (this.ambient && (!active || !this.enabled)) {
      this.ambient.oscillator.stop();
      this.ambient = null;
    }
    if (!active || !this.enabled || !this.context || this.ambient) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = 55;
    oscillator.type = 'sine';
    gain.gain.value = 0.018;
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start();
    this.ambient = { oscillator, gain };
  }

  play(cue) {
    if (!this.enabled || !this.context) return;
    const time = this.context.currentTime;
    if (cue === 'tick' && time - this.lastTick < 0.04) return;
    if (cue === 'tick') this.lastTick = time;
    const tones = {
      switch: [180, 95], tick: [430], cut: [120, 60], accepted: [540],
      restored: [460, 690, 920], fault: [130, 100], broadcast: [520, 780, 1040],
    };
    const frequencies = tones[cue] ?? tones.switch;
    frequencies.forEach((frequency, index) => {
      const start = time + index * 0.085;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = cue === 'fault' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(cue === 'tick' ? 0.045 : 0.065, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + 0.09);
    });
  }
}
