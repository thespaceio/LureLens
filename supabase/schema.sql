-- LureLens online features, for Supabase (Postgres): accounts and profiles,
-- synced game history, the online scoreboard (live), and certificate checks.
--
-- Apply the whole file (SQL Editor → New query → Run, or as a migration).
-- It is safe to run again after changes. Then run supabase/messages.sql.
--
-- Security model
-- - Anyone (the public "anon" key) can read the scoreboard, read a class's
--   board with its code, and check a certificate, through functions. Nothing else.
-- - Signed-in players can post games, register certificates, edit their own
--   profile, read and add their own game history, and delete their account.
-- - Moderators (listed by hand in the moderators table) can hide and unhide
--   scores and players, and every change is logged.
-- - Scores are worked out on the server from the answers, so a made-up score
--   can't be posted.
--
-- Personal data: email (held by Supabase Auth, never exposed), username
-- (public), optional full name (only on certificates), optional organisation
-- (private), game history (private). Deleting an account deletes all of it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The answer key: which messages are phishing, and where "Verify first" is
-- right. Filled by supabase/messages.sql (generated from src/data/emails.json).
create table if not exists public.messages (
  id text primary key,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  is_phishing boolean not null,
  verify_first boolean not null default false
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  full_name text,
  organisation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_username on public.profiles (lower(username));
-- Moderation (2.4): a hidden player is left off every public board and check.
alter table public.profiles add column if not exists hidden boolean not null default false;

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  score integer not null,
  correct integer not null,
  total integer not null,
  accuracy integer not null,
  best_streak integer not null,
  avg_seconds numeric(5, 1) not null,
  -- false for classroom games posted only to back a certificate
  ranked boolean not null default true,
  played_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- set to true to take an entry off the scoreboard (moderation)
  hidden boolean not null default false
);
-- Games posted from 2.2 on belong to an account. Older guest games have none.
alter table public.scores add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- Classroom games (2.3): the class code, each answer's outcome in round order
-- (R right, S "verify first" where it wasn't needed, W wrong), and a
-- fingerprint of the round so everyone in a class played the same messages.
alter table public.scores add column if not exists class_code text;
alter table public.scores add column if not exists marks text;
alter table public.scores add column if not exists class_round text;

create index if not exists scores_board on public.scores (level, score desc) where ranked and not hidden;
create index if not exists scores_by_name on public.scores (lower(name), created_at desc);
create index if not exists scores_by_user on public.scores (user_id, created_at desc);
create index if not exists scores_recent on public.scores (created_at desc);
create index if not exists scores_by_class on public.scores (class_code, created_at desc) where class_code is not null;

create table if not exists public.certificates (
  reference text primary key check (reference ~ '^LL-[0-9A-Z]{4}-[0-9A-Z]{4}$'),
  display_name text not null,
  player_name text not null,
  beginner_id uuid not null,
  intermediate_id uuid not null,
  advanced_id uuid not null,
  completed_on timestamptz not null,
  created_at timestamptz not null default now(),
  -- set to true to withdraw a certificate
  hidden boolean not null default false
);
alter table public.certificates add column if not exists user_id uuid references auth.users (id) on delete cascade;
-- Deleting a game (or an account) removes certificates that rest on it.
alter table public.certificates
  drop constraint if exists certificates_beginner_id_fkey,
  drop constraint if exists certificates_intermediate_id_fkey,
  drop constraint if exists certificates_advanced_id_fkey;
alter table public.certificates
  add constraint certificates_beginner_id_fkey foreign key (beginner_id) references public.scores (id) on delete cascade,
  add constraint certificates_intermediate_id_fkey foreign key (intermediate_id) references public.scores (id) on delete cascade,
  add constraint certificates_advanced_id_fkey foreign key (advanced_id) references public.scores (id) on delete cascade;

-- Deleting a game or an account looks certificates up by these.
create index if not exists certificates_by_user on public.certificates (user_id);
create index if not exists certificates_beginner on public.certificates (beginner_id);
create index if not exists certificates_intermediate on public.certificates (intermediate_id);
create index if not exists certificates_advanced on public.certificates (advanced_id);

-- A signed-in player's own game history, synced between their devices.
-- `data` is the game as the app saves it (src/types.ts GameSession).
create table if not exists public.games (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  played_at timestamptz not null,
  data jsonb not null check (pg_column_size(data) < 65536),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists games_by_user on public.games (user_id, played_at desc);
create index if not exists games_recent on public.games (created_at desc);
-- A saved game is about 1.3 KB; 8 KB leaves plenty of room and stops anyone
-- using history as free storage (security review, October 2026).
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'games_data_check' and conrelid = 'public.games'::regclass) then
    alter table public.games drop constraint games_data_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'games_data_size' and conrelid = 'public.games'::regclass) then
    alter table public.games add constraint games_data_size check (pg_column_size(data) < 8192) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Access: tables closed except a player's own profile and history.
-- ---------------------------------------------------------------------------

alter table public.messages enable row level security;
alter table public.scores enable row level security;
alter table public.certificates enable row level security;
alter table public.profiles enable row level security;
alter table public.games enable row level security;
revoke all on public.messages, public.scores, public.certificates, public.profiles, public.games from anon, authenticated;

grant select on public.profiles to authenticated;
drop policy if exists "Players read their own profile" on public.profiles;
create policy "Players read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

