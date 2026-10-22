import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, ShieldAlert, ShieldCheck, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmailViewer from '@/components/EmailViewer/EmailViewer';
import FeedbackModal from '@/components/FeedbackModal/FeedbackModal';
import { hostOf, scoreAnswer } from '@/lib/game';
import { LEVELS } from '@/types';
import type { AnswerRecord, Choice, Email, Level, Points } from '@/types';

export interface QuizResult {
  answers: AnswerRecord[];
  score: number;
  bestStreak: number;
}

interface QuizInterfaceProps {
  level: Level;
  emails: Email[];
  onFinish: (result: QuizResult) => void;
  onQuit: () => void;
}

interface LastAnswer {
  choice: Choice;
  correct: boolean;
  points: Points;
}

export function QuizInterface({ level, emails, onFinish, onQuit }: QuizInterfaceProps) {
  const cfg = LEVELS[level];
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'answering' | 'feedback'>('answering');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [last, setLast] = useState<LastAnswer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(cfg.seconds);
  const [link, setLink] = useState<{ url: string; clicked: boolean } | null>(null);

  const deadline = useRef(0);
  const answered = useRef(false);
  const email = emails[index];
  const isLast = index === emails.length - 1;

  const answer = useCallback(
    (choice: Choice) => {
      if (phase !== 'answering' || answered.current || !email) return;
      answered.current = true;

      const left = Math.max(0, (deadline.current - performance.now()) / 1000);
      const correct = choice === (email.is_phishing ? 'phishing' : 'legitimate');
      const newStreak = correct ? streak + 1 : 0;
      const points = scoreAnswer(correct, left, level, newStreak);

      setScore(s => s + points.total);
      setStreak(newStreak);
      setBestStreak(b => Math.max(b, newStreak));
      setSecondsLeft(left);
      setAnswers(a => [
        ...a,
        {
          id: email.id,
          subject: email.subject,
          category: email.category,
          topic: email.topic,
          is_phishing: email.is_phishing,
          choice,
          correct,
          seconds: Math.round((cfg.seconds - left) * 10) / 10,
          points: points.total,
        },
      ]);
      setLast({ choice, correct, points });
      setPhase('feedback');
    },
    [phase, email, streak, level, cfg.seconds],
  );

  const next = useCallback(() => {
    if (phase !== 'feedback') return;
    if (isLast) {
      onFinish({ answers, score, bestStreak });
      return;
    }
    answered.current = false;
    setIndex(i => i + 1);
    setSecondsLeft(cfg.seconds);
    setLink(null);
    setLast(null);
    setPhase('answering');
  }, [phase, isLast, onFinish, answers, score, bestStreak, cfg.seconds]);

  // Keep the latest handlers reachable from timers and key listeners.
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });

  // Countdown for the current email.
  useEffect(() => {
    if (phase !== 'answering') return;
    deadline.current = performance.now() + cfg.seconds * 1000;
    const id = window.setInterval(() => {
      const left = Math.max(0, (deadline.current - performance.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0) answerRef.current('timeout');
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, index, cfg.seconds]);

  // Keyboard shortcuts: L = legitimate, P = phishing, S = skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'l') answerRef.current('legitimate');
      else if (key === 'p') answerRef.current('phishing');
      else if (key === 's') answerRef.current('skip');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleQuit = () => {
    if (window.confirm("Quit this game? This round won't be saved.")) onQuit();
  };

  if (!email) return null;

  const pct = Math.max(0, Math.min(100, (secondsLeft / cfg.seconds) * 100));
  const danger = secondsLeft <= 5;
  const warn = !danger && secondsLeft <= cfg.seconds * 0.4;
  const host = link ? hostOf(link.url) : '';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* HUD */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {[
          { label: 'Level', value: cfg.label, className: 'hidden sm:flex' },
          { label: 'Email', value: `${index + 1} / ${emails.length}` },
          { label: 'Score', value: score.toLocaleString(), testId: 'hud-score' },
          { label: 'Streak', value: String(streak) },
          {
            label: 'Time',
            value: `${Math.ceil(secondsLeft)}s`,
            valueClass: `font-mono ${danger ? 'text-destructive' : ''}`,
            testId: 'hud-time',
          },
        ].map(item => (
          <div
            key={item.label}
            className={`flex min-w-0 flex-col rounded-lg border border-border bg-card px-3 py-2 ${item.className ?? ''}`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{item.label}</span>
            <span data-testid={item.testId} className={`truncate text-base font-bold sm:text-lg ${item.valueClass ?? ''}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            danger ? 'bg-destructive' : warn ? 'bg-lavender' : 'bg-primary'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Email */}
      <motion.div key={email.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <EmailViewer email={email} onLinkInspect={(url, clicked) => setLink({ url, clicked })} />
        <div
          className={`mt-2 flex min-h-10 items-start gap-2 rounded-lg px-3 py-2 text-xs ${
            link ? 'bg-secondary text-foreground' : 'text-muted-foreground'
          }`}
          data-testid="link-status"
          aria-live="polite"
        >
          <Link2 className="mt-0.5 size-3.5 shrink-0" />
          {link ? (
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <span className="text-muted-foreground">
                {link.clicked ? 'Links are disabled in training. This one goes to: ' : 'Link goes to: '}
              </span>
              <span className="font-mono">
                {link.url.split(host).map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && <mark className="rounded bg-primary/20 px-0.5 text-primary">{host}</mark>}
                  </span>
                ))}
              </span>
            </span>
          ) : (
            <span>Hover over or tap a link in the email to see where it really goes.</span>
          )}
        </div>
      </motion.div>

      {/* Answers */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          size="lg"
          className="h-14 gap-2 border-primary/50 bg-primary/10 text-base font-semibold text-primary hover:bg-primary/20 hover:text-primary"
          onClick={() => answer('legitimate')}
          disabled={phase !== 'answering'}
        >
          <ShieldCheck className="size-5" />
          Legitimate
          <kbd className="ml-1 hidden rounded border border-current px-1.5 font-mono text-[10px] opacity-60 sm:inline">L</kbd>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 gap-2 border-destructive/50 bg-destructive/10 text-base font-semibold text-destructive hover:bg-destructive/20 hover:text-destructive"
          onClick={() => answer('phishing')}
          disabled={phase !== 'answering'}
        >
          <ShieldAlert className="size-5" />
          Phishing
          <kbd className="ml-1 hidden rounded border border-current px-1.5 font-mono text-[10px] opacity-60 sm:inline">P</kbd>
        </Button>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={handleQuit}>
          Quit game
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => answer('skip')} disabled={phase !== 'answering'}>
          <SkipForward className="size-4" />
          Skip (0 points)
        </Button>
      </div>

      {last && (
        <FeedbackModal
          open={phase === 'feedback'}
          email={email}
          choice={last.choice}
          correct={last.correct}
          points={last.points}
          streak={streak}
          isLast={isLast}
          onNext={next}
        />
      )}
    </div>
  );
}

export default QuizInterface;
