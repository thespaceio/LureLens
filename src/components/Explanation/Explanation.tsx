import { Check, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Email } from '@/types';

/** Red flags (or trust signals) and the "why it matters" text for a message. */
export function Explanation({ email, large = false }: { email: Email; large?: boolean }) {
  const isPhish = email.is_phishing;
  const items = isPhish ? email.red_flags : email.trust_signals.map(t => ({ description: t, location: undefined }));
  const text = large ? 'text-base' : 'text-sm';

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {isPhish ? <ShieldAlert className="size-4 text-destructive" /> : <ShieldCheck className="size-4 text-primary" />}
          {isPhish ? 'Red flags you could have spotted' : 'Why you can trust it'}
        </h3>
        <ul className="space-y-2">
          {items.map((flag, i) => (
            <li key={i} className={`flex gap-3 rounded-lg px-3 py-2.5 ${text} ${isPhish ? 'bg-destructive/10' : 'bg-primary/10'}`}>
              {isPhish ? (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              )}
              <span>
                {flag.description}
                {flag.location && <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{flag.location}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">Why it matters</h3>
        <p className={`${text} leading-relaxed`}>{email.explanation}</p>
      </section>
    </div>
  );
}

export default Explanation;
