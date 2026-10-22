import { describe, expect, it } from 'vitest';
import { bestScore, leaderboard, rankOf } from './stats';
import type { GameSession, Level } from '@/types';

const game = (id: string, name: string, score: number, level: Level = 'beginner', practice = false): GameSession => ({
  id,
  name,
  level,
  date: '2026-10-20T10:00:00.000Z',
  score,
  correct: 8,
  total: 10,
  accuracy: 80,
  bestStreak: 4,
  avgSeconds: 9,
  answers: [],
  ...(practice ? { practice: true } : {}),
});

describe('scoreboard', () => {
  const sessions = [
    game('a', 'Faith', 1500),
    game('b', 'Tolu', 1800),
    game('c', 'Faith', 2600, 'beginner', true), // topic practice round
    game('d', 'faith ', 1200),
  ];

  it('leaves practice rounds off the scoreboard', () => {
    const rows = leaderboard(sessions, 'beginner', false);
    expect(rows.map(r => r.id)).toEqual(['b', 'a', 'd']);
  });

  it('keeps one row per player when asked, matching names case-insensitively', () => {
    const rows = leaderboard(sessions, 'beginner', true);
    expect(rows.map(r => r.id)).toEqual(['b', 'a']);
  });

  it('ranks a game only among non-practice games of its level', () => {
    expect(rankOf(sessions, sessions[0])).toEqual({ rank: 2, of: 3 });
  });

  it('ignores practice rounds for personal bests', () => {
    expect(bestScore(sessions, 'Faith', 'beginner')).toBe(1500);
  });
});
