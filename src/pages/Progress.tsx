import { useMemo } from 'react';
import { DegreeChip, Eyebrow, GhostButton, Panel } from '../components/ui';
import { DEGREES } from '../theory/core';
import { romanNumeral } from '../theory/harmony';
import { confusionTip } from '../theory/descriptors';
import { type ExerciseId, MASTERY, stagesFor } from '../trainer/curriculum';
import { itemStats, resetProgress, setStage, todayKey, useStore } from '../trainer/store';

const TRACKS: { ex: ExerciseId; title: string; desc: string }[] = [
  { ex: 'degree', title: 'Scale degrees', desc: 'Context → note → resolve. Starts at 1 ♭3 5 and ends with all 12.' },
  { ex: 'movement', title: 'Root movement', desc: 'Power-chord moves away from i, named as Roman numerals.' },
];

const PLANNED = [
  { title: 'Riff dictation', desc: '3–5 note riffs in the current mode, every note by degree.' },
  { title: 'Mic: sing it back', desc: 'Pitch detection checks the note you sing.' },
];

export function Progress() {
  const attempts = useStore((s) => s.attempts);
  const confusions = useStore((s) => s.confusions);
  const stage = useStore((s) => s.stage);
  const unlocked = useStore((s) => s.unlocked);
  const practice = useStore((s) => s.practice);
  const mode = useStore((s) => s.settings.mode);

  const days = useMemo(() => {
    const out: { key: string; label: string; min: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = todayKey(d);
      out.push({ key: k, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), min: Math.round((practice[k] ?? 0) / 60) });
    }
    return out;
  }, [practice]);
  const maxMin = Math.max(10, ...days.map((d) => d.min));

  const topConfusions = useMemo(
    () =>
      (['degree', 'movement'] as ExerciseId[])
        .flatMap((ex) =>
          Object.entries(confusions[ex]).map(([k, n]) => {
            const [a, b] = k.split('>').map(Number);
            return { ex, a, b, n };
          }),
        )
        .sort((x, y) => y.n - x.n)
        .slice(0, 5),
    [confusions],
  );

  // Match the Ear Trainer, which names root movements in the selected mode.
  const label = (ex: ExerciseId, s: number) => (ex === 'degree' ? DEGREES[s].label : romanNumeral({ root: s, quality: 'power' }, mode));

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2.5">
          <h2 className="m-0 text-lg">Your path</h2>
          <span className="text-muted text-[13px]">
            A stage unlocks when every item in it is at {Math.round(MASTERY.accuracy * 100)}% over your last {MASTERY.window} tries, with a median answer under{' '}
            {MASTERY.medianMs / 1000} s. Progress is saved in this browser.
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {TRACKS.map((t) => {
            const stages = stagesFor(t.ex);
            const cur = stage[t.ex];
            return (
              <div key={t.ex} className="flex flex-col gap-2 min-h-[150px] p-3.5 rounded-xl bg-active border border-gold">
                <Eyebrow className="text-gold">
                  Stage {cur + 1} of {stages.length}
                </Eyebrow>
                <strong className="text-[15px]">{t.title}</strong>
                <span className="text-xs text-muted leading-snug">{t.desc}</span>
                <label className="flex items-center gap-2 text-xs text-muted">
                  Practising
                  <select
                    value={cur}
                    onChange={(e) => setStage(t.ex, Number(e.target.value))}
                    className="flex-1 min-w-0 bg-raised text-ink border border-edge rounded-lg px-2 min-h-8 text-xs"
                  >
                    {stages.map((s, i) => (
                      <option key={s.title} value={i}>
                        {i + 1}. {s.title}
                        {i > unlocked[t.ex] ? ' (skip ahead)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-1 mt-auto" aria-hidden="true">
                  {stages.map((_, i) => (
                    <span key={i} className="flex-1 h-1.5 rounded-sm" style={{ background: i < unlocked[t.ex] ? '#F5C451' : i === unlocked[t.ex] ? '#5A4A1E' : '#1F2633' }} />
                  ))}
                </div>
              </div>
            );
          })}
          {PLANNED.map((p) => (
            <div key={p.title} className="flex flex-col gap-2 min-h-[150px] p-3.5 rounded-xl bg-bar border border-line-soft opacity-70">
              <Eyebrow className="text-faint">Planned</Eyebrow>
              <strong className="text-[15px]">{p.title}</strong>
              <span className="text-xs text-muted leading-snug">{p.desc}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap gap-5 items-start">
        <Panel className="flex-[3_1_560px]">
          <div className="flex flex-wrap justify-between gap-2.5">
            <h2 className="m-0 text-lg">Degree mastery</h2>
            <div className="flex gap-3.5 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-ok" />
                Accuracy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-warn" />
                Speed (longer = faster)
              </span>
            </div>
          </div>
          <MasteryRows ex="degree" items={DEGREES.map((d) => d.semi)} attempts={attempts.degree} label={(s) => label('degree', s)} />
          <h2 className="m-0 text-lg pt-2">Root movement mastery</h2>
          <MasteryRows ex="movement" items={stagesFor('movement').at(-1)!.pool} attempts={attempts.movement} label={(s) => label('movement', s)} />
        </Panel>

        <div className="flex-[2_1_380px] min-w-0 flex flex-col gap-5">
          <Panel>
            <h2 className="m-0 text-lg">Top confusions</h2>
            {topConfusions.length === 0 && <p className="m-0 text-muted text-[13px]">No mix-ups yet. Train a few rounds and your blind spots will show up here.</p>}
            {topConfusions.map((c) => (
              <div key={`${c.ex}${c.a}${c.b}`} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-bar border border-line-soft">
                {c.ex === 'degree' ? <DegreeChip semi={c.a} size="sm" /> : <span className="font-bold">{label(c.ex, c.a)}</span>}
                <span className="text-faint">heard as</span>
                {c.ex === 'degree' ? <DegreeChip semi={c.b} size="sm" /> : <span className="font-bold">{label(c.ex, c.b)}</span>}
                <span className="flex-1 text-xs text-muted">
                  {c.n}× · {c.ex === 'degree' ? confusionTip(c.a, c.b) : 'Root movement'}
                </span>
              </div>
            ))}
            {topConfusions.length > 0 && <span className="text-xs text-faint">The trainer automatically replays both sides of a miss in your next rounds.</span>}
          </Panel>

          <Panel>
            <div className="flex justify-between items-baseline">
              <h2 className="m-0 text-lg">Last 14 days</h2>
              <span className="font-mono text-xs text-muted">minutes per day</span>
            </div>
            <div role="img" aria-label={`Practice minutes per day: ${days.map((d) => d.min).join(', ')}`} className="grid gap-1.5 items-end h-[110px]" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
              {days.map((d) => (
                <div key={d.key} title={`${d.key}: ${d.min} min`} className="rounded-t" style={{ height: `${Math.max(3, (d.min / maxMin) * 100)}%`, background: d.min ? '#F5C451' : '#1F2633' }} />
              ))}
            </div>
            <div className="grid gap-1.5 text-center font-mono text-[10px] text-faint" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }} aria-hidden="true">
              {days.map((d) => (
                <span key={d.key}>{d.label}</span>
              ))}
            </div>
            <span className="text-xs text-muted">Short daily sessions with quiz and listen blocks alternating.</span>
          </Panel>

          <GhostButton
            onClick={() => {
              if (window.confirm('Reset all progress? Your settings and saved songs are kept.')) resetProgress();
            }}
            className="self-start text-xs !text-ink-2"
          >
            Reset progress
          </GhostButton>
        </div>
      </div>
    </>
  );
}

const MasteryRows = ({ ex, items, attempts, label }: { ex: ExerciseId; items: number[]; attempts: Record<number, { ok: boolean; ms: number; at: number }[]>; label: (s: number) => string }) => (
  <div className="flex flex-col gap-2">
    {items.map((s) => {
      const st = itemStats(attempts[s]);
      const pct = Math.round(st.accuracy * 100);
      const speed = st.n ? Math.max(8, Math.min(100, ((4000 - st.medianMs) / 3500) * 100)) : 0;
      return (
        <div key={s} className="grid grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_110px] items-center gap-3 min-h-[30px]">
          {ex === 'degree' ? (
            <span className={st.n ? '' : 'opacity-40'}>
              <DegreeChip semi={s} size="sm" />
            </span>
          ) : (
            <span className={`font-mono font-bold text-xs text-center ${st.n ? '' : 'opacity-40'}`}>{label(s)}</span>
          )}
          <div className="h-2.5 rounded bg-active overflow-hidden">
            <div className="h-full rounded bg-ok" style={{ width: `${st.n ? pct : 0}%` }} />
          </div>
          <div className="h-2.5 rounded bg-active overflow-hidden">
            <div className="h-full rounded bg-warn" style={{ width: `${speed}%` }} />
          </div>
          <span className={`font-mono text-xs text-right ${!st.n ? 'text-faint' : st.mastered ? 'text-ok' : 'text-ink-2'}`}>
            {st.n ? `${pct}% · ${st.medianMs ? `${(st.medianMs / 1000).toFixed(1)}s` : '—'}${st.mastered ? ' ✓' : ''}` : 'not tried'}
          </span>
        </div>
      );
    })}
  </div>
);
