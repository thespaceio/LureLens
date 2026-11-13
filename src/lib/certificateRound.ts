// Certificate rounds (2.8): played on messages that are not in the public code.
// The server deals them one at a time, times each answer itself and only
// reports the result at the end (supabase/schema.sql, "Certificate rounds").
import { rpc } from '@/lib/online';
import type { Email, Level } from '@/types';

/** A message as the server deals it: what the player sees, never the answer. */
export interface DealtMessage {
  round: string;
  level: Level;
  /** 0-based position in the round. */
  index: number;
  total: number;
  /** Seconds allowed for this message. */
  seconds: number;
  /** Seconds already gone since the server dealt it (after a reload, say). */
  elapsed: number;
  message: Record<string, unknown> & { id: string };
}

export interface RoundResult {
  id: string;
  level: Level;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  best_streak: number;
  avg_seconds: number;
  played_at: string;
}

export type CertificateChoice = 'phishing' | 'legitimate' | 'verify' | 'skip';

export const startCertificateRound = (level: Level) => rpc<DealtMessage>('start_certificate_round', { p_level: level });

export const currentCertificateRound = (round: string) => rpc<DealtMessage>('certificate_round_current', { p_round: round });

export const answerCertificateRound = (round: string, choice: CertificateChoice) =>
  rpc<{ done: false; next: DealtMessage } | { done: true; result: RoundResult }>('answer_certificate_round', {
    p_round: round,
    p_choice: choice,
  });

/**
 * The dealt message in the shape the viewers expect. Answer fields are left
 * empty: the player is never told them during a certificate round.
 */
export function asViewable(dealt: DealtMessage): Email {
  const m = dealt.message as Record<string, unknown>;
  return {
    ...(m as object),
    id: dealt.message.id,
    level: dealt.level,
    is_phishing: false,
    category: 'accounts',
    topic: '',
    subject: typeof m.subject === 'string' ? m.subject : '',
    red_flags: [],
    trust_signals: [],
    explanation: '',
  } as unknown as Email;
}
