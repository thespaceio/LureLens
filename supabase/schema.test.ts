// Runs supabase/schema.sql and messages.sql in an in-memory Postgres (PGlite)
// and checks the server against the game: same scores, closed tables, clear
// refusals, working certificates. Fails if the two scoring rules drift apart.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { buildRound, scoreAnswer, scoreVerify } from '@/lib/game';
import { LEVELS, LEVEL_ORDER } from '@/types';
import type { Choice, Email, Level } from '@/types';

let db: PGlite;

async function asAnon<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec('set role anon');
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

/** Scores a game exactly as QuizInterface does. */
function play(level: Level, round: Email[], choices: Choice[], spent: number[]) {
  let streak = 0;
  let score = 0;
  let right = 0;
  const answers = round.map((e, i) => {
    const choice = choices[i];
    const seconds = Math.round(spent[i] * 10) / 10;
    let correct: boolean;
    let points;
    if (choice === 'verify') {
      correct = Boolean(e.verify_first);
      streak = correct ? streak + 1 : streak;
      points = scoreVerify();
    } else {
      correct = choice === (e.is_phishing ? 'phishing' : 'legitimate');
      streak = correct ? streak + 1 : 0;
      points = scoreAnswer(correct, LEVELS[level].seconds - seconds, level, streak);
    }
    score += points.total;
    if (correct) right++;
    return { id: e.id, choice, seconds };
  });
  return { answers, score, right };
}

const perfect = (level: Level) => {
  const round = buildRound(level);
  return play(level, round, round.map(e => (e.is_phishing ? 'phishing' : 'legitimate')), Array(10).fill(3)).answers;
};

const submit = (name: string, level: string, answers: unknown, ranked = true, playedAt = new Date().toISOString()) =>
  asAnon<{ r: { id: string; score: number; correct: number; accuracy: number; rank: number | null } }>(
    'select submit_score($1, $2, $3::jsonb, $4::timestamptz, $5) as r',
    [name, level, JSON.stringify(answers), playedAt, ranked],
  ).then(rows => rows[0].r);

const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated;');
  const schema = readFileSync('supabase/schema.sql', 'utf8');
  await db.exec(schema);
  await db.exec(readFileSync('supabase/messages.sql', 'utf8'));
  await db.exec(schema); // safe to run twice
}, 60_000);

describe('online scoreboard (supabase/schema.sql)', () => {
  it('scores every kind of game exactly as the game does', async () => {
    const choices: Choice[] = ['phishing', 'legitimate', 'verify', 'timeout', 'skip'];
    for (let g = 0; g < 120; g++) {
      const level = LEVEL_ORDER[g % 3];
      const round = buildRound(level);
      const picks = round.map((e, i) => (g % 4 === 0 ? (e.is_phishing ? 'phishing' : 'legitimate') : choices[(g * 7 + i * 3) % 5]));
      const spent = round.map((_, i) => (picks[i] === 'timeout' ? LEVELS[level].seconds : ((g * 13 + i * 7) % (LEVELS[level].seconds * 10)) / 10));
      const game = play(level, round, picks, spent);
      const server = await submit(`Player${g % 30}`, level, game.answers);
      expect({ score: server.score, correct: server.correct }).toEqual({ score: game.score, correct: game.right });
      if (g % 40 === 39) await db.exec("update scores set created_at = created_at - interval '1 hour'");
    }
  }, 60_000);

  it('keeps the tables closed to browsers', async () => {
    for (const sql of [
      'select * from scores limit 1',
      'select * from messages limit 1',
      'select * from certificates limit 1',
      "insert into scores (name, level, score, correct, total, accuracy, best_streak, avg_seconds, played_at) values ('x', 'beginner', 9, 1, 1, 1, 1, 1, now())",
    ]) {
      expect(await refusal(asAnon(sql))).not.toBeNull();
    }
  });

  it("lists each player's best game, highest first", async () => {
    const board = await asAnon<{ name: string; score: number }>('select * from leaderboard($1, null, 20)', ['beginner']);
    expect(board.length).toBeGreaterThan(0);
    expect(new Set(board.map(b => b.name.toLowerCase())).size).toBe(board.length);
    expect(board.every((b, i) => i === 0 || board[i - 1].score >= b.score)).toBe(true);
  });

  it('refuses bad games and names with a readable reason', async () => {
    await db.exec("update scores set created_at = created_at - interval '1 hour'");
    const good = perfect('beginner');
    expect(await refusal(submit('Ok', 'beginner', good.slice(0, 9)))).toMatch(/10 answers/);
    expect(await refusal(submit('Ok', 'beginner', [...good.slice(0, 9), good[0]]))).toMatch(/twice/);
    expect(await refusal(submit('Ok', 'advanced', good))).toMatch(/does not know/);
    expect(await refusal(submit('big mumu', 'beginner', good))).toMatch(/different name/);
    expect(await refusal(submit('   ', 'beginner', good))).toMatch(/between 1 and 24/);
    expect(await refusal(submit('<script>', 'beginner', good))).toMatch(/only use letters/);
    for (const name of ['Dickson', "Chi'Amaka", 'Faith A.', 'Sùlè']) {
      expect(await refusal(submit(name, 'beginner', good))).toBeNull();
    }
  });

  it('limits how fast one name can post', async () => {
    const good = perfect('beginner');
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await refusal(submit('Flooder', 'beginner', good)));
    expect(results.slice(0, 10).every(r => r === null)).toBe(true);
    expect(results[10]).toMatch(/Too many games/);
  });

  it('registers and checks a certificate backed by three 80%+ games', async () => {
    const ids = [];
    for (const level of LEVEL_ORDER) ids.push((await submit('Ada', level, perfect(level), level !== 'advanced')).id);
    await asAnon('select register_certificate($1, $2, $3::uuid[])', ['LL-ABCD-EFGH', 'Ada Okafor', ids]);
    await asAnon('select register_certificate($1, $2, $3::uuid[])', ['LL-ABCD-EFGH', 'Ada N. Okafor', ids]);
    const [{ r }] = await asAnon<{ r: { display_name: string; player_name: string; levels: Record<Level, { accuracy: number }> } }>(
      'select check_certificate($1) as r',
      [' ll-abcd-efgh'],
    );
    expect(r.display_name).toBe('Ada N. Okafor');
    expect(r.player_name).toBe('Ada');
    expect(r.levels.advanced.accuracy).toBe(100);
    // The unranked (classroom) game stays off the scoreboard.
    const adv = await asAnon<{ name: string }>('select * from leaderboard($1, null, 100)', ['advanced']);
    expect(adv.some(row => row.name === 'Ada')).toBe(false);

    const [{ r: none }] = await asAnon<{ r: unknown }>('select check_certificate($1) as r', ['LL-0000-0000']);
    expect(none).toBeNull();
    const weak = await submit('Ada', 'advanced', play('advanced', buildRound('advanced'), Array(10).fill('skip'), Array(10).fill(1)).answers);
    expect(await refusal(asAnon('select register_certificate($1, $2, $3::uuid[])', ['LL-ZZZZ-ZZZZ', 'Ada', [ids[0], ids[1], weak.id]]))).toMatch(/80%/);
    expect(await refusal(asAnon('select register_certificate($1, $2, $3::uuid[])', ['LL-ABCD-EFGH', 'Ada', [ids[0], ids[1], weak.id]]))).not.toBeNull();
  });
});
