// Pitch-class theory core: keys, degrees, modes, spelling and tunings.
// Everything is expressed as semitones above the tonic (0–11) so the same
// data drives the ear trainer, the fretboard and the analyser.

export type Semi = number; // 0..11, semitones above the tonic

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

export interface KeyDef {
  id: string;
  label: string;
  pc: number;
  letter: number; // index into LETTERS
}

// Spellings chosen for minor-key work: G♯ minor rather than A♭ minor,
// B♭ minor rather than A♯ minor.
export const KEYS: KeyDef[] = [
  { id: 'C', label: 'C', pc: 0, letter: 0 },
  { id: 'C#', label: 'C♯', pc: 1, letter: 0 },
  { id: 'D', label: 'D', pc: 2, letter: 1 },
  { id: 'Eb', label: 'E♭', pc: 3, letter: 2 },
  { id: 'E', label: 'E', pc: 4, letter: 2 },
  { id: 'F', label: 'F', pc: 5, letter: 3 },
  { id: 'F#', label: 'F♯', pc: 6, letter: 3 },
  { id: 'G', label: 'G', pc: 7, letter: 4 },
  { id: 'G#', label: 'G♯', pc: 8, letter: 4 },
  { id: 'A', label: 'A', pc: 9, letter: 5 },
  { id: 'Bb', label: 'B♭', pc: 10, letter: 6 },
  { id: 'B', label: 'B', pc: 11, letter: 6 },
];

export const keyById = (id: string): KeyDef => KEYS.find((k) => k.id === id) ?? KEYS[11];
export const keyByPc = (pc: number): KeyDef => KEYS.find((k) => k.pc === mod12(pc))!;

export interface DegreeDef {
  semi: Semi;
  label: string;
  num: number; // scale-step number used for spelling (♭5 spells as a 5th)
  name: string;
  color: string;
  ink: string; // text colour that reads on `color`
}

export const DEGREES: DegreeDef[] = [
  { semi: 0, label: '1', num: 1, name: 'Root', color: '#F2EFE6', ink: '#0E1116' },
  { semi: 1, label: '♭2', num: 2, name: 'Minor second', color: '#C9303C', ink: '#FFFFFF' },
  { semi: 2, label: '2', num: 2, name: 'Major second', color: '#F29B59', ink: '#0E1116' },
  { semi: 3, label: '♭3', num: 3, name: 'Minor third', color: '#2F6FDB', ink: '#FFFFFF' },
  { semi: 4, label: '3', num: 3, name: 'Major third', color: '#F5D04A', ink: '#0E1116' },
  { semi: 5, label: '4', num: 4, name: 'Perfect fourth', color: '#8FD16A', ink: '#0E1116' },
  { semi: 6, label: '♭5', num: 5, name: 'Tritone', color: '#8B4FE0', ink: '#FFFFFF' },
  { semi: 7, label: '5', num: 5, name: 'Perfect fifth', color: '#5A6273', ink: '#FFFFFF' },
  { semi: 8, label: '♭6', num: 6, name: 'Minor sixth', color: '#B04A6E', ink: '#FFFFFF' },
  { semi: 9, label: '6', num: 6, name: 'Major sixth', color: '#2EC4B6', ink: '#0E1116' },
  { semi: 10, label: '♭7', num: 7, name: 'Minor seventh', color: '#8FB3D1', ink: '#0E1116' },
  { semi: 11, label: '7', num: 7, name: 'Major seventh', color: '#FF8CCB', ink: '#0E1116' },
];

export const ROOT_RING = '#F5C451';

export type ModeId =
  | 'aeolian'
  | 'phrygian'
  | 'dorian'
  | 'harmonic'
  | 'phrygdom'
  | 'ionian'
  | 'mixolydian'
  | 'lydian'
  | 'locrian';

export interface ModeDef {
  id: ModeId;
  name: string;
  short: string;
  intervals: Semi[];
  /** Scale the character notes are measured against. */
  baseline: ModeId;
  blurb: string;
}

