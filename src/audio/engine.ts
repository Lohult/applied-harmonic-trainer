// Web Audio engine: Karplus–Strong plucked strings, an overdrive chain,
// palm-muted chugs, a bass voice and a sustained drone.
//
// Everything is scheduled on the AudioContext clock inside a "take". Starting
// a new take fades out and stops the previous one, so a replay never overlaps.

import { midiToFreq } from '../theory/core';

export type Timbre = 'clean' | 'overdrive' | 'bass' | 'chug';
export const TIMBRES: { id: Timbre; label: string }[] = [
  { id: 'clean', label: 'Clean pluck' },
  { id: 'overdrive', label: 'Overdrive' },
  { id: 'bass', label: 'Bass' },
  { id: 'chug', label: 'Palm-mute chug' },
];

interface VoiceSpec {
  damping: number;
  brightness: number;
  length: number;
}

const SPECS: Record<Timbre, VoiceSpec> = {
  clean: { damping: 0.996, brightness: 0.7, length: 2.6 },
  overdrive: { damping: 0.998, brightness: 0.85, length: 3 },
  bass: { damping: 0.997, brightness: 0.45, length: 2.6 },
  chug: { damping: 0.96, brightness: 0.6, length: 0.5 },
};

export interface NoteOpts {
  timbre?: Timbre;
  dur?: number;
  vel?: number;
}

const driveCurve = (() => {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(4 * x) / Math.tanh(4);
  }
  return curve;
})();

export class Take {
  readonly start: number;
  private sources = new Set<AudioScheduledSourceNode>();
  private drive: AudioNode | null = null;
  private stopped = false;
  private timers = new Set<number>();
  readonly group: GainNode;
  private readonly ctx: AudioContext;
  private readonly bufferFor: (midi: number, timbre: Timbre) => { buffer: AudioBuffer; rate: number };

  constructor(
    ctx: AudioContext,
    out: AudioNode,
    bufferFor: (midi: number, timbre: Timbre) => { buffer: AudioBuffer; rate: number },
  ) {
    this.ctx = ctx;
    this.bufferFor = bufferFor;
    this.group = ctx.createGain();
    this.group.connect(out);
    this.start = ctx.currentTime + 0.06;
  }

  get isStopped() {
    return this.stopped;
  }

  private driveInput(): AudioNode {
    if (this.drive) return this.drive;
    const c = this.ctx;
    const pre = c.createGain();
    pre.gain.value = 6;
    const shaper = c.createWaveShaper();
    shaper.curve = driveCurve;
    shaper.oversample = '4x';
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const cab = c.createBiquadFilter();
    cab.type = 'lowpass';
    cab.frequency.value = 3600;
    cab.Q.value = 0.8;
    const mid = c.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 800;
    mid.gain.value = -4;
    const post = c.createGain();
    post.gain.value = 0.22;
    pre.connect(shaper).connect(hp).connect(mid).connect(cab).connect(post).connect(this.group);
    this.drive = pre;
    return pre;
  }

  /** Schedule a plucked note at `at` seconds after the take's start. */
  pluck(midi: number, at: number, opts: NoteOpts = {}) {
    if (this.stopped) return;
    const timbre = opts.timbre ?? 'clean';
    const play = timbre === 'bass' ? midi - 12 : midi;
    const { buffer, rate } = this.bufferFor(play, timbre);
    const t = this.start + at;
    const dur = Math.min(opts.dur ?? SPECS[timbre].length, buffer.duration / rate);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const env = this.ctx.createGain();
    const vel = opts.vel ?? 0.8;
    env.gain.setValueAtTime(vel, t);
    env.gain.setValueAtTime(vel, t + Math.max(0.01, dur - 0.08));
    env.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(env);
    if (timbre === 'overdrive' || timbre === 'chug') {
      if (timbre === 'chug') {
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1100;
        env.connect(lp).connect(this.driveInput());
      } else {
        env.connect(this.driveInput());
      }
    } else if (timbre === 'bass') {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      const g = this.ctx.createGain();
      g.gain.value = 1.4;
      env.connect(lp).connect(g).connect(this.group);
    } else {
      env.connect(this.group);
    }
    src.start(t);
    src.stop(t + dur + 0.02);
    this.track(src);
  }

  /** A strummed chord: notes low to high, a few milliseconds apart. */
  strum(midis: number[], at: number, opts: NoteOpts = {}) {
    const sorted = [...midis].sort((a, b) => a - b);
    const vel = (opts.vel ?? 0.8) / Math.sqrt(sorted.length) * 1.3;
    sorted.forEach((m, i) => this.pluck(m, at + i * 0.012, { ...opts, vel }));
  }

