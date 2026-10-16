import type { Attempt } from './store';
import { itemStats } from './store';
import { MASTERY } from './curriculum';

export interface PickContext {
  pool: number[];
  fresh: number[];
  attempts: Record<number, Attempt[]>;
  /** Items to revisit soon, e.g. both sides of a recent confusion. */
  focus: number[];
  recent: number[];
  random?: () => number;
}

/**
 * Weight each item by how weak it is: low accuracy, slow answers, few
 * attempts, newly introduced, or recently confused. Never pick the same item
 * three times running.
 */
export const itemWeights = ({ pool, fresh, attempts, focus, recent }: PickContext) =>
  pool.map((item) => {
    const st = itemStats(attempts[item]);
    let w = 1;
    w += st.n ? 3 * (1 - st.accuracy) : 1.5;
    if (st.n && st.medianMs > MASTERY.medianMs) w += 1;
    if (st.n < 5) w += 1;
    if (fresh.includes(item) && !st.mastered) w += 2;
    if (focus.includes(item)) w += 3;
    if (st.mastered) w *= 0.6;
    const last2 = recent.slice(-2);
    if (last2.length === 2 && last2.every((r) => r === item)) w = 0;
    return { item, w };
  });

export const pickItem = (ctx: PickContext): number => {
  const rnd = ctx.random ?? Math.random;
  const ws = itemWeights(ctx);
  const total = ws.reduce((a, b) => a + b.w, 0);
  if (total <= 0) return ctx.pool[Math.floor(rnd() * ctx.pool.length)];
  let r = rnd() * total;
  for (const { item, w } of ws) {
    r -= w;
    if (r <= 0) return item;
  }
  return ws[ws.length - 1].item;
};

/** Items to give listening exposure to: the weakest first. */
export const weakest = (pool: number[], attempts: Record<number, Attempt[]>, count: number): number[] => {
  const scored = pool.map((item) => {
    const st = itemStats(attempts[item]);
    return { item, score: st.n ? st.accuracy - (st.medianMs > MASTERY.medianMs ? 0.1 : 0) : 0.4 };
  });
  scored.sort((a, b) => a.score - b.score);
  const out = scored.slice(0, count).map((s) => s.item);
  while (out.length < count && pool.length) out.push(pool[out.length % pool.length]);
  return out;
};
