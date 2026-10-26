import { ArrowRight, Phone } from 'lucide-react';
import Explanation from '@/components/Explanation/Explanation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CHANNELS, channelOf, verifyTip } from '@/types';
import type { Choice, Email, Points } from '@/types';

interface FeedbackModalProps {
  open: boolean;
  email: Email;
  choice: Choice;
  correct: boolean;
  points: Points;
  streak: number;
  isLast: boolean;
  onNext: () => void;
}

const CHOICE_LABEL: Record<Choice, string> = {
  phishing: 'Phishing',
  legitimate: 'Legitimate',
  verify: 'Verify first',
  timeout: 'No answer',
  skip: 'Skipped',
};

export function FeedbackModal({ open, email, choice, correct, points, streak, isLast, onNext }: FeedbackModalProps) {
  const isPhish = email.is_phishing;
  const verified = choice === 'verify';
  // Verifying where it wasn't needed is safe, so it gets its own colour, not red.
  const tone = correct ? 'primary' : verified ? 'lavender' : 'destructive';
  const verdict =
    choice === 'timeout'
      ? "Time's up"
      : choice === 'skip'
        ? 'Skipped'
        : verified
          ? correct
            ? 'Good call: checking first is right here'
            : 'Safe, but you could have decided'
          : correct
            ? 'Correct'
            : 'Not quite';

  const breakdown = verified
    ? correct
      ? '0 points, but it counts as correct and your streak keeps growing.'
      : '0 points for playing it safe. Streak kept.'
    : correct
    ? [
        `+${points.base} correct`,
        points.speed ? `+${points.speed} speed` : '',
        points.streak ? `+${points.streak} streak (${streak} in a row)` : '',
      ].filter(Boolean).join(' · ')
    : choice === 'timeout'
      ? 'No answer in time. Streak reset.'
      : '0 points. Streak reset.';

  const showTip = verified || Boolean(email.verify_first);
  const tipLead = email.verify_first
    ? verified
      ? 'The sender may be a real account that has been hacked, so the message alone cannot settle it.'
      : 'Even when you spot it, the safest move here is to check through another channel.'
    : 'Checking is never wrong, but this one could be decided from the message itself. To check it:';

  return (
    <Dialog open={open} onOpenChange={o => !o && onNext()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto border-border bg-card p-0 sm:max-w-lg"
      >
        <div
          className={`border-b border-border px-6 pb-4 pt-6 ${
            tone === 'primary' ? 'bg-primary/10' : tone === 'lavender' ? 'bg-lavender/10' : 'bg-destructive/10'
          }`}
        >
          <p
            className={`mb-1 font-mono text-xs uppercase tracking-[0.14em] ${
              tone === 'primary' ? 'text-primary' : tone === 'lavender' ? 'text-lavender' : 'text-destructive'
            }`}
          >
            {verdict}
          </p>
          <DialogTitle className="text-xl font-semibold">
            This {CHANNELS[channelOf(email)].noun} was {isPhish ? 'phishing' : 'legitimate'}
          </DialogTitle>
          <DialogDescription className="mt-1 font-mono text-xs text-muted-foreground">
            {correct && !verified ? `+${points.total} points · ` : ''}
            {breakdown}
          </DialogDescription>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
              You: <strong className="text-foreground">{CHOICE_LABEL[choice]}</strong>
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
              Answer: <strong className="text-foreground">{isPhish ? 'Phishing' : 'Legitimate'}</strong>
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">{email.topic}</span>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {showTip && (
            <section className="rounded-lg border border-lavender/40 bg-lavender/10 px-4 py-3 text-sm" data-testid="verify-tip">
              <h3 className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-lavender">
                <Phone className="size-4" /> How to verify
              </h3>
              <p className="text-muted-foreground">{tipLead}</p>
              <p className="mt-1 font-medium">{verifyTip(email)}</p>
            </section>
          )}
          <Explanation email={email} />
        </div>

        <div className="border-t border-border px-6 py-4">
          <Button autoFocus onClick={onNext} size="lg" className="w-full gap-2 font-semibold">
            {isLast ? 'See results' : 'Next message'}
            <ArrowRight className="size-4" />
            <kbd className="ml-1 hidden rounded border border-current px-1.5 opacity-60 font-mono text-[10px] sm:inline">Enter</kbd>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FeedbackModal;
