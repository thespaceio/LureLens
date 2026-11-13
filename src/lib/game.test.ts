import { describe, expect, it } from 'vitest';
import { ALL_EMAILS, BASE_POINTS, MAX_SPEED_BONUS, STREAK_BONUS, buildRound, scoreVerify, MIN_PHONE_MESSAGES, channelCounts, emailsFor, hostOf, rankTitle, scoreAnswer, seenOrder, splitLinks } from './game';
import type { GameSession } from '@/types';
import { LEVELS, LEVEL_ORDER, channelOf } from '@/types';

describe('buildRound', () => {
  it.each(LEVEL_ORDER)('gives a full, varied %s game', level => {
    for (let i = 0; i < 50; i++) {
      const round = buildRound(level);
      expect(round).toHaveLength(LEVELS[level].rounds);
      expect(new Set(round.map(e => e.id)).size).toBe(round.length);
      expect(round.every(e => e.level === level)).toBe(true);
      const phish = round.filter(e => e.is_phishing).length;
      // Roughly half phishing, so counting answers never wins.
      expect(phish).toBeGreaterThanOrEqual(4);
      expect(phish).toBeLessThanOrEqual(6);
    }
  });

  it('only uses emails from the chosen topics', () => {
    const round = buildRound('beginner', ['banking']);
    expect(round.length).toBeGreaterThan(0);
    expect(round.every(e => e.category === 'banking')).toBe(true);
    expect(round.length).toBe(Math.min(LEVELS.beginner.rounds, emailsFor('beginner', ['banking']).length));
  });
});

describe('scoreAnswer', () => {
  it('scores nothing for a wrong answer', () => {
    expect(scoreAnswer(false, 30, 'beginner', 0).total).toBe(0);
  });

  it('adds the full speed bonus for an instant answer', () => {
    const p = scoreAnswer(true, LEVELS.beginner.seconds, 'beginner', 1);
    expect(p).toEqual({ base: BASE_POINTS, speed: MAX_SPEED_BONUS, streak: 0, total: BASE_POINTS + MAX_SPEED_BONUS });
  });

  it('applies the level multiplier and the streak bonus from the third answer', () => {
    const p = scoreAnswer(true, 0, 'advanced', 3);
    expect(p.base).toBe(BASE_POINTS * LEVELS.advanced.multiplier);
    expect(p.speed).toBe(0);
    expect(p.streak).toBe(STREAK_BONUS);
    expect(scoreAnswer(true, 0, 'advanced', 2).streak).toBe(0);
  });

  it('never gives a speed bonus above the maximum, even with clock drift', () => {
    expect(scoreAnswer(true, 999, 'intermediate', 1).speed).toBe(Math.round(MAX_SPEED_BONUS * LEVELS.intermediate.multiplier));
  });
});

describe('scoreVerify', () => {
  it('always scores 0 points', () => {
    expect(scoreVerify()).toEqual({ base: 0, speed: 0, streak: 0, total: 0 });
  });
});

describe('verify first content', () => {
  const marked = ALL_EMAILS.filter(e => e.verify_first);
  it('marks a handful of messages where checking first is the real best move', () => {
    expect(marked.length).toBeGreaterThanOrEqual(5);
    expect(marked.length).toBeLessThan(ALL_EMAILS.length / 5);
  });
  it('includes genuine messages too, so Verify is not a phishing detector', () => {
    expect(marked.some(e => !e.is_phishing)).toBe(true);
  });
});

describe('hostOf', () => {
  it('returns the host of a web link', () => {
    expect(hostOf('https://kuda-verify.com.ng/secure-login')).toBe('kuda-verify.com.ng');
  });

  it('returns an empty host for mailto links', () => {
    expect(hostOf('mailto:it-support@brightpath.ng')).toBe('');
  });
});

describe('rankTitle', () => {
  it('maps accuracy to a title', () => {
    expect(rankTitle(95)).toBe('Phish Hunter');
    expect(rankTitle(40)).toBe('Keep Training');
  });
});