export const MODES: Record<ModeId, ModeDef> = {
  aeolian: {
    id: 'aeolian', name: 'Aeolian', short: 'Aeolian', intervals: [0, 2, 3, 5, 7, 8, 10], baseline: 'aeolian',
    blurb: 'Natural minor. The reference for every other minor colour.',
  },
  phrygian: {
    id: 'phrygian', name: 'Phrygian', short: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], baseline: 'aeolian',
    blurb: 'Natural minor with a ♭2. The darkest common mode and the metal riff engine.',
  },
  dorian: {
    id: 'dorian', name: 'Dorian', short: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], baseline: 'aeolian',
    blurb: 'Natural minor with a ♮6. Minor but cool and grooving rather than tragic.',
  },
  harmonic: {
    id: 'harmonic', name: 'Harmonic minor', short: 'Harm. minor', intervals: [0, 2, 3, 5, 7, 8, 11], baseline: 'aeolian',
    blurb: 'Natural minor with a raised 7. A leading tone and a major V, for neoclassical drama.',
  },
  phrygdom: {
    id: 'phrygdom', name: 'Phrygian Dominant', short: 'Phryg. Dom.', intervals: [0, 1, 4, 5, 7, 8, 10], baseline: 'aeolian',
    blurb: 'The 5th mode of harmonic minor: ♭2 plus a major 3rd. Exotic and snake-charmer heavy.',
  },
  ionian: {
    id: 'ionian', name: 'Ionian (major)', short: 'Ionian', intervals: [0, 2, 4, 5, 7, 9, 11], baseline: 'ionian',
    blurb: 'The major scale. The reference for every major colour.',
  },
  mixolydian: {
    id: 'mixolydian', name: 'Mixolydian', short: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], baseline: 'ionian',
    blurb: 'Major with a ♭7. Classic rock swagger.',
  },
  lydian: {
    id: 'lydian', name: 'Lydian', short: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], baseline: 'ionian',
    blurb: 'Major with a ♯4. Floating and cinematic.',
  },
  locrian: {
    id: 'locrian', name: 'Locrian', short: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], baseline: 'aeolian',
    blurb: 'Phrygian with a ♭5. Unstable because the tonic chord itself is diminished.',
  },
};

/** The modes offered in the top bar (the trainer's minor-focused set). */
export const TRAINER_MODES: ModeId[] = ['aeolian', 'phrygian', 'phrygdom', 'dorian', 'harmonic'];

/** Degrees in `mode` that are not in its baseline scale. */
export const characterNotes = (mode: ModeId): Semi[] => {
  const m = MODES[mode];
  const base = MODES[m.baseline].intervals;
  return m.intervals.filter((s) => !base.includes(s));
};

const ACCIDENTALS: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

/** Spell the note `semi` semitones above the key's tonic using the degree's letter. */
export const spell = (key: KeyDef, semi: Semi): string => {
  const s = mod12(semi);
  const letterIdx = (key.letter + DEGREES[s].num - 1) % 7;
  const pc = mod12(key.pc + s);
  let diff = mod12(pc - LETTER_PC[letterIdx]);
  if (diff > 6) diff -= 12;
  return LETTERS[letterIdx] + (ACCIDENTALS[diff] ?? '?');
};

export interface TuningDef {
  id: string;
  name: string;
  /** MIDI note of each open string, low to high. */
  strings: number[];
  names: string[];
}

export const TUNINGS: TuningDef[] = [
  { id: 'standard', name: 'Standard E', strings: [40, 45, 50, 55, 59, 64], names: ['E', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'dropd', name: 'Drop D', strings: [38, 45, 50, 55, 59, 64], names: ['D', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'dropcs', name: 'Drop C♯', strings: [37, 44, 49, 54, 58, 63], names: ['C♯', 'G♯', 'C♯', 'F♯', 'A♯', 'd♯'] },
];

export const tuningById = (id: string): TuningDef => TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];

export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Semitones above the tonic for a MIDI note. */
export const semiOf = (midi: number, tonicPc: number): Semi => mod12(midi - tonicPc);
