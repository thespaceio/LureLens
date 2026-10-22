import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, RotateCcw, Share2, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SharePanel from '@/components/SharePanel/SharePanel';
import { rankTitle } from '@/lib/game';
import { LEVELS, LEVEL_ORDER } from '@/types';
import type { Choice, GameSession, Level } from '@/types';

interface ResultsScreenProps {
  session: GameSession;
  rank: { rank: number; of: number };
  personalBest: boolean;
  onPlayAgain: () => void;
  onPlayLevel: (level: Level) => void;
  onScoreboard: () => void;
  onProgress: () => void;
}

const CHOICE: Record<Choice, string> = {
  phishing: 'Phishing',
  legitimate: 'Legitimate',
  timeout: 'No answer',
  skip: 'Skipped',
};

export function ResultsScreen({ session, rank, personalBest, onPlayAgain, onPlayLevel, onScoreboard, onProgress }: ResultsScreenProps) {
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
          {session.practice ? (
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

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onPlayAgain} className="gap-2 font-semibold">
          <RotateCcw className="size-4" /> Play again
        </Button>
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
                  a.correct ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'
                }`}
              >
                {a.correct ? <Check className="size-4" /> : <X className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium [overflow-wrap:anywhere]">{a.subject}</div>
                <div className="text-xs text-muted-foreground">
                  {a.topic} · was <strong className="text-foreground">{a.is_phishing ? 'phishing' : 'legitimate'}</strong> ·
                  you said {CHOICE[a.choice]} · {a.seconds}s
                </div>
              </div>
              <span className="font-mono text-sm text-muted-foreground">{a.correct ? `+${a.points}` : '0'}</span>
            </li>
          ))}
        </ol>
      </section>
    </motion.div>
  );
}

export default ResultsScreen;
