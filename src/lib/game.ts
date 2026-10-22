// Pure game rules: picking emails, scoring and titles.
import emailsData from '@/data/emails.json';
import { LEVELS } from '@/types';
import { channelOf } from '@/types';
import type { CategoryId, Channel, Email, Level, Points } from '@/types';

export const ALL_EMAILS = emailsData as unknown as Email[];

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
/** The streak bonus starts on the 3rd correct answer in a row. */
export const STREAK_START = 3;
export const STREAK_BONUS = 50;

export function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
 * Pick a round of emails: up to `LEVELS[level].rounds`, roughly half phishing
 * (4–6 out of 10) so players can't win by counting answers.
 */
export function buildRound(level: Level, categories: CategoryId[] = [], channels: Channel[] = []): Email[] {
  const pool = emailsFor(level, categories, channels);
  const rounds = Math.min(LEVELS[level].rounds, pool.length);
  const phish = shuffle(pool.filter(e => e.is_phishing));
  const legit = shuffle(pool.filter(e => !e.is_phishing));

  let phishCount = Math.floor(rounds / 2) + Math.floor(Math.random() * 3) - 1;
  phishCount = Math.max(rounds - legit.length, Math.min(phishCount, phish.length, rounds));
  phishCount = Math.max(0, phishCount);
  const legitCount = Math.min(rounds - phishCount, legit.length);

  return shuffle([...phish.slice(0, phishCount), ...legit.slice(0, legitCount)]);
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
  const base = Math.round(BASE_POINTS * cfg.multiplier);
  const speed = Math.round(MAX_SPEED_BONUS * ratio * cfg.multiplier);
  const streak = streakAfterAnswer >= STREAK_START ? STREAK_BONUS : 0;
  return { base, speed, streak, total: base + speed + streak };
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
