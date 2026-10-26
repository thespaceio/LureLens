# Online scoreboard and certificate check

LureLens works fully offline without this. When the two Supabase settings are filled in, it adds:

- an **Online** tab on the scoreboard (each player's best posted game, this week or all time),
- a **Post to the online scoreboard** button after ranked games (nothing is sent unless the player taps it),
- **Make it checkable online** on the certificate, and a **Check a certificate** page (`?cert=LL-XXXX-XXXX`), which the LinkedIn "Add to profile" link points to.

## How it works

Everything lives in one Supabase project (free plan). The browser calls four database functions in `supabase/schema.sql` and nothing else; the tables themselves are closed.

- `submit_score` receives the **answers**, not a score. It checks every message against the answer key (`messages` table), recomputes the score with the same rules as the game, and refuses bad names, wrong answer counts and floods (10 games per name per 10 minutes, 120 games a minute overall).
- `leaderboard` returns each player's best visible game.
- `register_certificate` accepts a certificate only when it is backed by three posted games, one per level, each 80% or more, all under the same player name.
- `check_certificate` returns the certificate and its three results.

Stored: the player name a person chooses, scores, dates, and the name they put on a certificate. No emails, phone numbers or IP addresses.

`supabase/schema.test.ts` runs the SQL in an in-memory Postgres in CI and fails if the server and the game ever score a game differently.

## Setting it up

1. Create a Supabase project (Region: West EU (London), Plan: Free).
2. SQL Editor → New query → paste `supabase/schema.sql` → Run.
3. New query → paste `supabase/messages.sql` → Run.
4. Project Settings → API: copy the Project URL and the anon/publishable key into `src/onlineConfig.ts` (or set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` at build time). Never use the `service_role`/secret key in the app.

## When the messages change

`npm run check:data` fails until the answer key is regenerated:

```bash
npm run supabase:messages
```

Then run the new `supabase/messages.sql` in the SQL Editor. Until you do, games that include a new message are refused with "This game has messages the online scoreboard does not know yet."

## Moderation

In the Supabase Table Editor:

- **Remove a name from the scoreboard:** open `scores`, filter by `name`, set `hidden` to true (or delete the rows).
- **Withdraw a certificate:** open `certificates`, set `hidden` to true.

Or in the SQL Editor, for example:

```sql
update scores set hidden = true where lower(name) = 'some name';
```

To change the list of refused words, edit `lurelens_clean_name` in `supabase/schema.sql` and run the file again.
