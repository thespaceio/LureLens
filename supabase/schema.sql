-- LureLens online scoreboard and certificate check, for Supabase (Postgres).
--
-- Paste this whole file into Supabase: SQL Editor → New query → Run.
-- It is safe to run again after changes. Then run supabase/messages.sql.
--
-- Security model: the tables are closed. Browsers (using the public
-- publishable/anon key) can only call the four functions at the bottom, and
-- the functions check everything. Scores are worked out on the server from
-- the answers, so a made-up score can't be posted.
--
-- Stored: the name a player chooses, their scores and dates, and for
-- certificates the name they put on it. No emails, phone numbers or IPs.

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

create index if not exists scores_board on public.scores (level, score desc) where ranked and not hidden;
create index if not exists scores_by_name on public.scores (lower(name), created_at desc);
create index if not exists scores_recent on public.scores (created_at desc);

create table if not exists public.certificates (
  reference text primary key check (reference ~ '^LL-[0-9A-Z]{4}-[0-9A-Z]{4}$'),
  display_name text not null,
  player_name text not null,
  beginner_id uuid not null references public.scores (id),
  intermediate_id uuid not null references public.scores (id),
  advanced_id uuid not null references public.scores (id),
  completed_on timestamptz not null,
  created_at timestamptz not null default now(),
  -- set to true to withdraw a certificate
  hidden boolean not null default false
);

-- Row level security on, and no policies: nobody reads or writes the tables
-- directly. Everything goes through the functions below.
alter table public.messages enable row level security;
alter table public.scores enable row level security;
alter table public.certificates enable row level security;
revoke all on public.messages, public.scores, public.certificates from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Name checks
-- ---------------------------------------------------------------------------

create or replace function public.lurelens_clean_name(p_name text, p_max integer)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_letters text;
begin
  if char_length(v) < 1 or char_length(v) > p_max then
    raise exception 'Names must be between 1 and % characters.', p_max using errcode = '22023';
  end if;
  if v !~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .''_-]+$' then
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

-- ---------------------------------------------------------------------------
-- Post a game. Mirrors the scoring in src/lib/game.ts and LEVELS in src/types.ts.
-- ---------------------------------------------------------------------------

