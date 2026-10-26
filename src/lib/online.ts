// The online scoreboard and certificate check (Supabase, see supabase/schema.sql).
// Plain fetch calls to four database functions; nothing else is sent.
import { SUPABASE_KEY, SUPABASE_URL } from '@/onlineConfig';
import type { GameSession, Level } from '@/types';

export const ONLINE = Boolean(SUPABASE_URL && SUPABASE_KEY);

export class OnlineError extends Error {}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!ONLINE) throw new OnlineError('The online scoreboard is not set up.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OnlineError("You're offline. Try again when you're connected.");
  }
  const headers: Record<string, string> = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  // Older "anon" keys are JWTs and also go in Authorization; new publishable keys don't.
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });
  } catch {
    throw new OnlineError("Couldn't reach the online scoreboard. Check your connection and try again.");
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message;
    // Messages from our own checks (code 22023) are written for players.
    const ours = (data as { code?: string } | null)?.code === '22023';
    throw new OnlineError(ours && message ? message : 'The online scoreboard had a problem. Try again in a moment.');
  }
  return data as T;
}

export interface PostedScore {
  id: string;
  name: string;
  score: number;
  correct: number;
  accuracy: number;
  rank: number | null;
  of: number | null;
}

/** Sends the answers (not the score): the server works the score out itself. */
export function postScore(session: GameSession, ranked = !session.practice): Promise<PostedScore> {
  return rpc<PostedScore>('submit_score', {
    p_name: session.name,
    p_level: session.level,
    p_answers: session.answers.map(a => ({ id: a.id, choice: a.choice, seconds: a.seconds })),
    p_played_at: session.date,
    p_ranked: ranked,
  });
}

export interface BoardRow {
  name: string;
  level: Level;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  best_streak: number;
  avg_seconds: number;
  played_at: string;
}

export function fetchBoard(level: Level | 'all', days: number | null, limit = 20): Promise<BoardRow[]> {
  return rpc<BoardRow[]>('leaderboard', { p_level: level === 'all' ? null : level, p_days: days, p_limit: limit });
}

export function registerCertificate(reference: string, displayName: string, scoreIds: string[]): Promise<{ reference: string }> {
  return rpc('register_certificate', { p_reference: reference, p_display_name: displayName, p_score_ids: scoreIds });
}

export interface CheckedCertificate {
  reference: string;
  display_name: string;
  player_name: string;
  completed_on: string;
  levels: Record<Level, { accuracy: number; score: number; played_at: string }>;
}

export function checkCertificate(reference: string): Promise<CheckedCertificate | null> {
  return rpc<CheckedCertificate | null>('check_certificate', { p_reference: reference });
}

/** Link that opens the certificate check with a reference filled in. */
export function certificateLink(reference: string, base = 'https://lurelens.netlify.app/'): string {
  return `${base}?cert=${encodeURIComponent(reference)}`;
}
