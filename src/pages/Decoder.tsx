import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Repeat, Square, Trash2 } from 'lucide-react';
import { Fretboard } from '../components/Fretboard';
import { DegreeChip, Eyebrow, GhostButton, Panel, PrimaryButton, Segmented } from '../components/ui';
import { characterNotes, DEGREES, keyById, MODES, type ModeId, mod12, type Semi, spell } from '../theory/core';
import { chordTones, diatonicQuality, romanNumeral } from '../theory/harmony';
import { PRESETS, type Preset, type ProgressionChord } from '../theory/presets';
import { analyse, parseProgression } from '../theory/analyze';
import { engine, type Timbre } from '../audio/engine';
import { playChord, tonicMidiFor } from '../audio/phrases';
import { deleteSong, type SavedSong, useStore } from '../trainer/store';

interface Item extends Preset {
  keyId: string | null; // null = follow the top-bar key
  saved?: boolean;
}

const fromSong = (song: SavedSong): Item | null => {
  const key = keyById(song.keyId);
  const { chords } = parseProgression(song.text);
  if (!chords.length) return null;
  const { rows, observations } = analyse(chords, key, song.mode);
  const pchords: ProgressionChord[] = rows.map((r) => ({
    root: r.semi,
    quality: 'power',
    triad: r.chord.quality === 'power' ? diatonicQuality(song.mode, r.semi) ?? 'major' : r.chord.quality,
  }));
  const chars = characterNotes(song.mode);
  return {
    id: song.id,
    title: song.name,
    mode: song.mode,
    chords: pchords,
    why: observations[0] ? `${observations[0].title}. ${observations[0].body}` : `A ${MODES[song.mode].name} progression with no borrowed notes.`,
    think: observations.slice(1).map((o) => o.title).join(' · ') || 'Saved from Analyze Your Song.',
    character: chars.filter((c) => rows.some((r) => r.character.includes(c))),
    characterText: chars.length ? `${MODES[song.mode].name} colour: ${chars.map((c) => DEGREES[c].label).join(' and ')}.` : 'Measured against the natural scale, nothing stands out.',
    keyId: song.keyId,
    saved: true,
  };
};

const QUIZ_ROOTS: Semi[] = [0, 1, 2, 3, 5, 7, 8, 9, 10];