describe('email bank', () => {
  it('has unique ids', () => {
    expect(new Set(ALL_EMAILS.map(e => e.id)).size).toBe(ALL_EMAILS.length);
  });
});

describe('channels', () => {
  it.each(LEVEL_ORDER)('has SMS and WhatsApp items at %s level', level => {
    const counts = channelCounts(level);
    expect(counts.sms).toBeGreaterThan(0);
    expect(counts.whatsapp).toBeGreaterThan(0);
  });

  it.each(LEVEL_ORDER)('always mixes texts or chats into a %s round', level => {
    for (let i = 0; i < 50; i++) {
      const round = buildRound(level);
      expect(round.filter(e => channelOf(e) !== 'email').length).toBeGreaterThanOrEqual(MIN_PHONE_MESSAGES);
    }
  });

  it('builds a round from one channel only', () => {
    const round = buildRound('beginner', [], ['whatsapp']);
    expect(round.length).toBeGreaterThan(0);
    expect(round.every(e => channelOf(e) === 'whatsapp')).toBe(true);
  });
});

describe('splitLinks', () => {
  it('finds bare scam links and keeps the punctuation outside', () => {
    const parts = splitLinks('Update now: gtb-bvn-update.xyz.');
    expect(parts).toEqual([
      { text: 'Update now: ' },
      { text: 'gtb-bvn-update.xyz', url: 'http://gtb-bvn-update.xyz' },
      { text: '.' },
    ]);
  });

  it('finds full links with paths', () => {
    const link = splitLinks('Pay here https://remita-pay.net/retry?rrr=29 now').find(p => p.url);
    expect(link?.url).toBe('https://remita-pay.net/retry?rrr=29');
  });

  it('does not treat email addresses or amounts as links', () => {
    expect(splitLinks('Write to help@kuda.com about NGN5,400.00').some(p => p.url)).toBe(false);
  });

  it('needs a whole top-level domain', () => {
    expect(splitLinks('kuda.company').some(p => p.url)).toBe(false);
  });
});

describe('rounds avoid messages the player has already seen', () => {
  const session = (ids: string[], date: string) =>
    ({ id: date, name: 'Ada', level: 'beginner', date, score: 0, correct: 0, total: ids.length, accuracy: 0, bestStreak: 0, avgSeconds: 0,
       answers: ids.map(id => ({ id, subject: '', category: 'banking', topic: '', is_phishing: false, choice: 'skip', correct: false, seconds: 0, points: 0 })) }) as GameSession;

  it('never repeats a message until every message in the level has been seen', () => {
    const level = 'beginner' as const;
    const pool = emailsFor(level).length;
    const sessions: GameSession[] = [];
    const counts = new Map<string, number>();
    const rounds = Math.floor(pool / 10);
    for (let r = 0; r < rounds; r++) {
      const round = buildRound(level, [], [], Math.random, seenOrder(sessions));
      for (const e of round) counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
      sessions.push(session(round.map(e => e.id), new Date(2026, 10, 1, 0, r).toISOString()));
    }
    // A few repeats are allowed only where the 4–6 phishing balance needs them.
    const repeats = [...counts.values()].filter(c => c > 1).length;
    expect(repeats).toBeLessThanOrEqual(3);
  });

  it('serves the least recently seen messages once everything has been seen', () => {
    const all = emailsFor('beginner').map(e => e.id);
    const old = all.slice(0, 20);
    const recent = all.slice(20);
    const seen = seenOrder([session(old, '2026-11-01T10:00:00Z'), session(recent, '2026-11-08T10:00:00Z')]);
    const round = buildRound('beginner', [], [], Math.random, seen).map(e => e.id);
    expect(round.filter(id => old.includes(id)).length).toBeGreaterThanOrEqual(8);
  });

  it('classroom rounds are unchanged by it (same seed, same messages)', () => {
    const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const a = buildRound('advanced', [], [], seeded(42)).map(e => e.id);
    const b = buildRound('advanced', [], [], seeded(42), undefined).map(e => e.id);
    expect(a).toEqual(b);
  });
});