grant select, insert, delete on public.games to authenticated;
drop policy if exists "Players read their own games" on public.games;
create policy "Players read their own games" on public.games
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Players add their own games" on public.games;
create policy "Players add their own games" on public.games
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Players delete their own games" on public.games;
create policy "Players delete their own games" on public.games
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Keep history to a sensible size per player, and stop floods: quick-join
-- accounts are free to create, so limits also apply across everyone.
create or replace function public.lurelens_games_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anonymous boolean := coalesce((select is_anonymous from auth.users where id = new.user_id), false);
  v_max integer;
begin
  v_max := case when v_anonymous then 300 else 2000 end;
  if (select count(*) from games where user_id = new.user_id) >= v_max then
    raise exception 'Your history is full. Add an email to your account to keep more games.' using errcode = '22023';
  end if;
  if (select count(*) from games where user_id = new.user_id and created_at > now() - interval '10 minutes') >= 200 then
    raise exception 'Too many games saved in a short time. Try again in a few minutes.' using errcode = '22023';
  end if;
  if (select count(*) from games where created_at > now() - interval '10 minutes') >= 1000 then
    raise exception 'LureLens is busy. Your games will sync in a few minutes.' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists games_limit on public.games;
create trigger games_limit before insert on public.games for each row execute function public.lurelens_games_limit();

-- ---------------------------------------------------------------------------
-- Name and text checks. Letters from any language are allowed, including
-- Yoruba and Igbo (ọ ẹ ṣ ụ ị and tone marks).
-- ---------------------------------------------------------------------------

create or replace function public.lurelens_clean_name(p_name text, p_max integer)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := normalize(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), NFC);
  v_letters text;
begin
  if char_length(v) < 1 or char_length(v) > p_max then
    raise exception 'Names must be between 1 and % characters.', p_max using errcode = '22023';
  end if;
  if v !~ '^[[:alpha:][:digit:] .''_̀-ͯ-]+$' or v !~ '[[:alpha:][:digit:]]' then
    raise exception 'Names can only use letters, numbers, spaces and . '' _ -' using errcode = '22023';
  end if;
  v_letters := lower(regexp_replace(v, '[^A-Za-z]', '', 'g'));
  if v_letters ~ '(fuck|cunt|nigg|faggot|retard)'
     or v ~* '\m(shit\w*|bitch\w*|dick|pussy|bastard|asshole|whore|slut|ashawo|oloshi|werey|mumu|olodo)\M' then
    raise exception 'Please choose a different name.' using errcode = '22023';
  end if;
  return v;
end;
$$;

