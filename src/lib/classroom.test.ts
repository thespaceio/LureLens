import { describe, expect, it } from 'vitest';
import { ALL_EMAILS } from './game';
import {
  classRound,
  createClassCode,
  decodeClassCode,
  formatCode,
  messageAccuracy,
  normalizeCode,
  parseResults,
  resultLine,
  seededRandom,
} from './classroom';
import { LEVELS, LEVEL_ORDER, channelOf } from '@/types';
import type { GameSession } from '@/types';

const decode = (code: string) => {
  const d = decodeClassCode(code);
  if (!d.ok) throw new Error(`code ${code} did not decode`);
  return d;
};

describe('class codes', () => {
  it.each(LEVEL_ORDER)('round-trips a %s code', level => {
    for (let i = 0; i < 200; i++) {
      const code = createClassCode(level);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(decode(code).level).toBe(level);
    }
  });

  it('gives everyone with the same code the same round, in the same order', () => {
    const code = createClassCode('intermediate');
    const a = classRound(decode(code)).map(e => e.id);
    const b = classRound(decode(formatCode(code).toLowerCase())).map(e => e.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(LEVELS.intermediate.rounds);
  });

  it('keeps class rounds balanced and mixed like normal rounds', () => {
    const rand = seededRandom(7);
    for (let i = 0; i < 100; i++) {
      const round = classRound(decode(createClassCode('beginner', rand)));
      const phish = round.filter(e => e.is_phishing).length;
      expect(phish).toBeGreaterThanOrEqual(4);
      expect(phish).toBeLessThanOrEqual(6);
      expect(round.filter(e => channelOf(e) !== 'email').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('gives different codes different rounds', () => {
    const rand = seededRandom(1);
    const rounds = new Set(Array.from({ length: 20 }, () => classRound(decode(createClassCode('advanced', rand))).map(e => e.id).join()));
    expect(rounds.size).toBeGreaterThan(15);
  });

  it('reads codes typed loosely', () => {
    expect(normalizeCode(' 7k2-qxo ')).toBe('7K2QX0');
    expect(normalizeCode('il0-abc')).toBe('110ABC');
  });

  it('rejects codes of the wrong shape', () => {
    expect(decodeClassCode('ABC')).toEqual({ ok: false, reason: 'format' });
    expect(decodeClassCode('ABCDEU')).toEqual({ ok: false, reason: 'format' });
  });

  it('catches most typos', () => {
    const rand = seededRandom(3);
    let caught = 0;
    let tried = 0;
    for (let i = 0; i < 200; i++) {
      const code = createClassCode('beginner', rand);
      const pos = i % 5;
      const swapped = code[pos] === '7' ? '8' : '7';
      tried++;
      if (!decodeClassCode(code.slice(0, pos) + swapped + code.slice(pos + 1)).ok) caught++;
    }
    expect(caught / tried).toBeGreaterThan(0.85);
  });

  it('stops matching when the message bank changes', () => {
    const rand = seededRandom(5);
    const codes = Array.from({ length: 50 }, () => createClassCode('beginner', rand));
    const changed = ALL_EMAILS.filter(e => e.id !== ALL_EMAILS.find(x => x.level === 'beginner')!.id);
    const stillValid = codes.filter(c => decodeClassCode(c, changed).ok).length;
    expect(stillValid).toBeLessThan(10);
  });
});

function session(name: string, marks: (boolean | 'verify')[], score: number, classCode = '7K2QX9'): GameSession {
  return {
    id: name,
    name,
    level: 'beginner',
    date: '2026-10-23T10:00:00Z',
    score,
    correct: marks.filter(m => m === true).length,
    total: marks.length,
    accuracy: 0,
    bestStreak: 0,
    avgSeconds: 0,
    practice: true,
    classCode,
    answers: marks.map((mark, i) => ({
      id: `m${i}`,
      subject: '',
      category: 'banking',
      topic: '',
      is_phishing: true,
      choice: mark === 'verify' ? 'verify' : mark ? 'phishing' : 'legitimate',
      correct: mark === true,
      seconds: 1,
      points: 0,
    })),
  };
}

describe('class results', () => {
  const tunde = session('Tunde', [true, true, false], 450);
  const amaka = session('Amaka · Lagos', [true, false, false], 300);

  it('writes a readable result line', () => {
    expect(resultLine(tunde)).toBe('LureLens class 7K2-QX9 · Tunde · 450 pts · 2/3 · ✓✓✗');
  });

  it('reads lines from a pasted WhatsApp chat', () => {
    const chat = [
      `[23/10, 21:03] Tunde: ${resultLine(tunde)}`,
      'Faith: thanks everyone!',
      `[23/10, 21:04] Amaka: ${resultLine(amaka)}`,
      resultLine(session('Bisi', [true, true, true], 900, 'ABCDEF')),
    ].join('\n');
    const { results, otherClass } = parseResults(chat, '7K2QX9');
    expect(results.map(r => r.name)).toEqual(['Tunde', 'Amaka Lagos']);
    expect(results[0]).toMatchObject({ score: 450, correct: 2, total: 3, marks: ['right', 'right', 'wrong'] });
    expect(otherClass).toBe(1);
  });

  it('marks a "Verify first" answer as safe, not wrong', () => {
    const careful = session('Kemi', [true, 'verify', false], 350);
    expect(resultLine(careful)).toBe('LureLens class 7K2-QX9 · Kemi · 350 pts · 1/3 · ✓☎✗');
    // Some phones add an emoji selector to ☎ when the line is copied back.
    const pasted = resultLine(careful).replace('☎', '☎\uFE0F');
    const { results } = parseResults(pasted, '7K2QX9');
    expect(results[0].marks).toEqual(['right', 'safe', 'wrong']);
    expect(messageAccuracy(results, 3)[1]).toEqual({ right: 0, answered: 1 });
  });

  it('keeps the latest line when a player sends twice', () => {
    const again = session('tunde', [true, true, true], 700);
    const { results } = parseResults(`${resultLine(tunde)}\n${resultLine(again)}`, '7K2QX9');
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(700);
  });

  it('works out how many got each message right', () => {
    const { results } = parseResults(`${resultLine(tunde)}\n${resultLine(amaka)}`, '7K2QX9');
    expect(messageAccuracy(results, 3)).toEqual([
      { right: 2, answered: 2 },
      { right: 1, answered: 2 },
      { right: 0, answered: 2 },
    ]);
  });
});
