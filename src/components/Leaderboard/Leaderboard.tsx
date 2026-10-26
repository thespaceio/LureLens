import { useState } from 'react';
import { Globe, MonitorSmartphone, Play } from 'lucide-react';
import OnlineBoard from '@/components/Online/OnlineBoard';
import { ONLINE } from '@/lib/online';
import { Button } from '@/components/ui/button';
import { leaderboard } from '@/lib/stats';
import { LEVELS, LEVEL_ORDER } from '@/types';
import type { GameSession, Level } from '@/types';

interface LeaderboardProps {
  sessions: GameSession[];
  playerName: string;
  onPlay: () => void;
  onBigScreen?: () => void;
}

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

export function Leaderboard({ sessions, playerName, onPlay, onBigScreen }: LeaderboardProps) {
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [bestOnly, setBestOnly] = useState(true);
  const [source, setSource] = useState<'device' | 'online'>(ONLINE ? 'online' : 'device');
  const rows = leaderboard(sessions, level, bestOnly, 20);
  const games = sessions.filter(s => level === 'all' || s.level === level).length;
  const me = playerName.trim().toLowerCase();
  const podium = rows.length >= 3 ? [1, 0, 2] : rows.map((_, i) => i);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.16em] text-primary">SPACEIO // SCOREBOARD</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Top phish hunters</h1>
          <p className="mt-1 text-muted-foreground">
            {source === 'online'
              ? 'Best scores posted by players everywhere.'
              : 'Highest scores on this device. Ties go to accuracy, then speed.'}
          </p>
        </div>
        <Button onClick={onPlay} className="gap-2 font-semibold">
          <Play className="size-4" /> Play now
        </Button>
      </div>

      {ONLINE && (
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1 sm:w-fit" role="group" aria-label="Scoreboard">
          {([
            ['online', 'Online', Globe],
            ['device', 'This device', MonitorSmartphone],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={source === id}
              onClick={() => setSource(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                source === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Level">
          {(['all', ...LEVEL_ORDER] as const).map(l => (
            <button
              key={l}
              role="tab"
              aria-selected={level === l}
              data-board-level={l}
              onClick={() => setLevel(l)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                level === l ? 'border-primary bg-primary font-semibold text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {l === 'all' ? 'All levels' : LEVELS[l].label}
            </button>
          ))}
        </div>
        {source === 'device' && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={bestOnly}
            onChange={e => setBestOnly(e.target.checked)}
            className="size-4 accent-[hsl(var(--primary))]"
          />
          Best score per player
        </label>
        )}
      </div>

      {source === 'online' ? (
        <OnlineBoard level={level} onBigScreen={onBigScreen} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
          <p>No scores yet{level === 'all' ? '' : ` for ${LEVELS[level].label}`}. Be the first on the board.</p>
          <Button onClick={onPlay} className="mt-4">Start playing</Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {podium.filter(i => rows[i]).map(i => {
              const r = rows[i];
              return (
                <div key={r.id} className={`rounded-xl border bg-card p-4 text-center ${i === 0 ? 'border-primary/60' : 'border-border'}`}>
                  <span className={`mx-auto grid size-7 place-items-center rounded-full text-sm font-bold text-primary-foreground ${MEDAL[i]}`}>{i + 1}</span>
                  <div className="mt-2 truncate font-semibold">{r.name}</div>
                  <div className="text-xl font-bold text-primary">{r.score.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{r.accuracy}% · {LEVELS[r.level].label}</div>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm" data-testid="leaderboard-table">
              <thead>
                <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Player</th>
                  {level === 'all' && <th className="px-4 py-3 text-left font-medium">Level</th>}
                  <th className="px-4 py-3 text-right font-medium">Score</th>
                  <th className="px-4 py-3 text-right font-medium">Accuracy</th>
                  <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Streak</th>
                  <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Avg. time</th>
                  <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={`border-t border-border first:border-t-0 ${r.name.trim().toLowerCase() === me ? 'bg-primary/10' : ''}`}>
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
                    <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.bestStreak}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.avgSeconds}s</td>
                    <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">{formatDate(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-right font-mono text-xs text-muted-foreground">
            {games} game{games === 1 ? '' : 's'} played
          </p>
        </>
      )}
    </div>
  );
}

export default Leaderboard;
