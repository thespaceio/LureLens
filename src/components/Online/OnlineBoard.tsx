import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnlineError, fetchBoard } from '@/lib/online';
import { useScoreboardUpdates } from '@/lib/live';
import LiveDot from '@/components/Online/LiveDot';
import type { BoardRow } from '@/lib/online';
import { LEVELS } from '@/types';
import type { Level } from '@/types';

const PILL: Record<Level, string> = {
  beginner: 'text-primary border-primary',
  intermediate: 'text-lavender border-lavender',
  advanced: 'text-muted-foreground border-muted-foreground',
};
const MEDAL = ['bg-primary', 'bg-lavender', 'bg-muted-foreground'];

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The shared scoreboard: each player's best posted game. */
export function OnlineBoard({ level, onBigScreen }: { level: Level | 'all'; onBigScreen?: () => void }) {
  const [days, setDays] = useState<7 | null>(7);
  const [reload, setReload] = useState(0);
  const key = `${level}|${days}|${reload}`;
  const [result, setResult] = useState<{ key: string; rows?: BoardRow[]; error?: string } | null>(null);
  const live = useScoreboardUpdates(() => setReload(n => n + 1));

  useEffect(() => {
    let cancelled = false;
    fetchBoard(level, days, 20)
      .then(rows => !cancelled && setResult({ key, rows }))
      .catch(e => !cancelled && setResult({ key, error: e instanceof OnlineError ? e.message : 'Could not load the online scoreboard.' }));
    return () => {
      cancelled = true;
    };
  }, [level, days, key]);

  // Until the answer for the current tab arrives, show loading. A live
  // refresh of the same tab keeps showing the old rows meanwhile.
  const sameTab = (k: string) => k.split('|').slice(0, 2).join('|') === `${level}|${days}`;
  const current = result && (result.key === key || sameTab(result.key)) ? result : null;
  const rows = current?.rows ?? null;
  const error = current?.error ?? '';

  return (
    <div className="space-y-3" data-testid="online-board">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border border-border p-1" role="group" aria-label="Period">
          {([
            [7, 'This week'],
            [null, 'All time'],
          ] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={days === value}
              onClick={() => setDays(value)}
              className={`rounded-full px-3.5 py-2 text-sm transition-colors ${
                days === value ? 'bg-lavender font-semibold text-primary-foreground hover:bg-lavender/85' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          <LiveDot status={live} />
          {onBigScreen && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBigScreen} data-testid="big-screen-button">
              <Tv className="size-4" /> Big screen
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setReload(n => n + 1)} disabled={!rows && !error}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-muted-foreground" role="alert">
          <p>{error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => setReload(n => n + 1)}>
            Try again
          </Button>
        </div>
      ) : !rows ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading the online scoreboard…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-muted-foreground">
          <p>
            No online scores {days ? 'this week' : 'yet'}
            {level === 'all' ? '' : ` for ${LEVELS[level].label}`}. Sign in, finish a ranked game and post your score to be the first.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline-2 focus-visible:outline-primary" tabIndex={0} role="region" aria-label="Online scores">
          <table className="w-full text-sm" data-testid="online-table">
            <thead>
              <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">Player</th>
                {level === 'all' && <th className="px-4 py-3 text-left font-medium">Level</th>}
                <th className="px-4 py-3 text-right font-medium">Score</th>
                <th className="px-4 py-3 text-right font-medium">Accuracy</th>
                <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Avg. time</th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.name}-${r.level}`}
                  className={`fade-in-row border-t border-border first:border-t-0 hover:bg-secondary/40 ${r.is_me ? 'bg-primary/10' : ''}`}
                  style={{ '--i': i } as CSSProperties}
                >
                  <td className="px-4 py-3 font-mono font-bold">
                    {i < 3 ? <span className={`grid size-6 place-items-center rounded-full text-xs text-primary-foreground ${MEDAL[i]}`}>{i + 1}</span> : i + 1}
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-3">{r.name}</td>
                  {level === 'all' && (
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${PILL[r.level]}`}>{LEVELS[r.level].label}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">{r.score.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {r.accuracy}% <span className="text-muted-foreground">({r.correct}/{r.total})</span>
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{Number(r.avg_seconds)}s</td>
                  <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">{formatDate(r.played_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Each player's best posted game. Scores are worked out by the server from the answers, so they can't be typed in.
      </p>
    </div>
  );
}

export default OnlineBoard;
