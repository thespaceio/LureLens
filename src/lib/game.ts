// Pure game rules: picking emails, scoring and titles.
import emailsData from '@/data/emails.json';
import { LEVELS } from '@/types';
import type { CategoryId, Email, Level, Points } from '@/types';

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

export function emailsFor(level: Level, categories: CategoryId[] = []): Email[] {
  return ALL_EMAILS.filter(
    e => e.level === level && (categories.length === 0 || categories.includes(e.category)),
  );
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
export function buildRound(level: Level, categories: CategoryId[] = []): Email[] {
  const pool = emailsFor(level, categories);
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
