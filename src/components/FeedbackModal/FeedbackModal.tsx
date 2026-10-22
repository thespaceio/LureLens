import { ArrowRight, Check, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
            This email was {isPhish ? 'phishing' : 'legitimate'}
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

        <div className="space-y-5 px-6 py-5">
          <section>
            <h3 className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {isPhish ? <ShieldAlert className="size-4 text-destructive" /> : <ShieldCheck className="size-4 text-primary" />}
              {isPhish ? 'Red flags you could have spotted' : 'Why you can trust it'}
            </h3>
            <ul className="space-y-2">
              {(isPhish ? email.red_flags : email.trust_signals.map(t => ({ description: t, location: undefined }))).map(
                (flag, i) => (
                  <li
                    key={i}
                    className={`flex gap-3 rounded-lg px-3 py-2.5 text-sm ${isPhish ? 'bg-destructive/10' : 'bg-primary/10'}`}
                  >
                    {isPhish ? (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    )}
                    <span>
                      {flag.description}
                      {flag.location && (
                        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{flag.location}</span>
                      )}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">Why it matters</h3>
            <p className="text-sm leading-relaxed">{email.explanation}</p>
          </section>
        </div>

        <div className="border-t border-border px-6 py-4">
          <Button autoFocus onClick={onNext} size="lg" className="w-full gap-2 font-semibold">
            {isLast ? 'See results' : 'Next email'}
            <ArrowRight className="size-4" />
            <kbd className="ml-1 hidden rounded border border-current px-1.5 opacity-60 font-mono text-[10px] sm:inline">Enter</kbd>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FeedbackModal;
