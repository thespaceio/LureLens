import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { accuracyOf } from '@/lib/game';
import { playerNames, playerSessions, topicStats } from '@/lib/stats';
import { LEVELS, LEVEL_ORDER } from '@/types';
import type { GameSession, Level } from '@/types';

interface ProgressDashboardProps {
  sessions: GameSession[];
  playerName: string;
  onPlay: (level?: Level) => void;
  onReset: () => void;
}

const PILL: Record<Level, string> = {
  beginner: 'text-primary border-primary',
  intermediate: 'text-lavender border-lavender',
  advanced: 'text-muted-foreground border-muted-foreground',
};

const barColor = (acc: number) => (acc >= 70 ? '#C6F432' : acc >= 50 ? '#B9A6FF' : '#FF6B6B');

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function ProgressDashboard({ sessions, playerName, onPlay, onReset }: ProgressDashboardProps) {
  const names = playerNames(sessions);
  const [chosen, setChosen] = useState<string>('');
  const current = playerName.trim();
  const selected =
    chosen ||
    (current && names.some(n => n.toLowerCase() === current.toLowerCase()) ? current : names[0] ?? current);
  const games = selected ? playerSessions(sessions, selected) : [];

  const answered = games.reduce((n, s) => n + s.total, 0);
  const correct = games.reduce((n, s) => n + s.correct, 0);
  const topics = topicStats(games);
  const chartData = topics.slice().sort((a, b) => b.accuracy - a.accuracy);
  const weak = topics.filter(t => t.accuracy < 100).slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.16em] text-primary">SPACEIO // PROGRESS</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{selected ? `${selected}'s progress` : 'My progress'}</h1>
          <p className="mt-1 text-muted-foreground">Training history on this device.</p>
        </div>
        {names.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Player
            <select
              value={selected}
              onChange={e => setChosen(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
            >
              {names.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {games.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
          <p>No games played yet. Finish a round and your stats will appear here.</p>
          <Button onClick={() => onPlay()} className="mt-4 gap-2">
            <Play className="size-4" /> Start training
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Games played', String(games.length)],
              ['Total points', games.reduce((n, s) => n + s.score, 0).toLocaleString()],
              ['Overall accuracy', `${accuracyOf(correct, answered)}%`],
              ['Best streak', String(games.reduce((m, s) => Math.max(m, s.bestStreak), 0))],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-2xl font-bold" data-testid={`stat-${label}`}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">Levels</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {LEVEL_ORDER.map(id => {
                const lv = games.filter(s => s.level === id);
                const acc = accuracyOf(lv.reduce((n, s) => n + s.correct, 0), lv.reduce((n, s) => n + s.total, 0));
                const best = lv.reduce((m, s) => Math.max(m, s.score), 0);
                return (
                  <div key={id} className="rounded-lg border border-border bg-background/50 p-4 text-sm">
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${PILL[id]}`}>{LEVELS[id].label}</span>
                    <div className="mt-3 flex justify-between text-muted-foreground">Games <strong className="text-foreground">{lv.length}</strong></div>
                    <div className="mt-1 flex justify-between text-muted-foreground">Best score <strong className="text-foreground">{best ? best.toLocaleString() : '–'}</strong></div>
                    <div className="mt-1 flex justify-between text-muted-foreground">Accuracy <strong className="text-foreground">{lv.length ? `${acc}%` : '–'}</strong></div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${lv.length ? acc : 0}%` }} />
                    </div>
                    {lv.length === 0 && (
                      <button className="mt-3 text-xs text-primary underline" onClick={() => onPlay(id)}>
                        Play {LEVELS[id].label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-[1.6fr_1fr]">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold">Accuracy by attack type</h2>
              <div style={{ height: Math.max(200, chartData.length * 30 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="rgba(207,198,232,0.15)" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} stroke="#CFC6E8" fontSize={12} />
                    <YAxis type="category" dataKey="topic" width={150} stroke="#CFC6E8" fontSize={12} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ background: '#1B1035', border: '1px solid #3A2A63', borderRadius: 8, color: '#fff' }}
                      formatter={(v, _n, item) => [`${v}% (${item.payload.correct}/${item.payload.total})`, 'Accuracy']}
                    />
                    <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={14} minPointSize={3}>
                      {chartData.map(d => (
                        <Cell key={d.topic} fill={barColor(d.accuracy)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold">Practise these next</h2>
              <ul className="space-y-2 text-sm">
                {weak.length ? (
                  weak.map(t => (
                    <li key={t.topic} className="flex justify-between gap-3 rounded-lg bg-background/50 px-3 py-2.5">
                      <span>{t.topic}</span>
                      <span className="font-mono text-destructive">{t.accuracy}% ({t.correct}/{t.total})</span>
                    </li>
                  ))
                ) : (
                  <li className="rounded-lg bg-background/50 px-3 py-2.5">Perfect so far. Try a harder level.</li>
                )}
              </ul>
            </section>
          </div>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Recent games</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    <th className="py-2 pr-4 text-left font-medium">Date</th>
                    <th className="py-2 pr-4 text-left font-medium">Level</th>
                    <th className="py-2 pr-4 text-right font-medium">Score</th>
                    <th className="py-2 pr-4 text-right font-medium">Accuracy</th>
                    <th className="hidden py-2 text-right font-medium sm:table-cell">Avg. time</th>
                  </tr>
                </thead>
                <tbody>
                  {games.slice(0, 10).map(s => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="whitespace-nowrap py-2.5 pr-4">{formatDateTime(s.date)}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${PILL[s.level]}`}>{LEVELS[s.level].label}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-bold tabular-nums text-primary">{s.score.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{s.accuracy}%</td>
                      <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{s.avgSeconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex justify-end">
            <Button
              variant="outline"
              className="gap-2 border-destructive/50 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (window.confirm('Delete every game and score saved on this device? This cannot be undone.')) onReset();
              }}
            >
              <RotateCcw className="size-4" /> Clear all data on this device
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default ProgressDashboard;
