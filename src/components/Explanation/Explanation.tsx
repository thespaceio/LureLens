import { Check, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import ReportMistake from '@/components/ReportMistake/ReportMistake';
import { reviewItems } from '@/lib/marks';
import type { Email } from '@/types';

interface ExplanationProps {
  email: Email;
  large?: boolean;
  /**
   * Set when the message is shown beside this explanation with its red flags
   * marked: numbered items then point to the same numbers on the message, and
   * pressing a number brings that spot into view.
   */
  onShow?: (n: number) => void;
}

/** Red flags (or trust signals) and the "why it matters" text for a message. */
export function Explanation({ email, large = false, onShow }: ExplanationProps) {
  const isPhish = email.is_phishing;
  const items = reviewItems(email);
  const marked = Boolean(onShow) && items.some(i => i.n);
  const text = large ? 'text-base' : 'text-sm';
  const thing = isPhish ? 'red flag' : 'sign';

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {isPhish ? <ShieldAlert className="size-4 text-destructive" /> : <ShieldCheck className="size-4 text-primary" />}
          {isPhish ? 'Red flags you could have spotted' : 'Why you can trust it'}
        </h3>
        {marked && (
          <p className="mb-2 text-xs text-muted-foreground">
            The numbers match the marks on the message. Tap one to see where it is.
          </p>
        )}
        <ul className="space-y-2" data-testid="review-items">
          {items.map((item, i) => (
            <li key={i} className={`flex gap-3 rounded-lg px-3 py-2.5 ${text} ${isPhish ? 'bg-destructive/10' : 'bg-primary/10'}`}>
              {marked && item.n ? (
                <button
                  type="button"
                  onClick={() => onShow?.(item.n!)}
                  aria-label={`Show ${thing} ${item.n} on the message`}
                  className="group -my-1 -ml-1 grid size-8 shrink-0 place-items-center rounded-full"
                >
                  <span
                    className={`grid size-6 place-items-center rounded-full font-mono text-xs font-bold transition-transform group-hover:scale-110 ${
                      isPhish ? 'bg-destructive text-background' : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {item.n}
                  </span>
                </button>
              ) : isPhish ? (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              )}
              <span className="min-w-0">
                {item.description}
                {marked && item.spot && (
                  <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">“{item.spot}”</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">Why it matters</h3>
        <p className={`${text} leading-relaxed`}>{email.explanation}</p>
      </section>

      <ReportMistake email={email} />
    </div>
  );
}

export default Explanation;
