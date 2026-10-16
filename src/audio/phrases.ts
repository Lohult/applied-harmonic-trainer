// Musical phrases built on the engine: key-establishing context, targets,
// resolutions and progressions. Times are seconds from the take's start.

import type { ModeId, Semi } from '../theory/core';
import { type ChordShape, diatonicTriad, resolutionPath, voiceChord } from '../theory/harmony';
import type { Take, Timbre } from './engine';

/** Tonic placed in the guitar's middle register: C3 (48) … B3 (59). */
export const tonicMidiFor = (pc: number) => 48 + pc;

/** Chords (relative to the tonic) that establish each mode without implying another. */
export const CADENCES: Record<string, ChordShape[]> = {
  aeolian: [{ root: 0, quality: 'minor' }, { root: 8, quality: 'major' }, { root: 10, quality: 'major' }, { root: 0, quality: 'minor' }],
  phrygian: [{ root: 0, quality: 'minor' }, { root: 1, quality: 'major' }, { root: 0, quality: 'minor' }],
  dorian: [{ root: 0, quality: 'minor' }, { root: 5, quality: 'major' }, { root: 0, quality: 'minor' }],
  harmonic: [{ root: 0, quality: 'minor' }, { root: 5, quality: 'minor' }, { root: 7, quality: 'major' }, { root: 0, quality: 'minor' }],
  phrygdom: [{ root: 0, quality: 'major' }, { root: 1, quality: 'major' }, { root: 0, quality: 'major' }],
};

export const cadenceFor = (mode: ModeId): ChordShape[] =>
  CADENCES[mode] ?? [diatonicTriad(mode, 0), diatonicTriad(mode, 0)];

/** Keep chord voicings within about a 5th of the tonic so the bass stays put. */
const placeNear = (notes: number[], tonicMidi: number) => {
  const shift = notes[0] > tonicMidi + 6 ? -12 : 0;
  return notes.map((n) => n + shift);
};

export type ContextKind = 'cadence' | 'drone';

const chordTimbre = (t: Timbre): Timbre => (t === 'bass' ? 'clean' : t);

/**
 * Establish the key: a drone on the tonic, plus a short modal vamp when
 * `kind` is 'cadence'. Returns the time the target should start, and the
 * drone keeps sounding through `holdUntil` so the target is heard against it.
 */
export const playContext = (
  take: Take,
  tonicMidi: number,
  mode: ModeId,
  kind: ContextKind,
  timbre: Timbre,
  holdUntil: number,
): number => {
  take.drone(tonicMidi - 12, 0, holdUntil);
  if (kind === 'drone') return 1.4;
  const chords = cadenceFor(mode);
  const step = 0.7;
  chords.forEach((c, i) => {
    const notes = placeNear(voiceChord(c, tonicMidi), tonicMidi);
    take.strum(notes, 0.15 + i * step, { timbre: chordTimbre(timbre), dur: i === chords.length - 1 ? 1.2 : step + 0.1 });
  });
  return 0.15 + chords.length * step + 0.55;
};

/** Total length to reserve for the drone when a target follows the context. */
export const contextLength = (mode: ModeId, kind: ContextKind) =>
  kind === 'drone' ? 1.4 : 0.15 + cadenceFor(mode).length * 0.7 + 0.55;

/** Resolve a target stepwise to the nearest tonic. Returns the end time. */
export const playResolution = (take: Take, mode: ModeId, targetMidi: number, semi: Semi, at: number, timbre: Timbre): number => {
  const path = resolutionPath(mode, semi);
  const base = targetMidi - semi;
  const step = 0.42;
  path.forEach((off, i) => {
    take.pluck(base + off, at + i * step, { timbre, dur: i === path.length - 1 ? 1.4 : step + 0.15 });
  });
  return at + (path.length - 1) * step + 1.4;
};

export const playChord = (take: Take, chord: ChordShape, tonicMidi: number, at: number, dur: number, timbre: Timbre) => {
  const notes = voiceChord(chord, tonicMidi - 12);
  const placed = notes[0] > tonicMidi - 12 + 6 ? notes.map((n) => n - 12) : notes;
  if (timbre === 'chug') {
    // Palm-muted eighth notes across the bar.
    const hits = Math.max(2, Math.round(dur / 0.21));
    for (let h = 0; h < hits; h++) take.strum(placed, at + h * (dur / hits), { timbre: 'chug', vel: h % 2 ? 0.6 : 0.85 });
  } else {
    take.strum(placed, at, { timbre, dur: dur + 0.15 });
  }
};
