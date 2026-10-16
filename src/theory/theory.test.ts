import { describe, expect, it } from 'vitest';
import { characterNotes, keyById, MODES, spell } from './core';
import { diatonicQuality, resolutionPath, romanNumeral } from './harmony';
import { analyse, detectKey, parseProgression } from './analyze';

const scaleNames = (keyId: string, mode: keyof typeof MODES) =>
  MODES[mode].intervals.map((s) => spell(keyById(keyId), s)).join(' ');

describe('spelling', () => {
  it('spells modes with one letter per degree', () => {
    expect(scaleNames('B', 'aeolian')).toBe('B C♯ D E F♯ G A');
    expect(scaleNames('B', 'phrygian')).toBe('B C D E F♯ G A');
    expect(scaleNames('B', 'phrygdom')).toBe('B C D♯ E F♯ G A');
    expect(scaleNames('B', 'harmonic')).toBe('B C♯ D E F♯ G A♯');
    expect(scaleNames('E', 'phrygian')).toBe('E F G A B C D');
    expect(scaleNames('Eb', 'aeolian')).toBe('E♭ F G♭ A♭ B♭ C♭ D♭');
    expect(scaleNames('G#', 'phrygdom')).toBe('G♯ A B♯ C♯ D♯ E F♯');
  });
});

describe('character notes', () => {
  it('measures against natural minor', () => {
    expect(characterNotes('aeolian')).toEqual([]);
    expect(characterNotes('phrygian')).toEqual([1]);
    expect(characterNotes('dorian')).toEqual([9]);
    expect(characterNotes('harmonic')).toEqual([11]);
    expect(characterNotes('phrygdom')).toEqual([1, 4]);
  });
});

describe('harmony', () => {
  it('names diatonic chords', () => {
    expect(romanNumeral({ root: 0, quality: 'power' }, 'aeolian')).toBe('i');
    expect(romanNumeral({ root: 8, quality: 'power' }, 'aeolian')).toBe('♭VI');
    expect(romanNumeral({ root: 1, quality: 'power' }, 'phrygian')).toBe('♭II');
    expect(romanNumeral({ root: 5, quality: 'power' }, 'phrygian')).toBe('iv');
    expect(romanNumeral({ root: 7, quality: 'major' }, 'harmonic')).toBe('V');
    expect(romanNumeral({ root: 2, quality: 'dim' }, 'aeolian')).toBe('ii°');
    expect(diatonicQuality('dorian', 5)).toBe('major');
  });

  it('resolves along the shorter scale path', () => {
    expect(resolutionPath('aeolian', 8)).toEqual([8, 10, 12]);
    expect(resolutionPath('aeolian', 7)).toEqual([7, 8, 10, 12]);
    expect(resolutionPath('aeolian', 5)).toEqual([5, 3, 2, 0]);
    expect(resolutionPath('phrygian', 1)).toEqual([1, 0]);
    expect(resolutionPath('aeolian', 11)).toEqual([11, 12]);
    expect(resolutionPath('aeolian', 0)).toEqual([0]);
  });
});

describe('analysis', () => {
  it('parses power chords, triads and bare roots', () => {
    const { chords, errors } = parseProgression('B5 C5 Bm F♯dim e | G');
    expect(errors).toEqual([]);
    expect(chords.map((c) => c.rootPc)).toEqual([11, 0, 11, 6, 4, 7]);
    expect(chords.map((c) => c.quality)).toEqual(['power', 'power', 'minor', 'dim', 'power', 'major']);
  });

  it('reports unparseable tokens', () => {
    expect(parseProgression('B5 xyz').errors).toEqual(['xyz']);
  });

  it('hears a Phrygian riff as Phrygian on its starting root', () => {
    const { chords } = parseProgression('B5 C5 B5 A5 G5 E5');
    const [best] = detectKey(chords);
    expect(best.key.id).toBe('B');
    expect(best.mode).toBe('phrygian');
    const { rows, observations } = analyse(chords, best.key, best.mode);
    expect(rows.map((r) => r.numeral)).toEqual(['i', '♭II', 'i', '♭vii', '♭VI', 'iv']);
    expect(observations[0].semi).toBe(1);
  });

  it('prefers Aeolian for a plain epic progression', () => {
    const { chords } = parseProgression('Em C D Em');
    const [best] = detectKey(chords);
    expect(best.key.id).toBe('E');
    expect(best.mode).toBe('aeolian');
  });

  it('detects harmonic minor from a major V', () => {
    const { chords } = parseProgression('Am Dm E Am');
    const [best] = detectKey(chords);
    expect(best.key.id).toBe('A');
    expect(best.mode).toBe('harmonic');
  });
});

describe('slash chords', () => {
  it('keeps the quality of the chord above the slash', () => {
    const { chords } = parseProgression('C/G F/A Am/C');
    expect(chords.map((c) => c.quality)).toEqual(['major', 'major', 'minor']);
    expect(chords.map((c) => c.rootPc)).toEqual([0, 5, 9]);
    expect(chords[0].pcs.sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });
});
