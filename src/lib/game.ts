// Pure game rules: picking emails, scoring and titles.
import emailsData from '@/data/emails.json';
import { LEVELS } from '@/types';
import { channelOf } from '@/types';
import type { CategoryId, Channel, Email, GameSession, Level, Points } from '@/types';

export const ALL_EMAILS = emailsData as unknown as Email[];

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
/** The streak bonus starts on the 3rd correct answer in a row. */
export const STREAK_START = 3;
export const STREAK_BONUS = 50;

/** A source of random numbers in [0, 1). Classroom rounds pass a seeded one. */
export type Random = () => number;

export function shuffle<T>(items: T[], rand: Random = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function emailsFor(level: Level, categories: CategoryId[] = [], channels: Channel[] = []): Email[] {
  return ALL_EMAILS.filter(
    e =>
      e.level === level &&
      (categories.length === 0 || categories.includes(e.category)) &&
      (channels.length === 0 || channels.includes(channelOf(e))),
  );
}

/** Number of messages available per channel for a level. */
export function channelCounts(level: Level): Record<Channel, number> {
  const counts: Record<Channel, number> = { email: 0, sms: 0, whatsapp: 0 };
  for (const e of emailsFor(level)) counts[channelOf(e)] += 1;
  return counts;
}

/** Number of emails available per category for a level. */
export function categoryCounts(level: Level): Partial<Record<CategoryId, number>> {
  const counts: Partial<Record<CategoryId, number>> = {};
  for (const e of emailsFor(level)) counts[e.category] = (counts[e.category] ?? 0) + 1;
  return counts;
}

/**
 * When this player last saw each message: a larger number is more recent.
 * Messages they have never seen are not in the map.
 */
export type SeenOrder = Map<string, number>;

export function seenOrder(sessions: GameSession[]): SeenOrder {
  const seen: SeenOrder = new Map();
  const byDate = [...sessions].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  let n = 0;
  for (const s of byDate) for (const a of s.answers) seen.set(a.id, ++n);
  return seen;
}

/**
 * Pick a round of emails: up to `LEVELS[level].rounds`, roughly half phishing
 * (4–6 out of 10) so players can't win by counting answers.
 *
 * With `seen`, messages the player has never seen come first, then the ones
 * they saw longest ago, so nobody meets the same message again until they have
 * worked through the rest of the level. Classroom rounds pass no `seen`: everyone
 * in the class must get the same messages.
 */
export function buildRound(
  level: Level,
  categories: CategoryId[] = [],
  channels: Channel[] = [],
  rand: Random = Math.random,
  seen?: SeenOrder,
): Email[] {
  const pool = emailsFor(level, categories, channels);
  const rounds = Math.min(LEVELS[level].rounds, pool.length);
  const order = (list: Email[]) => freshestFirst(shuffle(list, rand), seen);
  const phish = order(pool.filter(e => e.is_phishing));
  const legit = order(pool.filter(e => !e.is_phishing));

  let phishCount = Math.floor(rounds / 2) + Math.floor(rand() * 3) - 1;
  if (seen?.size) {
    // Lean towards the balance that needs no repeats, when one of the usual three does.
    const unseenPhish = phish.filter(e => !seen.has(e.id)).length;
    const unseenLegit = legit.filter(e => !seen.has(e.id)).length;
    const repeats = (p: number) => Math.max(0, p - unseenPhish) + Math.max(0, rounds - p - unseenLegit);
    const options = [phishCount, Math.floor(rounds / 2), Math.floor(rounds / 2) - 1, Math.floor(rounds / 2) + 1];
    phishCount = options.reduce((best, p) => (repeats(p) < repeats(best) ? p : best), phishCount);
  }
  phishCount = Math.max(rounds - legit.length, Math.min(phishCount, phish.length, rounds));
  phishCount = Math.max(0, phishCount);
  const legitCount = Math.min(rounds - phishCount, legit.length);

  const round = [...phish.slice(0, phishCount), ...legit.slice(0, legitCount)];
  if (channels.length === 0) mixInPhoneMessages(round, pool, rand, seen);
  return shuffle(round, rand);
}

/** Unseen messages first (in their shuffled order), then the least recently seen. */
function freshestFirst(list: Email[], seen?: SeenOrder): Email[] {
  if (!seen || seen.size === 0) return list;
  return list
    .map((e, i) => ({ e, i, at: seen.get(e.id) ?? 0 }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map(x => x.e);
}

/** Mixed rounds always include a few texts or chats, not just emails. */
export const MIN_PHONE_MESSAGES = 2;

/** Swap emails for unused SMS or WhatsApp items of the same answer, keeping the balance. */
function mixInPhoneMessages(round: Email[], pool: Email[], rand: Random, seen?: SeenOrder) {
  const isPhone = (e: Email) => channelOf(e) !== 'email';
  const used = new Set(round.map(e => e.id));
  const spare = freshestFirst(shuffle(pool.filter(e => isPhone(e) && !used.has(e.id)), rand), seen);
  let missing = MIN_PHONE_MESSAGES - round.filter(isPhone).length;
  for (let i = 0; i < round.length && missing > 0; i++) {
    if (isPhone(round[i])) continue;
    // Don't bring back a message they've seen in place of one they haven't.
    const j = spare.findIndex(e => e.is_phishing === round[i].is_phishing && (!seen?.has(e.id) || seen.has(round[i].id)));
    if (j === -1) continue;
    round[i] = spare.splice(j, 1)[0];
    missing--;
  }
}

export function scoreAnswer(
  correct: boolean,
  secondsLeft: number,
  level: Level,
  streakAfterAnswer: number,
): Points {
  if (!correct) return { base: 0, speed: 0, streak: 0, total: 0 };
  const cfg = LEVELS[level];
  const ratio = Math.max(0, Math.min(1, secondsLeft / cfg.seconds));
  // The tiny nudge makes x.5 round up even when floating point gives x.4999…,
  // so the game always agrees with the online scoreboard's exact maths.
  const base = Math.round(BASE_POINTS * cfg.multiplier + 1e-9);
  const speed = Math.round(MAX_SPEED_BONUS * ratio * cfg.multiplier + 1e-9);
  const streak = streakAfterAnswer >= STREAK_START ? STREAK_BONUS : 0;
  return { base, speed, streak, total: base + speed + streak };
}

/**
 * "Verify first" never scores points: points reward deciding. It is still
 * safe, so it never resets the streak, and on messages where checking
 * through another channel is the real-world best move it counts as correct.
 */
export function scoreVerify(): Points {
  return { base: 0, speed: 0, streak: 0, total: 0 };
}

export function accuracyOf(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

export function rankTitle(accuracy: number): string {
  if (accuracy >= 90) return 'Phish Hunter';
  if (accuracy >= 70) return 'Sharp Eye';
  if (accuracy >= 50) return 'Getting There';
  return 'Keep Training';
}

export function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  return at === -1 ? '' : address.slice(at + 1).toLowerCase();
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export interface TextPart {
  text: string;
  /** Set when this part is a link; the full URL to show on inspection. */
  url?: string;
}

// Web links in plain-text messages, with or without http(s)://, including the
// bare short links scam texts use (bit.ly/abc, gtb-verify.xyz/login).
// The lookbehind skips the domain part of email addresses.
const LINK_RE =
  /(?<![@\w.-])(?:https?:\/\/[^\s<>"']+|(?:[a-z0-9-]+\.)+(?:com|ng|net|org|xyz|top|info|link|ly|co|io|me|site|online|live|shop|click)(?![a-z0-9-])(?:\/[^\s<>"']*)?)/gi;

/** Split message text into plain text and inspectable links. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    let raw = m[0];
    // Leave sentence punctuation outside the link.
    const trail = raw.match(/[.,!?;:)]+$/);
    if (trail) raw = raw.slice(0, -trail[0].length);
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: raw, url: /^https?:\/\//i.test(raw) ? raw : `http://${raw}` });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
