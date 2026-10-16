import type { Semi } from '../theory/core';

export type ExerciseId = 'degree' | 'movement';

export interface Stage {
  title: string;
  /** Items available at this stage (scale degrees, or chord roots for movement). */
  pool: Semi[];
  /** Items introduced at this stage, drilled harder at first. */
  fresh: Semi[];
}

const build = (steps: { title: string; add: Semi[] }[]): Stage[] => {
  const out: Stage[] = [];
  let pool: Semi[] = [];
  for (const s of steps) {
    pool = [...pool, ...s.add];
    out.push({ title: s.title, pool: [...pool].sort((a, b) => a - b), fresh: s.add });
  }
  return out;
};

/** Minor-first path through all twelve degrees. */
export const DEGREE_STAGES = build([
  { title: 'Minor core', add: [0, 3, 7] },
  { title: 'Rock minor', add: [5, 10] },
  { title: 'Natural minor', add: [8, 2] },
  { title: 'Modal colours', add: [1, 9] },
  { title: 'Leading tones', add: [11, 4] },
  { title: 'All twelve', add: [6] },
]);

/** Root motion of power chords away from i. */
export const MOVEMENT_STAGES = build([
  { title: 'Epic minor', add: [0, 8, 10] },
  { title: 'Subdominant & dominant', add: [5, 7] },
  { title: 'Relative major & Phrygian', add: [3, 1] },
  { title: 'Everything', add: [2, 9, 6, 4, 11] },
]);

export const stagesFor = (ex: ExerciseId) => (ex === 'degree' ? DEGREE_STAGES : MOVEMENT_STAGES);

export const MASTERY = {
  window: 20,
  minAttempts: 8,
  accuracy: 0.9,
  medianMs: 2500,
};

export const QUIZ_BLOCK = 10;
export const LISTEN_BLOCK = 4;
export const KEY_ROTATE_EVERY = 8;
