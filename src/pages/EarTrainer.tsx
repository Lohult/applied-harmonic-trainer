import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ear, Headphones, Lock, Play, RotateCcw, SkipForward, Sparkles, TriangleAlert } from 'lucide-react';
import { Fretboard } from '../components/Fretboard';
import { DegreeChip, Eyebrow, GhostButton, Panel, PrimaryButton, Segmented, Toggle } from '../components/ui';
import { DEGREES, KEYS, keyById, MODES, type ModeId, mod12, type Semi, spell, TRAINER_MODES } from '../theory/core';
import { resolutionPath, romanNumeral } from '../theory/harmony';
import { confusionTip, DEGREE_VIBES } from '../theory/descriptors';
import { engine, type Take, type Timbre, TIMBRES } from '../audio/engine';
import { contextLength, playChord, playContext, playResolution, tonicMidiFor } from '../audio/phrases';
import { type ExerciseId, KEY_ROTATE_EVERY, LISTEN_BLOCK, QUIZ_BLOCK, stagesFor } from '../trainer/curriculum';
import { pickItem, weakest } from '../trainer/picker';
import { getState, itemStats, median, recordAttempt, setStage, updateSettings, useStore } from '../trainer/store';

type Phase = 'idle' | 'playing' | 'answering' | 'feedback' | 'listen';

interface Round {
  target: Semi;
  keyId: string;
  mode: ModeId;
  timbre: Timbre;
  targetMidi: number;
}

interface Result {
  answer: Semi;
  ms: number;
}

const resolveTimbre = (t: Timbre | 'random'): Timbre => (t === 'random' ? TIMBRES[Math.floor(Math.random() * TIMBRES.length)].id : t);

const ANSWER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

