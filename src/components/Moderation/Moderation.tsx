import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import RevealText from '@/components/ui/reveal';
import { ArrowLeft, Eye, EyeOff, History, Loader2, RefreshCw, Search, ShieldAlert, UserRoundX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OnlineError, fetchModeration, fetchModerationHistory, moderatePlayer, moderateScore } from '@/lib/online';
import type { ModerationEntry, ModerationFlag, ModerationRow, ModerationView } from '@/lib/online';
import { LEVELS } from '@/types';

const VIEWS: { id: ModerationView; label: string; hint: string }[] = [
  { id: 'recent', label: 'Recent', hint: 'The latest games posted online, newest first.' },
  { id: 'flagged', label: 'Flagged', hint: 'Games too fast or too perfect for a person reading the messages. Likely scripted, but check before hiding.' },
  { id: 'hidden', label: 'Hidden', hint: 'Scores and players currently off the public boards.' },
];

const FLAG_LABEL: Record<ModerationFlag, string> = {
  perfect_fast: 'Perfect and fast',
  very_fast: 'Too fast to read',
};

const REASONS = ['Offensive name', 'Fake or scripted score', 'Test entry'];

const ACTION_LABEL: Record<ModerationEntry['action'], string> = {
  hide_score: 'Hid a score',
  show_score: 'Restored a score',
  hide_player: 'Hid a player',
  show_player: 'Restored a player',
};

const message = (e: unknown) => (e instanceof OnlineError ? e.message : 'Something went wrong. Try again.');

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

type Pending = { kind: 'score' | 'player'; row: ModerationRow };

