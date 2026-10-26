import { describe, expect, it } from 'vitest';
import { CERTIFICATE_ACCURACY, certificateProgress } from './certificate';
import type { GameSession, Level } from '@/types';

let n = 0;
function game(level: Level, accuracy: number, date: string, extra: Partial<GameSession> = {}): GameSession {
  n++;
  return {
    id: `g${n}`,
    name: 'Faith',
    level,
    date,
    score: accuracy * 10,
    correct: accuracy / 10,
    total: 10,
    accuracy,
    bestStreak: 0,
    avgSeconds: 5,
    answers: [],
    ...extra,
  };
}

describe('certificateProgress', () => {
  it('is not earned until every level reaches the bar', () => {
    const sessions = [
      game('beginner', 90, '2026-10-20T10:00:00Z'),
      game('intermediate', 80, '2026-10-21T10:00:00Z'),
      game('advanced', 70, '2026-10-22T10:00:00Z'),
    ];
    const p = certificateProgress(sessions, 'Faith');
    expect(p.earned).toBe(false);
    expect(p.levels.advanced.best?.accuracy).toBe(70);
    expect(p.levels.advanced.passedWith).toBeNull();
    expect(p.reference).toBeNull();
  });

  it('is earned on the date the last level was first passed', () => {
    const sessions = [
      game('beginner', 90, '2026-10-20T10:00:00Z'),
      game('intermediate', 80, '2026-10-21T10:00:00Z'),
      game('advanced', 100, '2026-10-25T10:00:00Z'),
      game('advanced', 80, '2026-10-23T10:00:00Z'),
    ];
    const p = certificateProgress(sessions, 'faith ');
    expect(p.earned).toBe(true);
    expect(p.earnedOn).toBe('2026-10-23T10:00:00Z');
    expect(p.reference).toMatch(/^LL-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(certificateProgress(sessions, 'Faith').reference).toBe(p.reference);
  });

  it('counts classroom rounds but not single-topic practice', () => {
    const base = [game('beginner', 90, '2026-10-20T10:00:00Z'), game('intermediate', 90, '2026-10-21T10:00:00Z')];
    const practice = game('advanced', 100, '2026-10-22T10:00:00Z', { practice: true });
    expect(certificateProgress([...base, practice], 'Faith').earned).toBe(false);
    const classRound = game('advanced', 90, '2026-10-22T10:00:00Z', { practice: true, classCode: '7K2QX9' });
    expect(certificateProgress([...base, classRound], 'Faith').earned).toBe(true);
  });

  it("only uses the named player's games", () => {
    const sessions = LEVELS_ALL.map(l => game(l, 100, '2026-10-20T10:00:00Z', { name: 'Tunde' }));
    expect(certificateProgress(sessions, 'Faith').earned).toBe(false);
    expect(certificateProgress(sessions, '').earned).toBe(false);
  });

  it(`uses ${CERTIFICATE_ACCURACY}% as the bar`, () => {
    expect(CERTIFICATE_ACCURACY).toBe(80);
  });
});

const LEVELS_ALL: Level[] = ['beginner', 'intermediate', 'advanced'];
