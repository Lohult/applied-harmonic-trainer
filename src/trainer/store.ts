// Progress and settings persisted in localStorage. Reads and writes are
// wrapped so a blocked or full storage never breaks the app.

import { useSyncExternalStore } from 'react';
import type { ModeId } from '../theory/core';
import type { Timbre } from '../audio/engine';
import { type ExerciseId, MASTERY, stagesFor } from './curriculum';
import type { ContextKind } from '../audio/phrases';

export interface Attempt {
  ok: boolean;
  ms: number;
  at: number;
}

export interface Settings {
  keyId: string;
  tuningId: string;
  mode: ModeId;
  labels: 'degree' | 'note';
  timbre: Timbre | 'random';
  context: ContextKind;
  rotateKey: boolean;
  listenBlocks: boolean;
  autoResolve: boolean;
  singFirst: boolean;
  volume: number;
}

export interface SavedSong {
  id: string;
  name: string;
  text: string;
  keyId: string;
  mode: ModeId;
}

export interface StoreState {
  version: 1;
  attempts: Record<ExerciseId, Record<number, Attempt[]>>;
  confusions: Record<ExerciseId, Record<string, number>>;
  stage: Record<ExerciseId, number>;
  unlocked: Record<ExerciseId, number>;
  practice: Record<string, number>;
  songs: SavedSong[];
  settings: Settings;
}

const KEY = 'harmonic-trainer:v1';

const DEFAULTS: StoreState = {
  version: 1,
  attempts: { degree: {}, movement: {} },
  confusions: { degree: {}, movement: {} },
  stage: { degree: 0, movement: 0 },
  unlocked: { degree: 0, movement: 0 },
  practice: {},
  songs: [],
  settings: {
    keyId: 'B',
    tuningId: 'standard',
    mode: 'aeolian',
    labels: 'degree',
    timbre: 'clean',
    context: 'cadence',
    rotateKey: true,
    listenBlocks: true,
    autoResolve: true,
    singFirst: false,
    volume: 0.8,
  },
};

const load = (): StoreState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    return {
      ...DEFAULTS,
      ...parsed,
      attempts: { ...DEFAULTS.attempts, ...parsed.attempts },
      confusions: { ...DEFAULTS.confusions, ...parsed.confusions },
      stage: { ...DEFAULTS.stage, ...parsed.stage },
      unlocked: { ...DEFAULTS.unlocked, ...parsed.unlocked },
      settings: { ...DEFAULTS.settings, ...parsed.settings },
    };
  } catch {
    return DEFAULTS;
  }
};

let state: StoreState = typeof window === 'undefined' ? DEFAULTS : load();
const listeners = new Set<() => void>();

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: keep working in memory */
  }
};

export const getState = () => state;

export const setState = (fn: (s: StoreState) => StoreState) => {
  state = fn(state);
  save();
  for (const l of listeners) l();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useStore<T>(select: (s: StoreState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(DEFAULTS));
}

export const updateSettings = (patch: Partial<Settings>) =>
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

// ---- stats --------------------------------------------------------------

export const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface ItemStats {
  n: number;
  accuracy: number;
  medianMs: number;
  mastered: boolean;
}

export const itemStats = (attempts: Attempt[] | undefined): ItemStats => {
  const recent = (attempts ?? []).slice(-MASTERY.window);
  const n = recent.length;
  const accuracy = n ? recent.filter((a) => a.ok).length / n : 0;
  const medianMs = median(recent.filter((a) => a.ok).map((a) => a.ms));
  const mastered = n >= MASTERY.minAttempts && accuracy >= MASTERY.accuracy && medianMs > 0 && medianMs < MASTERY.medianMs;
  return { n, accuracy, medianMs, mastered };
};

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Record an answer. Returns the index of a newly unlocked stage, if this
 * answer completed the current one.
 */
export const recordAttempt = (
  ex: ExerciseId,
  target: number,
  answer: number,
  ms: number,
  practiceSeconds: number,
): number | null => {
  let unlockedNow: number | null = null;
  setState((s) => {
    const ok = target === answer;
    const list = [...(s.attempts[ex][target] ?? []), { ok, ms, at: Date.now() }].slice(-30);
    const attempts = { ...s.attempts, [ex]: { ...s.attempts[ex], [target]: list } };
    const confusions = { ...s.confusions };
    if (!ok) {
      const k = `${target}>${answer}`;
      confusions[ex] = { ...confusions[ex], [k]: (confusions[ex][k] ?? 0) + 1 };
    }
    const day = todayKey();
    const practice = { ...s.practice, [day]: (s.practice[day] ?? 0) + practiceSeconds };
    const stages = stagesFor(ex);
    let unlocked = { ...s.unlocked };
    let stage = { ...s.stage };
    const cur = s.stage[ex];
    if (cur === s.unlocked[ex] && cur < stages.length - 1) {
      const done = stages[cur].pool.every((it) => itemStats(attempts[ex][it]).mastered);
      if (done) {
        unlocked = { ...unlocked, [ex]: cur + 1 };
        stage = { ...stage, [ex]: cur + 1 };
        unlockedNow = cur + 1;
      }
    }
    return { ...s, attempts, confusions, practice, unlocked, stage };
  });
  return unlockedNow;
};

export const setStage = (ex: ExerciseId, idx: number) =>
  setState((s) => ({ ...s, stage: { ...s.stage, [ex]: idx }, unlocked: { ...s.unlocked, [ex]: Math.max(s.unlocked[ex], idx) } }));

export const resetProgress = () =>
  setState((s) => ({ ...DEFAULTS, settings: s.settings, songs: s.songs }));

export const saveSong = (song: SavedSong) =>
  setState((s) => ({ ...s, songs: [...s.songs.filter((x) => x.id !== song.id), song] }));

export const deleteSong = (id: string) => setState((s) => ({ ...s, songs: s.songs.filter((x) => x.id !== id) }));
