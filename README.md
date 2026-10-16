# Harmonic Trainer

Ear training, modal analysis and fretboard mapping for rock and metal guitarists. You hear a scale degree or a chord move against a tonic, name it, see it on a 22-fret neck, and learn what it does musically.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # theory + trainer unit tests
npm run build    # typecheck + production build in dist/
```

## What's in it

- **Ear Trainer**
  - Two exercises: *Scale degrees* and *Root movement* (power-chord moves named as Roman numerals).
  - Each round sets the key with a drone plus a short cadence in the chosen mode. Each mode has its own cadence (e.g. i–♭II–i for Phrygian), so the context never implies the wrong mode.
  - After you answer, the note plays its stepwise resolution back to the tonic.
  - Quiz blocks of 10 alternate with short listen-only blocks.
  - The key changes every 8 rounds, the tone can be clean, overdrive, bass, palm-mute or a random mix, and answer time is tracked.
- **Progression Decoder**
  - Six presets that transpose to any key, plus your saved songs.
  - Play and loop at a set tempo, switch between power chords and full triads, or use *Quiz me first* mode where you name each bar before the reveal.
- **Analyze Your Song**
  - Type the chords you heard (`B5 C5 B5 A5 G5 E5`) and it ranks key and mode readings.
  - It writes the Roman numerals, flags character notes and common moves, and shows the result on the neck.
  - Results can be saved to the decoder as presets.
- **Progress:** stage path, mastery per degree (accuracy and speed), top confusions, and a 14-day practice log. Everything is stored in `localStorage`.

## How the training works

These choices come from research on how people learn to hear pitch:

- **Context first.** Every degree is heard against a tonic (functional ear training), never as a bare interval.
- **Few items, then mix.** Stages start with 1 ♭3 5. New degrees get extra weight until they are learned. A stage unlocks when every item reaches 90% accuracy over your last 20 tries *and* a median answer under 2.5 s.
- **Practice + exposure.** Quiz blocks alternate with listen-only blocks that play your weakest items with their labels. Little, Cheng & Wright (2019) found that this mix produced learning where practice alone didn't.
- **Confusion focus.** A miss queues both the target and your wrong answer for the next rounds.
- **Varied timbre.** Relative pitch transfers poorly across timbres, so the same drills run on clean, driven, bass and palm-muted tones.

## Code map

| Path | What |
| --- | --- |
| `src/theory/core.ts` | Keys, degrees and colours, modes, character notes, note spelling, tunings |
| `src/theory/harmony.ts` | Chord tones, Roman numerals, diatonic qualities, resolution paths |
| `src/theory/analyze.ts` | Chord parsing (via [tonal](https://github.com/tonaljs/tonal)), key/mode detection, observations |
| `src/theory/presets.ts`, `descriptors.ts` | Decoder presets and plain-English degree descriptions |
| `src/audio/engine.ts` | Web Audio: Karplus–Strong strings, overdrive chain, drone, cancellable takes |
| `src/audio/phrases.ts` | Cadences, resolutions and chord playback built on the engine |
| `src/trainer/` | Curriculum stages, weighted item picker, persisted store and mastery stats |
| `src/pages/`, `src/components/` | The four screens, fretboard and UI primitives |

## Planned

- Riff dictation (3–5 note phrases, every note by degree)
- Microphone pitch detection for "sing it back"