create or replace function public.submit_score(
  p_name text,
  p_level text,
  p_answers jsonb,
  p_played_at timestamptz default now(),
  p_ranked boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := lurelens_clean_name(p_name, 24);
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
begin
  case p_level
    when 'beginner' then v_limit := 30; v_mult := 1;
    when 'intermediate' then v_limit := 25; v_mult := 1.5;
    when 'advanced' then v_limit := 20; v_mult := 2;
    else raise exception 'Unknown level.' using errcode = '22023';
  end case;

  -- Light flood protection.
  if (select count(*) from scores where lower(name) = lower(v_name) and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Too many games posted under this name. Try again in a few minutes.' using errcode = '22023';
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
    v_best := greatest(v_best, v_streak);
  end loop;

  if v_played > now() + interval '5 minutes' or v_played < now() - interval '2 years' then
    v_played := now();
  end if;
  v_accuracy := round(v_right * 100.0 / v_rounds)::integer;

  insert into scores (name, level, score, correct, total, accuracy, best_streak, avg_seconds, ranked, played_at)
  values (v_name, p_level, v_score, v_right, v_rounds, v_accuracy, v_best, round(v_time / v_rounds, 1), coalesce(p_ranked, true), v_played)
  returning id into v_id;

  if coalesce(p_ranked, true) then
    select count(*) + 1 into v_rank
    from (
      select lower(name) as player, max(score) as best
      from scores
      where level = p_level and ranked and not hidden and lower(name) <> lower(v_name)
      group by lower(name)
    ) b
    where b.best > v_score;
    select count(distinct lower(name)) into v_of from scores where level = p_level and ranked and not hidden;
  end if;

  return jsonb_build_object(
    'id', v_id, 'name', v_name, 'score', v_score, 'correct', v_right, 'accuracy', v_accuracy,
    'rank', v_rank, 'of', v_of
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The online scoreboard: each player's best game, optionally within the last
-- p_days days. p_level null = every level.
-- ---------------------------------------------------------------------------

create or replace function public.leaderboard(p_level text default null, p_days integer default null, p_limit integer default 20)
returns table (
  name text, level text, score integer, correct integer, total integer, accuracy integer,
  best_streak integer, avg_seconds numeric, played_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.name, b.level, b.score, b.correct, b.total, b.accuracy, b.best_streak, b.avg_seconds, b.played_at
  from (
    select distinct on (lower(s.name), s.level) s.*
    from scores s
    where s.ranked and not s.hidden
      and (p_level is null or s.level = p_level)
      and (p_days is null or s.created_at >= now() - make_interval(days => p_days))
    order by lower(s.name), s.level, s.score desc, s.accuracy desc, s.avg_seconds asc, s.created_at asc
  ) b
  order by b.score desc, b.accuracy desc, b.avg_seconds asc, b.played_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Certificates: registered from three posted games (one per level, each 80%+,
-- same player name), so the online check shows server-checked results.
-- ---------------------------------------------------------------------------

create or replace function public.register_certificate(p_reference text, p_display_name text, p_score_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display text := lurelens_clean_name(p_display_name, 48);
  v_ref text := upper(btrim(coalesce(p_reference, '')));
  v_b scores%rowtype;
  v_i scores%rowtype;
  v_a scores%rowtype;
  v_existing certificates%rowtype;
begin
  if v_ref !~ '^LL-[0-9A-Z]{4}-[0-9A-Z]{4}$' then
    raise exception 'That is not a certificate reference.' using errcode = '22023';
  end if;
  if p_score_ids is null or array_length(p_score_ids, 1) <> 3 then
    raise exception 'A certificate needs one game from each level.' using errcode = '22023';
  end if;

  select * into v_b from scores where id = any (p_score_ids) and level = 'beginner' and not hidden;
  select * into v_i from scores where id = any (p_score_ids) and level = 'intermediate' and not hidden;
  select * into v_a from scores where id = any (p_score_ids) and level = 'advanced' and not hidden;
  if v_b.id is null or v_i.id is null or v_a.id is null then
    raise exception 'A certificate needs one posted game from each level.' using errcode = '22023';
  end if;
  if least(v_b.accuracy, v_i.accuracy, v_a.accuracy) < 80 then
    raise exception 'Each level needs at least 80%% accuracy.' using errcode = '22023';
  end if;
  if lower(v_b.name) <> lower(v_i.name) or lower(v_b.name) <> lower(v_a.name) then
    raise exception 'All three games must be played under the same name.' using errcode = '22023';
  end if;

  select * into v_existing from certificates where reference = v_ref;
  if found then
    if (v_existing.beginner_id, v_existing.intermediate_id, v_existing.advanced_id) <> (v_b.id, v_i.id, v_a.id) then
      raise exception 'This reference is already registered.' using errcode = '22023';
    end if;
    update certificates set display_name = v_display where reference = v_ref;
  else
    insert into certificates (reference, display_name, player_name, beginner_id, intermediate_id, advanced_id, completed_on)
    values (v_ref, v_display, v_b.name, v_b.id, v_i.id, v_a.id, greatest(v_b.played_at, v_i.played_at, v_a.played_at));
  end if;

  return jsonb_build_object('reference', v_ref);
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
    'player_name', c.player_name,
    'completed_on', c.completed_on,
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
  where c.reference = upper(btrim(coalesce(p_reference, ''))) and not c.hidden;
$$;

-- Only these functions are callable from the browser.
revoke execute on function public.lurelens_clean_name(text, integer) from public, anon, authenticated;
revoke execute on function public.submit_score(text, text, jsonb, timestamptz, boolean) from public;
revoke execute on function public.leaderboard(text, integer, integer) from public;
revoke execute on function public.register_certificate(text, text, uuid[]) from public;
revoke execute on function public.check_certificate(text) from public;
grant execute on function public.submit_score(text, text, jsonb, timestamptz, boolean) to anon, authenticated;
grant execute on function public.leaderboard(text, integer, integer) to anon, authenticated;
grant execute on function public.register_certificate(text, text, uuid[]) to anon, authenticated;
grant execute on function public.check_certificate(text) to anon, authenticated;
