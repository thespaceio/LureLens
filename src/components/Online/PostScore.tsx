import { useState } from 'react';
import { Check, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnlineError, postScore } from '@/lib/online';
import type { PostedScore } from '@/lib/online';
import { LEVELS } from '@/types';
import type { GameSession } from '@/types';

/** "Post to the online scoreboard" on the results screen. Nothing is sent until the player taps it. */
export function PostScore({ session, onPosted }: { session: GameSession; onPosted: (posted: PostedScore) => void }) {
  const [state, setState] = useState<'idle' | 'posting' | 'error'>('idle');
  const [error, setError] = useState('');
  const level = LEVELS[session.level].label;

  if (session.online) {
    const { score, rank, of } = session.online;
    return (
      <section className="flex items-center gap-3 rounded-xl border border-primary/50 bg-card p-4" data-testid="online-posted">
        <Check className="size-5 shrink-0 text-primary" />
        <p className="text-sm">
          Posted to the online scoreboard: <strong>{score.toLocaleString()} points</strong>
          {rank && of ? (
            <>
              , <strong>#{rank}</strong> of {of} {of === 1 ? 'player' : 'players'} on {level}
            </>
          ) : null}
          .
        </p>
      </section>
    );
  }

  const post = async () => {
    setState('posting');
    try {
      onPosted(await postScore(session, true));
    } catch (e) {
      setError(e instanceof OnlineError ? e.message : 'Something went wrong. Try again.');
      setState('error');
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Online scoreboard" data-testid="online-post">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold">
            <Globe className="size-4 text-lavender" /> See how you rank everywhere
          </h2>
          <p className="text-sm text-muted-foreground">
            Posts your player name <strong className="text-foreground">{session.name}</strong>, this score and the date. Nothing else.
          </p>
        </div>
        <Button onClick={post} disabled={state === 'posting'} className="gap-2 font-semibold" data-testid="online-post-button">
          {state === 'posting' ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
          {state === 'posting' ? 'Posting…' : 'Post to the online scoreboard'}
        </Button>
      </div>
      {state === 'error' && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default PostScore;
