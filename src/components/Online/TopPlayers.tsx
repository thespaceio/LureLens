import { useEffect, useState } from 'react';
import { ArrowRight, Trophy } from 'lucide-react';
import LiveDot from '@/components/Online/LiveDot';
import { fetchBoard } from '@/lib/online';
import type { BoardRow } from '@/lib/online';
import { useScoreboardUpdates } from '@/lib/live';
import { LEVELS } from '@/types';

const MEDAL = ['bg-primary', 'bg-lavender', 'bg-muted-foreground'];

/** "Top players this week" on the home screen, updating live. Hidden when offline or empty. */
export function TopPlayers({ onOpen }: { onOpen: () => void }) {
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [tick, setTick] = useState(0);
  const live = useScoreboardUpdates(() => setTick(n => n + 1));

  useEffect(() => {
    let cancelled = false;
    fetchBoard('all', 7, 5)
      .then(r => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows(prev => prev ?? []));
    return () => {
      cancelled = true;
    };
  }, [tick]);

  if (!rows || rows.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="top-players" data-testid="top-players">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="top-players" className="flex items-center gap-2 font-semibold">
          <Trophy className="size-4 text-primary" /> Top players this week
        </h2>
        <LiveDot status={live} />
      </div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={`${r.name}-${r.level}`} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm ${r.is_me ? 'bg-primary/10' : ''}`}>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold ${i < 3 ? `${MEDAL[i]} text-primary-foreground` : 'text-muted-foreground'}`}>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">{LEVELS[r.level].label}</span>
            <span className="w-16 text-right font-mono font-semibold tabular-nums text-primary">{r.score.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onOpen} className="mt-3 flex items-center gap-1 text-sm text-lavender underline-offset-2 hover:underline">
        See the full scoreboard <ArrowRight className="size-3.5" />
      </button>
    </section>
  );
}

export default TopPlayers;
