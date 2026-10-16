import { useEffect, useState } from 'react';
import { AudioLines, Volume2 } from 'lucide-react';
import { KEYS, MODES, TRAINER_MODES, TUNINGS } from './theory/core';
import { updateSettings, useStore } from './trainer/store';
import { engine } from './audio/engine';
import { EarTrainer } from './pages/EarTrainer';
import { Decoder } from './pages/Decoder';
import { YourSong } from './pages/YourSong';
import { Progress } from './pages/Progress';

type Tab = 'ear' | 'decoder' | 'song' | 'progress';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ear', label: 'Ear Trainer' },
  { id: 'decoder', label: 'Progression Decoder' },
  { id: 'song', label: 'Analyze Your Song' },
  { id: 'progress', label: 'Progress' },
];

const tabFromHash = (): Tab => {
  const h = window.location.hash.replace('#', '');
  return (TABS.find((t) => t.id === h)?.id ?? 'ear') as Tab;
};

export default function App() {
  const settings = useStore((s) => s.settings);
  const [tab, setTab] = useState<Tab>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    engine.stop();
  }, [tab]);

  useEffect(() => {
    engine.setVolume(settings.volume);
  }, [settings.volume]);

  const showModeTabs = tab === 'ear';

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 sm:px-6 py-3 border-b border-line-soft bg-bar">
        <div className="flex items-center gap-2.5 mr-2">
          <AudioLines size={22} color="#F5C451" aria-hidden="true" />
          <span className="font-bold text-[15px]">Harmonic Trainer</span>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          Key
          <select
            value={settings.keyId}
            onChange={(e) => updateSettings({ keyId: e.target.value })}
            className="bg-raised text-ink border border-edge rounded-lg px-2.5 min-h-9 font-mono font-semibold text-[13px]"
          >
            {KEYS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          Tuning
          <select
            value={settings.tuningId}
            onChange={(e) => updateSettings({ tuningId: e.target.value })}
            className="bg-raised text-ink border border-edge rounded-lg px-2.5 min-h-9 text-[13px]"
          >
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {showModeTabs && (
          <div role="radiogroup" aria-label="Mode" className="flex flex-wrap gap-1 bg-raised border border-edge rounded-xl p-[3px]">
            {TRAINER_MODES.map((m) => {
              const on = settings.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => updateSettings({ mode: m })}
                  className={`min-h-8 px-3 rounded-md text-xs cursor-pointer ${on ? 'bg-edge text-ink font-bold' : 'text-muted font-medium hover:text-ink-2'}`}
                >
                  {MODES[m].short}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs text-muted">
          <Volume2 size={16} aria-hidden="true" />
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            className="w-24 accent-gold"
          />
        </label>
      </header>

      <nav aria-label="Modules" className="flex flex-wrap gap-1 px-4 sm:px-6 pt-2.5 border-b border-line-soft overflow-x-auto">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`px-4 py-2.5 no-underline whitespace-nowrap border-b-2 ${tab === t.id ? 'text-ink font-semibold border-gold' : 'text-muted font-medium border-transparent hover:text-ink-2'}`}
          >
            {t.label}
          </a>
        ))}
      </nav>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-5 pb-10 flex flex-col gap-5">
        {tab === 'ear' && <EarTrainer />}
        {tab === 'decoder' && <Decoder />}
        {tab === 'song' && <YourSong />}
        {tab === 'progress' && <Progress />}
      </main>
    </div>
  );
}
