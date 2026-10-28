// Runs supabase/schema.sql and messages.sql in an in-memory Postgres (PGlite)
// with small stand-ins for Supabase's auth and realtime schemas, and checks
// the server against the game: same scores, closed tables, accounts and
// profiles, private history, live signals, certificates, account deletion.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { buildRound, scoreAnswer, scoreVerify } from '@/lib/game';
import { classRound, createClassCode, decodeClassCode, formatCode, seededRandom } from '@/lib/classroom';
import { LEVELS, LEVEL_ORDER } from '@/types';
import type { Choice, Email, Level } from '@/types';

let db: PGlite;

// Stand-ins for what Supabase provides: auth.users, auth.uid() (read from the
// request's JWT), and realtime.send() (recorded so tests can see signals).
const SUPABASE_STANDINS = `
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, is_anonymous boolean not null default false);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  create schema realtime;
  create table realtime.sent (payload jsonb, event text, topic text, private boolean, at timestamptz default now());
  create function realtime.send(payload jsonb, event text, topic text, private boolean) returns void language sql as $$
    insert into realtime.sent (payload, event, topic, private) values (payload, event, topic, private)
  $$;
`;

const ADA = '00000000-0000-4000-8000-00000000000a';
const BOLA = '00000000-0000-4000-8000-00000000000b';
const CHI = '00000000-0000-4000-8000-00000000000c';
const DAN = '00000000-0000-4000-8000-00000000000d';
const EVE = '00000000-0000-4000-8000-00000000000e'; // a quick-join account

/** Runs SQL as a browser would: anonymous, or signed in as `uid`. */
async function as<T>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};

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

type Posted = { id: string; name: string; score: number; correct: number; accuracy: number; rank: number | null; of: number | null };
const submit = (uid: string | null, level: string, answers: unknown, ranked = true) =>
  as<{ r: Posted }>(uid, 'select submit_score($1, $2, $3::jsonb, now(), $4) as r', ['ignored', level, JSON.stringify(answers), ranked]).then(r => r[0].r);
const saveProfile = (uid: string | null, username: string, full: string | null = null, org: string | null = null) =>
  as<{ r: { username: string; full_name: string | null; organisation: string | null } }>(uid, 'select save_profile($1, $2, $3) as r', [username, full, org]).then(r => r[0].r);
const submitClass = (uid: string, level: string, answers: unknown, code: string) =>
  as<{ r: Posted & { already?: boolean } }>(uid, 'select submit_score($1, $2, $3::jsonb, now(), true, $4) as r', ['ignored', level, JSON.stringify(answers), code]).then(r => r[0].r);
type ClassRow = { name: string; score: number; correct: number; marks: string; is_me: boolean };
const classBoard = (uid: string | null, code: string) => as<ClassRow>(uid, 'select * from class_board($1)', [code]);
const relax = () => db.exec("update scores set created_at = created_at - interval '1 hour'");

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDINS);
  await db.exec(`insert into auth.users (id, email) values ('${ADA}', 'ada@example.com'), ('${BOLA}', 'bola@example.com'), ('${CHI}', 'chi@example.com'), ('${DAN}', 'dan@example.com')`);
  await db.exec(`insert into auth.users (id, email, is_anonymous) values ('${EVE}', null, true)`);
  const schema = readFileSync('supabase/schema.sql', 'utf8');
  await db.exec(schema);
  await db.exec(readFileSync('supabase/messages.sql', 'utf8'));
  await db.exec(schema); // safe to run twice
  // A guest game from before accounts (2.1).
  await db.exec(`insert into scores (name, level, score, correct, total, accuracy, best_streak, avg_seconds, played_at)
                 values ('Johnny', 'beginner', 740, 5, 10, 50, 1, 1.3, now())`);
}, 60_000);