export function Decoder() {
  const settings = useStore((s) => s.settings);
  const songs = useStore((s) => s.songs);
  const items = useMemo<Item[]>(
    () => [...PRESETS.map((p) => ({ ...p, keyId: null })), ...songs.map(fromSong).filter((x): x is Item => x !== null)],
    [songs],
  );
  const [itemId, setItemId] = useState(PRESETS[0].id);
  const item = items.find((i) => i.id === itemId) ?? items[0];
  const keyId = item.keyId ?? settings.keyId;
  const key = keyById(keyId);
  const mode: ModeId = item.mode;

  const [active, setActive] = useState(0);
  const [voicing, setVoicing] = useState<'power' | 'triad'>('power');
  const [quiz, setQuiz] = useState(false);
  const [guesses, setGuesses] = useState<Record<number, Semi>>({});
  const [bpm, setBpm] = useState(140);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  useEffect(() => {
    setActive(0);
    setGuesses({});
    engine.stop();
    setPlaying(false);
  }, [itemId]);
  useEffect(() => () => engine.stop(), []);

  const timbre: Timbre = settings.timbre === 'random' ? 'overdrive' : settings.timbre;
  const shapeOf = (c: ProgressionChord) => ({ root: c.root, quality: voicing === 'power' ? ('power' as const) : c.triad });

  const playFrom = () => {
    const take = engine.take();
    const tonic = tonicMidiFor(key.pc);
    const dur = (60 / bpm) * 2;
    setPlaying(true);
    const schedule = (offset: number) => {
      item.chords.forEach((c, i) => {
        playChord(take, shapeOf(c), tonic, offset + i * dur, dur, timbre);
        take.at(offset + i * dur, () => setActive(i));
      });
      const end = offset + item.chords.length * dur;
      take.at(end - 0.05, () => {
        if (loopRef.current && !take.isStopped) schedule(end);
        else setPlaying(false);
      });
    };
    schedule(0);
  };

  const playOne = (i: number) => {
    setActive(i);
    const take = engine.take();
    setPlaying(false);
    playChord(take, shapeOf(item.chords[i]), tonicMidiFor(key.pc), 0, 1.4, timbre);
  };

  const stop = () => {
    engine.stop();
    setPlaying(false);
  };

  const hidden = (i: number) => quiz && guesses[i] === undefined;
  const allGuessed = item.chords.every((_, i) => guesses[i] !== undefined);
  const ac = item.chords[active];
  const activeShape = shapeOf(ac);
  const numeral = (c: ProgressionChord) => romanNumeral(voicing === 'power' ? { root: c.root, quality: 'power' } : { root: c.root, quality: c.triad }, mode);
  const chordName = (c: ProgressionChord) => {
    const root = spell(key, c.root);
    if (voicing === 'power') return `${root}5`;
    return root + (c.triad === 'minor' ? 'm' : c.triad === 'dim' ? '°' : c.triad === 'aug' ? '+' : '');
  };
  const correctCount = item.chords.filter((c, i) => guesses[i] === c.root).length;

  return (
    <>
      <section aria-label="Fretboard" className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-semibold">
            {hidden(active) ? `Bar ${active + 1}` : `${chordName(ac)} (${numeral(ac)})`} over {key.label} {MODES[mode].name}
          </span>
          <span className="text-muted text-[13px]">Bright dots are the chord tones. Faded dots are the rest of the scale.</span>
        </div>
        <Fretboard keyId={keyId} mode={mode} tuningId={settings.tuningId} labels={settings.labels} emphasis={hidden(active) ? [0] : chordTones(activeShape)} timbre={timbre} />
      </section>

      <div className="flex flex-wrap gap-5 items-start">
        <aside aria-label="Presets" className="flex-[1_1_280px] min-w-0 flex flex-col gap-2">
          <Eyebrow className="text-muted px-1 pb-1">Presets{item.keyId === null ? ` · in ${key.label}` : ''}</Eyebrow>
          {items.map((p) => {
            const on = p.id === item.id;
            return (
              <div key={p.id} className="flex gap-1.5 items-stretch">
                <button
                  type="button"
                  onClick={() => setItemId(p.id)}
                  aria-pressed={on}
                  className={`flex-1 flex flex-col items-start gap-1 px-3.5 py-3 min-h-14 rounded-xl text-left cursor-pointer border ${on ? 'bg-active border-gold' : 'bg-panel border-line hover:border-edge'}`}
                >
                  <span className="font-semibold text-sm">
                    {p.title}
                    {p.saved && <span className="ml-2 text-[11px] font-mono text-muted">yours · {keyById(p.keyId!).label}</span>}
                  </span>
                  <span className="font-mono text-xs text-muted">{p.chords.map((c) => romanNumeral({ root: c.root, quality: c.triad }, p.mode)).join(' – ')}</span>
                </button>
                {p.saved && (
                  <GhostButton ariaLabel={`Delete ${p.title}`} onClick={() => deleteSong(p.id)} className="!px-3">
                    <Trash2 size={14} aria-hidden="true" />
                  </GhostButton>
                )}
              </div>
            );
          })}
          <a href="#song" className="flex items-center justify-center gap-2 min-h-11 rounded-xl border border-dashed border-[#3A4456] text-ink-2 no-underline text-[13px] mt-1 hover:border-faint">
            + Analyze your own song
          </a>
        </aside>

        <section aria-label="Progression" className="flex-[999_1_640px] min-w-0 flex flex-col gap-4">
          <Panel>
            <div className="flex flex-wrap items-center gap-2.5">
              {playing ? (
                <PrimaryButton onClick={stop}>
                  <Square size={16} fill="currentColor" aria-hidden="true" /> Stop
                </PrimaryButton>
              ) : (
                <PrimaryButton onClick={playFrom}>
                  <Play size={18} fill="currentColor" aria-hidden="true" /> Play
                </PrimaryButton>
              )}
              <button
                type="button"
                aria-label="Loop"
                aria-pressed={loop}
                onClick={() => setLoop((l) => !l)}
                className={`min-h-12 min-w-12 rounded-xl border flex items-center justify-center cursor-pointer ${loop ? 'border-gold bg-gold-deep text-gold' : 'border-edge bg-raised text-ink-2'}`}
              >
                <Repeat size={18} aria-hidden="true" />
              </button>
              <label className="flex items-center gap-2 text-xs text-muted ml-1.5">
                Tempo
                <input
                  type="number"
                  min={50}
                  max={240}
                  value={bpm}
                  onChange={(e) => setBpm(Math.max(50, Math.min(240, Number(e.target.value) || 140)))}
                  className="w-16 min-h-9 bg-raised text-ink border border-edge rounded-lg px-2 font-mono font-semibold text-[13px]"
                />
                bpm
              </label>
              <div className="flex-1" />
              <Segmented
                label="Voicing"
                value={voicing}
                onChange={setVoicing}
                options={[
                  { id: 'power', label: 'Power chords' },
                  { id: 'triad', label: 'Full triads' },
                ]}
              />
              <Segmented
                label="Study or quiz"
                value={quiz ? 'quiz' : 'study'}
                onChange={(v) => {
                  setQuiz(v === 'quiz');
                  setGuesses({});
                  setActive(0);
                }}
                options={[
                  { id: 'study', label: 'Study' },
                  { id: 'quiz', label: 'Quiz me first' },
                ]}
              />
            </div>

            <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(item.chords.length, 4)}, minmax(0, 1fr))` }}>
              {item.chords.map((c, i) => {
                const isActive = i === active;
                const g = guesses[i];
                const tones = chordTones(shapeOf(c));
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => playOne(i)}
                    aria-label={`Bar ${i + 1}${hidden(i) ? '' : `: ${chordName(c)}, ${numeral(c)}`}`}
                    className={`flex flex-col items-center gap-1.5 min-h-[150px] px-2 py-3.5 rounded-xl cursor-pointer ${isActive ? 'bg-active border-2 border-gold' : 'bg-bar border border-line-soft hover:border-edge'}`}
                  >
                    <span className="font-mono text-[11px] text-muted">Bar {i + 1}</span>
                    <span className={`text-[26px] font-bold ${quiz && g !== undefined ? (g === c.root ? 'text-ok' : 'text-warn') : 'text-ink'}`}>
                      {hidden(i) ? '?' : numeral(c)}
                    </span>
                    <span className="font-mono font-semibold text-[15px]">{hidden(i) ? '?' : chordName(c)}</span>
                    {!hidden(i) && (
                      <div className="flex gap-1 flex-wrap justify-center">
                        {tones.map((s) => (
                          <DegreeChip key={s} semi={s} size="sm" />
                        ))}
                      </div>
                    )}
                    {quiz && g !== undefined && g !== c.root && <span className="text-[11px] text-warn">you said {romanNumeral({ root: g, quality: 'power' }, mode)}</span>}
                  </button>
                );
              })}
            </div>

            {quiz && !allGuessed && (
              <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-bar border border-line-soft">
                <span className="font-semibold">Bar {active + 1}: which chord is it, relative to i?</span>
                <div className="flex flex-wrap gap-2">
                  {QUIZ_ROOTS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        const g = { ...guesses, [active]: r };
                        setGuesses(g);
                        const nextIdx = item.chords.findIndex((_, i) => g[i] === undefined);
                        if (nextIdx >= 0) setActive(nextIdx);
                      }}
                      className="min-h-11 min-w-14 px-3 rounded-xl border border-edge bg-raised text-ink cursor-pointer font-bold text-[15px] hover:border-faint"
                    >
                      {romanNumeral({ root: r, quality: 'power' }, mode)}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted">Play the progression, hum the root of bar 1, and measure how far the bass moves. Most of a metal analysis is just root motion.</span>
              </div>
            )}
            {quiz && allGuessed && (
              <div role="status" className={`p-3.5 rounded-xl border ${correctCount === item.chords.length ? 'bg-ok-deep border-ok' : 'bg-warn-deep border-warn'}`}>
                <strong>
                  {correctCount}/{item.chords.length} bars right.
                </strong>{' '}
                <span className="text-ink-2 text-[13px]">Click any bar to hear it alone, or hit Play to hear the whole move again with the answers showing.</span>
              </div>
            )}
          </Panel>

          {(!quiz || allGuessed) && (
            <div className="flex flex-wrap gap-4">
              <Panel className="flex-[2_1_380px] !gap-2.5">
                <Eyebrow>Why it works</Eyebrow>
                <p className="m-0 text-base leading-relaxed">{item.why}</p>
                <span className="text-[13px] text-muted">{item.think}</span>
              </Panel>
              <Panel className="flex-[1_1_260px] !gap-3">
                <Eyebrow>Character notes</Eyebrow>
                <div className="flex gap-2 flex-wrap">
                  {item.character.length ? (
                    item.character.map((s) => <DegreeChip key={s} semi={mod12(s)} ring />)
                  ) : (
                    <span className="inline-flex items-center justify-center min-w-[34px] h-[30px] rounded-full border border-dashed border-[#3A4456] text-muted font-mono font-bold">—</span>
                  )}
                </div>
                <span className="text-[13px] leading-normal text-ink-2">{item.characterText}</span>
              </Panel>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
