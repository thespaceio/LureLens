import { Phone } from 'lucide-react';
import { verifyTip } from '@/types';
import type { Choice, Email } from '@/types';

/** How to check this kind of message, shown when verifying was the answer or the player chose it. */
export function VerifyTip({ email, choice }: { email: Email; choice?: Choice }) {
  const verified = choice === 'verify';
  if (!verified && !email.verify_first) return null;
  const lead = email.verify_first
    ? verified
      ? 'The sender may be a real account that has been hacked, so the message alone cannot settle it.'
      : 'Even when you spot it, the safest move here is to check through another channel.'
    : 'Checking is never wrong, but this one could be decided from the message itself. To check it:';
  return (
    <section className="rounded-lg border border-lavender/40 bg-lavender/10 px-4 py-3 text-sm" data-testid="verify-tip">
      <h3 className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-lavender">
        <Phone className="size-4" /> How to verify
      </h3>
      <p className="text-muted-foreground">{lead}</p>
      <p className="mt-1 font-medium">{verifyTip(email)}</p>
    </section>
  );
}

export default VerifyTip;
