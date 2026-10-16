import { describe, expect, it } from 'vitest';
import { itemWeights, pickItem, weakest } from './picker';
import { itemStats } from './store';
import { DEGREE_STAGES } from './curriculum';

const att = (ok: boolean, ms = 1500) => ({ ok, ms, at: 0 });

describe('mastery', () => {
  it('needs accuracy, speed and enough attempts', () => {
    expect(itemStats(Array(10).fill(att(true))).mastered).toBe(true);
    expect(itemStats(Array(5).fill(att(true))).mastered).toBe(false);
    expect(itemStats(Array(10).fill(att(true, 3200))).mastered).toBe(false);
    expect(itemStats([...Array(8).fill(att(true)), att(false), att(false)]).mastered).toBe(false);
  });
});

describe('curriculum', () => {
  it('ends with all twelve degrees', () => {
    expect(DEGREE_STAGES[0].pool).toEqual([0, 3, 7]);
    expect(DEGREE_STAGES[DEGREE_STAGES.length - 1].pool).toHaveLength(12);
  });
});

describe('picker', () => {
  it('favours weak and focused items', () => {
    const ws = itemWeights({
      pool: [0, 3, 7],
      fresh: [],
      attempts: { 0: Array(10).fill(att(true)), 3: Array(10).fill(att(false)) },
      focus: [7],
      recent: [],
    });
    const w = Object.fromEntries(ws.map((x) => [x.item, x.w]));
    expect(w[3]).toBeGreaterThan(w[0]);
    expect(w[7]).toBeGreaterThan(w[0]);
  });

  it('never picks the same item three times running', () => {
    for (let i = 0; i < 50; i++) {
      const pick = pickItem({ pool: [0, 3], fresh: [], attempts: {}, focus: [0], recent: [0, 0] });
      expect(pick).toBe(3);
    }
  });

  it('lists the weakest items for listening blocks', () => {
    const out = weakest([0, 3, 7], { 0: Array(10).fill(att(true)), 3: Array(10).fill(att(false)), 7: Array(10).fill(att(true)) }, 2);
    expect(out[0]).toBe(3);
  });
});
