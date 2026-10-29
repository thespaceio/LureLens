import { useEffect, useRef, useState } from 'react';
import { Expand, X } from 'lucide-react';
import QrCode from '@/components/Classroom/QrCode';
import LiveDot from '@/components/Online/LiveDot';
import { LogoMark } from '@/components/Logo/Logo';
import { fetchBoard } from '@/lib/online';
import type { BoardRow } from '@/lib/online';
import { useScoreboardUpdates } from '@/lib/live';
import { SITE_HOST, SITE_URL } from '@/lib/shareCard';
import { LEVELS, LEVEL_ORDER } from '@/types';
import type { Level } from '@/types';

const PER_LEVEL = 8;
const MEDAL = ['bg-primary', 'bg-lavender', 'bg-muted-foreground'];
const ACCENT: Record<Level, string> = { beginner: 'text-primary', intermediate: 'text-lavender', advanced: 'text-foreground' };

type Boards = Record<Level, BoardRow[]>;

/** Full-screen live scoreboard for a projector or TV at a class or event. */
export function LiveBoard({ onExit }: { onExit: () => void }) {
  const [days, setDays] = useState<7 | null>(7);
  const [boards, setBoards] = useState<Boards | null>(null);
  const [error, setError] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const seen = useRef<Map<string, number> | null>(null);
  const live = useScoreboardUpdates(() => setTick(n => n + 1), 30_000);

  useEffect(() => {
    let cancelled = false;
    Promise.all(LEVEL_ORDER.map(l => fetchBoard(l, days, PER_LEVEL)))
      .then(([beginner, intermediate, advanced]) => {
        if (cancelled) return;
        const next: Boards = { beginner, intermediate, advanced };
        // Highlight rows that are new or improved since the last load.
        const scores = new Map<string, number>();
        const changed = new Set<string>();
        for (const l of LEVEL_ORDER) {
          for (const r of next[l]) {
            const key = `${l}|${r.name}`;
            scores.set(key, r.score);
            if (seen.current && seen.current.get(key) !== r.score) changed.add(key);
          }
        }
        seen.current = scores;
        setBoards(next);
        setError(false);
        if (changed.size) setFresh(changed);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [days, tick]);

  // New rows stay highlighted for a few seconds.
  useEffect(() => {
    if (!fresh.size) return;
    const t = window.setTimeout(() => setFresh(new Set()), 6000);
    return () => window.clearTimeout(t);
  }, [fresh]);

  const fullScreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const changePeriod = (value: 7 | null) => {
    seen.current = null;
    setDays(value);
  };

  return (
    <div className="flex min-h-dvh flex-col gap-6 bg-background p-4 sm:p-8 lg:p-10" data-testid="live-board">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <LogoMark size={56} />
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] sm:text-5xl">Live scoreboard</h1>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground sm:text-sm">
              LureLens · {days ? 'this week' : 'all time'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveDot status={live} className="text-sm" />
          <div className="flex gap-1 rounded-full border border-border p-1" role="group" aria-label="Period">
            {([
              [7, 'This week'],
              [null, 'All time'],
            ] as const).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={days === value}
                onClick={() => changePeriod(value)}
                className={`rounded-full px-3.5 py-2 text-sm ${days === value ? 'bg-lavender font-semibold text-primary-foreground hover:bg-lavender/85' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={fullScreen} className="grid size-10 place-items-center rounded-lg border border-border hover:border-primary/60" aria-label="Full screen">
            <Expand className="size-4" />
          </button>
          <button type="button" onClick={onExit} className="grid size-10 place-items-center rounded-lg border border-border hover:border-primary/60" aria-label="Close big-screen view">
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,16rem)]">
        {LEVEL_ORDER.map(level => (
          <section key={level} className="flex flex-col rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label={`${LEVELS[level].label} top players`}>
            <h2 className={`mb-3 font-mono text-sm font-semibold uppercase tracking-[0.16em] ${ACCENT[level]}`}>{LEVELS[level].label}</h2>
            {error && !boards ? (
              <p className="text-muted-foreground">Can't reach the scoreboard right now. Retrying…</p>
            ) : !boards ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : boards[level].length === 0 ? (
              <p className="text-muted-foreground">No scores yet. Be the first!</p>
            ) : (
              <ol className="space-y-1.5">
                {boards[level].map((r, i) => {
                  const isFresh = fresh.has(`${level}|${r.name}`);
                  return (
                    <li
                      key={r.name}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-700 ${isFresh ? 'bg-primary/20' : i === 0 ? 'bg-primary/5' : ''}`}
                      data-fresh={isFresh || undefined}
                    >
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-full font-mono text-sm font-bold ${i < 3 ? `${MEDAL[i]} text-primary-foreground` : 'text-muted-foreground'}`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-lg font-semibold xl:text-xl">{r.name}</span>
                      <span className="hidden text-sm text-muted-foreground sm:inline">{r.accuracy}%</span>
                      <span className="w-20 text-right font-mono text-lg font-bold tabular-nums text-primary xl:text-xl">{r.score.toLocaleString()}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        ))}

        <aside className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-primary/50 bg-card p-5 text-center">
          <p className="font-display text-2xl font-extrabold">Scan to play</p>
          <div className="w-full max-w-[12rem] overflow-hidden rounded-xl">
            <QrCode text={SITE_URL} label={`QR code for ${SITE_URL}`} className="block h-auto w-full" />
          </div>
          <p className="font-mono text-sm text-primary [overflow-wrap:anywhere]">{SITE_HOST}</p>
          <p className="text-xs text-muted-foreground">Sign in, play a ranked round, then tap "Post to the online scoreboard".</p>
        </aside>
      </div>
      <p className="text-center font-mono text-[11px] tracking-[0.18em] text-muted-foreground">TH3 SPACEIO · LEARN. BUILD. SECURE.</p>
    </div>
  );
}

export default LiveBoard;
