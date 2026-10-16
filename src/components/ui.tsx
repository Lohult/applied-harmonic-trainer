import type { ReactNode } from 'react';
import { DEGREES, ROOT_RING, type Semi } from '../theory/core';

export const Panel = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`bg-panel border border-line rounded-2xl p-5 flex flex-col gap-4 min-w-0 ${className}`}>{children}</section>
);

export const Eyebrow = ({ children, className = 'text-muted' }: { children: ReactNode; className?: string }) => (
  <span className={`font-mono text-[11px] font-semibold uppercase tracking-[1px] ${className}`}>{children}</span>
);

interface SegOption<T extends string> {
  id: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-0.5 bg-raised border border-edge rounded-lg p-0.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`min-h-8 px-3 rounded-md text-xs cursor-pointer ${on ? 'bg-edge text-ink font-bold' : 'text-muted font-medium hover:text-ink-2'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const DegreeChip = ({ semi, size = 'md', ring = false }: { semi: Semi; size?: 'sm' | 'md' | 'lg'; ring?: boolean }) => {
  const d = DEGREES[semi];
  const cls = size === 'lg' ? 'min-w-16 h-16 text-[22px]' : size === 'sm' ? 'min-w-[26px] h-[22px] text-[11px] px-1.5' : 'min-w-[34px] h-[28px] text-[13px] px-2';
  const ringColor = semi === 0 ? ROOT_RING : d.color;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-mono font-bold box-border ${cls}`}
      style={{ background: d.color, color: d.ink, boxShadow: ring || semi === 0 ? `0 0 0 2px #11151C, 0 0 0 4px ${ringColor}` : undefined }}
    >
      {d.label}
    </span>
  );
};

export const PrimaryButton = ({ children, onClick, disabled, className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2.5 min-h-12 px-5 rounded-xl bg-gold text-ground font-bold text-[15px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 ${className}`}
  >
    {children}
  </button>
);

export const GhostButton = ({ children, onClick, disabled, className = '', ariaLabel }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string; ariaLabel?: string }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={`flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-edge bg-raised text-ink cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:border-faint ${className}`}
  >
    {children}
  </button>
);

export const Toggle = ({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) => (
  <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer min-h-9">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-[18px] h-[18px] accent-gold" />
    {children}
  </label>
);