describe('profiles', () => {
  it('lets a signed-in player choose a unique username, with any letters', async () => {
    expect(await refusal(saveProfile(null, 'Ada'))).toMatch(/permission denied|Sign in/);
    expect(await saveProfile(ADA, '  Adá   Okafor ', 'Ọlálékan Adébáyọ̀', 'University of Ilorin')).toEqual({
      username: 'Adá Okafor',
      full_name: 'Ọlálékan Adébáyọ̀',
      organisation: 'University of Ilorin',
    });
    expect(await refusal(saveProfile(BOLA, 'ADÁ OKAFOR'))).toMatch(/taken/);
    expect(await refusal(saveProfile(BOLA, 'Admin'))).toMatch(/reserved/);
    expect(await refusal(saveProfile(BOLA, 'big mumu'))).toMatch(/different name/);
    expect(await refusal(saveProfile(BOLA, 'x'))).toMatch(/at least 2/);
    expect(await refusal(saveProfile(BOLA, '<b>'))).toMatch(/only use letters/);
    expect(await refusal(saveProfile(BOLA, 'Bola', null, 'Acme <script>'))).toMatch(/not allowed/);
    for (const name of ['Chukwuemeka Ụzọ', 'Ngozi Ọkafọr', 'Ẹ̀ṣọ́', 'Sùlè', "Chi'Amaka", 'Dickson']) {
      expect(await refusal(saveProfile(BOLA, name))).toBeNull();
    }
    await saveProfile(BOLA, 'Bola');
  });

  it('shows players only their own profile', async () => {
    const mine = await as<{ username: string }>(ADA, 'select username from profiles');
    expect(mine.map(p => p.username)).toEqual(['Adá Okafor']);
    expect(await refusal(as(null, 'select * from profiles'))).not.toBeNull();
    expect(await refusal(as(ADA, "update profiles set username = 'x'"))).not.toBeNull();
  });
});

describe('posting games', () => {
  it('needs an account with a username', async () => {
    expect(await refusal(submit(null, 'beginner', perfect('beginner')))).toMatch(/permission denied|Sign in/);
    expect(await refusal(submit(CHI, 'beginner', perfect('beginner')))).toMatch(/username/);
  });

  it('scores every kind of game exactly as the game does, under the username', async () => {
    const choices: Choice[] = ['phishing', 'legitimate', 'verify', 'timeout', 'skip'];
    for (let g = 0; g < 90; g++) {
      const level = LEVEL_ORDER[g % 3];
      const round = buildRound(level);
      const picks = round.map((e, i) => (g % 4 === 0 ? (e.is_phishing ? 'phishing' : 'legitimate') : choices[(g * 7 + i * 3) % 5]));
      const spent = round.map((_, i) => (picks[i] === 'timeout' ? LEVELS[level].seconds : ((g * 13 + i * 7) % (LEVELS[level].seconds * 10)) / 10));
      const game = play(level, round, picks, spent);
      const server = await submit(g % 2 ? ADA : BOLA, level, game.answers);
      expect({ score: server.score, correct: server.correct }).toEqual({ score: game.score, correct: game.right });
      expect(server.name).toBe(g % 2 ? 'Adá Okafor' : 'Bola');
      if (g % 8 === 7) await relax();
    }
  }, 60_000);

  it('limits how fast one account can post', async () => {
    await relax();
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await refusal(submit(BOLA, 'beginner', perfect('beginner'))));
    expect(results.slice(0, 10).every(r => r === null)).toBe(true);
    expect(results[10]).toMatch(/Too many games/);
    await relax();
  });

  it('refuses bad games with a readable reason', async () => {
    const good = perfect('beginner');
    expect(await refusal(submit(ADA, 'beginner', good.slice(0, 9)))).toMatch(/10 answers/);
    expect(await refusal(submit(ADA, 'beginner', [...good.slice(0, 9), good[0]]))).toMatch(/twice/);
    expect(await refusal(submit(ADA, 'advanced', good))).toMatch(/does not know/);
  });

  it('sends a live signal for ranked games only, without names', async () => {
    await db.exec('delete from realtime.sent');
    await submit(ADA, 'intermediate', perfect('intermediate'));
    await submit(ADA, 'advanced', perfect('advanced'), false);
    const sent = (await db.query<{ payload: unknown; event: string; topic: string; private: boolean }>('select payload, event, topic, private from realtime.sent')).rows;
    expect(sent).toEqual([{ payload: { level: 'intermediate' }, event: 'new_score', topic: 'scoreboard', private: false }]);
  });
});

