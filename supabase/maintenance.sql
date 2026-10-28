-- LureLens scheduled maintenance, run by Supabase's pg_cron (Database ->
-- Extensions -> pg_cron). Kept apart from schema.sql because pg_cron only
-- exists on the hosted database. Safe to run again: it replaces the job.
--
-- Nightly at 03:17 UTC: remove quick-join (anonymous) accounts that never chose
-- a username, a week after they were made. Without a username an account can't
-- post scores, save history or register certificates, so nothing is lost; this
-- just stops abandoned or scripted sign-ins from piling up.

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'lurelens-cleanup-quick-join';

select cron.schedule(
  'lurelens-cleanup-quick-join',
  '17 3 * * *',
  $job$
    delete from auth.users u
    where u.is_anonymous
      and u.created_at < now() - interval '7 days'
      and not exists (select 1 from public.profiles p where p.id = u.id)
  $job$
);
