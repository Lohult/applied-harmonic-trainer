import { memo } from 'react';
import { characterNotes, DEGREES, keyById, MODES, type ModeId, mod12, ROOT_RING, type Semi, spell, tuningById } from '../theory/core';
import { engine, type Timbre } from '../audio/engine';

interface Props {
  keyId: string;
  mode: ModeId;
  tuningId: string;
  labels: 'degree' | 'note';
  /** Degrees drawn bright; the rest of the scale is ghosted. Null = whole scale bright. */
  emphasis?: Semi[] | null;
  /** Degree drawn large with a glow. */
  target?: Semi | null;
  frets?: number;
  timbre?: Timbre;
}

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

const FretboardImpl = ({ keyId, mode, tuningId, labels, emphasis = null, target = null, frets = 22, timbre = 'clean' }: Props) => {
  const key = keyById(keyId);
  const tuning = tuningById(tuningId);
  const scale = MODES[mode].intervals;
  const chars = characterNotes(mode);
  const cols = `40px 46px repeat(${frets}, minmax(0, 1fr))`;
  const strings = [...tuning.strings.keys()].reverse();

  return (
    <div className="bg-panel border border-line rounded-xl px-4 pt-3.5 pb-2.5 overflow-x-auto">
      <div style={{ minWidth: 86 + frets * 46 }} role="grid" aria-label={`Fretboard: ${key.label} ${MODES[mode].name}`}>
        {strings.map((si, row) => (
          <div key={si} role="row" className="grid h-[34px]" style={{ gridTemplateColumns: cols }}>
            <div className="flex items-center font-mono text-xs font-semibold text-muted">{tuning.names[si]}</div>
            {Array.from({ length: frets + 1 }, (_, f) => {
              const midi = tuning.strings[si] + f;
              const semi = mod12(midi - key.pc);
              const inScale = scale.includes(semi);
              const isTarget = target === semi;
              const show = inScale || isTarget || (emphasis?.includes(semi) ?? false);
              const bright = emphasis ? emphasis.includes(semi) || isTarget : true;
              const d = DEGREES[semi];
              const label = labels === 'note' ? spell(key, semi) : d.label;
              let style: React.CSSProperties;
              if (bright) {
                const ring = isTarget
                  ? `0 0 0 3px #11151C, 0 0 0 5px ${d.color}, 0 0 16px ${d.color}`
                  : semi === 0
                    ? `0 0 0 2px #11151C, 0 0 0 4px ${ROOT_RING}`
                    : chars.includes(semi)
                      ? `0 0 0 2px #11151C, 0 0 0 4px ${d.color}`
                      : undefined;
                const sz = isTarget ? 30 : 26;
                style = { width: sz, height: sz, background: d.color, color: d.ink, boxShadow: ring, fontSize: 11 };
              } else {
                style = { width: 22, height: 22, background: '#11151C', color: '#7C8597', border: `1.5px solid ${d.color}66`, fontSize: 10 };
              }
              return (
                <div
                  key={f}
                  role="gridcell"
                  className={`relative flex items-center justify-center h-[34px] ${f === 0 ? 'border-r-[5px] border-r-[#D8CFBC]' : 'border-r-2 border-r-[#3B4150] bg-neck'}`}
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2"
                    style={{ height: [1, 1.4, 1.8, 2.3, 2.8, 3.4][row] ?? 2, background: f === 0 ? '#5E584D' : '#8A8170' }}
                  />
                  {show && (
                    <button
                      type="button"
                      onClick={() => engine.preview(midi, timbre)}
                      aria-label={`${tuning.names[si]} string fret ${f}: ${spell(key, semi)}, degree ${d.label}`}
                      className={`relative z-[1] rounded-full flex items-center justify-center font-mono font-bold box-border cursor-pointer leading-none hover:scale-110 transition-transform ${isTarget ? 'dot-pulse' : ''}`}
                      style={style}
                    >
                      {label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="grid h-6 mt-1" style={{ gridTemplateColumns: cols }} aria-hidden="true">
          <div />
          {Array.from({ length: frets + 1 }, (_, f) => {
            const strong = INLAYS.includes(f) || f === 12 || f === 24;
            return (
              <div key={f} className={`flex items-center justify-center font-mono text-[11px] ${strong ? 'text-ink-2 font-semibold' : 'text-faint'}`}>
                {f === 12 || f === 24 ? `${f} ••` : strong ? `${f} •` : f}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const Fretboard = memo(FretboardImpl);