export function EarTrainer() {
  const settings = useStore((s) => s.settings);
  const attemptsAll = useStore((s) => s.attempts);
  const confusionsAll = useStore((s) => s.confusions);
  const stageAll = useStore((s) => s.stage);
  const unlockedAll = useStore((s) => s.unlocked);

  const [exercise, setExercise] = useState<ExerciseId>('degree');
  const stages = stagesFor(exercise);
  const stageIdx = stageAll[exercise];
  const stage = stages[stageIdx];
  const attempts = attemptsAll[exercise];

  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState<Round | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [session, setSession] = useState<{ ok: boolean; ms: number }[]>([]);
  const [quizCount, setQuizCount] = useState(0);
  const [roundCount, setRoundCount] = useState(0);
  const [listenItem, setListenItem] = useState<{ semi: Semi; i: number } | null>(null);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);

  const startedAt = useRef(0);
  const lastAnswerAt = useRef(0);
  const recent = useRef<Semi[]>([]);
  const focus = useRef<Semi[]>([]);
  const takeRef = useRef<Take | null>(null);
  const listenAbort = useRef(false);

  useEffect(() => () => engine.stop(), []);

  /** Abandon the current round. Called when the user switches exercise or stage. */
  const resetRound = () => {
    engine.stop();
    listenAbort.current = true;
    setPhase('idle');
    setRound(null);
    setResult(null);
    setListenItem(null);
    focus.current = [];
  };

  const chooseExercise = (ex: ExerciseId) => {
    if (ex === exercise) return;
    resetRound();
    setExercise(ex);
  };

  const chooseStage = (idx: number) => {
    resetRound();
    setStage(exercise, idx);
  };

  const labelFor = useCallback(
    (semi: Semi, mode: ModeId) => (exercise === 'degree' ? DEGREES[semi].label : romanNumeral({ root: semi, quality: 'power' }, mode)),
    [exercise],
  );

  /** Play the context, then the target. Calls `onTarget` when the target sounds. */
  const playRound = useCallback(
    (r: Round, onTarget?: () => void) => {
      const take = engine.take();
      takeRef.current = take;
      const tonic = tonicMidiFor(keyById(r.keyId).pc);
      const ctxLen = contextLength(r.mode, settings.context);
      const t = playContext(take, tonic, r.mode, settings.context, r.timbre, ctxLen + 2.6);
      if (exercise === 'degree') take.pluck(r.targetMidi, t, { timbre: r.timbre, dur: 2.2 });
      else playChord(take, { root: r.target, quality: 'power' }, tonic, t, 1.6, r.timbre);
      if (onTarget) take.at(t, onTarget);
      return take;
    },
    [exercise, settings.context],
  );

  const playTargetOnly = useCallback(
    (r: Round) => {
      const take = engine.take();
      takeRef.current = take;
      const tonic = tonicMidiFor(keyById(r.keyId).pc);
      take.drone(tonic - 12, 0, 3);
      if (exercise === 'degree') take.pluck(r.targetMidi, 0.5, { timbre: r.timbre, dur: 2.2 });
      else playChord(take, { root: r.target, quality: 'power' }, tonic, 0.5, 1.6, r.timbre);
    },
    [exercise],
  );

  /** After an answer: hear where the target goes (degree) or the move in context (movement). */
  const playReveal = useCallback(
    (r: Round) => {
      const take = engine.take();
      takeRef.current = take;
      const tonic = tonicMidiFor(keyById(r.keyId).pc);
      if (exercise === 'degree') {
        const path = resolutionPath(r.mode, r.target);
        take.drone(tonic - 12, 0, 1.0 + path.length * 0.42 + 1.4);
        playResolution(take, r.mode, r.targetMidi, r.target, 0.1, r.timbre);
      } else {
        take.drone(tonic - 12, 0, 4.2);
        playChord(take, { root: 0, quality: 'power' }, tonic, 0.1, 1.2, r.timbre);
        playChord(take, { root: r.target, quality: 'power' }, tonic, 1.4, 1.2, r.timbre);
        playChord(take, { root: 0, quality: 'power' }, tonic, 2.7, 1.4, r.timbre);
      }
      return take;
    },
    [exercise],
  );

  const newRound = useCallback(() => {
    setUnlockMsg(null);
    let keyId = getState().settings.keyId;
    if (settings.rotateKey && roundCount > 0 && roundCount % KEY_ROTATE_EVERY === 0) {
      const others = KEYS.filter((k) => k.id !== keyId);
      keyId = others[Math.floor(Math.random() * others.length)].id;
      updateSettings({ keyId });
    }
    const target = pickItem({ pool: stage.pool, fresh: stage.fresh, attempts, focus: focus.current, recent: recent.current });
    recent.current = [...recent.current, target].slice(-4);
    focus.current = focus.current.filter((f) => f !== target);
    const tonic = tonicMidiFor(keyById(keyId).pc);
    const octave = Math.random() < 0.5 ? 0 : 12;
    const r: Round = { target, keyId, mode: settings.mode, timbre: resolveTimbre(settings.timbre), targetMidi: tonic + target + octave };
    setRound(r);
    setResult(null);
    startedAt.current = 0;
    setPhase('playing');
    setRoundCount((n) => n + 1);
    playRound(r, () => {
      startedAt.current = performance.now();
      setPhase('answering');
    });
  }, [attempts, playRound, roundCount, settings.mode, settings.rotateKey, settings.timbre, stage]);

  // While the context plays, the take holds the timer that opens answering;
  // starting another take would cancel it and strand the round.
  const canReplay = phase === 'answering' || phase === 'feedback';

  const answer = useCallback(
    (semi: Semi) => {
      if (!round || phase !== 'answering' || !startedAt.current) return;
      const ms = Math.round(performance.now() - startedAt.current);
      const now = Date.now();
      const practice = lastAnswerAt.current ? Math.min(30, (now - lastAnswerAt.current) / 1000) : 10;
      lastAnswerAt.current = now;
      const ok = semi === round.target;
      const unlocked = recordAttempt(exercise, round.target, semi, ms, practice);
      if (!ok) focus.current = Array.from(new Set([...focus.current, round.target, semi]));
      setResult({ answer: semi, ms });
      setSession((s) => [...s, { ok, ms }]);
      setQuizCount((n) => n + 1);
      setPhase('feedback');
      if (unlocked !== null) setUnlockMsg(`Stage ${unlocked + 1} unlocked: ${stages[unlocked].title}. New: ${stages[unlocked].fresh.map((s) => labelFor(s, round.mode)).join(' ')}`);
      if (settings.autoResolve) playReveal(round);
    },
    [exercise, labelFor, phase, playReveal, round, settings.autoResolve, stages],
  );

  const runListenBlock = useCallback(async () => {
    listenAbort.current = false;
    setPhase('listen');
    const items = weakest(stage.pool, attempts, LISTEN_BLOCK);
    for (let i = 0; i < items.length; i++) {
      if (listenAbort.current) return;
      const keyId = getState().settings.keyId;
      const semi = items[i];
      const tonic = tonicMidiFor(keyById(keyId).pc);
      const r: Round = { target: semi, keyId, mode: settings.mode, timbre: resolveTimbre(settings.timbre), targetMidi: tonic + semi };
      setRound(r);
      setListenItem({ semi, i });
      const take = engine.take();
      takeRef.current = take;
      const ctxLen = contextLength(r.mode, settings.context);
      const t = playContext(take, tonic, r.mode, settings.context, r.timbre, ctxLen + 4.5);
      if (exercise === 'degree') {
        // The resolution path starts on the target itself, then walks home.
        const end = playResolution(take, r.mode, r.targetMidi, semi, t, r.timbre);
        if (!(await take.until(end + 0.3))) return;
      } else {
        playChord(take, { root: semi, quality: 'power' }, tonic, t, 1.4, r.timbre);
        playChord(take, { root: 0, quality: 'power' }, tonic, t + 1.6, 1.4, r.timbre);
        if (!(await take.until(t + 3.4))) return;
      }
    }
    if (listenAbort.current) return;
    setListenItem(null);
    setQuizCount(0);
    setPhase('idle');
  }, [attempts, exercise, settings.context, settings.mode, settings.timbre, stage.pool]);

  const next = useCallback(() => {
    if (settings.listenBlocks && quizCount >= QUIZ_BLOCK) {
      void runListenBlock();
      return;
    }
    newRound();
  }, [newRound, quizCount, runListenBlock, settings.listenBlocks]);

  const skipListen = () => {
    listenAbort.current = true;
    engine.stop();
    setListenItem(null);
    setQuizCount(0);
    setPhase('idle');
  };

  // Keyboard: Space/Enter = play or next, R = replay note, 1–=, answers in order.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (el && el.tagName === 'BUTTON') return;
        e.preventDefault();
        if (phase === 'idle' || phase === 'feedback') next();
      } else if (e.key === 'r' || e.key === 'R') {
        if (round && canReplay) playTargetOnly(round);
      } else if (phase === 'answering') {
        const idx = ANSWER_KEYS.indexOf(e.key);
        if (idx >= 0) {
          const options = stage.pool;
          if (idx < options.length) answer(options[idx]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, canReplay, next, phase, playTargetOnly, round, stage.pool]);

  // ---- derived view state --------------------------------------------------

  const key = keyById(settings.keyId);
  const viewMode = round?.mode ?? settings.mode;
  const answered = phase === 'feedback' && result && round;
  const correct = answered ? result.answer === round.target : false;

  const fbEmphasis = useMemo<Semi[]>(() => {
    if (phase === 'listen' && round) return exercise === 'degree' ? [0, round.target] : [round.target, mod12(round.target + 7)];
    if (!answered || !round) return [0];
    return exercise === 'degree' ? [0, round.target] : [round.target, mod12(round.target + 7)];
  }, [answered, exercise, phase, round]);
  const fbTarget = (answered || phase === 'listen') && round ? round.target : null;

  const blockStats = useMemo(() => {
    const last = session.slice(-QUIZ_BLOCK);
    let streak = 0;
    for (let i = session.length - 1; i >= 0 && session[i].ok; i--) streak++;
    return {
      acc: last.length ? Math.round((last.filter((x) => x.ok).length / last.length) * 100) : null,
      med: last.length ? median(last.filter((x) => x.ok).map((x) => x.ms)) : 0,
      streak,
    };
  }, [session]);

  const topConfusion = useMemo(() => {
    const entries = Object.entries(confusionsAll[exercise])
      .map(([k, n]) => {
        const [a, b] = k.split('>').map(Number);
        return { a, b, n };
      })
      .filter((c) => stage.pool.includes(c.a) && stage.pool.includes(c.b))
      .sort((x, y) => y.n - x.n);
    return entries[0] ?? null;
  }, [confusionsAll, exercise, stage.pool]);

  const blocks = useMemo(() => {
    const cur = phase === 'listen' ? 'listen' : 'quiz';
    return [
      { kind: 'Quiz', state: cur === 'quiz' ? 'now' : 'done' },
      { kind: 'Listen', state: !settings.listenBlocks ? 'off' : cur === 'listen' ? 'now' : 'next' },
    ];
  }, [phase, settings.listenBlocks]);

  const promptText = (() => {
    if (phase === 'idle') return exercise === 'degree' ? 'Press play to hear the key, then a mystery note' : 'Press play to hear the key, then a mystery chord';
    if (phase === 'playing') return 'Listen…';
    if (phase === 'answering') return exercise === 'degree' ? 'Which scale degree did you hear?' : 'Which chord did it move to?';
    if (phase === 'listen') return 'Listen block: just listen, no answering';
    if (answered) return correct ? `Correct: ${labelFor(round.target, round.mode)}` : `Not quite. It was ${labelFor(round.target, round.mode)}`;
    return '';
  })();

  const modeOptions = TRAINER_MODES.filter((m) => m !== viewMode);

  return (
    <>
      <section aria-label="Fretboard" className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <span className="font-semibold">
            {key.label} {MODES[viewMode].name}
          </span>
          <span className="text-muted text-[13px]">
            {answered || phase === 'listen'
              ? exercise === 'degree'
                ? `Every place to play the ${DEGREES[round!.target].label} (${spell(key, round!.target)}), with the root ringed in gold`
                : `The ${labelFor(round!.target, round!.mode)} power chord's notes, everywhere on the neck`
              : 'Mystery note hidden until you answer · ringed dots = character notes vs. natural minor'}
          </span>
          <div className="flex-1" />
          <Segmented
            label="Dot labels"
            value={settings.labels}
            onChange={(v) => updateSettings({ labels: v })}
            options={[
              { id: 'degree', label: 'Degrees' },
              { id: 'note', label: 'Notes' },
            ]}
          />
        </div>
        <Fretboard keyId={settings.keyId} mode={viewMode} tuningId={settings.tuningId} labels={settings.labels} emphasis={fbEmphasis} target={fbTarget} timbre={round?.timbre ?? 'clean'} />
      </section>

      <div className="flex flex-wrap gap-5 items-start">
        <Panel className="flex-[999_1_560px]">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
            <Segmented
              label="Exercise"
              value={exercise}
              onChange={chooseExercise}
              options={[
                { id: 'degree', label: 'Scale degrees' },
                { id: 'movement', label: 'Root movement' },
              ]}
            />
            <label className="flex items-center gap-2 text-xs text-muted">
              Stage
              <select
                value={stageIdx}
                onChange={(e) => chooseStage(Number(e.target.value))}
                className="bg-raised text-ink border border-edge rounded-lg px-2.5 min-h-9 text-[13px]"
              >
                {stages.map((s, i) => (
                  <option key={s.title} value={i}>
                    {i + 1}. {s.title}
                    {i > unlockedAll[exercise] ? ' (skip ahead)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex-1" />
            <div aria-label="Session blocks" className="flex items-center gap-1">
              {blocks.map((b) => (
                <span
                  key={b.kind}
                  className={`px-2 py-[3px] rounded-md font-mono text-[11px] font-semibold ${
                    b.state === 'now' ? 'bg-gold text-ground font-bold' : b.state === 'off' ? 'text-faint line-through' : 'border border-dashed border-[#3A4456] text-muted'
                  }`}
                >
                  {b.kind}
                </span>
              ))}
              <span className="font-mono text-[11px] text-muted ml-1">
                {phase === 'listen' && listenItem ? `${listenItem.i + 1}/${LISTEN_BLOCK}` : `${Math.min(quizCount, QUIZ_BLOCK)}/${QUIZ_BLOCK}`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            {phase === 'listen' ? (
              <GhostButton onClick={skipListen}>
                <SkipForward size={16} aria-hidden="true" /> Skip listening
              </GhostButton>
            ) : (
              <PrimaryButton onClick={phase === 'idle' || phase === 'feedback' ? next : () => round && playRound(round)} disabled={phase === 'playing'}>
                <Play size={18} fill="currentColor" aria-hidden="true" />
                {phase === 'idle' ? 'Play' : phase === 'feedback' ? 'Next' : 'Replay all'}
              </PrimaryButton>
            )}
            <GhostButton onClick={() => round && playTargetOnly(round)} disabled={!round || !canReplay}>
              <RotateCcw size={16} aria-hidden="true" /> {exercise === 'degree' ? 'Note again' : 'Chord again'}
            </GhostButton>
            <GhostButton
              onClick={() => {
                if (!round) return;
                const take = engine.take();
                take.drone(tonicMidiFor(keyById(round.keyId).pc) - 12, 0, 4);
              }}
              disabled={!round || !canReplay}
            >
              <Headphones size={16} aria-hidden="true" /> Drone only
            </GhostButton>
            {answered && (
              <GhostButton onClick={() => playReveal(round)}>
                <Ear size={16} aria-hidden="true" /> {exercise === 'degree' ? 'Resolution' : 'Hear the move'}
              </GhostButton>
            )}
            <div className="flex-1" />
            <Segmented
              label="Context"
              value={settings.context}
              onChange={(v) => updateSettings({ context: v })}
              options={[
                { id: 'cadence', label: 'Cadence + drone' },
                { id: 'drone', label: 'Drone only' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="m-0 text-xl font-semibold" aria-live="polite">
                {promptText}
              </h2>
              <span className="font-mono text-xs text-muted">
                {answered ? `answered in ${(result.ms / 1000).toFixed(1)} s` : settings.singFirst && phase === 'answering' ? 'Sing it back to the root first' : 'Answer time is tracked'}
              </span>
            </div>
            {phase === 'listen' && listenItem && round ? (
              <div className="flex items-center gap-4 p-4 rounded-xl border border-line-soft bg-bar">
                {exercise === 'degree' ? <DegreeChip semi={listenItem.semi} size="lg" ring /> : <span className="text-3xl font-bold">{labelFor(listenItem.semi, round.mode)}</span>}
                <div className="flex flex-col gap-1">
                  <strong>{exercise === 'degree' ? DEGREES[listenItem.semi].name : `${spell(key, listenItem.semi)}5 → ${key.label}5`}</strong>
                  <span className="text-ink-2 text-[13px]">{exercise === 'degree' ? DEGREE_VIBES[listenItem.semi].listenFor : 'Hear the move away from home and back.'}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {(exercise === 'degree' ? DEGREES.map((d) => d.semi) : stagesFor('movement')[stagesFor('movement').length - 1].pool).map((semi) => {
                  const locked = !stage.pool.includes(semi);
                  const isTarget = answered && semi === round.target;
                  const isWrongPick = answered && semi === result.answer && !correct;
                  const d = DEGREES[semi];
                  return (
                    <button
                      key={semi}
                      type="button"
                      disabled={locked || phase !== 'answering'}
                      onClick={() => answer(semi)}
                      aria-label={locked ? `${labelFor(semi, viewMode)}, not in this stage` : `Answer ${labelFor(semi, viewMode)}`}
                      className={`relative min-h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 ${
                        locked ? 'border-line-soft text-[#3F4859] cursor-not-allowed' : phase === 'answering' ? 'border-edge bg-raised text-ink cursor-pointer hover:border-faint' : 'border-edge bg-raised text-ink-2'
                      } ${isWrongPick ? '!border-warn border-2 !text-warn' : ''}`}
                      style={isTarget ? { background: d.color, borderColor: d.color, color: d.ink, boxShadow: `0 0 0 2px #11151C, 0 0 0 4px ${d.color}` } : undefined}
                    >
                      <span className="font-mono font-bold text-lg">{labelFor(semi, viewMode)}</span>
                      {locked && <Lock size={12} color="#5C6577" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {unlockMsg && (
            <div role="status" className="flex items-center gap-3 p-3.5 rounded-xl bg-gold-deep border border-gold">
              <Sparkles size={18} color="#F5C451" aria-hidden="true" />
              <span className="text-sm">{unlockMsg}</span>
            </div>
          )}

          {answered && (
            <div className={`flex flex-wrap items-center gap-3 p-3.5 rounded-xl border ${correct ? 'bg-ok-deep border-ok' : 'bg-warn-deep border-warn'}`}>
              <div className="flex flex-col gap-1 flex-[1_1_300px]">
                <strong className="text-[15px]">
                  {correct
                    ? exercise === 'degree'
                      ? round.target === 0
                        ? 'Nice. That was home.'
                        : `Nice. ${resolutionPath(round.mode, round.target).map((s) => DEGREES[mod12(s)].label).join(' → ')}${settings.autoResolve ? ' is playing.' : ' is where it resolves.'}`
                      : 'Nice. i → that chord → i is playing.'
                    : `You picked ${labelFor(result.answer, round.mode)}.`}
                </strong>
                <span className="text-ink-2 text-[13px]">
                  {correct
                    ? result.ms > 2500
                      ? `It took ${(result.ms / 1000).toFixed(1)} s. Mastery needs under 2.5 s, so it stays in focus.`
                      : 'Fast and right. That one is sticking.'
                    : exercise === 'degree'
                      ? `${confusionTip(round.target, result.answer)} Both go into your next few rounds.`
                      : 'Hum the root, then measure how far the bass moved. Both chords go into your next few rounds.'}
                </span>
              </div>
              <button type="button" onClick={next} className="min-h-11 px-[18px] rounded-xl bg-ink text-ground font-bold cursor-pointer">
                Next →
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 pt-3.5 border-t border-line-soft">
            <span className="text-xs text-muted">Tone</span>
            <div className="flex flex-wrap gap-1.5">
              {[...TIMBRES, { id: 'random' as const, label: 'Mix: random' }].map((t) => {
                const on = settings.timbre === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => updateSettings({ timbre: t.id })}
                    className={`min-h-9 px-3 rounded-full border text-xs cursor-pointer ${on ? 'border-gold bg-gold-deep text-gold font-semibold' : 'border-edge bg-raised text-ink-2'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="flex-1" />
            <Toggle checked={settings.rotateKey} onChange={(v) => updateSettings({ rotateKey: v })}>
              New key every {KEY_ROTATE_EVERY} rounds
            </Toggle>
            <Toggle checked={settings.listenBlocks} onChange={(v) => updateSettings({ listenBlocks: v })}>
              Listen blocks
            </Toggle>
            <Toggle checked={settings.autoResolve} onChange={(v) => updateSettings({ autoResolve: v })}>
              Auto-play resolution
            </Toggle>
            <Toggle checked={settings.singFirst} onChange={(v) => updateSettings({ singFirst: v })}>
              Sing before answering
            </Toggle>
          </div>
          <p className="m-0 text-xs text-faint">
            Keyboard: Space = play / next · R = replay · answers {stage.pool.map((s, i) => `${ANSWER_KEYS[i]}=${labelFor(s, viewMode)}`).join(' ')}
          </p>
        </Panel>

        <aside aria-label="Descriptor" className="flex-[1_1_380px] min-w-0 flex flex-col gap-4">
          <Panel>
            <Eyebrow>Descriptor</Eyebrow>
            {(answered || phase === 'listen') && round ? (
              exercise === 'degree' ? (
                <DegreeDescriptor semi={round.target} keyId={round.keyId} mode={round.mode} />
              ) : (
                <MovementDescriptor semi={round.target} keyId={round.keyId} mode={round.mode} />
              )
            ) : (
              <p className="m-0 leading-relaxed text-ink-2">
                {exercise === 'degree'
                  ? 'Hold the root in your head, then sing the mystery note back to it. Answer when you hear which way it wants to move.'
                  : 'Listen to the bass. How far did the root move from home, and did it sound brighter (major side) or darker?'}
              </p>
            )}
          </Panel>

          <Panel>
            <div className="flex justify-between items-center">
              <Eyebrow>This block</Eyebrow>
              <span className="text-xs text-muted">
                Stage {stageIdx + 1}: {stage.title}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <Stat value={blockStats.acc === null ? '—' : `${blockStats.acc}%`} label="Accuracy" />
              <Stat value={blockStats.med ? `${(blockStats.med / 1000).toFixed(1)}s` : '—'} label="Median answer" />
              <Stat value={String(blockStats.streak)} label="Streak" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">Mastery: 90% correct and under 2.5 s unlocks the next stage</span>
              {stage.pool.map((s) => {
                const st = itemStats(attempts[s]);
                const pct = Math.round(st.accuracy * 100);
                return (
                  <div key={s} className="grid grid-cols-[48px_minmax(0,1fr)_92px] items-center gap-2.5">
                    {exercise === 'degree' ? (
                      <DegreeChip semi={s} size="sm" />
                    ) : (
                      <span className="font-mono font-bold text-xs text-center">{labelFor(s, viewMode)}</span>
                    )}
                    <div className="h-2 rounded bg-active overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${st.n ? pct : 0}%`, background: st.mastered ? '#2EC4B6' : '#5A6273' }} />
                    </div>
                    <span className={`font-mono text-xs text-right ${st.mastered ? 'text-ok' : 'text-ink-2'}`}>
                      {st.n ? `${pct}% · ${st.medianMs ? `${(st.medianMs / 1000).toFixed(1)}s` : '—'}${st.mastered ? ' ✓' : ''}` : 'new'}
                    </span>
                  </div>
                );
              })}
            </div>
            {topConfusion && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1F1A10] border border-[#4A3A14]">
                <TriangleAlert size={16} color="#F29B59" aria-hidden="true" />
                <span className="text-[13px]">
                  Most confused:{' '}
                  <strong className="font-mono">
                    {labelFor(topConfusion.a, viewMode)} ↔ {labelFor(topConfusion.b, viewMode)}
                  </strong>{' '}
                  ({topConfusion.n}×). Misses are replayed in the next rounds.
                </span>
              </div>
            )}
            {modeOptions.length > 0 && (
              <p className="m-0 text-xs text-faint">Tip: switch mode in the top bar to train the same degrees against a different colour.</p>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="font-mono font-bold text-2xl">{value}</span>
    <span className="text-xs text-muted">{label}</span>
  </div>
);

const DegreeDescriptor = ({ semi, keyId, mode }: { semi: Semi; keyId: string; mode: ModeId }) => {
  const key = keyById(keyId);
  const d = DEGREES[semi];
  const vibe = DEGREE_VIBES[semi];
  const path = resolutionPath(mode, semi);
  const inModes = TRAINER_MODES.filter((m) => MODES[m].intervals.includes(semi)).map((m) => MODES[m].name);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-4">
        <DegreeChip semi={semi} size="lg" ring />
        <div className="flex flex-col gap-0.5">
          <strong className="text-xl">{d.name}</strong>
          <span className="text-muted">
            Note <span className="font-mono text-ink">{spell(key, semi)}</span> in {key.label} · {vibe.title}
          </span>
        </div>
      </div>
      <p className="m-0 leading-relaxed text-ink-2">{vibe.vibe}</p>
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-bar border border-line-soft">
        <span className="text-xs text-muted">Resolution</span>
        <div className="flex flex-wrap items-center gap-2">
          {path.map((s, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-faint">→</span>}
              <DegreeChip semi={mod12(s)} size="sm" />
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">Formula</span>
        <span className="font-mono text-[13px]">
          {semi} semitone{semi === 1 ? '' : 's'} above the root · {inModes.length ? `in ${inModes.join(', ')}` : 'outside every trainer mode (chromatic)'}
        </span>
      </div>
    </div>
  );
};

const MovementDescriptor = ({ semi, keyId, mode }: { semi: Semi; keyId: string; mode: ModeId }) => {
  const key = keyById(keyId);
  const numeral = romanNumeral({ root: semi, quality: 'power' }, mode);
  const vibe = DEGREE_VIBES[semi];
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-4">
        <span className="min-w-16 h-16 px-3 rounded-2xl flex items-center justify-center text-2xl font-bold bg-active border border-edge">{numeral}</span>
        <div className="flex flex-col gap-0.5">
          <strong className="text-xl">
            {spell(key, semi)}5 in {key.label}
          </strong>
          <span className="text-muted">
            Root on <DegreeChip semi={semi} size="sm" /> · {vibe.title}
          </span>
        </div>
      </div>
      <p className="m-0 leading-relaxed text-ink-2">{vibe.vibe}</p>
      <p className="m-0 text-xs text-muted">
        {MODES[mode].intervals.includes(semi) ? `Diatonic to ${MODES[mode].name}.` : `Borrowed: its root is outside ${MODES[mode].name}.`}
      </p>
    </div>
  );
};
