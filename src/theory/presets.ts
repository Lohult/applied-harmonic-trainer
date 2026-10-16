import type { ModeId, Semi } from './core';
import type { ChordShape } from './harmony';

export interface ProgressionChord extends ChordShape {
  /** Power-chord root plus the full triad quality used in "Full triads" voicing. */
  triad: ChordShape['quality'];
}

export interface Preset {
  id: string;
  title: string;
  mode: ModeId;
  /** Chords relative to the tonic, so presets transpose to any key. */
  chords: ProgressionChord[];
  why: string;
  think: string;
  character: Semi[];
  characterText: string;
}

const pc = (root: Semi, triad: ChordShape['quality']): ProgressionChord => ({ root, quality: 'power', triad });

export const PRESETS: Preset[] = [
  {
    id: 'gallop',
    title: 'Epic Gallop',
    mode: 'aeolian',
    chords: [pc(0, 'minor'), pc(8, 'major'), pc(10, 'major'), pc(0, 'minor')],
    why: '♭VI → ♭VII → i climbs by whole steps straight back home, with no V chord needed. That rising push is what makes it sound like a charge into battle rather than a sad ballad.',
    think: 'Common in power and melodic metal choruses and galloping verses.',
    character: [],
    characterText: 'None. This is pure Aeolian. The weight comes from ♭6 and ♭7 sitting in the bass.',
  },
  {
    id: 'lift',
    title: 'Relative Major Lift',
    mode: 'aeolian',
    chords: [pc(0, 'minor'), pc(3, 'major'), pc(10, 'major'), pc(8, 'major')],
    why: 'Moving from i to ♭III swaps the minor centre for its relative major, so the same notes suddenly sound hopeful. Then ♭VII and ♭VI let it sink back into the minor.',
    think: 'The classic clean-intro move from brooding to brief light.',
    character: [],
    characterText: 'None. The lift comes from re-centring on ♭3, not from any new note.',
  },
  {
    id: 'phrygian',
    title: 'Phrygian ♭2 Teaser',
    mode: 'phrygian',
    chords: [pc(0, 'minor'), pc(1, 'major'), pc(0, 'minor'), pc(1, 'major')],
    why: 'The ♭II sits a half step above home and keeps slamming back down onto it. That half-step grind is the engine of countless heavy riffs.',
    think: 'Listen for a riff that hammers the open low string, then nudges one fret up.',
    character: [1],
    characterText: '♭2 is the Phrygian fingerprint. Natural minor has a 2 here, so the ♭2 is what makes it sound darker and Spanish or Middle Eastern.',
  },
  {
    id: 'harmonic',
    title: 'Harmonic Minor Turnaround',
    mode: 'harmonic',
    chords: [pc(0, 'minor'), pc(5, 'minor'), pc(7, 'major'), pc(0, 'minor')],
    why: 'Raising the 7th turns v into a major V, whose leading tone pulls hard up to the root. You get classical, neoclassical drama instead of modal drift.',
    think: 'Switch to Full triads to hear the leading tone. A power chord leaves it out.',
    character: [11],
    characterText: 'The natural 7 is the leading tone. It only sounds in the V chord and in melodies.',
  },
  {
    id: 'dorian',
    title: 'Dorian Lift',
    mode: 'dorian',
    chords: [pc(0, 'minor'), pc(5, 'major'), pc(0, 'minor'), pc(5, 'major')],
    why: 'A major IV chord in a minor key brings in the natural 6, which brightens the darkness without leaving minor. It sounds cool and grooving rather than tragic.',
    think: 'Switch to Full triads. The ♮6 only exists in the major IV.',
    character: [9],
    characterText: 'The ♮6 is the Dorian fingerprint, one half step brighter than Aeolian ♭6.',
  },
  {
    id: 'phrygdom',
    title: 'Phrygian Dominant Snake',
    mode: 'phrygdom',
    chords: [pc(0, 'major'), pc(1, 'major'), pc(0, 'major'), pc(10, 'minor')],
    why: 'A major tonic chord with a ♭II above it. The major 3rd against the ♭2 creates the augmented-second gap that sounds instantly exotic.',
    think: 'Switch to Full triads. With power chords alone it sounds like plain Phrygian.',
    character: [1, 4],
    characterText: '♭2 plus the major 3rd. Together they form the 1-♭2-3 cell that defines the sound.',
  },
];
