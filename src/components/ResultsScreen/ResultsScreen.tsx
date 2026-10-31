import type { CSSProperties } from 'react';
import RevealText from '@/components/ui/reveal';
import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { Award, Check, Copy, Loader2, Phone, RotateCcw, Send, Share2, Trophy, UserRound, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SharePanel from '@/components/SharePanel/SharePanel';
import PostScore from '@/components/Online/PostScore';
import { ONLINE, OnlineError, postClassResult } from '@/lib/online';
import type { PostedScore } from '@/lib/online';
import { rankTitle } from '@/lib/game';
import { formatCode, resultLine } from '@/lib/classroom';
import { LEVELS, LEVEL_ORDER } from '@/types';
import type { Choice, GameSession, Level } from '@/types';

interface ResultsScreenProps {
  session: GameSession;
  rank: { rank: number; of: number };
  personalBest: boolean;
  newCertificate?: boolean;
  onPlayAgain: () => void;
  onPlayLevel: (level: Level) => void;
  onScoreboard: () => void;
  onProgress: () => void;
  onClassroom: () => void;
  onPosted: (posted: PostedScore) => void;
  /** A classroom game reached its class board. */
  onClassPosted: (posted: PostedScore) => void;
  signedIn: boolean;
  onSignIn: () => void;
}

const CHOICE: Record<Choice, string> = {
  phishing: 'Phishing',
  legitimate: 'Legitimate',
  verify: 'Verify first',
  timeout: 'No answer',
  skip: 'Skipped',
};

export function ResultsScreen({ session, rank, personalBest, newCertificate, onPlayAgain, onPlayLevel, onScoreboard, onProgress, onClassroom, onPosted, onClassPosted, signedIn, onSignIn }: ResultsScreenProps) {
  const cfg = LEVELS[session.level];
  const nextLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(session.level) + 1];
  const [sharing, setSharing] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto w-full max-w-3xl space-y-6">
      <div className="text-center">
        <p className="text-in font-mono text-xs uppercase tracking-[0.16em] text-primary">{cfg.label} complete</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl"><RevealText text={rankTitle(session.accuracy)} /></h1>
        <p className="mt-1 text-5xl font-bold text-primary sm:text-6xl" data-testid="results-score">
          <CountUp value={session.score} /> <span className="text-base font-medium text-muted-foreground">points</span>
        </p>
        <p className="text-in mt-2 flex items-center justify-center gap-2 text-muted-foreground" data-testid="results-rank" style={{ '--d': '700ms' } as CSSProperties}>
          <Trophy className="size-4" />
          {session.classCode ? (
            <>Class {formatCode(session.classCode)} · {ONLINE ? 'for your class board' : 'saved to your progress, not the scoreboard'}</>
          ) : session.practice ? (
            <>Practice round, saved to your progress but not the scoreboard</>
          ) : (
            <>#{rank.rank} of {rank.of} on the {cfg.label} scoreboard</>
          )}
          {personalBest && <span className="font-semibold text-primary">· New personal best!</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Accuracy', `${session.accuracy}%`],
          ['Correct', `${session.correct}/${session.total}`],
          ['Best streak', String(session.bestStreak)],
          ['Avg. answer time', `${session.avgSeconds}s`],
        ].map(([label, value], i) => (
          <div key={label} className="rise-in rounded-xl border border-border bg-card p-4 text-center" style={{ '--i': i + 2 } as CSSProperties}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {newCertificate && (
        <section
          className="flex flex-col items-center gap-3 rounded-xl border-2 border-primary bg-primary/10 p-5 text-center sm:flex-row sm:text-left"
          data-testid="certificate-earned"
        >
          <Award className="size-10 shrink-0 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">You've earned your LureLens certificate</h2>
            <p className="text-sm text-muted-foreground">
              You've now scored at least 80% at every level. Download it, print it or add it to LinkedIn.
            </p>
          </div>
          <Button onClick={onProgress} className="shrink-0 gap-2 font-semibold">
            <Award className="size-4" /> Get your certificate
          </Button>
        </section>
      )}

      {session.classCode &&
        (ONLINE ? (
          <>
            <ClassBoardSend session={session} signedIn={signedIn} onSignIn={onSignIn} onPosted={onClassPosted} />
            <details className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">No internet? Send your result line to your facilitator instead</summary>
              <div className="pt-3">
                <SendToFacilitator session={session} />
              </div>
            </details>
          </>
        ) : (
          <SendToFacilitator session={session} />
        ))}

      {ONLINE && !session.practice && <PostScore session={session} onPosted={onPosted} signedIn={signedIn} onSignIn={onSignIn} />}

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onPlayAgain} className="gap-2 font-semibold" variant={session.classCode ? 'secondary' : 'default'}>
          <RotateCcw className="size-4" /> {session.classCode ? 'Play a ranked round' : 'Play again'}
        </Button>
        {session.classCode && (
          <Button variant="outline" className="gap-2 bg-transparent" onClick={onClassroom}>
            <Users className="size-4" /> Classroom
          </Button>
        )}
        <Button
          variant="secondary"
          className="gap-2"
          aria-expanded={sharing}
          onClick={() => setSharing(s => !s)}
          data-testid="share-button"
        >
          <Share2 className="size-4" /> {sharing ? 'Hide share card' : 'Share result'}
        </Button>
        {nextLevel && session.accuracy >= 70 && (
          <Button variant="secondary" onClick={() => onPlayLevel(nextLevel)}>
            Try {LEVELS[nextLevel].label}
          </Button>
        )}
        <Button variant="outline" className="bg-transparent" onClick={onScoreboard}>
          Scoreboard
        </Button>
        <Button variant="outline" className="bg-transparent" onClick={onProgress}>
          My progress
        </Button>
      </div>

      {sharing && <SharePanel session={session} />}

      <section>
        <h2 className="mb-3 font-semibold">Review your answers</h2>
        <ol className="space-y-2">
          {session.answers.map((a, i) => (
            <li key={a.id} className="rise-in flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3" style={{ '--i': i } as CSSProperties}>
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full ${
                  a.correct
                    ? 'bg-primary/15 text-primary'
                    : a.choice === 'verify'
                      ? 'bg-lavender/15 text-lavender'
                      : 'bg-destructive/15 text-destructive'
                }`}
              >
                {a.correct ? <Check className="size-4" /> : a.choice === 'verify' ? <Phone className="size-4" /> : <X className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium [overflow-wrap:anywhere]">{a.subject}</div>
                <div className="text-xs text-muted-foreground">
                  {a.topic} · was <strong className="text-foreground">{a.is_phishing ? 'phishing' : 'legitimate'}</strong> ·
                  you said {CHOICE[a.choice]} · {a.seconds}s
                </div>
              </div>
              <span className="font-mono text-sm text-muted-foreground">{a.points ? `+${a.points}` : '0'}</span>
            </li>
          ))}
        </ol>
      </section>
    </motion.div>
  );
}

/**
 * Sends a classroom game to the class board: straight away when signed in,
 * otherwise after signing in or quick joining.
 */
function ClassBoardSend({
  session,
  signedIn,
  onSignIn,
  onPosted,
}: {
  session: GameSession;
  signedIn: boolean;
  onSignIn: () => void;
  onPosted: (posted: PostedScore) => void;
}) {
  const [state, setState] = useState<{ sending: boolean; error: string }>({ sending: false, error: '' });
  const started = useRef(false);

  const send = async () => {
    started.current = true;
    setState({ sending: true, error: '' });
    try {
      onPosted(await postClassResult(session));
      setState({ sending: false, error: '' });
    } catch (e) {
      setState({ sending: false, error: e instanceof OnlineError ? e.message : 'Something went wrong. Try again.' });
    }
  };

  // Signed in: the result goes to the class board without a tap. Joining the
  // class is the player's choice to share it with the facilitator.
  useEffect(() => {
    if (signedIn && !session.classBoard && !started.current) {
      const t = window.setTimeout(() => void send(), 0);
      return () => window.clearTimeout(t);
    }
  });

  if (session.classBoard) {
    const { rank, of } = session.classBoard;
    return (
      <section className="flex items-center gap-3 rounded-xl border border-primary/50 bg-card p-4" data-testid="class-posted">
        <Check className="size-5 shrink-0 text-primary" />
        <p className="text-sm">
          On your class board
          {rank && of ? (
            <>
              : <strong>#{rank}</strong> of {of} so far
            </>
          ) : null}
          . Your facilitator can see it now.
        </p>
      </section>
    );
  }

  if (!signedIn) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-lavender/50 bg-card p-4 sm:p-5" data-testid="class-sign-in">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold">
            <Send className="size-4 text-lavender" /> Put this on your class board
          </h2>
          <p className="text-sm text-muted-foreground">Sign in or quick join (no email needed) and your result goes to your facilitator.</p>
        </div>
        <Button onClick={onSignIn} className="gap-2 font-semibold">
          <UserRound className="size-4" /> Sign in or quick join
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-xl border border-lavender/50 bg-card p-4 sm:p-5" data-testid="class-sending">
      <p className="flex items-center gap-2 text-sm">
        {state.error ? <Send className="size-4 text-lavender" /> : <Loader2 className="size-4 animate-spin text-lavender" />}
        {state.error ? "Your result didn't reach the class board." : 'Sending your result to the class board…'}
      </p>
      {state.error && (
        <>
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
          <Button onClick={() => void send()} disabled={state.sending} className="gap-2 font-semibold">
            {state.sending && <Loader2 className="size-4 animate-spin" />} Try again
          </Button>
        </>
      )}
    </section>
  );
}

/** The one line a class player sends back, with copy and share buttons. */
function SendToFacilitator({ session }: { session: GameSession }) {
  const line = resultLine(session);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the line is still on screen to select by hand.
    }
  };
  const share = async () => {
    try {
      await navigator.share({ text: line });
    } catch {
      // The player closed the share sheet.
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-lavender/50 bg-card p-4 sm:p-5" aria-label="Send your result" data-testid="class-result">
      <h2 className="flex items-center gap-2 font-semibold">
        <Send className="size-4 text-lavender" /> Send this to your facilitator
      </h2>
      <p className="select-all rounded-lg bg-background px-3 py-2.5 font-mono text-sm [overflow-wrap:anywhere]" data-testid="class-result-line">
        {line}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} className="gap-2 font-semibold">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy result'}
        </Button>
        {'share' in navigator && (
          <Button variant="secondary" className="gap-2" onClick={share}>
            <Share2 className="size-4" /> Share
          </Button>
        )}
        <Button asChild variant="outline" className="bg-transparent">
          <a href={`https://wa.me/?text=${encodeURIComponent(line)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Send it as it is: your facilitator pastes it into LureLens to see the class results.</p>
    </section>
  );
}

export default ResultsScreen;

/** The score counts up when the results appear (shown at once with reduced motion). */
function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [counted, setShown] = useState(0);
  const shown = reduce ? value : counted;
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: v => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <>
      <span aria-hidden>{shown.toLocaleString()}</span>
      <span className="sr-only">{value.toLocaleString()}</span>
    </>
  );
}
