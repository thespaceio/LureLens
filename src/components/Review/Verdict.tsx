import { forwardRef } from 'react';
import { CHANNELS, channelOf } from '@/types';
import type { Choice, Email, Points } from '@/types';

const CHOICE_LABEL: Record<Choice, string> = {
  phishing: 'Phishing',
  legitimate: 'Legitimate',
  verify: 'Verify first',
  timeout: 'No answer',
  skip: 'Skipped',
};

interface VerdictProps {
  email: Email;
  choice: Choice;
  correct: boolean;
  points: Points;
  streak: number;
  /** How many red flags (or reasons to trust) are marked on the message. */
  marked: number;
}

/** The result of one answer, shown above the message after answering. Focused when it appears. */
export const Verdict = forwardRef<HTMLDivElement, VerdictProps>(function Verdict(
  { email, choice, correct, points, streak, marked },
  ref,
) {
  const isPhish = email.is_phishing;
  const verified = choice === 'verify';
  const noun = CHANNELS[channelOf(email)].noun;
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
        ]
          .filter(Boolean)
          .join(' · ')
      : choice === 'timeout'
        ? 'No answer in time. Streak reset.'
        : '0 points. Streak reset.';

  const where =
    marked === 0
      ? ''
      : isPhish
        ? `${marked === 1 ? 'The red flag is' : `The ${marked} red flags are`} marked on the ${noun}.`
        : `${marked === 1 ? 'The sign it is safe is' : `The ${marked} signs it is safe are`} marked on the ${noun}.`;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby="verdict-title"
      data-testid="verdict"
      className={`scroll-mt-20 rounded-xl border px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-lavender/60 ${
        tone === 'primary' ? 'border-primary/40 bg-primary/10' : tone === 'lavender' ? 'border-lavender/40 bg-lavender/10' : 'border-destructive/40 bg-destructive/10'
      }`}
    >
      <p
        className={`mb-1 font-mono text-xs uppercase tracking-[0.14em] ${
          tone === 'primary' ? 'text-primary' : tone === 'lavender' ? 'text-lavender' : 'text-destructive'
        }`}
      >
        {verdict}
      </p>
      <h2 id="verdict-title" className="text-xl font-semibold">
        This {noun} was {isPhish ? 'phishing' : 'legitimate'}
      </h2>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {correct && !verified ? `+${points.total} points · ` : ''}
        {breakdown}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
          You: <strong className="text-foreground">{CHOICE_LABEL[choice]}</strong>
        </span>
        <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
          Answer: <strong className="text-foreground">{isPhish ? 'Phishing' : 'Legitimate'}</strong>
        </span>
        <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">{email.topic}</span>
      </div>
      {where && <p className="mt-3 text-sm text-foreground">{where}</p>}
    </div>
  );
});

export default Verdict;
