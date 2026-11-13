import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Loader2, Lock, Phone, RotateCcw, ShieldAlert, ShieldCheck, SkipForward, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LinkStatus from '@/components/LinkStatus/LinkStatus';
import type { InspectedLink } from '@/components/LinkStatus/LinkStatus';
import ReviewViewer from '@/components/Review/ReviewViewer';
import { CERTIFICATE_ACCURACY } from '@/lib/certificate';
import { answerCertificateRound, asViewable, currentCertificateRound, startCertificateRound } from '@/lib/certificateRound';
import type { CertificateChoice, DealtMessage, RoundResult } from '@/lib/certificateRound';
import { OnlineError } from '@/lib/online';
import { CHANNELS, LEVELS, channelOf } from '@/types';
import type { Level } from '@/types';

const RESUME_KEY = 'lurelens_cert_round';

function readResume(level: Level): string | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? 'null') as { level: Level; round: string } | null;
    return saved?.level === level ? saved.round : null;
  } catch {
    return null;
  }
}
function saveResume(level: Level, round: string | null) {
  try {
    if (round) sessionStorage.setItem(RESUME_KEY, JSON.stringify({ level, round }));
    else sessionStorage.removeItem(RESUME_KEY);
  } catch {
    // Storage blocked: a reload simply can't resume the round.
  }
}

type Phase =
  | { kind: 'intro' }
  | { kind: 'loading' }
  | { kind: 'playing'; dealt: DealtMessage; sending: boolean }
  | { kind: 'done'; result: RoundResult }
  | { kind: 'error'; message: string };

/**
 * A certificate round: ten messages the player has never seen in practice,
 * dealt and timed by the server, with only the result shown at the end.
 */
