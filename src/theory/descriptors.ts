import type { Semi } from './core';

export interface DegreeVibe {
  title: string;
  vibe: string;
  listenFor: string;
}

/** Plain-English character of each degree heard against a minor-ish tonic. */
export const DEGREE_VIBES: Record<Semi, DegreeVibe> = {
  0: {
    title: 'Home',
    vibe: 'Total rest. Every other degree is measured by how much it wants to get back here.',
    listenFor: 'No pull at all. The note simply sits on the drone.',
  },
  1: {
    title: 'Phrygian tension, the metal riff engine',
    vibe: 'A half step above home, grinding against the root. Dark and menacing, with a Spanish or Middle Eastern edge.',
    listenFor: 'Almost on the root but sour, and it wants to collapse straight down.',
  },
  2: {
    title: 'Passing step',
    vibe: 'Mild and open, neither happy nor sad. It mostly wants to step down to the root.',
    listenFor: 'A gentle lean down, with no darkness.',
  },
  3: {
    title: 'The minor colour',
    vibe: 'Sad, serious, introspective. This is the note that makes a chord or key minor.',
    listenFor: 'Stable-ish but sombre. It could almost rest here.',
  },
  4: {
    title: 'The major colour',
    vibe: 'Bright and open. In a minor context it jumps out as a Picardy-third or Phrygian-dominant flash.',
    listenFor: 'Unexpected brightness, stable but foreign against a minor drone.',
  },
  5: {
    title: 'Suspended pull',
    vibe: 'Strong and hymn-like, leaning down onto ♭3 or 3. It is the root of iv.',
    listenFor: 'An open, unresolved lift, like a sus4 that wants to drop.',
  },
  6: {
    title: 'The devil in music',
    vibe: 'Maximally unstable, splitting the octave in half. Doom, sirens, and Black Sabbath.',
    listenFor: 'Pure unease, with no clear direction. It could go either way.',
  },
  7: {
    title: 'Power and stability',
    vibe: 'The backbone of every power chord. Almost as stable as the root, just elevated.',
    listenFor: 'Consonant and hollow. Nothing to resolve, but not quite home.',
  },
  8: {
    title: 'The Aeolian sigh',
    vibe: 'Mournful weight hanging a half step above the 5th. It is the root of the epic ♭VI chord.',
    listenFor: 'A heavy, dark lean, like it wants to sink down to 5.',
  },
  9: {
    title: 'Dorian brightness',
    vibe: 'A raised, hopeful 6th inside a minor key. It sounds cool, jazzy or funky rather than tragic.',
    listenFor: 'Sweet and slightly surprising in minor, brighter than you expect.',
  },
  10: {
    title: 'Rock-minor pull',
    vibe: 'The modal 7th, with no leading tone. It is the root of ♭VII, the classic rock and metal approach chord.',
    listenFor: 'Lifts toward the root but relaxed, without urgency.',
  },
  11: {
    title: 'Leading tone',
    vibe: 'A half step below the octave, desperate to resolve up. Harmonic-minor and neoclassical drama.',
    listenFor: 'Intense upward tension. It almost hurts to leave it unresolved.',
  },
};

/** Short guidance for a pair of commonly confused degrees. */
export const confusionTip = (a: Semi, b: Semi): string => {
  const key = [a, b].sort((x, y) => x - y).join('-');
  const tips: Record<string, string> = {
    '7-8': '♭6 leans down onto 5, while 5 feels at rest.',
    '5-7': '4 wants to fall to ♭3, while 5 does not.',
    '8-10': '♭6 sinks, ♭7 lifts toward the root.',
    '0-3': '♭3 is the sad colour, not home.',
    '0-1': '♭2 grinds against the root; 1 is calm.',
    '0-11': '7 strains upward; the root is resolved.',
    '9-10': '6 is sweet, ♭7 is bluesy.',
    '8-9': '♭6 is mournful, 6 is hopeful.',
    '3-4': '♭3 is sad, 3 is bright.',
    '10-11': '♭7 is relaxed, 7 is urgent.',
    '2-3': '2 is neutral, ♭3 carries the minor mood.',
    '1-2': '♭2 is dark and tense, 2 is a gentle step.',
    '6-7': '♭5 is unsettled, 5 is solid.',
    '5-6': '4 is open, ♭5 is uneasy.',
  };
  return tips[key] ?? 'Sing each one back to the root and compare which way it pulls.';
};