-- Free text such as a school or organisation name.
create or replace function public.lurelens_clean_text(p_text text, p_max integer)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := normalize(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g'), NFC);
begin
  if v = '' then
    return null;
  end if;
  if char_length(v) > p_max then
    raise exception 'Keep it under % characters.', p_max using errcode = '22023';
  end if;
  if v ~ '[<>{}\\]' or v ~ '[[:cntrl:]]' then
    raise exception 'That contains characters that are not allowed.' using errcode = '22023';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create or replace function public.save_profile(p_username text, p_full_name text default null, p_organisation text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_username text;
  v_full text;
  v_org text := lurelens_clean_text(p_organisation, 80);
  v_row profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '22023';
  end if;
  v_username := lurelens_clean_name(p_username, 24);
  if char_length(v_username) < 2 then
    raise exception 'Usernames need at least 2 characters.' using errcode = '22023';
  end if;
  if lower(v_username) in ('admin', 'administrator', 'lurelens', 'th3spaceio', 'th3 spaceio', 'spaceio', 'moderator', 'support', 'system', 'guest', 'player') then
    raise exception 'That username is reserved. Try another.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_full_name, '')), '') is not null then
    v_full := lurelens_clean_name(p_full_name, 48);
  end if;

  begin
    insert into profiles (id, username, full_name, organisation)
    values (v_uid, v_username, v_full, v_org)
    on conflict (id) do update
      set username = excluded.username, full_name = excluded.full_name,
          organisation = excluded.organisation, updated_at = now()
    returning * into v_row;
  exception when unique_violation then
    raise exception 'That username is taken. Try another.' using errcode = '22023';
  end;

  return jsonb_build_object('username', v_row.username, 'full_name', v_row.full_name, 'organisation', v_row.organisation);
end;
$$;

-- Deletes the signed-in player's account and everything tied to it:
-- profile, history, posted scores and certificates.
create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '22023';
  end if;
  delete from auth.users where id = v_uid;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Class codes (src/lib/classroom.ts): 6 Crockford base32 characters. The
-- first 5 hold the level and the round's seed; the last is a check character
-- the app verifies against its message bank. Returns the code tidied up
-- (upper case, no dash, O read as 0 and I or L as 1), or null if it isn't one.
-- ---------------------------------------------------------------------------

create or replace function public.lurelens_class_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when c ~ '^[0-9A-HJKMNP-TV-Z]{6}$' then c end
  from (select translate(upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011') as c) t;
$$;

-- Each player's first result for a class within the last day.
create or replace function public.lurelens_class_firsts(p_code text)
returns setof public.scores
language sql
stable
set search_path = public
as $$
  select distinct on (s.user_id) s.*
  from scores s
  where s.class_code = p_code and s.created_at > now() - interval '1 day' and not s.hidden
    and not exists (select 1 from profiles p where p.id = s.user_id and p.hidden)
  order by s.user_id, s.created_at;
$$;

-- A result's place in its class, in the same order as class_board.
create or replace function public.lurelens_class_rank(p_code text, p_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select r::integer from (
    select f.id, row_number() over (order by f.score desc, f.correct desc, f.avg_seconds asc, f.created_at asc) as r
    from lurelens_class_firsts(p_code) f
  ) x where x.id = p_id;
$$;

-- The level a class code is for.
create or replace function public.lurelens_class_level(p_code text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_value bigint := 0;
begin
  for i in 1..5 loop
    v_value := v_value * 32 + strpos('0123456789ABCDEFGHJKMNPQRSTVWXYZ', substr(p_code, i, 1)) - 1;
  end loop;
  return (array['beginner', 'intermediate', 'advanced'])[v_value % 3 + 1];
end;
$$;

-- ---------------------------------------------------------------------------
-- Post a game. Mirrors the scoring in src/lib/game.ts and LEVELS in src/types.ts.
-- p_name is ignored: the name is the account's username.
-- p_class_code: a classroom game for that class's board. It never goes on the
-- public scoreboard, each player's first result per class (within a day)
-- counts, and rank/of in the reply are the player's place in the class.
-- ---------------------------------------------------------------------------

drop function if exists public.submit_score(text, text, jsonb, timestamptz, boolean);
create or replace function public.submit_score(
  p_name text,
  p_level text,
  p_answers jsonb,
  p_played_at timestamptz default now(),
  p_ranked boolean default true,
  p_class_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_limit numeric;
  v_mult numeric;
  v_rounds constant integer := 10;
  v_answer jsonb;
  v_msg public.messages%rowtype;
  v_choice text;
  v_spent numeric;
  v_correct boolean;
  v_streak integer := 0;
  v_best integer := 0;
  v_score integer := 0;
  v_right integer := 0;
  v_time numeric := 0;
  v_seen text[] := '{}';
  v_played timestamptz := coalesce(p_played_at, now());
  v_id uuid;
  v_accuracy integer;
  v_rank integer;
  v_of integer;
  v_code text;
  v_marks text := '';
  v_round text;
  v_ranked boolean := coalesce(p_ranked, true);
  v_first public.scores%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in to post to the online scoreboard.' using errcode = '22023';
  end if;
  select username into v_name from profiles where id = v_uid;
  if v_name is null then
    raise exception 'Choose a username in your profile first.' using errcode = '22023';
  end if;

  case p_level
    when 'beginner' then v_limit := 30; v_mult := 1;
    when 'intermediate' then v_limit := 25; v_mult := 1.5;
    when 'advanced' then v_limit := 20; v_mult := 2;
    else raise exception 'Unknown level.' using errcode = '22023';
  end case;

  if p_class_code is not null then
    v_code := lurelens_class_code(p_class_code);
    if v_code is null then
      raise exception 'That class code isn''t right. Check it with your facilitator.' using errcode = '22023';
    end if;
    if lurelens_class_level(v_code) <> p_level then
      raise exception 'This class code is for a different level.' using errcode = '22023';
    end if;
    v_ranked := false;
    -- Already on this class's board today: the first result stands.
    select * into v_first from scores
    where class_code = v_code and user_id = v_uid and created_at > now() - interval '1 day'
    order by created_at limit 1;
    if found then
      select lurelens_class_rank(v_code, v_first.id) into v_rank;
      select count(*) into v_of from lurelens_class_firsts(v_code);
      return jsonb_build_object(
        'id', v_first.id, 'name', v_name, 'score', v_first.score, 'correct', v_first.correct,
        'accuracy', v_first.accuracy, 'rank', v_rank, 'of', v_of, 'already', true
      );
    end if;
  end if;

  -- Light flood protection.
  if (select count(*) from scores where user_id = v_uid and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Too many games posted in a short time. Try again in a few minutes.' using errcode = '22023';
  end if;
  if (select count(*) from scores where created_at > now() - interval '1 minute') >= 120 then
    raise exception 'The scoreboard is busy. Try again in a minute.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers) <> v_rounds then
    raise exception 'A game has % answers.', v_rounds using errcode = '22023';
  end if;

  for v_answer in select value from jsonb_array_elements(p_answers) loop
    select * into v_msg from messages where id = v_answer ->> 'id';
    if not found or v_msg.level <> p_level then
      raise exception 'This game has messages the online scoreboard does not know yet.' using errcode = '22023';
    end if;
    if v_msg.id = any (v_seen) then
      raise exception 'A message appears twice in this game.' using errcode = '22023';
    end if;
    v_seen := v_seen || v_msg.id;

    v_choice := v_answer ->> 'choice';
    if v_choice is null or v_choice not in ('phishing', 'legitimate', 'verify', 'timeout', 'skip') then
      raise exception 'Unknown answer.' using errcode = '22023';
    end if;
    if jsonb_typeof(v_answer -> 'seconds') = 'number' then
      v_spent := least(greatest((v_answer ->> 'seconds')::numeric, 0), v_limit);
    else
      v_spent := v_limit;
    end if;
    v_time := v_time + v_spent;

    if v_choice = 'verify' then
      -- Verify first: 0 points, never resets the streak, correct where checking first is right.
      v_correct := v_msg.verify_first;
      if v_correct then
        v_streak := v_streak + 1;
      end if;
    else
      v_correct := (v_choice = 'phishing' and v_msg.is_phishing) or (v_choice = 'legitimate' and not v_msg.is_phishing);
      if v_correct then
        v_streak := v_streak + 1;
        v_score := v_score
          + round(100 * v_mult)::integer
          + round(50 * ((v_limit - v_spent) / v_limit) * v_mult)::integer
          + case when v_streak >= 3 then 50 else 0 end;
      else
        v_streak := 0;
      end if;
    end if;
    if v_correct then
      v_right := v_right + 1;
    end if;
    v_marks := v_marks || case when v_correct then 'R' when v_choice = 'verify' then 'S' else 'W' end;
    v_best := greatest(v_best, v_streak);
  end loop;

  if v_code is not null then
    -- Everyone in a class plays the same messages in the same order. A
    -- different round means a different version of LureLens.
    v_round := md5(array_to_string(v_seen, ','));
    if exists (
      select 1 from scores
      where class_code = v_code and created_at > now() - interval '1 day' and class_round <> v_round
    ) then
      raise exception 'Your messages don''t match the rest of your class. Refresh LureLens so you have the same version as your facilitator, then play the class round again.' using errcode = '22023';
    end if;
  end if;

  if v_played > now() + interval '5 minutes' or v_played < now() - interval '2 years' then
    v_played := now();
  end if;
  v_accuracy := round(v_right * 100.0 / v_rounds)::integer;

  insert into scores (user_id, name, level, score, correct, total, accuracy, best_streak, avg_seconds, ranked, played_at,
                      class_code, marks, class_round)
  values (v_uid, v_name, p_level, v_score, v_right, v_rounds, v_accuracy, v_best, round(v_time / v_rounds, 1), v_ranked, v_played,
          v_code, case when v_code is not null then v_marks end, v_round)
  returning id into v_id;

  if v_code is not null then
    select lurelens_class_rank(v_code, v_id) into v_rank;
    select count(*) into v_of from lurelens_class_firsts(v_code);
  elsif v_ranked then
    select count(*) + 1 into v_rank
    from (
      select coalesce(user_id::text, 'guest:' || lower(name)) as player, max(score) as best
      from scores
      where level = p_level and ranked and not hidden
        and not exists (select 1 from profiles p where p.id = scores.user_id and p.hidden)
      group by 1
    ) b
    where b.best > v_score and b.player <> v_uid::text;
    select count(distinct coalesce(user_id::text, 'guest:' || lower(name))) into v_of
    from scores where level = p_level and ranked and not hidden
      and not exists (select 1 from profiles p where p.id = scores.user_id and p.hidden);
  end if;

  return jsonb_build_object(
    'id', v_id, 'name', v_name, 'score', v_score, 'correct', v_right, 'accuracy', v_accuracy,
    'rank', v_rank, 'of', v_of
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The online scoreboard: each player's best game, optionally within the last
-- p_days days. p_level null = every level. Names are current usernames.
-- ---------------------------------------------------------------------------

drop function if exists public.leaderboard(text, integer, integer);
create function public.leaderboard(p_level text default null, p_days integer default null, p_limit integer default 20)
returns table (
  name text, level text, score integer, correct integer, total integer, accuracy integer,
  best_streak integer, avg_seconds numeric, played_at timestamptz, is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.username, b.name), b.level, b.score, b.correct, b.total, b.accuracy, b.best_streak,
         b.avg_seconds, b.played_at, coalesce(b.user_id = auth.uid(), false)
  from (
    select distinct on (coalesce(s.user_id::text, 'guest:' || lower(s.name)), s.level) s.*
    from scores s
    where s.ranked and not s.hidden
      and (p_level is null or s.level = p_level)
      and (p_days is null or s.created_at >= now() - make_interval(days => p_days))
    order by coalesce(s.user_id::text, 'guest:' || lower(s.name)), s.level,
             s.score desc, s.accuracy desc, s.avg_seconds asc, s.created_at asc
  ) b
  left join profiles p on p.id = b.user_id
  where not coalesce(p.hidden, false)
  order by b.score desc, b.accuracy desc, b.avg_seconds asc, b.played_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- A class's board: each player's first result for the class code in the last
-- day, best first, with every answer's outcome for the debrief. Anyone with
-- the code can read it (the facilitator's screen, the big screen).
-- ---------------------------------------------------------------------------

create or replace function public.class_board(p_code text)
returns table (
  name text, score integer, correct integer, total integer, accuracy integer,
  avg_seconds numeric, marks text, played_at timestamptz, is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.username, f.name), f.score, f.correct, f.total, f.accuracy, f.avg_seconds, f.marks, f.played_at,
         coalesce(f.user_id = auth.uid(), false)
  from lurelens_class_firsts(lurelens_class_code(p_code)) f
  left join profiles p on p.id = f.user_id
  order by f.score desc, f.correct desc, f.avg_seconds asc, f.created_at asc
  limit 300;
$$;

-- Live updates: every new ranked game sends a small public signal on the
-- "scoreboard" channel (just the level, no names), and every class result a
-- signal on "class:<code>". Open boards reload.
create or replace function public.lurelens_announce_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.class_code is not null then
      -- Only screens watching this class hear it ("class:<code>").
      perform realtime.send('{}'::jsonb, 'new_class_result', 'class:' || new.class_code, false);
    elsif new.ranked and not new.hidden then
      perform realtime.send(jsonb_build_object('level', new.level), 'new_score', 'scoreboard', false);
    end if;
  exception when others then
    null; -- live updates must never stop a game from being posted
  end;
  return new;
end;
$$;
drop trigger if exists scores_announce on public.scores;
create trigger scores_announce after insert on public.scores for each row execute function public.lurelens_announce_score();

-- ---------------------------------------------------------------------------
-- Certificate rounds (2.8). The answers to the game's 140 messages are in the
-- public code, so anyone could look them up while playing. A certificate now
-- needs a certificate round at each level, played on messages that are NOT in
-- the public code: they live in a private repository and are loaded straight
-- into exam_messages. The server deals each message one at a time, times the
-- answer itself, and never says which answers were right; the player sees only
-- the final result.
-- ---------------------------------------------------------------------------

create table if not exists public.exam_messages (
  -- Opaque ids: nothing about the answer or level shows in the id.
  id text primary key check (id ~ '^x[0-9a-f]{8}$'),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  is_phishing boolean not null,
  verify_first boolean not null default false,
  -- What the player sees: channel, sender, subject, date, body or messages, attachments.
  content jsonb not null,
  active boolean not null default true
);

create table if not exists public.exam_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  message_ids text[] not null,
  -- One entry per answered message: {"id", "choice", "seconds"}.
  answers jsonb not null default '[]'::jsonb,
  -- When the message now on screen was dealt. Null between messages.
  served_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score_id uuid references public.scores (id) on delete set null
);
create index if not exists exam_rounds_by_user on public.exam_rounds (user_id, started_at desc);
create index if not exists exam_rounds_recent on public.exam_rounds (started_at desc);

-- Games from certificate rounds are saved as scores (never ranked) with exam = true.
alter table public.scores add column if not exists exam boolean not null default false;

alter table public.exam_messages enable row level security;
alter table public.exam_rounds enable row level security;
revoke all on public.exam_messages, public.exam_rounds from anon, authenticated;

-- Seconds per message and points multiplier for a level.
create or replace function public.lurelens_level_rules(p_level text, out seconds numeric, out mult numeric)
language sql
immutable
as $$
  select case p_level when 'beginner' then 30 when 'intermediate' then 25 when 'advanced' then 20 end::numeric,
         case p_level when 'beginner' then 1 when 'intermediate' then 1.5 when 'advanced' then 2 end::numeric;
$$;

-- What the player is shown for a message: its content and its id, never the answer.
create or replace function public.lurelens_exam_view(p_round public.exam_rounds)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'round', p_round.id,
    'level', p_round.level,
    'index', jsonb_array_length(p_round.answers),
    'total', cardinality(p_round.message_ids),
    'seconds', (lurelens_level_rules(p_round.level)).seconds,
    'elapsed', round(extract(epoch from (now() - p_round.served_at))::numeric, 1),
    'message', m.content || jsonb_build_object('id', m.id, 'level', m.level)
  )
  from exam_messages m
  where m.id = p_round.message_ids[jsonb_array_length(p_round.answers) + 1];
$$;

create or replace function public.start_certificate_round(p_level text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rounds constant integer := 10;
  v_phish_n integer;
  v_phish text[];
  v_legit text[];
  v_ids text[];
  v_round exam_rounds%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in to take a certificate round.' using errcode = '22023';
  end if;
  if not exists (select 1 from profiles where id = v_uid) then
    raise exception 'Choose a username in your profile first.' using errcode = '22023';
  end if;
  if p_level is null or p_level not in ('beginner', 'intermediate', 'advanced') then
    raise exception 'Unknown level.' using errcode = '22023';
  end if;

  -- A round left unfinished counts as an attempt; it can't be resumed with a fresh clock.
  update exam_rounds set finished_at = now()
  where user_id = v_uid and finished_at is null;

  if (select count(*) from exam_rounds
      where user_id = v_uid and level = p_level and started_at > now() - interval '1 day') >= 3 then
    raise exception 'You''ve had three certificate rounds at this level today. Practise, then try again tomorrow.' using errcode = '22023';
  end if;
  if (select count(*) from exam_rounds where started_at > now() - interval '1 hour') >= 600 then
    raise exception 'Certificate rounds are busy. Try again in a few minutes.' using errcode = '22023';
  end if;

  -- 4 to 6 phishing messages, preferring ones this player hasn't been dealt before.
  v_phish_n := 4 + floor(random() * 3)::integer;
  select array(
    select m.id from exam_messages m
    where m.level = p_level and m.active and m.is_phishing
    order by exists (select 1 from exam_rounds r where r.user_id = v_uid and m.id = any (r.message_ids)), random()
    limit v_phish_n
  ) into v_phish;
  select array(
    select m.id from exam_messages m
    where m.level = p_level and m.active and not m.is_phishing
    order by exists (select 1 from exam_rounds r where r.user_id = v_uid and m.id = any (r.message_ids)), random()
    limit v_rounds - cardinality(v_phish)
  ) into v_legit;
  if cardinality(v_phish) + cardinality(v_legit) < v_rounds then
    raise exception 'Certificate rounds aren''t ready yet. Try again later.' using errcode = '22023';
  end if;
  select array(select x from unnest(v_phish || v_legit) x order by random()) into v_ids;

  insert into exam_rounds (user_id, level, message_ids, served_at)
  values (v_uid, p_level, v_ids, now())
  returning * into v_round;
  return lurelens_exam_view(v_round);
end;
$$;

-- The message now on screen (after a reload, say). The clock keeps running.
create or replace function public.certificate_round_current(p_round uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round exam_rounds%rowtype;
begin
  select * into v_round from exam_rounds where id = p_round and user_id = auth.uid();
  if not found or v_round.finished_at is not null then
    raise exception 'This certificate round has finished.' using errcode = '22023';
  end if;
  if v_round.served_at is null then
    update exam_rounds set served_at = now() where id = v_round.id returning * into v_round;
  end if;
  return lurelens_exam_view(v_round);
end;
$$;

-- Records an answer, timed by the server, and deals the next message. After
-- the last one, scores the round. It never says whether an answer was right.
create or replace function public.answer_certificate_round(p_round uuid, p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_round exam_rounds%rowtype;
  v_rules record;
  v_elapsed numeric;
  v_choice text := p_choice;
  v_index integer;
  v_answer jsonb;
  v_msg exam_messages%rowtype;
  v_correct boolean;
  v_streak integer := 0;
  v_best integer := 0;
  v_score integer := 0;
  v_right integer := 0;
  v_time numeric := 0;
  v_spent numeric;
  v_total integer;
  v_name text;
  v_id uuid;
  v_accuracy integer;
begin
  select * into v_round from exam_rounds where id = p_round and user_id = v_uid for update;
  if not found or v_round.finished_at is not null then
    raise exception 'This certificate round has finished.' using errcode = '22023';
  end if;
  if v_round.served_at is null then
    raise exception 'Load the message before answering.' using errcode = '22023';
  end if;
  if v_choice is null or v_choice not in ('phishing', 'legitimate', 'verify', 'skip') then
    raise exception 'Unknown answer.' using errcode = '22023';
  end if;

  select * into v_rules from lurelens_level_rules(v_round.level);
  v_elapsed := extract(epoch from (now() - v_round.served_at))::numeric;
  -- A moment of grace for the network; after that the answer is too late.
  if v_elapsed > v_rules.seconds + 3 then
    v_choice := 'timeout';
  end if;
  v_index := jsonb_array_length(v_round.answers) + 1;
  v_answer := jsonb_build_object('id', v_round.message_ids[v_index], 'choice', v_choice,
                                 'seconds', round(least(v_elapsed, v_rules.seconds), 1));
  v_total := cardinality(v_round.message_ids);

  if v_index < v_total then
    update exam_rounds set answers = answers || v_answer, served_at = now()
    where id = v_round.id returning * into v_round;
    return jsonb_build_object('done', false, 'next', lurelens_exam_view(v_round));
  end if;

  -- The last answer: score the round exactly like a normal game.
  update exam_rounds set answers = answers || v_answer, served_at = null
  where id = v_round.id returning * into v_round;
  for v_answer in select value from jsonb_array_elements(v_round.answers) loop
    select * into v_msg from exam_messages where id = v_answer ->> 'id';
    v_spent := (v_answer ->> 'seconds')::numeric;
    v_time := v_time + v_spent;
    if v_answer ->> 'choice' = 'verify' then
      v_correct := v_msg.verify_first;
      if v_correct then v_streak := v_streak + 1; end if;
    else
      v_correct := (v_answer ->> 'choice' = 'phishing' and v_msg.is_phishing)
                or (v_answer ->> 'choice' = 'legitimate' and not v_msg.is_phishing);
      if v_correct then
        v_streak := v_streak + 1;
        v_score := v_score
          + round(100 * v_rules.mult)::integer
          + round(50 * ((v_rules.seconds - v_spent) / v_rules.seconds) * v_rules.mult)::integer
          + case when v_streak >= 3 then 50 else 0 end;
      else
        v_streak := 0;
      end if;
    end if;
    if v_correct then v_right := v_right + 1; end if;
    v_best := greatest(v_best, v_streak);
  end loop;

  select username into v_name from profiles where id = v_uid;
  v_accuracy := round(v_right * 100.0 / v_total)::integer;
  insert into scores (user_id, name, level, score, correct, total, accuracy, best_streak, avg_seconds, ranked, exam, played_at)
  values (v_uid, coalesce(v_name, 'Player'), v_round.level, v_score, v_right, v_total, v_accuracy, v_best,
          round(v_time / v_total, 1), false, true, now())
  returning id into v_id;
  update exam_rounds set finished_at = now(), score_id = v_id where id = v_round.id;

  return jsonb_build_object(
    'done', true,
    'result', jsonb_build_object(
      'id', v_id, 'level', v_round.level, 'score', v_score, 'correct', v_right, 'total', v_total,
      'accuracy', v_accuracy, 'best_streak', v_best, 'avg_seconds', round(v_time / v_total, 1),
      'played_at', now(), 'answers', v_round.answers
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Certificates: registered by a signed-in player from three of their own
-- posted games (one per level, each 80%+), so the online check shows
-- server-checked results.
-- ---------------------------------------------------------------------------

create or replace function public.register_certificate(p_reference text, p_display_name text, p_score_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
  v_display text;
  v_ref text := upper(btrim(coalesce(p_reference, '')));
  v_b scores%rowtype;
  v_i scores%rowtype;
  v_a scores%rowtype;
  v_existing certificates%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in to make your certificate checkable online.' using errcode = '22023';
  end if;
  select * into v_profile from profiles where id = v_uid;
  if v_profile.id is null then
    raise exception 'Choose a username in your profile first.' using errcode = '22023';
  end if;
  v_display := lurelens_clean_name(coalesce(nullif(btrim(coalesce(p_display_name, '')), ''), v_profile.full_name, v_profile.username), 48);
  if v_ref !~ '^LL-[0-9A-Z]{4}-[0-9A-Z]{4}$' then
    raise exception 'That is not a certificate reference.' using errcode = '22023';
  end if;
  if p_score_ids is null or array_length(p_score_ids, 1) <> 3 then
    raise exception 'A certificate needs one game from each level.' using errcode = '22023';
  end if;

  select * into v_b from scores where id = any (p_score_ids) and level = 'beginner' and user_id = v_uid and not hidden;
  select * into v_i from scores where id = any (p_score_ids) and level = 'intermediate' and user_id = v_uid and not hidden;
  select * into v_a from scores where id = any (p_score_ids) and level = 'advanced' and user_id = v_uid and not hidden;
  if v_b.id is null or v_i.id is null or v_a.id is null then
    raise exception 'A certificate needs one of your posted games from each level.' using errcode = '22023';
  end if;
  if least(v_b.accuracy, v_i.accuracy, v_a.accuracy) < 80 then
    raise exception 'Each level needs at least 80%% accuracy.' using errcode = '22023';
  end if;
  -- From 2.8 a certificate rests on certificate rounds, whose messages aren't
  -- public. Games posted before then still count, so no one loses a certificate.
  if (not v_b.exam and v_b.created_at >= timestamptz '2026-11-13 10:00:00+00')
     or (not v_i.exam and v_i.created_at >= timestamptz '2026-11-13 10:00:00+00')
     or (not v_a.exam and v_a.created_at >= timestamptz '2026-11-13 10:00:00+00') then
    raise exception 'Certificates now need a certificate round at each level. Take them from the Progress page.' using errcode = '22023';
  end if;

  select * into v_existing from certificates where reference = v_ref;
  if found then
    if v_existing.user_id is distinct from v_uid
       or (v_existing.beginner_id, v_existing.intermediate_id, v_existing.advanced_id) <> (v_b.id, v_i.id, v_a.id) then
      raise exception 'This reference is already registered.' using errcode = '22023';
    end if;
    update certificates set display_name = v_display where reference = v_ref;
  else
    insert into certificates (reference, user_id, display_name, player_name, beginner_id, intermediate_id, advanced_id, completed_on)
    values (v_ref, v_uid, v_display, v_profile.username, v_b.id, v_i.id, v_a.id, greatest(v_b.played_at, v_i.played_at, v_a.played_at));
  end if;

  return jsonb_build_object('reference', v_ref, 'display_name', v_display);
end;
$$;

create or replace function public.check_certificate(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reference', c.reference,
    'display_name', c.display_name,
    'player_name', coalesce(p.username, c.player_name),
    'account', c.user_id is not null,
    'completed_on', c.completed_on,
    -- true when every level was passed in a certificate round (2.8 and later)
    'certificate_rounds', b.exam and i.exam and a.exam,
    'levels', jsonb_build_object(
      'beginner', jsonb_build_object('accuracy', b.accuracy, 'score', b.score, 'played_at', b.played_at),
      'intermediate', jsonb_build_object('accuracy', i.accuracy, 'score', i.score, 'played_at', i.played_at),
      'advanced', jsonb_build_object('accuracy', a.accuracy, 'score', a.score, 'played_at', a.played_at)
    )
  )
  from certificates c
  join scores b on b.id = c.beginner_id
  join scores i on i.id = c.intermediate_id
  join scores a on a.id = c.advanced_id
  left join profiles p on p.id = c.user_id
  where c.reference = upper(btrim(coalesce(p_reference, ''))) and not c.hidden and not coalesce(p.hidden, false);
$$;

-- ---------------------------------------------------------------------------
-- Moderation: moderators can take a score, or a whole player, off every public
-- board (the scoreboard, class boards and certificate checks), put it back,
-- and see who did what and why. Nothing is deleted, so it can always be undone.
--
-- Moderators are added by hand in the SQL editor, never from the app:
--   insert into public.moderators (user_id)
--   select id from auth.users where email = 'someone@example.com';
-- ---------------------------------------------------------------------------

create table if not exists public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists public.moderation_log (
  id bigint generated always as identity primary key,
  moderator uuid references auth.users (id) on delete set null,
  action text not null check (action in ('hide_score', 'show_score', 'hide_player', 'show_player')),
  score_id uuid references public.scores (id) on delete set null,
  player_id uuid references auth.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists moderation_log_recent on public.moderation_log (created_at desc);
create index if not exists moderation_log_by_moderator on public.moderation_log (moderator);
create index if not exists moderation_log_by_score on public.moderation_log (score_id);
create index if not exists moderation_log_by_player on public.moderation_log (player_id);

alter table public.moderators enable row level security;
alter table public.moderation_log enable row level security;
revoke all on public.moderators, public.moderation_log from anon, authenticated;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from moderators where user_id = auth.uid());
$$;

-- Tells open boards to reload after a change.
create or replace function public.lurelens_moderation_signal(p_class_codes text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  begin
    perform realtime.send('{}'::jsonb, 'new_score', 'scoreboard', false);
    foreach v_code in array coalesce(p_class_codes, '{}') loop
      perform realtime.send('{}'::jsonb, 'new_class_result', 'class:' || v_code, false);
    end loop;
  exception when others then
    null; -- a missed signal only delays the refresh
  end;
end;
$$;

-- Recent posted games for review. p_view: 'recent', 'flagged' (perfect and
-- very fast, or impossibly fast: likely scripted) or 'hidden'.
create or replace function public.moderation_scores(p_view text default 'recent', p_search text default null, p_limit integer default 100)
returns table (
  id uuid, player_id uuid, name text, level text, score integer, correct integer, total integer,
  accuracy integer, avg_seconds numeric, ranked boolean, class_code text, created_at timestamptz,
  hidden boolean, player_hidden boolean, flags text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
begin
  if not is_moderator() then
    raise exception 'Only moderators can do that.' using errcode = '42501';
  end if;
  return query
  select s.id, s.user_id, coalesce(p.username, s.name), s.level, s.score, s.correct, s.total,
         s.accuracy, s.avg_seconds, s.ranked, s.class_code, s.created_at,
         s.hidden, coalesce(p.hidden, false),
         array_remove(array[
           case when s.accuracy = 100 and s.avg_seconds < 4 then 'perfect_fast' end,
           case when s.avg_seconds < 2 then 'very_fast' end
         ], null)
  from scores s
  left join profiles p on p.id = s.user_id
  where (v_search = '' or strpos(lower(coalesce(p.username, s.name)), v_search) > 0)
    and case coalesce(p_view, 'recent')
          when 'hidden' then s.hidden or coalesce(p.hidden, false)
          when 'flagged' then (s.accuracy = 100 and s.avg_seconds < 4) or s.avg_seconds < 2
          else true
        end
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.moderate_score(p_id uuid, p_hidden boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v scores%rowtype;
  v_reason text := lurelens_clean_text(p_reason, 200);
begin
  if not is_moderator() then
    raise exception 'Only moderators can do that.' using errcode = '42501';
  end if;
  update scores set hidden = coalesce(p_hidden, true) where id = p_id returning * into v;
  if v.id is null then
    raise exception 'That score no longer exists.' using errcode = '22023';
  end if;
  insert into moderation_log (moderator, action, score_id, player_id, reason)
  values (auth.uid(), case when v.hidden then 'hide_score' else 'show_score' end, v.id, v.user_id, v_reason);
  perform lurelens_moderation_signal(case when v.class_code is not null then array[v.class_code] end);
  return jsonb_build_object('id', v.id, 'hidden', v.hidden);
end;
$$;

create or replace function public.moderate_player(p_player uuid, p_hidden boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v profiles%rowtype;
  v_reason text := lurelens_clean_text(p_reason, 200);
begin
  if not is_moderator() then
    raise exception 'Only moderators can do that.' using errcode = '42501';
  end if;
  if p_player = auth.uid() then
    raise exception 'You can''t hide yourself.' using errcode = '22023';
  end if;
  update profiles set hidden = coalesce(p_hidden, true) where id = p_player returning * into v;
  if v.id is null then
    raise exception 'That player has no account, so hide their scores one at a time.' using errcode = '22023';
  end if;
  insert into moderation_log (moderator, action, player_id, reason)
  values (auth.uid(), case when v.hidden then 'hide_player' else 'show_player' end, v.id, v_reason);
  perform lurelens_moderation_signal(array(
    select distinct class_code from scores
    where user_id = v.id and class_code is not null and created_at > now() - interval '1 day'
  ));
  return jsonb_build_object('id', v.id, 'username', v.username, 'hidden', v.hidden);
end;
$$;

-- What moderators did, newest first.
create or replace function public.moderation_history(p_limit integer default 50)
returns table (
  created_at timestamptz, action text, moderator text, player text, level text, score integer, reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not is_moderator() then
    raise exception 'Only moderators can do that.' using errcode = '42501';
  end if;
  return query
  select l.created_at, l.action, m.username, coalesce(p.username, s.name), s.level, s.score, l.reason
  from moderation_log l
  left join profiles m on m.id = l.moderator
  left join scores s on s.id = l.score_id
  left join profiles p on p.id = coalesce(l.player_id, s.user_id)
  order by l.created_at desc, l.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.lurelens_clean_name(text, integer) from public, anon, authenticated;
revoke execute on function public.lurelens_clean_text(text, integer) from public, anon, authenticated;
revoke execute on function public.lurelens_announce_score() from public, anon, authenticated;
revoke execute on function public.lurelens_games_limit() from public, anon, authenticated;
revoke execute on function public.lurelens_class_code(text) from public, anon, authenticated;
revoke execute on function public.lurelens_class_level(text) from public, anon, authenticated;
revoke execute on function public.lurelens_class_firsts(text) from public, anon, authenticated;
revoke execute on function public.lurelens_class_rank(text, uuid) from public, anon, authenticated;
revoke execute on function public.submit_score(text, text, jsonb, timestamptz, boolean, text) from public, anon;
revoke execute on function public.class_board(text) from public;
revoke execute on function public.leaderboard(text, integer, integer) from public;
revoke execute on function public.register_certificate(text, text, uuid[]) from public, anon;
revoke execute on function public.check_certificate(text) from public;
revoke execute on function public.save_profile(text, text, text) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.lurelens_moderation_signal(text[]) from public, anon, authenticated;
revoke execute on function public.is_moderator() from public, anon;
revoke execute on function public.moderation_scores(text, text, integer) from public, anon;
revoke execute on function public.moderate_score(uuid, boolean, text) from public, anon;
revoke execute on function public.moderate_player(uuid, boolean, text) from public, anon;
revoke execute on function public.moderation_history(integer) from public, anon;
revoke execute on function public.lurelens_level_rules(text) from public, anon, authenticated;
revoke execute on function public.lurelens_exam_view(public.exam_rounds) from public, anon, authenticated;
revoke execute on function public.start_certificate_round(text) from public, anon;
revoke execute on function public.certificate_round_current(uuid) from public, anon;
revoke execute on function public.answer_certificate_round(uuid, text) from public, anon;

-- Everyone: read the board, check a certificate.
grant execute on function public.leaderboard(text, integer, integer) to anon, authenticated;
grant execute on function public.check_certificate(text) to anon, authenticated;
grant execute on function public.class_board(text) to anon, authenticated;
-- Signed-in players only.
grant execute on function public.submit_score(text, text, jsonb, timestamptz, boolean, text) to authenticated;
grant execute on function public.register_certificate(text, text, uuid[]) to authenticated;
grant execute on function public.save_profile(text, text, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.start_certificate_round(text) to authenticated;
grant execute on function public.certificate_round_current(uuid) to authenticated;
grant execute on function public.answer_certificate_round(uuid, text) to authenticated;
-- Moderators only (each function checks the moderators table itself).
grant execute on function public.is_moderator() to authenticated;
grant execute on function public.moderation_scores(text, text, integer) to authenticated;
grant execute on function public.moderate_score(uuid, boolean, text) to authenticated;
grant execute on function public.moderate_player(uuid, boolean, text) to authenticated;
grant execute on function public.moderation_history(integer) to authenticated;