/** Moderators only: take scores or players off the public boards, and put them back. */
export function Moderation({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<ModerationView>('recent');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [reload, setReload] = useState(0);
  const [rows, setRows] = useState<ModerationRow[] | null>(null);
  const [history, setHistory] = useState<ModerationEntry[] | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError('');
    Promise.all([fetchModeration(view, query), fetchModerationHistory()])
      .then(([r, h]) => {
        if (cancelled) return;
        setRows(r);
        setHistory(h);
      })
      .catch(e => !cancelled && setError(message(e)));
    return () => {
      cancelled = true;
    };
  }, [view, query, reload]);

  const act = async (kind: 'score' | 'player', row: ModerationRow, hide: boolean, why: string | null) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (kind === 'score') await moderateScore(row.id, hide, why);
      else await moderatePlayer(row.player_id!, hide, why);
      setNotice(
        kind === 'score'
          ? `${hide ? 'Hid' : 'Restored'} ${row.name}'s ${LEVELS[row.level].label} score of ${row.score}.`
          : `${hide ? 'Hid' : 'Restored'} ${row.name}${hide ? ' from every board' : ' on every board'}.`,
      );
      setPending(null);
      setReason('');
      setReload(n => n + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const ask = (kind: 'score' | 'player', row: ModerationRow) => {
    setPending({ kind, row });
    setReason('');
    setNotice('');
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" data-testid="moderation">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={onBack}>
          <ArrowLeft className="size-4" /> Account
        </Button>
        <div>
          <p className="text-in font-mono text-xs tracking-[0.16em] text-primary">SPACEIO // MODERATION</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl"><RevealText text="Moderation" /></h1>
          <p className="text-in mt-2 text-sm text-muted-foreground" style={{ '--d': '220ms' } as CSSProperties}>
            Hiding takes a score, or a whole player, off the scoreboard, class boards and certificate checks straight away.
            Nothing is deleted, so you can always restore it. Every change is logged below.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-border p-1" role="group" aria-label="Show">
          {VIEWS.map(v => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => {
                setView(v.id);
                setPending(null);
              }}
              className={`rounded-full px-3.5 py-2 text-sm transition-colors ${
                view === v.id ? 'bg-lavender font-semibold text-primary-foreground hover:bg-lavender/85' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <form
          className="flex w-full items-center gap-2 sm:w-80"
          role="search"
          onSubmit={e => {
            e.preventDefault();
            setQuery(search);
          }}
        >
          <label htmlFor="moderation-search" className="sr-only">
            Search by name
          </label>
          <Input id="moderation-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" />
          <Button type="submit" variant="secondary" size="icon" aria-label="Search">
            <Search className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Refresh" onClick={() => setReload(n => n + 1)}>
            <RefreshCw className="size-4" />
          </Button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">{VIEWS.find(v => v.id === view)!.hint}</p>

      {notice && (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm" role="status" data-testid="moderation-notice">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!rows && !error ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      ) : rows && rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {view === 'hidden' ? 'Nothing is hidden.' : view === 'flagged' ? 'No flagged games.' : 'No games found.'}
        </p>
      ) : (
        <ul className="space-y-3" data-testid="moderation-list">
          {rows?.map(row => {
            const off = row.hidden || row.player_hidden;
            const open = pending?.row.id === row.id ? pending : null;
            return (
              <li
                key={row.id}
                className={`rounded-xl border bg-card p-4 text-sm ${off ? 'border-destructive/50' : 'border-border'}`}
                data-testid="moderation-row"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold [overflow-wrap:anywhere]">{row.name}</span>
                    {!row.player_id && <span className="text-xs text-muted-foreground">guest, before accounts</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{when(row.created_at)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {LEVELS[row.level].label} · <strong className="text-foreground">{row.score}</strong> points · {row.correct}/
                  {row.total} right · {row.avg_seconds}s a message
                  {row.class_code ? ` · class ${row.class_code}` : row.ranked ? '' : ' · unranked'}
                </p>
                {(row.flags.length > 0 || off) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.flags.map(f => (
                      <span key={f} className="inline-flex items-center gap-1 rounded-full border border-lavender px-2 py-0.5 text-xs text-lavender">
                        <ShieldAlert className="size-3" aria-hidden /> {FLAG_LABEL[f]}
                      </span>
                    ))}
                    {row.hidden && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">Score hidden</span>}
                    {row.player_hidden && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">Player hidden</span>}
                  </div>
                )}

                {open ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-border p-3" data-testid="moderation-confirm">
                    <p className="font-medium">
                      {open.kind === 'score'
                        ? `Hide this score? It leaves every board; ${row.name}'s other scores stay.`
                        : `Hide ${row.name} everywhere? All their scores, now and in future, leave every board, and their certificate stops checking.`}
                    </p>
                    <fieldset className="space-y-2">
                      <legend className="text-xs text-muted-foreground">Reason (for the log, optional)</legend>
                      <div className="flex flex-wrap gap-1.5">
                        {REASONS.map(r => (
                          <button
                            key={r}
                            type="button"
                            aria-pressed={reason === r}
                            onClick={() => setReason(reason === r ? '' : r)}
                            className={`rounded-full border px-2.5 py-1 text-xs ${
                              reason === r ? 'border-lavender bg-lavender font-semibold text-primary-foreground hover:bg-lavender/85' : 'border-border text-muted-foreground hover:border-lavender/60 hover:text-foreground'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <label htmlFor={`reason-${row.id}`} className="sr-only">
                        Or write a reason
                      </label>
                      <Input
                        id={`reason-${row.id}`}
                        value={REASONS.includes(reason) ? '' : reason}
                        onChange={e => setReason(e.target.value)}
                        maxLength={200}
                        placeholder="Or write a reason"
                      />
                    </fieldset>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => act(open.kind, row, true, reason.trim() || null)}
                        data-testid="moderation-confirm-hide"
                      >
                        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                        {open.kind === 'score' ? 'Hide score' : 'Hide player'}
                      </Button>
                      <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.hidden ? (
                      <Button variant="secondary" size="sm" className="gap-1.5" disabled={busy} onClick={() => act('score', row, false, null)}>
                        <Eye className="size-4" /> Restore score
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" className="gap-1.5" disabled={busy} onClick={() => ask('score', row)}>
                        <EyeOff className="size-4" /> Hide score
                      </Button>
                    )}
                    {row.player_id &&
                      (row.player_hidden ? (
                        <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={() => act('player', row, false, null)}>
                          <Eye className="size-4" /> Restore player
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={() => ask('player', row)}>
                          <UserRoundX className="size-4" /> Hide player
                        </Button>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm" data-testid="moderation-history">
        <h2 className="flex items-center gap-2 font-semibold">
          <History className="size-4 text-lavender" /> Recent actions
        </h2>
        {!history ? null : history.length === 0 ? (
          <p className="text-muted-foreground">No moderation yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-2">
                <span>
                  <strong>{h.moderator ?? 'A former moderator'}</strong> {ACTION_LABEL[h.action].toLowerCase()}:{' '}
                  {h.player ?? 'a deleted account'}
                  {h.level && h.score !== null ? `, ${LEVELS[h.level].label} ${h.score}` : ''}
                  {h.reason ? <span className="text-muted-foreground"> ({h.reason})</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">{when(h.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Moderation;
