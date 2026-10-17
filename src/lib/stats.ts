// Scoreboard and progress calculations over saved games.
import { accuracyOf } from '@/lib/game';
import type { CategoryId, GameSession, Level } from '@/types';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function sortForBoard(a: GameSession, b: GameSession): number {
  return (
    b.score - a.score ||
    b.accuracy - a.accuracy ||
    a.avgSeconds - b.avgSeconds ||
    a.date.localeCompare(b.date)
  );
}

/** Scoreboard rows for a level ('all' = every level). */
export function leaderboard(
  sessions: GameSession[],
  level: Level | 'all',
  bestPerPlayer: boolean,
  limit = 20,
): GameSession[] {
  let rows = sessions.filter(s => level === 'all' || s.level === level).slice().sort(sortForBoard);
  if (bestPerPlayer) {
    const seen = new Set<string>();
    rows = rows.filter(r => {
      const key = r.name.trim().toLowerCase() + (level === 'all' ? '|' + r.level : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return rows.slice(0, limit);
}

/** Position of a game among all games of its level (1-based). */
export function rankOf(sessions: GameSession[], session: GameSession): { rank: number; of: number } {
  const rows = sessions.filter(s => s.level === session.level).slice().sort(sortForBoard);
  return { rank: rows.findIndex(s => s.id === session.id) + 1, of: rows.length };
}

export function playerSessions(sessions: GameSession[], name: string): GameSession[] {
  return sessions.filter(s => sameName(s.name, name));
}

export function bestScore(sessions: GameSession[], name: string, level: Level): number {
  return playerSessions(sessions, name)
    .filter(s => s.level === level)
    .reduce((best, s) => Math.max(best, s.score), 0);
}

export function playerNames(sessions: GameSession[]): string[] {
  const names = new Map<string, string>();
  for (const s of sessions) {
    const key = s.name.trim().toLowerCase();
    if (!names.has(key)) names.set(key, s.name);
  }
  return [...names.values()];
}

export interface CategoryStat {
  category: CategoryId;
  correct: number;
  total: number;
  accuracy: number;
}

export function categoryStats(sessions: GameSession[]): CategoryStat[] {
  const map = new Map<CategoryId, { correct: number; total: number }>();
  for (const s of sessions) {
    for (const a of s.answers) {
      const cur = map.get(a.category) ?? { correct: 0, total: 0 };
      map.set(a.category, { correct: cur.correct + (a.correct ? 1 : 0), total: cur.total + 1 });
    }
  }
  return [...map.entries()].map(([category, v]) => ({
    category,
    ...v,
    accuracy: accuracyOf(v.correct, v.total),
  }));
}

export interface TopicStat {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
}

export function topicStats(sessions: GameSession[]): TopicStat[] {
  const map = new Map<string, { correct: number; total: number }>();
  for (const s of sessions) {
    for (const a of s.answers) {
      const cur = map.get(a.topic) ?? { correct: 0, total: 0 };
      map.set(a.topic, { correct: cur.correct + (a.correct ? 1 : 0), total: cur.total + 1 });
    }
  }
  return [...map.entries()]
    .map(([topic, v]) => ({ topic, ...v, accuracy: accuracyOf(v.correct, v.total) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}
