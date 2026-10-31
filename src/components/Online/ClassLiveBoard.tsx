import { useEffect, useRef, useState } from 'react';
import RevealText from '@/components/ui/reveal';
import { Expand, X } from 'lucide-react';
import QrCode from '@/components/Classroom/QrCode';
import LiveDot from '@/components/Online/LiveDot';
import { LogoMark } from '@/components/Logo/Logo';
import { useClassBoard } from '@/hooks/useClassBoard';
import { decodeClassCode, formatCode, inviteLink } from '@/lib/classroom';
import { SITE_HOST } from '@/lib/shareCard';
import { LEVELS } from '@/types';

const MEDAL = ['bg-primary', 'bg-lavender', 'bg-muted-foreground'];

/** Full-screen live board for one class, for the projector in the room. */
export function ClassLiveBoard({ code, onExit }: { code: string; onExit: () => void }) {
  const board = useClassBoard(code);
  const decoded = decodeClassCode(code);
  const level = decoded.ok ? LEVELS[decoded.level].label : null;
  const link = inviteLink(code);
  const results = board.results ?? [];
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);

  // Highlight players who just finished.
  useEffect(() => {
    if (!board.results) return;
    const names = new Set(board.results.map(r => r.name));
    const added = seen.current ? [...names].filter(n => !seen.current!.has(n)) : [];
    seen.current = names;
    if (!added.length) return;
    const show = window.setTimeout(() => setFresh(new Set(added)), 0);
    const hide = window.setTimeout(() => setFresh(new Set()), 6000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [board.results]);

  const fullScreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const average = results.length ? Math.round((results.reduce((s, r) => s + (r.total ? r.correct / r.total : 0), 0) / results.length) * 100) : 0;
  const rows = Math.max(Math.ceil(results.length / 2), 8);

  return (
    <div className="flex min-h-dvh flex-col gap-6 bg-background p-4 sm:p-8 lg:p-10" data-testid="class-live-board">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <LogoMark size={56} />
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] sm:text-5xl"><RevealText text="Class board" /></h1>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground sm:text-sm">
              Class {formatCode(code)}
              {level ? ` · ${level}` : ''} · today
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveDot status={board.status} className="text-sm" />
          <button type="button" onClick={fullScreen} className="grid size-10 place-items-center rounded-lg border border-border hover:border-primary/60" aria-label="Full screen">
            <Expand className="size-4" />
          </button>
          <button type="button" onClick={onExit} className="grid size-10 place-items-center rounded-lg border border-border hover:border-primary/60" aria-label="Close big-screen view">
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Class results">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Players finished', String(results.length)],
              ['Average accuracy', results.length ? `${average}%` : '–'],
              ['Top score', results.length ? results[0].score.toLocaleString() : '–'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-background/60 p-3">
                <div className="font-mono text-2xl font-bold text-primary sm:text-4xl">{value}</div>
                <div className="text-xs text-muted-foreground sm:text-sm">{label}</div>
              </div>
            ))}
          </div>

          {!decoded.ok && decoded.reason === 'format' ? (
            <p className="text-lg text-muted-foreground">That isn't a class code. Open the big screen from your class in Classroom mode.</p>
          ) : board.error && !board.results ? (
            <p className="text-lg text-muted-foreground">Can't reach the class board right now. Retrying…</p>
          ) : !board.results ? (
            <p className="text-lg text-muted-foreground">Loading…</p>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-xl text-muted-foreground">Waiting for the first player to finish…</p>
          ) : (
            <ol
              className="grid gap-x-6 gap-y-1.5 xl:grid-flow-col xl:grid-cols-2"
              style={{ gridTemplateRows: `repeat(${rows}, auto)` }}
              data-testid="class-live-list"
            >
              {results.map((r, i) => {
                const isFresh = fresh.has(r.name);
                return (
                  <li
                    key={r.name}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-700 ${isFresh ? 'bg-primary/20' : i === 0 ? 'bg-primary/5' : ''}`}
                    data-fresh={isFresh || undefined}
                  >
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full font-mono text-sm font-bold ${i < 3 ? `${MEDAL[i]} text-primary-foreground` : 'text-muted-foreground'}`}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-lg font-semibold xl:text-xl">{r.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {r.correct}/{r.total}
                    </span>
                    <span className="w-20 text-right font-mono text-lg font-bold tabular-nums text-primary xl:text-xl">{r.score.toLocaleString()}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-primary/50 bg-card p-5 text-center">
          <p className="font-display text-2xl font-extrabold">Scan to join</p>
          <div className="w-full max-w-[13rem] overflow-hidden rounded-xl">
            <QrCode text={link} label={`QR code for ${link}`} className="block h-auto w-full" />
          </div>
          <p className="font-mono text-4xl font-semibold tracking-[0.08em]">{formatCode(code)}</p>
          <p className="text-sm text-muted-foreground">
            Or open <span className="font-mono text-primary [overflow-wrap:anywhere]">{SITE_HOST}</span>, choose Classroom and enter the code. Sign in or quick join first so your
            result appears here.
          </p>
        </aside>
      </div>
      <p className="text-center font-mono text-[11px] tracking-[0.18em] text-muted-foreground">TH3 SPACEIO · LEARN. BUILD. SECURE.</p>
    </div>
  );
}

export default ClassLiveBoard;
