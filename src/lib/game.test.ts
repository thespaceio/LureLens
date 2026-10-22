import { describe, expect, it } from 'vitest';
import { ALL_EMAILS, BASE_POINTS, MAX_SPEED_BONUS, STREAK_BONUS, buildRound, channelCounts, emailsFor, hostOf, rankTitle, scoreAnswer, splitLinks } from './game';
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
