import { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Check, Copy, Phone, RotateCcw, Send, Share2, Trophy, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SharePanel from '@/components/SharePanel/SharePanel';
import PostScore from '@/components/Online/PostScore';
import { ONLINE } from '@/lib/online';
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

export function ResultsScreen({ session, rank, personalBest, newCertificate, onPlayAgain, onPlayLevel, onScoreboard, onProgress, onClassroom, onPosted, signedIn, onSignIn }: ResultsScreenProps) {
  const cfg = LEVELS[session.level];
  const nextLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(session.level) + 1];
  const [sharing, setSharing] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto w-full max-w-3xl space-y-6">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">{cfg.label} complete</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{rankTitle(session.accuracy)}</h1>
        <p className="mt-1 text-5xl font-bold text-primary sm:text-6xl" data-testid="results-score">
          {session.score.toLocaleString()} <span className="text-base font-medium text-muted-foreground">points</span>
        </p>
        <p className="mt-2 flex items-center justify-center gap-2 text-muted-foreground" data-testid="results-rank">
          <Trophy className="size-4" />
          {session.classCode ? (
            <>Class {formatCode(session.classCode)} · saved to your progress, not the scoreboard</>
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
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
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

      {session.classCode && <SendToFacilitator session={session} />}

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
          {session.answers.map(a => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
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
