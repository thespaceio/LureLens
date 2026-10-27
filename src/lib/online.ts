// The online scoreboard and certificate check (Supabase, see supabase/schema.sql).
// Calls the database functions through the Supabase client, which adds the
// player's sign-in when there is one.
import { ONLINE, getSupabase } from '@/lib/supabase';
import type { GameSession, Level } from '@/types';

export { ONLINE };

export class OnlineError extends Error {}

/** Turns a Supabase error into a message written for players. */
export function friendlyError(error: { code?: string; message?: string } | null | undefined, fallback?: string): OnlineError {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new OnlineError("You're offline. Try again when you're connected.");
  }
  // Messages from our own checks (code 22023) are written for players.
  if (error?.code === '22023' && error.message) return new OnlineError(error.message);
  if (error?.code === '42501') return new OnlineError('Sign in to do that.');
  if (!error?.code && /fetch|network/i.test(error?.message ?? '')) {
    return new OnlineError("Couldn't reach LureLens online. Check your connection and try again.");
  }
  return new OnlineError(fallback ?? 'Something went wrong online. Try again in a moment.');
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!ONLINE) throw new OnlineError('Online features are not set up.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OnlineError("You're offline. Try again when you're connected.");
  }
  let sb;
  try {
    sb = await getSupabase();
  } catch {
    throw new OnlineError("Couldn't load the online features. Check your connection and try again.");
  }
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw friendlyError(error);
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

/**
 * Sends a classroom game to its class board (never the public scoreboard).
 * rank/of in the reply are the player's place in the class. Sending again the
 * same day returns the first result.
 */
export function postClassResult(session: GameSession): Promise<PostedScore & { already?: boolean }> {
  return rpc('submit_score', {
    p_name: session.name,
    p_level: session.level,
    p_answers: session.answers.map(a => ({ id: a.id, choice: a.choice, seconds: a.seconds })),
    p_played_at: session.date,
    p_ranked: false,
    p_class_code: session.classCode,
  });
}

export interface ClassBoardRow {
  name: string;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  avg_seconds: number;
  /** Each answer's outcome in round order: R right, S verify first where not needed, W wrong. */
  marks: string;
  played_at: string;
  is_me: boolean;
}

/** A class's results today, best first. Anyone with the code can read them. */
export function fetchClassBoard(code: string): Promise<ClassBoardRow[]> {
  return rpc<ClassBoardRow[]>('class_board', { p_code: code });
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
  /** The signed-in player's own row. */
  is_me: boolean;
}

export function fetchBoard(level: Level | 'all', days: number | null, limit = 20): Promise<BoardRow[]> {
  return rpc<BoardRow[]>('leaderboard', { p_level: level === 'all' ? null : level, p_days: days, p_limit: limit });
}

export function registerCertificate(reference: string, displayName: string | null, scoreIds: string[]): Promise<{ reference: string; display_name: string }> {
  return rpc('register_certificate', { p_reference: reference, p_display_name: displayName, p_score_ids: scoreIds });
}

export interface CheckedCertificate {
  reference: string;
  display_name: string;
  player_name: string;
  /** Registered by a signed-in account (2.2 and later). */
  account?: boolean;
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
