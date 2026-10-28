import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Phone, Play, ShieldAlert, ShieldCheck, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmailViewer from '@/components/EmailViewer/EmailViewer';
import MessageViewer from '@/components/MessageViewer/MessageViewer';
import FeedbackModal from '@/components/FeedbackModal/FeedbackModal';
import LinkStatus from '@/components/LinkStatus/LinkStatus';
import type { InspectedLink } from '@/components/LinkStatus/LinkStatus';
import { scoreAnswer, scoreVerify } from '@/lib/game';
import { CHANNELS, LEVELS, channelOf } from '@/types';
import type { AnswerRecord, Choice, Email, EmailMessage, Level, Points } from '@/types';

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
  const [link, setLink] = useState<InspectedLink | null>(null);
  const [paused, setPaused] = useState(false);

  const deadline = useRef(0);
  const answered = useRef(false);
  const pausedRef = useRef(false);
  const remainingMs = useRef(0);
  const email = emails[index];
  const isLast = index === emails.length - 1;

  const answer = useCallback(
    (choice: Choice) => {
      if (phase !== 'answering' || answered.current || pausedRef.current || !email) return;
      answered.current = true;

      // Time is kept to a tenth of a second, the same precision the online
      // scoreboard uses to check the score.
      const spent = Math.min(cfg.seconds, Math.round((cfg.seconds - Math.max(0, (deadline.current - performance.now()) / 1000)) * 10) / 10);
      const left = cfg.seconds - spent;
      let correct: boolean;
      let newStreak: number;
      let points: Points;
      if (choice === 'verify') {
        // Checking first is always safe: it never breaks the streak.
        correct = Boolean(email.verify_first);
        newStreak = correct ? streak + 1 : streak;
        points = scoreVerify();
      } else {
        correct = choice === (email.is_phishing ? 'phishing' : 'legitimate');
        newStreak = correct ? streak + 1 : 0;
        points = scoreAnswer(correct, left, level, newStreak);
      }

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
          seconds: spent,
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

  // Start a fresh clock for each email.
  useEffect(() => {
    if (phase !== 'answering') return;
    deadline.current = performance.now() + cfg.seconds * 1000;
  }, [phase, index, cfg.seconds]);

  // Tick while answering and not paused.
  useEffect(() => {
    if (phase !== 'answering' || paused) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, (deadline.current - performance.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0) answerRef.current('timeout');
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, index, paused]);

  // Pausing freezes the clock and hides the email, so it can't be used to study it.
  const pause = useCallback(() => {
    if (phase !== 'answering' || pausedRef.current || answered.current) return;
    remainingMs.current = Math.max(0, deadline.current - performance.now());
    pausedRef.current = true;
    setPaused(true);
  }, [phase]);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    deadline.current = performance.now() + remainingMs.current;
    pausedRef.current = false;
    setPaused(false);
  }, []);

  // A phone call or switching tabs pauses the game instead of timing out.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause]);

  // Keyboard shortcuts: L = legitimate, P = phishing, S = skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'l') answerRef.current('legitimate');
      else if (key === 'p') answerRef.current('phishing');
      else if (key === 'v') answerRef.current('verify');
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
  const noun = CHANNELS[channelOf(email)].noun;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* HUD */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {[
          { label: 'Level', value: cfg.label, className: 'hidden sm:flex' },
          { label: 'Message', value: `${index + 1} / ${emails.length}` },
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
      <motion.div
        key={email.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        <div aria-hidden={paused} className={paused ? 'invisible' : undefined}>
          {email.channel === 'sms' || email.channel === 'whatsapp' ? (
            <MessageViewer message={email} onLinkInspect={(url, clicked) => setLink({ url, clicked })} />
          ) : (
            <EmailViewer email={email as EmailMessage} onLinkInspect={(url, clicked) => setLink({ url, clicked })} />
          )}
        </div>
        {paused && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-6 text-center"
            data-testid="paused-overlay"
          >
            <Pause className="size-8 text-lavender" />
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">Paused</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              The clock is stopped at {Math.ceil(secondsLeft)}s and the {noun} is hidden until you come back.
            </p>
            <Button autoFocus size="lg" className="mt-1 gap-2 font-semibold" onClick={resume}>
              <Play className="size-4" />
              Resume
            </Button>
          </div>
        )}
        <LinkStatus link={link} noun={noun} />
      </motion.div>

      {/* Answers */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          size="lg"
          className="h-14 gap-2 border-primary/50 bg-primary/10 text-base font-semibold text-primary hover:bg-primary/20 hover:text-primary"
          onClick={() => answer('legitimate')}
          disabled={phase !== 'answering' || paused}
        >
          <ShieldCheck className="size-5" />
          Legitimate
          <kbd className="ml-1 hidden rounded border border-current px-1.5 font-mono text-[10px] opacity-70 sm:inline">L</kbd>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 gap-2 border-destructive/50 bg-destructive/10 text-base font-semibold text-destructive hover:bg-destructive/20 hover:text-destructive"
          onClick={() => answer('phishing')}
          disabled={phase !== 'answering' || paused}
        >
          <ShieldAlert className="size-5" />
          Phishing
          <kbd className="ml-1 hidden rounded border border-current px-1.5 font-mono text-[10px] opacity-70 sm:inline">P</kbd>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="col-span-2 h-12 gap-2 border-lavender/50 bg-lavender/10 text-sm font-semibold text-lavender hover:bg-lavender/20 hover:text-lavender sm:text-base"
          onClick={() => answer('verify')}
          disabled={phase !== 'answering' || paused}
          data-testid="verify-button"
        >
          <Phone className="size-4" />
          <span>Verify first</span>
          <span className="hidden font-normal opacity-80 sm:inline">: check through the official app or a number I trust</span>
          <kbd className="ml-1 hidden rounded border border-current px-1.5 font-mono text-[10px] opacity-70 sm:inline">V</kbd>
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={handleQuit}>
          Quit game
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={paused ? resume : pause}
          disabled={phase !== 'answering'}
          data-testid="pause-button"
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => answer('skip')}
          disabled={phase !== 'answering' || paused}
        >
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
