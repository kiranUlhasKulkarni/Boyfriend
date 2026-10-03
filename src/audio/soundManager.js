import { AUDIO } from '../config';

/**
 * Sound manager
 *  - sound.play('success' | 'fail' | 'kiss')  → your custom voice/audio files
 *  - sound.playBgm() / stopBgm() / duckBgm()   → looping background music
 *  - sound.sfx.pop() / .slash() / .jump() ...  → tiny synthesized game effects
 *    (no "excellent"/"try again" stock voices anywhere — only your files)
 * Missing files fail silently.
 */
class SoundManager {
  constructor() {
    this.muted = false;
    this.cache = new Map();
    this.missing = new Set();
    this.bgm = null;
    this.bgmVolume = 0.35;
    this.ctx = null;
    this.current = null; // currently playing voice line
  }

  setMuted(m) {
    this.muted = m;
    if (this.bgm) this.bgm.muted = m;
    if (m && this.current) this.current.pause();
  }

  _audio(src) {
    if (!this.cache.has(src)) {
      const a = new Audio(src);
      a.preload = 'auto';
      a.addEventListener('error', () => this.missing.add(src));
      this.cache.set(src, a);
    }
    return this.cache.get(src);
  }

  preload() {
    [...AUDIO.success, ...AUDIO.fail, AUDIO.kiss].filter(Boolean).forEach((s) => this._audio(s));
  }

  /** Play a named custom sound. Returns a promise resolving when it ends (or immediately if unavailable). */
  play(name, { volume = 1 } = {}) {
    const entry = AUDIO[name];
    const list = Array.isArray(entry) ? entry : [entry];
    const src = list[Math.floor(Math.random() * list.length)];
    if (!src || this.muted || this.missing.has(src)) {
      if (name === 'kiss') this.sfx.kiss();
      return Promise.resolve(false);
    }
    const base = this._audio(src);
    // clone so rapid repeats (kisses) can overlap
    const a = name === 'kiss' ? base.cloneNode() : base;
    a.volume = volume;
    a.currentTime = 0;
    if (name !== 'kiss') {
      this.current?.pause();
      this.current = a;
      this.duckBgm(true);
    }
    return new Promise((resolve) => {
      const done = () => {
        if (name !== 'kiss') this.duckBgm(false);
        resolve(true);
      };
      a.onended = done;
      a.play().catch(() => {
        if (name === 'kiss') this.sfx.kiss();
        done();
      });
    });
  }

  playBgm(src = AUDIO.bgm) {
    if (!src || this.missing.has(src)) return;
    if (this.bgm && this.bgm.dataset.src === src) {
      if (this.bgm.paused) this.bgm.play().catch(() => {});
      return;
    }
    this.stopBgm();
    const a = new Audio(src);
    a.dataset.src = src;
    a.loop = true;
    a.volume = this.bgmVolume;
    a.muted = this.muted;
    a.addEventListener('error', () => this.missing.add(src));
    this.bgm = a;
    a.play().catch(() => {});
  }

  pauseBgm() {
    this.bgm?.pause();
  }

  stopBgm() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }
  }

  duckBgm(on) {
    if (!this.bgm) return;
    const target = on ? this.bgmVolume * 0.25 : this.bgmVolume;
    const start = this.bgm.volume;
    const t0 = performance.now();
    const step = (t) => {
      if (!this.bgm) return;
      const k = Math.min(1, (t - t0) / 300);
      this.bgm.volume = start + (target - start) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ───────── synthesized SFX (WebAudio) ─────────
  _ctx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  _tone({ freq = 440, to, type = 'sine', dur = 0.15, vol = 0.18, delay = 0 }) {
    if (this.muted) return;
    const ctx = this._ctx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.2, vol = 0.15, filter = 1200, delay = 0 }) {
    if (this.muted) return;
    const ctx = this._ctx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(filter, t);
    f.frequency.exponentialRampToValueAtTime(filter * 3, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
  }

  sfx = {
    pop: (pitch = 1) => this._tone({ freq: 520 * pitch, to: 900 * pitch, type: 'sine', dur: 0.12, vol: 0.2 }),
    boop: (i = 0) => this._tone({ freq: [523, 659, 784, 1046][i % 4], to: [660, 830, 990, 1320][i % 4], type: 'triangle', dur: 0.18, vol: 0.22 }),
    click: () => this._tone({ freq: 800, to: 600, type: 'square', dur: 0.05, vol: 0.06 }),
    slash: () => this._noise({ dur: 0.22, vol: 0.25, filter: 1800 }),
    hit: () => {
      this._noise({ dur: 0.12, vol: 0.2, filter: 600 });
      this._tone({ freq: 300, to: 120, type: 'square', dur: 0.12, vol: 0.08 });
    },
    jump: () => this._tone({ freq: 300, to: 700, type: 'square', dur: 0.14, vol: 0.07 }),
    coin: () => {
      this._tone({ freq: 988, type: 'square', dur: 0.08, vol: 0.06 });
      this._tone({ freq: 1319, type: 'square', dur: 0.2, vol: 0.06, delay: 0.07 });
    },
    bad: () => this._tone({ freq: 220, to: 110, type: 'sawtooth', dur: 0.25, vol: 0.08 }),
    kiss: () => {
      this._tone({ freq: 900, to: 1500, type: 'sine', dur: 0.08, vol: 0.15 });
      this._noise({ dur: 0.06, vol: 0.12, filter: 3000, delay: 0.05 });
    },
    sparkle: () => [0, 1, 2, 3].forEach((i) => this._tone({ freq: 1200 + i * 300, type: 'sine', dur: 0.15, vol: 0.06, delay: i * 0.05 })),
    whoosh: () => this._noise({ dur: 0.5, vol: 0.18, filter: 400 }),
    boom: () => {
      this._noise({ dur: 1.4, vol: 0.5, filter: 120 });
      this._tone({ freq: 120, to: 30, type: 'sine', dur: 1.2, vol: 0.5 });
    },
    tick: () => this._tone({ freq: 1500, type: 'sine', dur: 0.03, vol: 0.05 }),
  };
}

export const sound = new SoundManager();