describe('scoreboard', () => {
  it("lists each player's best game under their current username, guests included", async () => {
    const board = await as<{ name: string; score: number; is_me: boolean }>(null, 'select * from leaderboard($1, null, 50)', ['beginner']);
    expect(board.filter(b => b.name === 'Bola')).toHaveLength(1);
    expect(board.some(b => b.name === 'Johnny')).toBe(true);
    expect(board.every((b, i) => i === 0 || board[i - 1].score >= b.score)).toBe(true);
    expect(board.every(b => b.is_me === false)).toBe(true);

    await saveProfile(BOLA, 'Bola Tinubu-Ade');
    const mine = await as<{ name: string; is_me: boolean }>(BOLA, 'select * from leaderboard($1, null, 50)', ['beginner']);
    expect(mine.find(b => b.is_me)?.name).toBe('Bola Tinubu-Ade');
    await saveProfile(BOLA, 'Bola');
  });

  it('keeps the score, answer key and certificate tables closed', async () => {
    for (const uid of [null, ADA]) {
      for (const sql of ['select * from scores limit 1', 'select * from messages limit 1', 'select * from certificates limit 1']) {
        expect(await refusal(as(uid, sql))).not.toBeNull();
      }
    }
  });
});

let posted0: Posted;
describe('class boards', () => {
  const code = createClassCode('beginner', seededRandom(7));
  const round = classRound(decodeClassCode(code) as Extract<ReturnType<typeof decodeClassCode>, { ok: true }>);
  const choices = (wrongAt: number[]): Choice[] =>
    round.map((e, i) => (wrongAt.includes(i) ? (e.is_phishing ? 'legitimate' : 'phishing') : e.is_phishing ? 'phishing' : 'legitimate'));

  it("posts a class result to the class's board only, scored as the game does", async () => {
    await relax();
    await db.exec('delete from realtime.sent');
    const game = play('beginner', round, choices([1, 4]), Array(10).fill(5));
    // Typed the way people read codes out: with a dash, lower case, O for 0.
    const typed = formatCode(code).toLowerCase().replace(/0/g, 'o');
    const posted = await submitClass(ADA, 'beginner', game.answers, typed);
    posted0 = posted;
    expect({ score: posted.score, correct: posted.correct, rank: posted.rank, of: posted.of }).toEqual({ score: game.score, correct: 8, rank: 1, of: 1 });
    // Not on the public scoreboard, and only this class's screens hear about it.
    const ranked = (await db.query<{ ranked: boolean; class_code: string }>('select ranked, class_code from scores where id = $1', [posted.id])).rows[0];
    expect(ranked).toEqual({ ranked: false, class_code: code });
    const sent = (await db.query<{ payload: unknown; event: string; topic: string }>('select payload, event, topic from realtime.sent')).rows;
    expect(sent).toEqual([{ payload: {}, event: 'new_class_result', topic: `class:${code}` }]);
  });

  it("keeps each player's first result, ranks the class and shows every answer's outcome", async () => {
    const again = await submitClass(ADA, 'beginner', play('beginner', round, choices([]), Array(10).fill(1)).answers, code);
    expect(again.already).toBe(true);
    expect(again.correct).toBe(8);

    const verifyIndex = round.findIndex(e => !e.verify_first);
    const picks = choices([]);
    picks[verifyIndex] = 'verify';
    const bola = await submitClass(BOLA, 'beginner', play('beginner', round, picks, Array(10).fill(2)).answers, code);
    expect({ rank: bola.rank, of: bola.of }).toEqual({ rank: 1, of: 2 });
    // Equal points: more correct answers, then speed, decide; the reply matches the board's order.
    const chi = await saveProfile(CHI, 'Chi').then(() =>
      submitClass(CHI, 'beginner', play('beginner', round, choices([1, 4]), Array(10).fill(5)).answers, code),
    );
    expect(chi.score).toBe(posted0.score);
    expect({ rank: chi.rank, of: chi.of }).toEqual({ rank: 3, of: 3 });

    const board = await classBoard(null, formatCode(code));
    expect(board.map(r => [r.name, r.correct, r.is_me])).toEqual([
      [board[0].name, 9, false],
      ['Adá Okafor', 8, false],
      ['Chi', 8, false],
    ]);
    expect(board[0].marks).toBe(round.map((_, i) => (i === verifyIndex ? 'S' : 'R')).join(''));
    expect(board[1].marks).toBe(round.map((_, i) => ([1, 4].includes(i) ? 'W' : 'R')).join(''));
    expect((await classBoard(ADA, code)).find(r => r.is_me)?.name).toBe('Adá Okafor');
    expect(await classBoard(null, 'nonsense')).toEqual([]);
  });

  it('refuses wrong codes, other levels and a different round', async () => {
    const answers = play('beginner', round, choices([]), Array(10).fill(3)).answers;
    expect(await refusal(submitClass(ADA, 'beginner', answers, 'ABC'))).toMatch(/isn't right/);
    expect(await refusal(submitClass(ADA, 'beginner', answers, createClassCode('advanced', seededRandom(3))))).toMatch(/different level/);
    await saveProfile(DAN, 'Dan');
    expect(await refusal(submitClass(DAN, 'beginner', perfect('beginner'), code))).toMatch(/don't match/);
    expect(await refusal(as(null, `select submit_score('x', 'beginner', '[]'::jsonb, now(), false, '${code}')`))).toMatch(/permission denied|Sign in/);
  });
});

describe('game history', () => {
  it("syncs a player's own games and hides everyone else's", async () => {
    const data = { id: 'local-1', name: 'Adá Okafor', level: 'beginner', score: 900 };
    await as(ADA, 'insert into games (user_id, id, played_at, data) values ($1, $2, now(), $3::jsonb)', [ADA, 'local-1', JSON.stringify(data)]);
    expect(await refusal(as(ADA, 'insert into games (user_id, id, played_at, data) values ($1, $2, now(), $3::jsonb)', [BOLA, 'x', '{}']))).not.toBeNull();
    expect(await refusal(as(null, 'select * from games'))).not.toBeNull();
    const own = await as<{ id: string }>(ADA, 'select id from games');
    expect(own.map(g => g.id)).toEqual(['local-1']);
    expect(await as(BOLA, 'select id from games')).toEqual([]);
  });

  it('stops history being used as storage or flooded', async () => {
    const save = (uid: string, id: string, data: unknown = { id }) =>
      as(uid, 'insert into games (user_id, id, played_at, data) values ($1, $2, now(), $3::jsonb)', [uid, id, JSON.stringify(data)]);
    // A real game is about 1.3 KB; 8 KB is the cap.
    expect(await refusal(save(BOLA, 'big', { pad: 'x'.repeat(9000) }))).toMatch(/games_data_size/);
    expect(await refusal(save(BOLA, 'ok', { pad: 'x'.repeat(5000) }))).toBeNull();
    // At most 200 games per account in 10 minutes (enough to add a long history at once).
    await db.exec(`insert into games (user_id, id, played_at, data) select '${BOLA}', 'b' || g, now(), '{}' from generate_series(1, 199) g`);
    expect(await refusal(save(BOLA, 'one-too-many'))).toMatch(/short time/);
    await db.exec(`update games set created_at = now() - interval '1 hour' where user_id = '${BOLA}'`);
    expect(await refusal(save(BOLA, 'later'))).toBeNull();
    // Quick-join accounts keep up to 300 games.
    await db.exec(`insert into games (user_id, id, played_at, data, created_at) select '${EVE}', 'e' || g, now(), '{}', now() - interval '1 day' from generate_series(1, 300) g`);
    expect(await refusal(save(EVE, 'e-more'))).toMatch(/history is full/);
    // At most 1,000 games saved across everyone in 10 minutes.
    // (setup only: skip the trigger to load 1,000 recent games quickly)
    await db.exec(`set session_replication_role = replica; insert into games (user_id, id, played_at, data) select '${DAN}', 'd' || g, now(), '{}' from generate_series(1, 1000) g; set session_replication_role = origin;`);
    expect(await refusal(save(CHI, 'c1'))).toMatch(/busy/);
    await db.exec(`delete from games where user_id in ('${BOLA}', '${DAN}', '${EVE}')`);
  });
});

describe('certificates', () => {
  it("registers a certificate from a player's own three 80%+ games and shows it publicly", async () => {
    await relax();
    const ids: string[] = [];
    for (const level of LEVEL_ORDER) ids.push((await submit(ADA, level, perfect(level), level !== 'advanced')).id);
    const [{ r }] = await as<{ r: { display_name: string } }>(ADA, 'select register_certificate($1, null, $2::uuid[]) as r', ['LL-ABCD-EFGH', ids]);
    expect(r.display_name).toBe('Ọlálékan Adébáyọ̀'); // the profile's full name

    expect(await refusal(as(BOLA, 'select register_certificate($1, $2, $3::uuid[])', ['LL-ZZZZ-ZZZZ', 'Bola', ids]))).toMatch(/your posted games/);
    expect(await refusal(as(null, 'select register_certificate($1, $2, $3::uuid[])', ['LL-ZZZZ-ZZZZ', 'X', ids]))).not.toBeNull();

    const [{ c }] = await as<{ c: { display_name: string; player_name: string; account: boolean; levels: Record<Level, { accuracy: number }> } }>(
      null,
      'select check_certificate($1) as c',
      [' ll-abcd-efgh'],
    );
    expect(c).toMatchObject({ display_name: 'Ọlálékan Adébáyọ̀', player_name: 'Adá Okafor', account: true });
    expect(c.levels.advanced.accuracy).toBe(100);
  });

  it('refuses a certificate resting on a weak game', async () => {
    const weak = await submit(ADA, 'advanced', play('advanced', buildRound('advanced'), Array(10).fill('skip'), Array(10).fill(1)).answers);
    const b = await submit(ADA, 'beginner', perfect('beginner'));
    const i = await submit(ADA, 'intermediate', perfect('intermediate'));
    expect(await refusal(as(ADA, 'select register_certificate($1, $2, $3::uuid[])', ['LL-WEAK-0001', 'Ada', [b.id, i.id, weak.id]]))).toMatch(/80%/);
  });
});

describe('moderation', () => {
  type ModRow = { id: string; player_id: string | null; name: string; hidden: boolean; player_hidden: boolean; flags: string[] };
  const review = (uid: string | null, view = 'recent', search: string | null = null) =>
    as<ModRow>(uid, 'select * from moderation_scores($1, $2, 200)', [view, search]);
  const hideScore = (uid: string, id: string, hidden: boolean, reason: string | null = null) =>
    as(uid, 'select moderate_score($1, $2, $3)', [id, hidden, reason]);
  const hidePlayer = (uid: string, id: string, hidden: boolean, reason: string | null = null) =>
    as(uid, 'select moderate_player($1, $2, $3)', [id, hidden, reason]);
  const board = (level: string) => as<{ name: string }>(null, 'select * from leaderboard($1, null, 100)', [level]).then(b => b.map(r => r.name));

  it('is closed to everyone but moderators', async () => {
    expect(await refusal(as(null, 'select is_moderator()'))).not.toBeNull();
    expect((await as<{ m: boolean }>(BOLA, 'select is_moderator() as m'))[0].m).toBe(false);
    for (const uid of [null, BOLA]) {
      expect(await refusal(review(uid))).not.toBeNull();
      expect(await refusal(as(uid, 'select * from moderation_history(10)'))).not.toBeNull();
      expect(await refusal(as(uid, 'select * from moderators'))).not.toBeNull();
      expect(await refusal(as(uid, 'select * from moderation_log'))).not.toBeNull();
    }
    const any = (await db.query<{ id: string }>('select id from scores limit 1')).rows[0].id;
    expect(await refusal(hideScore(BOLA, any, true))).toMatch(/permission denied|Only moderators/);
    expect(await refusal(hidePlayer(BOLA, ADA, true))).toMatch(/permission denied|Only moderators/);

    // Moderators are added by hand in the SQL editor.
    await db.exec(`insert into moderators (user_id) values ('${DAN}')`);
    expect((await as<{ m: boolean }>(DAN, 'select is_moderator() as m'))[0].m).toBe(true);
  });

  it('lists recent games, flags likely scripted ones, and searches by name', async () => {
    const recent = await review(DAN);
    expect(recent.length).toBeGreaterThan(5);
    // The 2.1 guest game averaged 1.3 seconds a message: faster than anyone reads.
    const johnny = recent.find(r => r.name === 'Johnny')!;
    expect(johnny.player_id).toBeNull();
    expect(johnny.flags).toEqual(['very_fast']);
    expect((await review(DAN, 'flagged')).map(r => r.name)).toContain('Johnny');
    expect((await review(DAN, 'flagged')).every(r => r.flags.length > 0)).toBe(true);
    const bolas = await review(DAN, 'recent', 'BOL');
    expect(bolas.length).toBeGreaterThan(0);
    expect(bolas.every(r => r.name === 'Bola')).toBe(true);
  });

  it('hides and restores a single score, with a live refresh and a log entry', async () => {
    const johnny = (await review(DAN, 'recent', 'johnny'))[0];
    await db.exec('delete from realtime.sent');
    await hideScore(DAN, johnny.id, true, 'Test entry');
    expect(await board('beginner')).not.toContain('Johnny');
    expect((await review(DAN, 'hidden')).map(r => r.id)).toEqual([johnny.id]);
    const sent = (await db.query<{ event: string; topic: string }>('select event, topic from realtime.sent')).rows;
    expect(sent).toEqual([{ event: 'new_score', topic: 'scoreboard' }]);

    await hideScore(DAN, johnny.id, false);
    expect(await board('beginner')).toContain('Johnny');
    expect(await refusal(hideScore(DAN, '00000000-0000-4000-8000-000000000999', true))).toMatch(/no longer exists/);
    expect(await refusal(hideScore(DAN, johnny.id, true, '<script>'))).toMatch(/not allowed/);
  });

  it('hides a whole player from every board and check, and brings them back', async () => {
    const classCode = (await db.query<{ c: string }>(`select class_code c from scores where user_id = '${ADA}' and class_code is not null limit 1`)).rows[0].c;
    const classNames = () => as<{ name: string }>(null, 'select * from class_board($1)', [classCode]).then(b => b.map(r => r.name));
    const cert = () => as<{ c: unknown }>(null, 'select check_certificate($1) as c', ['LL-ABCD-EFGH']).then(r => r[0].c);
    expect(await board('advanced')).toContain('Adá Okafor');
    expect(await classNames()).toContain('Adá Okafor');
    expect(await cert()).not.toBeNull();

    await db.exec('delete from realtime.sent');
    await hidePlayer(DAN, ADA, true, 'Offensive name');
    for (const level of LEVEL_ORDER) expect(await board(level)).not.toContain('Adá Okafor');
    expect(await classNames()).not.toContain('Adá Okafor');
    expect(await cert()).toBeNull();
    // Open class boards refresh too.
    const topics = (await db.query<{ topic: string }>('select topic from realtime.sent')).rows.map(r => r.topic);
    expect(topics).toEqual(expect.arrayContaining(['scoreboard', `class:${classCode}`]));
    // New games stay off the boards, and don't push other players down.
    await relax();
    const posted = await submit(ADA, 'beginner', perfect('beginner'));
    expect(await board('beginner')).not.toContain('Adá Okafor');
    const bola = await submit(BOLA, 'beginner', play('beginner', buildRound('beginner'), Array(10).fill('skip'), Array(10).fill(9)).answers);
    expect(bola.rank).toBeLessThanOrEqual(bola.of!);
    expect((await review(DAN, 'hidden')).find(r => r.id === posted.id)?.player_hidden).toBe(true);

    await hidePlayer(DAN, ADA, false);
    expect(await board('beginner')).toContain('Adá Okafor');
    expect(await cert()).not.toBeNull();

    expect(await refusal(hidePlayer(DAN, DAN, true))).toMatch(/yourself/);
    expect(await refusal(hidePlayer(DAN, EVE, true))).toMatch(/no account/);
  });

  it('keeps a history of who did what, and why', async () => {
    const log = await as<{ action: string; moderator: string; player: string; reason: string | null }>(DAN, 'select * from moderation_history(10)');
    expect(log.map(l => [l.action, l.moderator, l.player, l.reason])).toEqual([
      ['show_player', 'Dan', 'Adá Okafor', null],
      ['hide_player', 'Dan', 'Adá Okafor', 'Offensive name'],
      ['show_score', 'Dan', 'Johnny', null],
      ['hide_score', 'Dan', 'Johnny', 'Test entry'],
    ]);
  });
});

describe('deleting an account', () => {
  it('removes the profile, history, scores and certificates', async () => {
    expect(await refusal(as(null, 'select delete_my_account()'))).not.toBeNull();
    await as(ADA, 'select delete_my_account()');
    const counts = (
      await db.query<{ users: number; profiles: number; games: number; scores: number; certificates: number }>(`
        select (select count(*)::int from auth.users where id = '${ADA}') users,
               (select count(*)::int from profiles where id = '${ADA}') profiles,
               (select count(*)::int from games where user_id = '${ADA}') games,
               (select count(*)::int from scores where user_id = '${ADA}') scores,
               (select count(*)::int from certificates where reference = 'LL-ABCD-EFGH') certificates`)
    ).rows[0];
    expect(counts).toEqual({ users: 0, profiles: 0, games: 0, scores: 0, certificates: 0 });
    // The moderation log keeps what was done, but no longer points at them.
    const log = (await db.query<{ n: number }>(`select count(*)::int n from moderation_log where player_id = '${ADA}'`)).rows[0];
    expect(log.n).toBe(0);
    expect((await db.query<{ n: number }>('select count(*)::int n from moderation_log')).rows[0].n).toBe(4);
    // Other players are untouched.
    expect((await as<{ name: string }>(null, 'select * from leaderboard($1, null, 50)', ['beginner'])).some(b => b.name === 'Bola')).toBe(true);
  });
});
