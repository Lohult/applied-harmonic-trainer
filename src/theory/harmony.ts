import { MODES, type ModeId, type Semi, mod12 } from './core';

export type Quality = 'major' | 'minor' | 'dim' | 'aug' | 'power';

export interface ChordShape {
  /** Root, in semitones above the tonic. */
  root: Semi;
  quality: Quality;
}

const QUALITY_INTERVALS: Record<Quality, Semi[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  power: [0, 7],
};

export const chordTones = (c: ChordShape): Semi[] => QUALITY_INTERVALS[c.quality].map((i) => mod12(c.root + i));

const NUMERALS = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'];

/** Quality of the triad built on `root` from the notes of `mode`, if the root is in the mode. */
export const diatonicQuality = (mode: ModeId, root: Semi): Quality | null => {
  const iv = MODES[mode].intervals;
  if (!iv.includes(mod12(root))) return null;
  const has = (n: number) => iv.includes(mod12(root + n));
  if (has(3) && has(7)) return 'minor';
  if (has(4) && has(7)) return 'major';
  if (has(3) && has(6)) return 'dim';
  if (has(4) && has(8)) return 'aug';
  return null;
};

/**
 * Roman numeral for a chord relative to the tonic. Power chords take the case
 * of the mode's diatonic triad on that root (B5 → C5 in B Phrygian reads i → ♭II).
 */
export const romanNumeral = (c: ChordShape, mode: ModeId): string => {
  const base = NUMERALS[mod12(c.root)];
  const q = c.quality === 'power' ? diatonicQuality(mode, c.root) ?? 'major' : c.quality;
  const lower = (s: string) => s.replace(/[IV]+/, (m) => m.toLowerCase());
  switch (q) {
    case 'minor':
      return lower(base);
    case 'dim':
      return `${lower(base)}°`;
    case 'aug':
      return `${base}+`;
    default:
      return base;
  }
};

/** Diatonic triad on a scale step of the mode. */
export const diatonicTriad = (mode: ModeId, root: Semi): ChordShape => ({
  root: mod12(root),
  quality: diatonicQuality(mode, root) ?? 'major',
});

/**
 * Stepwise path from a degree back to the tonic through the mode's scale,
 * taking whichever direction (down to 1 or up to the octave) is shorter.
 * Ties resolve downward. Chromatic notes step to the nearest scale tone first.
 * Returns semitone offsets relative to the starting note's octave tonic:
 * values may be 12 when the path ends on the upper tonic.
 */
export const resolutionPath = (mode: ModeId, semi: Semi): number[] => {
  const s = mod12(semi);
  if (s === 0) return [0];
  const scale = [...MODES[mode].intervals, 12];
  const down: number[] = [s];
  for (let i = scale.length - 1; i >= 0; i--) if (scale[i] < s) down.push(scale[i]);
  const up: number[] = [s];
  for (const n of scale) if (n > s) up.push(n);
  return up.length < down.length ? up : down;
};

/** Close-voiced chord as MIDI notes, rooted on or above `bassMidi`. */
export const voiceChord = (c: ChordShape, tonicMidi: number, opts: { octaveRoot?: boolean } = {}): number[] => {
  const rootMidi = tonicMidi + mod12(c.root);
  const notes = QUALITY_INTERVALS[c.quality].map((i) => rootMidi + i);
  if (c.quality === 'power' && opts.octaveRoot !== false) notes.push(rootMidi + 12);
  return notes;
};