export function CertificateRound({
  level,
  onFinished,
  onExit,
}: {
  level: Level;
  /** The server's result, to save to this device's progress. */
  onFinished: (result: RoundResult) => void;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [secondsLeft, setSecondsLeft] = useState(LEVELS[level].seconds);
  const [link, setLink] = useState<InspectedLink | null>(null);
  const deadline = useRef(0);
  const sending = useRef(false);

  const fail = (e: unknown) =>
    setPhase({ kind: 'error', message: e instanceof OnlineError ? e.message : 'Something went wrong. Try again.' });

  const show = useCallback(
    (dealt: DealtMessage) => {
      saveResume(level, dealt.round);
      deadline.current = performance.now() + Math.max(0, dealt.seconds - dealt.elapsed) * 1000;
      setSecondsLeft(Math.max(0, dealt.seconds - dealt.elapsed));
      setLink(null);
      sending.current = false;
      setPhase({ kind: 'playing', dealt, sending: false });
      window.scrollTo(0, 0);
    },
    [level],
  );

  // A round in progress in this tab (after a reload) carries on where it was,
  // with the clock still running.
  useEffect(() => {
    const round = readResume(level);
    if (!round) return;
    let live = true;
    currentCertificateRound(round)
      .then(d => live && show(d))
      .catch(() => saveResume(level, null));
    return () => {
      live = false;
    };
  }, [level, show]);

  const begin = async () => {
    setPhase({ kind: 'loading' });
    try {
      show(await startCertificateRound(level));
    } catch (e) {
      fail(e);
    }
  };

  const answer = useCallback(
    async (choice: CertificateChoice) => {
      if (phase.kind !== 'playing' || sending.current) return;
      sending.current = true;
      setPhase({ ...phase, sending: true });
      try {
        const reply = await answerCertificateRound(phase.dealt.round, choice);
        if (reply.done) {
          saveResume(level, null);
          onFinished(reply.result);
          setPhase({ kind: 'done', result: reply.result });
          window.scrollTo(0, 0);
        } else {
          show(reply.next);
        }
      } catch (e) {
        sending.current = false;
        fail(e);
      }
    },
    [phase, level, onFinished, show],
  );

  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });

  // The clock: when it runs out the message counts as unanswered.
  const playing = phase.kind === 'playing';
  const round = phase.kind === 'playing' ? phase.dealt.round : null;
  const index = phase.kind === 'playing' ? phase.dealt.index : -1;
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, (deadline.current - performance.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0) void answerRef.current('skip');
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, round, index]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'l') void answerRef.current('legitimate');
      else if (key === 'p') void answerRef.current('phishing');
      else if (key === 'v') void answerRef.current('verify');
      else if (key === 's') void answerRef.current('skip');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  const cfg = LEVELS[level];

  if (phase.kind === 'intro' || phase.kind === 'loading' || phase.kind === 'error') {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5" data-testid="certificate-round-intro">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Certificate round · {cfg.label}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-[-0.02em]">Ready when you are</h1>
        </div>
        <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <p className="flex gap-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-lavender" aria-hidden />
            <span>
              Ten messages you won't find in practice. They come from the LureLens server one at a time, so the answers
              aren't anywhere to look up.
            </span>
          </p>
          <p className="flex gap-3">
            <Timer className="mt-0.5 size-4 shrink-0 text-lavender" aria-hidden />
            <span>
              {cfg.seconds} seconds per message, timed by the server. There's no pause, and the clock keeps running if you
              switch apps or reload.
            </span>
          </p>
          <p className="flex gap-3">
            <Award className="mt-0.5 size-4 shrink-0 text-lavender" aria-hidden />
            <span>
              Score {CERTIFICATE_ACCURACY}% or more to pass this level. You'll see your result at the end, not which answers
              were right, so the messages stay fair for everyone. Three tries per level each day.
            </span>
          </p>
        </section>
        {phase.kind === 'error' && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm" role="alert">
            {phase.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="lg" className="gap-2 font-semibold" onClick={begin} disabled={phase.kind === 'loading'} data-testid="start-certificate-round">
            {phase.kind === 'loading' && <Loader2 className="size-4 animate-spin" />}
            Start the {cfg.label} certificate round
          </Button>
          <Button size="lg" variant="outline" className="bg-transparent" onClick={onExit}>
            Back to progress
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'done') {
    const r = phase.result;
    const passed = r.accuracy >= CERTIFICATE_ACCURACY;
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-2xl space-y-5 text-center" data-testid="certificate-round-result">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Certificate round · {cfg.label}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em]">
          {passed ? `${cfg.label} passed` : 'Not this time'}
        </h1>
        <p className={`text-6xl font-bold ${passed ? 'text-primary' : 'text-foreground'}`}>{r.accuracy}%</p>
        <p className="text-muted-foreground">
          {r.correct} of {r.total} right · {r.score.toLocaleString()} points · {r.avg_seconds}s per message
        </p>
        <p className="mx-auto max-w-prose text-sm text-muted-foreground">
          {passed
            ? 'This level now counts towards your certificate. It is saved to your account, so it can be checked online.'
            : `You need ${CERTIFICATE_ACCURACY}% to pass. Practise ${cfg.label} rounds, where every answer is explained, then try again.`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="lg" className="gap-2 font-semibold" onClick={onExit}>
            <Award className="size-4" /> Back to my certificate
          </Button>
          {!passed && (
            <Button size="lg" variant="secondary" className="gap-2" onClick={() => setPhase({ kind: 'intro' })}>
              <RotateCcw className="size-4" /> Try again
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  const { dealt, sending: busy } = phase;
  const email = asViewable(dealt);
  const noun = CHANNELS[channelOf(email)].noun;
  const pct = Math.max(0, Math.min(100, (secondsLeft / dealt.seconds) * 100));
  const danger = secondsLeft <= 5;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4" data-testid="certificate-round" data-no-tilt>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Certificate round', value: cfg.label },
          { label: 'Message', value: `${dealt.index + 1} / ${dealt.total}` },
          { label: 'Time', value: `${Math.ceil(secondsLeft)}s`, className: `font-mono ${danger ? 'text-destructive' : ''}` },
        ].map(item => (
          <div key={item.label} className="flex min-w-0 flex-col rounded-lg border border-border bg-card px-3 py-2">
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{item.label}</span>
            <span className={`truncate text-base font-bold sm:text-lg ${item.className ?? ''}`}>{item.value}</span>
          </div>
        ))}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <div className={`h-full rounded-full transition-[width] duration-100 ease-linear ${danger ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>

      <motion.div key={dealt.message.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <ReviewViewer email={email} onLinkInspect={(url, clicked) => setLink({ url, clicked })} />
        <LinkStatus link={link} noun={noun} />
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          size="lg"
          className="h-14 gap-2 border-primary/50 bg-primary/10 text-base font-semibold text-primary hover:bg-primary/20 hover:text-primary"
          onClick={() => answer('legitimate')}
          disabled={busy}
        >
          <ShieldCheck className="size-5" /> Legitimate
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 gap-2 border-destructive/50 bg-destructive/10 text-base font-semibold text-destructive hover:bg-destructive/20 hover:text-destructive"
          onClick={() => answer('phishing')}
          disabled={busy}
        >
          <ShieldAlert className="size-5" /> Phishing
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="col-span-2 h-12 gap-2 border-lavender/50 bg-lavender/10 text-sm font-semibold text-lavender hover:bg-lavender/20 hover:text-lavender sm:text-base"
          onClick={() => answer('verify')}
          disabled={busy}
          data-testid="verify-button"
        >
          <Phone className="size-4" /> Verify first
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5 text-xs">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
          {busy ? 'Sending your answer…' : 'Answers are checked at the end'}
        </span>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => answer('skip')} disabled={busy}>
          <SkipForward className="size-4" /> Skip
        </Button>
      </div>
    </div>
  );
}

export default CertificateRound;
