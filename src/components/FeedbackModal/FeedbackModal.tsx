import { ArrowRight } from 'lucide-react';
import Explanation from '@/components/Explanation/Explanation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CHANNELS, channelOf } from '@/types';
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
  timeout: 'No answer',
  skip: 'Skipped',
};

export function FeedbackModal({ open, email, choice, correct, points, streak, isLast, onNext }: FeedbackModalProps) {
  const isPhish = email.is_phishing;
  const verdict = choice === 'timeout' ? "Time's up" : choice === 'skip' ? 'Skipped' : correct ? 'Correct' : 'Not quite';

  const breakdown = correct
    ? [
        `+${points.base} correct`,
        points.speed ? `+${points.speed} speed` : '',
        points.streak ? `+${points.streak} streak (${streak} in a row)` : '',
      ].filter(Boolean).join(' · ')
    : choice === 'timeout'
      ? 'No answer in time. Streak reset.'
      : '0 points. Streak reset.';

  return (
    <Dialog open={open} onOpenChange={o => !o && onNext()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto border-border bg-card p-0 sm:max-w-lg"
      >
        <div
          className={`border-b border-border px-6 pb-4 pt-6 ${
            correct
              ? 'bg-primary/10'
              : 'bg-destructive/10'
          }`}
        >
          <p className={`mb-1 font-mono text-xs uppercase tracking-[0.14em] ${correct ? 'text-primary' : 'text-destructive'}`}>
            {verdict}
          </p>
          <DialogTitle className="text-xl font-semibold">
            This {CHANNELS[channelOf(email)].noun} was {isPhish ? 'phishing' : 'legitimate'}
          </DialogTitle>
          <DialogDescription className="mt-1 font-mono text-xs text-muted-foreground">
            {correct ? `+${points.total} points · ` : ''}
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

        <div className="px-6 py-5">
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
