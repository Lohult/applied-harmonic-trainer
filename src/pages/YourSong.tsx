import { useMemo, useState } from 'react';
import { Play, Save, Square } from 'lucide-react';
import { Fretboard } from '../components/Fretboard';
import { DegreeChip, Eyebrow, GhostButton, Panel, PrimaryButton } from '../components/ui';
import { DEGREES, MODES, mod12, spell } from '../theory/core';
import { analyse, detectKey, parseProgression } from '../theory/analyze';
import { engine, type Timbre } from '../audio/engine';
import { playChord, tonicMidiFor } from '../audio/phrases';
import { saveSong, useStore } from '../trainer/store';

const EXAMPLE = 'B5 C5 B5 A5 G5 E5';

export function YourSong() {
  const settings = useStore((s) => s.settings);
  const [text, setText] = useState(EXAMPLE);
  const [submitted, setSubmitted] = useState(EXAMPLE);
  const [choice, setChoice] = useState(0);
  const [activeBar, setActiveBar] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [name, setName] = useState('');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const parsed = useMemo(() => parseProgression(submitted), [submitted]);
  const candidates = useMemo(() => detectKey(parsed.chords).slice(0, 4), [parsed]);
  const pick = candidates[choice] ?? candidates[0];
  const result = useMemo(() => (pick ? analyse(parsed.chords, pick.key, pick.mode) : null), [parsed, pick]);
  const timbre: Timbre = settings.timbre === 'random' ? 'overdrive' : settings.timbre;

  const submit = () => {
    setSubmitted(text);
    setChoice(0);
    setActiveBar(null);
    setSavedMsg(null);
  };

  const play = () => {
    if (!result || !pick) return;
    const take = engine.take();
    const tonic = tonicMidiFor(pick.key.pc);
    const dur = 0.86;
    setPlaying(true);
    result.rows.forEach((r, i) => {
      const quality = r.chord.quality === 'power' ? 'power' : r.chord.quality;
      playChord(take, { root: r.semi, quality }, tonic, i * dur, dur, timbre);
      take.at(i * dur, () => setActiveBar(i));
    });
    take.at(result.rows.length * dur, () => setPlaying(false));
  };

  const stop = () => {
    engine.stop();
    setPlaying(false);
  };

  const save = () => {
    if (!pick) return;
    const songName = name.trim() || submitted;
    saveSong({ id: `song-${Date.now()}`, name: songName, text: submitted, keyId: pick.key.id, mode: pick.mode });
    setSavedMsg(`Saved “${songName}” to your presets in the Progression Decoder.`);
  };

  const best = candidates[0];
  const fitLabel = (outside: number) => (outside === 0 ? 'every note fits' : `${outside} note${outside > 1 ? 's' : ''} outside`);
  const scaleText = pick ? MODES[pick.mode].intervals.map((s) => spell(pick.key, s)).join(' ') : '';
  const active = activeBar !== null && result ? result.rows[activeBar] : null;
  const emphasis = active ? active.chord.pcs.map((p) => mod12(p - pick!.key.pc)) : null;

  return (
    <>
      <Panel>
        <label htmlFor="prog" className="font-semibold text-[15px]">
          What did you hear? Enter the chords or roots, in order.
        </label>
        <form
          className="flex flex-wrap gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            id="prog"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="flex-[1_1_420px] min-w-0 min-h-[52px] px-4 rounded-xl border border-[#3A4456] bg-ground text-ink font-mono font-semibold text-lg"
          />
          <PrimaryButton className="!min-h-[52px]" onClick={submit}>
            Analyze
          </PrimaryButton>
        </form>
        <span className="text-xs text-muted">
          Write power chords, triads or bare roots: <span className="font-mono text-ink-2">B5 · Bm · C · F♯dim · e</span>. A lone lowercase letter is a bare root and uppercase is a major chord. Separate bars with spaces or{' '}
          <span className="font-mono text-ink-2">|</span>.
        </span>
        {parsed.errors.length > 0 && (
          <span role="alert" className="text-xs text-warn">
            Couldn’t read: {parsed.errors.join(', ')}. Those bars were skipped.
          </span>
        )}
      </Panel>

      {pick && result ? (
        <>
          <div className="flex flex-wrap gap-5 items-stretch">
            <Panel className="flex-[1_1_320px]">
              <Eyebrow>{choice === 0 ? 'Best fit' : 'Your choice'}</Eyebrow>
              <div className="flex items-baseline gap-3 flex-wrap">
                <strong className="text-[28px]">
                  {pick.key.label} {MODES[pick.mode].name}
                </strong>
                <span className={`font-mono text-[13px] font-semibold ${pick.outOfScale === 0 ? 'text-ok' : 'text-warn'}`}>{fitLabel(pick.outOfScale)}</span>
              </div>
              <p className="m-0 text-ink-2 leading-relaxed">
                Scale: <span className="font-mono text-ink">{scaleText}</span>. {pick.key.label} sounds like home because
                {parsed.chords[0].rootPc === pick.key.pc ? ' the progression starts there' : ' it carries the most weight'}
                {parsed.chords.filter((c) => c.rootPc === pick.key.pc).length > 1 ? ' and keeps returning to it.' : '.'} {MODES[pick.mode].blurb}
              </p>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted">Other readings</span>
                {candidates.map((c, i) =>
                  i === choice ? null : (
                    <div key={`${c.key.id}-${c.mode}`} className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl bg-bar border border-line-soft">
                      <span>
                        {c.key.label} {MODES[c.mode].name}{' '}
                        <span className="text-muted text-xs">
                          {fitLabel(c.outOfScale)}
                          {i === 0 ? ' · best fit' : ''}
                        </span>
                      </span>
                      <GhostButton onClick={() => setChoice(i)} className="!min-h-9 !px-3 text-xs">
                        Use this
                      </GhostButton>
                    </div>
                  ),
                )}
              </div>
            </Panel>

            <Panel className="flex-[2_1_640px]">
              <div className="flex flex-wrap items-center gap-2.5">
                <Eyebrow>Breakdown</Eyebrow>
                <div className="flex-1" />
                {playing ? (
                  <GhostButton onClick={stop}>
                    <Square size={14} fill="currentColor" aria-hidden="true" /> Stop
                  </GhostButton>
                ) : (
                  <GhostButton onClick={play}>
                    <Play size={14} fill="currentColor" aria-hidden="true" /> Play it back
                  </GhostButton>
                )}
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(result.rows.length, 8)}, minmax(0, 1fr))` }}>
                {result.rows.map((r, i) => {
                  const flagged = r.character.length > 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setActiveBar(i);
                        const take = engine.take();
                        playChord(take, { root: r.semi, quality: r.chord.quality }, tonicMidiFor(pick.key.pc), 0, 1.3, timbre);
                      }}
                      className={`flex flex-col items-center gap-1.5 px-1.5 py-3 rounded-xl cursor-pointer bg-bar border ${activeBar === i ? 'border-2 border-gold' : flagged ? 'border-[#6B1F27]' : 'border-line-soft'}`}
                    >
                      <span className="font-mono font-semibold text-sm">{r.chord.symbol}</span>
                      <span className="font-bold text-[22px]">{r.numeral}</span>
                      <DegreeChip semi={r.semi} size="sm" ring={flagged || r.semi === 0} />
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2">
                {result.observations.length === 0 && <p className="m-0 text-ink-2">No modal fingerprints. Everything sits inside the plain scale.</p>}
                {result.observations.map((o, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 items-start px-3.5 py-3 rounded-xl border ${o.emphasis ? 'bg-[#220F12] border-[#6B1F27]' : 'bg-bar border-line-soft'}`}
                  >
                    <DegreeChip semi={o.semi} size="sm" ring={o.emphasis} />
                    <span className="leading-normal text-ink-2">
                      <strong className="text-ink">{o.title}.</strong> {o.body}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-line-soft">
                <label className="flex items-center gap-2 text-xs text-muted flex-[1_1_240px]">
                  Name
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Verse riff from …"
                    className="flex-1 min-w-0 min-h-10 px-3 rounded-lg border border-edge bg-raised text-ink text-[13px]"
                  />
                </label>
                <button
                  type="button"
                  onClick={save}
                  className="flex items-center gap-2 min-h-10 px-3.5 rounded-xl border border-gold bg-gold-deep text-gold font-semibold cursor-pointer"
                >
                  <Save size={14} aria-hidden="true" /> Save to my presets
                </button>
                <a href="#decoder" className="text-[13px]" onClick={save}>
                  Save and quiz me on it →
                </a>
              </div>
              {savedMsg && (
                <span role="status" className="text-xs text-ok">
                  {savedMsg}
                </span>
              )}
            </Panel>
          </div>

          <section aria-label="Fretboard" className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-semibold">
                {active ? `${active.chord.symbol} (${active.numeral}) over ` : ''}
                {pick.key.label} {MODES[pick.mode].name} on the neck
              </span>
              <span className="text-muted text-[13px]">
                {best && pick.mode !== 'aeolian' && MODES[pick.mode].baseline === 'aeolian'
                  ? `Ringed dots are the notes that make it ${MODES[pick.mode].name}. Aim for them when you write over it.`
                  : 'Click a bar to light up its chord tones.'}
              </span>
            </div>
            <Fretboard keyId={pick.key.id} mode={pick.mode} tuningId={settings.tuningId} labels={settings.labels} emphasis={emphasis} timbre={timbre} />
            {active && active.outside.length > 0 && (
              <span className="text-xs text-warn">Outside the scale in this bar: {active.outside.map((s) => DEGREES[s].label).join(', ')}</span>
            )}
          </section>
        </>
      ) : (
        <Panel>
          <p className="m-0 text-ink-2">Enter at least one chord to analyse.</p>
        </Panel>
      )}
    </>
  );
}