  /** Sustained root drone (saw pair + sub sine) from `at` for `dur` seconds. */
  drone(midi: number, at: number, dur: number, level = 0.12) {
    if (this.stopped) return;
    const c = this.ctx;
    const t = this.start + at;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    lp.Q.value = 0.7;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + 0.35);
    env.gain.setValueAtTime(level, t + Math.max(0.4, dur - 0.4));
    env.gain.linearRampToValueAtTime(0, t + dur);
    lp.connect(env).connect(this.group);
    const f = midiToFreq(midi);
    const mk = (type: OscillatorType, freq: number, detune: number, gain: number) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = c.createGain();
      g.gain.value = gain;
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
      this.track(o);
    };
    mk('sawtooth', f, -5, 0.5);
    mk('sawtooth', f, 5, 0.5);
    mk('sine', f / 2, 0, 1.2);
  }

  /** Run `fn` when the context clock reaches `at` seconds into the take. */
  at(at: number, fn: () => void) {
    if (this.stopped) return;
    const ms = (this.start + at - this.ctx.currentTime) * 1000;
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.stopped) fn();
    }, Math.max(0, ms));
    this.timers.add(id);
  }

  /** Resolves when the clock reaches `at` seconds into the take (or the take stops). */
  until(at: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.stopped) return resolve(false);
      const ms = (this.start + at - this.ctx.currentTime) * 1000;
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        resolve(!this.stopped);
      }, Math.max(0, ms));
      this.timers.add(id);
    });
  }

  private track(src: AudioScheduledSourceNode) {
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    const now = this.ctx.currentTime;
    this.group.gain.cancelScheduledValues(now);
    this.group.gain.setValueAtTime(this.group.gain.value, now);
    this.group.gain.linearRampToValueAtTime(0, now + 0.04);
    for (const s of this.sources) {
      try {
        s.stop(now + 0.05);
      } catch {
        /* already stopped */
      }
    }
    window.setTimeout(() => this.group.disconnect(), 120);
  }
}

class Engine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cache = new Map<string, { buffer: AudioBuffer; rate: number }>();
  private current: Take | null = null;
  private previewTake: Take | null = null;
  volume = 0.8;

  private ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      const master = ctx.createGain();
      master.gain.value = this.volume;
      master.connect(comp).connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private bufferFor = (midi: number, timbre: Timbre) => {
    const key = `${midi}:${timbre}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const ctx = this.ensure();
    const spec = SPECS[timbre];
    const sr = ctx.sampleRate;
    const freq = midiToFreq(midi);
    // Integer delay line plus the averaging filter's half-sample delay gives a
    // loop of period + 0.5 samples; playbackRate corrects the tuning exactly.
    const period = Math.max(2, Math.round(sr / freq - 0.5));
    const rate = (freq * (period + 0.5)) / sr;
    const len = Math.floor(sr * spec.length);
    const buffer = ctx.createBuffer(1, len, sr);
    const d = buffer.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < period; i++) {
      lp += spec.brightness * (Math.random() * 2 - 1 - lp);
      d[i] = lp;
    }
    let mean = 0;
    for (let i = 0; i < period; i++) mean += d[i];
    mean /= period;
    for (let i = 0; i < period; i++) d[i] -= mean;
    // Lower strings ring longer; scale the loss per period by pitch.
    const damp = Math.pow(spec.damping, 440 / Math.max(60, freq) * 0.35 + 0.65);
    for (let i = period; i < len; i++) {
      d[i] = damp * 0.5 * (d[i - period] + d[i - period - 1 >= 0 ? i - period - 1 : period - 1]);
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
    const entry = { buffer, rate };
    this.cache.set(key, entry);
    return entry;
  };

  /** Stop whatever is playing and start a new take. */
  take(): Take {
    const ctx = this.ensure();
    this.current?.stop();
    this.current = new Take(ctx, this.master!, this.bufferFor);
    return this.current;
  }

  /** One-off note that doesn't interrupt the current take (fretboard clicks). */
  preview(midi: number, timbre: Timbre = 'clean') {
    const ctx = this.ensure();
    this.previewTake?.stop();
    this.previewTake = new Take(ctx, this.master!, this.bufferFor);
    this.previewTake.pluck(midi, 0, { timbre, dur: 1.6 });
  }

  stop() {
    this.current?.stop();
    this.current = null;
  }
}

export const engine = new Engine();
