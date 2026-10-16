import { Chord, Note } from 'tonal';
import { characterNotes, DEGREES, KEYS, type KeyDef, MODES, type ModeId, mod12, type Semi } from './core';
import { type Quality, romanNumeral } from './harmony';
import { DEGREE_VIBES } from './descriptors';

export interface ParsedChord {
  input: string;
  symbol: string;
  rootPc: number;
  quality: Quality;
  /** Absolute pitch classes of the chord tones. */
  pcs: number[];
}

export interface ParseResult {
  chords: ParsedChord[];
  errors: string[];
}

const normalise = (tok: string) => tok.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/°/g, 'dim');

const qualityOf = (intervals: string[]): Quality => {
  const has = (i: string) => intervals.includes(i);
  if (has('3m') && has('5d')) return 'dim';
  if (has('3M') && has('5A')) return 'aug';
  if (has('3m')) return 'minor';
  if (has('3M')) return 'major';
  return 'power';
};

/** Parse a space- or bar-separated list of chord symbols or bare roots. */
export const parseProgression = (text: string): ParseResult => {
  const chords: ParsedChord[] = [];
  const errors: string[] = [];
  const tokens = text.split(/[\s|,]+/).filter(Boolean);
  for (const raw of tokens) {
    let tok = normalise(raw);
    // A lone lowercase letter ("e", "f#") is a bare root of unknown quality;
    // an uppercase one ("E") is a major triad, as in any chord chart.
    const bare = /^[a-g](#|b)?$/.test(tok);
    tok = tok.charAt(0).toUpperCase() + tok.slice(1);
    if (bare) {
      const pc = Note.chroma(tok);
      chords.push({ input: raw, symbol: raw, rootPc: pc, quality: 'power', pcs: [pc] });
      continue;
    }
    const c = Chord.get(tok);
    if (c.empty || !c.tonic) {
      errors.push(raw);
      continue;
    }
    // For slash chords tonal measures intervals from the bass, so take the
    // quality from the chord above the slash; the bass stays in `pcs`.
    const [upper] = tok.split('/');
    const quality = qualityOf(upper === tok ? c.intervals : Chord.get(upper).intervals);
    const pcs = Array.from(new Set(c.notes.map((n) => Note.chroma(n))));
    chords.push({ input: raw, symbol: raw, rootPc: Note.chroma(c.tonic), quality, pcs });
  }
  return { chords, errors };
};

export interface KeyCandidate {
  key: KeyDef;
  mode: ModeId;
  score: number;
  outOfScale: number;
}

const DETECT_MODES: ModeId[] = ['aeolian', 'phrygian', 'dorian', 'harmonic', 'phrygdom', 'ionian', 'mixolydian', 'lydian', 'locrian'];

/** Prefer the more common reading when two candidates fit equally well. */
const MODE_PRIOR: Record<ModeId, number> = {
  aeolian: 0.3, ionian: 0.3, phrygian: 0.2, dorian: 0.2, mixolydian: 0.2, harmonic: 0.15, phrygdom: 0.1, lydian: 0.1, locrian: 0,
};

/**
 * Rank (tonic, mode) readings of a progression. Fit is how many chord tones the
 * scale explains; the tonic is weighted by where its chord falls (first, last)
 * and how often it recurs, which is how a listener hears "home".
 */
export const detectKey = (chords: ParsedChord[]): KeyCandidate[] => {
  if (chords.length === 0) return [];
  const out: KeyCandidate[] = [];
  const totalTones = chords.reduce((n, c) => n + c.pcs.length, 0);
  for (const key of KEYS) {
    for (const mode of DETECT_MODES) {
      const iv = MODES[mode].intervals;
      let outside = 0;
      for (const c of chords) for (const p of c.pcs) if (!iv.includes(mod12(p - key.pc))) outside++;
      const fit = 1 - outside / totalTones;
      const rootHits = chords.filter((c) => c.rootPc === key.pc).length;
      let tonic = (rootHits / chords.length) * 2;
      if (chords[0].rootPc === key.pc) tonic += 1.2;
      if (chords[chords.length - 1].rootPc === key.pc) tonic += 0.8;
      // The tonic chord's quality should match the mode's tonic triad.
      const tonicChord = chords.find((c) => c.rootPc === key.pc);
      if (tonicChord && tonicChord.quality !== 'power') {
        const third = tonicChord.pcs.map((p) => mod12(p - key.pc));
        const modeMinor = iv.includes(3);
        if ((third.includes(3) && !modeMinor) || (third.includes(4) && modeMinor)) tonic -= 1;
      }
      const score = fit * 6 + tonic + MODE_PRIOR[mode];
      out.push({ key, mode, score, outOfScale: outside });
    }
  }
  return out.sort((a, b) => b.score - a.score);
};

export interface AnalysedChord {
  chord: ParsedChord;
  semi: Semi;
  numeral: string;
  outside: Semi[];
  character: Semi[];
}

export interface Observation {
  semi: Semi;
  title: string;
  body: string;
  emphasis: boolean;
}

export const analyse = (chords: ParsedChord[], key: KeyDef, mode: ModeId) => {
  const iv = MODES[mode].intervals;
  const chars = characterNotes(mode);
  const rows: AnalysedChord[] = chords.map((c) => {
    const semi = mod12(c.rootPc - key.pc);
    const rel = c.pcs.map((p) => mod12(p - key.pc));
    return {
      chord: c,
      semi,
      numeral: romanNumeral({ root: semi, quality: c.quality }, mode),
      outside: rel.filter((s) => !iv.includes(s)),
      character: rel.filter((s) => chars.includes(s)),
    };
  });

  const observations: Observation[] = [];
  for (const ch of chars) {
    const bars = rows.map((r, i) => (r.character.includes(ch) ? i + 1 : 0)).filter(Boolean);
    if (bars.length === 0) continue;
    observations.push({
      semi: ch,
      title: `${DEGREES[ch].label} in bar${bars.length > 1 ? 's' : ''} ${bars.join(', ')}: the ${MODES[mode].name} fingerprint`,
      body: `${DEGREE_VIBES[ch].vibe} Natural ${MODES[MODES[mode].baseline].name === 'Aeolian' ? 'minor' : 'major'} doesn't have it, so this is what sets the mode.`,
      emphasis: true,
    });
  }
  // Half-step root motion into or out of the tonic is worth calling out.
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].semi;
    const b = rows[i].semi;
    if ((a === 0 && b === 1) || (a === 1 && b === 0)) {
      observations.push({
        semi: 1,
        title: `Bars ${i}–${i + 1}: half-step grind against the root`,
        body: 'The root moves a half step, the tightest tension available. It is the core of Phrygian riffing.',
        emphasis: false,
      });
      break;
    }
  }
  const descent = rows.findIndex((r, i) => i + 1 < rows.length && r.semi === 10 && rows[i + 1].semi === 8);
  if (descent >= 0) {
    observations.push({
      semi: 10,
      title: `Bars ${descent + 1}–${descent + 2}: ${rows[descent].numeral} → ${rows[descent + 1].numeral} descent`,
      body: 'A stepwise fall through the dark side of the key, shared by Aeolian and Phrygian.',
      emphasis: false,
    });
  }
  const outsideBars = rows.map((r, i) => (r.outside.length ? i + 1 : 0)).filter(Boolean);
  if (outsideBars.length) {
    observations.push({
      semi: rows[outsideBars[0] - 1].outside[0],
      title: `Borrowed notes in bar${outsideBars.length > 1 ? 's' : ''} ${outsideBars.join(', ')}`,
      body: 'Some chord tones fall outside this mode. That is either a borrowed chord or a hint that a different mode fits better.',
      emphasis: false,
    });
  }
  return { rows, observations };
};
