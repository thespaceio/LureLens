# Online features: accounts, live scoreboard, certificate checks

LureLens works fully offline without any of this. With the Supabase project connected (`src/onlineConfig.ts`), it adds:

- **Accounts** (email sign-in with a 6-digit code): a reserved public username, an optional full name for certificates, an optional school or organisation, and game history synced between devices. Guests can still play; their scores stay on their device.
- **The online scoreboard**, live: each player's best posted game, this week or all time. Signed-in players tap "Post to the online scoreboard" after a ranked game. New scores appear on open scoreboards within seconds.
- **"Top players this week"** on the home screen, and a **big-screen view** for projectors at `https://lurelens.netlify.app/?live`.
- **Checkable certificates** tied to an account, and a public **Check a certificate** page (`?cert=LL-XXXX-XXXX`), which the LinkedIn "Add to profile" link points to.
- A **privacy notice** at `?privacy`, and **account deletion** on the Account page.

## How it works

Everything is in `supabase/schema.sql`, which is safe to run again after changes.

| Who | Can |
|---|---|
| Anyone (public key) | read the scoreboard (`leaderboard`), check a certificate (`check_certificate`) |
| Signed-in player | post a game (`submit_score`), register a certificate (`register_certificate`), edit their profile (`save_profile`), read their own profile, read and add their own game history (`games`), delete their account (`delete_my_account`) |

- `submit_score` receives the **answers**, not a score. It checks them against the answer key (`messages`), recomputes the score with the game's rules, files it under the account's username, and limits floods (10 games per account per 10 minutes, 120 a minute overall).
- Names (usernames and certificate names) accept letters from any language, including Yoruba and Igbo (ọ ẹ ṣ ụ ị and tone marks), plus numbers, spaces and `. ' _ -`. A short list of offensive words and reserved names (admin, lurelens, th3spaceio, ...) is refused.
- Every new ranked game triggers `realtime.send(...)` on the public channel `scoreboard` with just the level, no names. Open scoreboards reload when they hear it, and refresh every minute anyway.
- Deleting an account removes the user, profile, history, posted scores and certificates (cascading deletes).

`supabase/schema.test.ts` runs the SQL in an in-memory Postgres in CI, with stand-ins for Supabase's `auth` and `realtime`, and fails if the server and the game ever score differently or access rules break.

## The live project

**LureLens** (`rxyhvpdbfuboukqgbych`, region eu-west-1) in the Supabase organization **Th3 SpaceIO**, free plan.

### Dashboard settings (one-time)

1. **Authentication → URL Configuration**
   - Site URL: `https://lurelens.netlify.app`
   - Redirect URLs: `https://lurelens.netlify.app/**`, `https://thespaceio.github.io/LureLens/**`, `http://localhost:5173/**`
2. **Authentication → Emails → Templates**: in **Magic link**, **Confirm signup** and **Change email address**, use the code template below so the email contains the 6-digit code (the app asks for the code, which works even when the email opens in another browser).
3. **Authentication → Emails → SMTP settings**: connect an email service (Resend, Brevo, ...). Without it Supabase only emails members of the Supabase team, a few times an hour. Then raise the email rate limit under **Authentication → Rate Limits** to suit (for example 100 an hour).
4. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**. This powers *Quick join*: players pick a username and post straight away with no email (useful in a class while email sending is limited). Quick-join accounts live on one device until the player adds an email. Quick joins are limited per IP address, and a class on shared Wi-Fi counts as one address. Under **Authentication → Rate Limits**, **Rate limit for anonymous users** is set to **300 per hour** (the default is 30). Supabase lets the first 30 join at once and then refills at that rate: with 300, one more every 12 seconds, so a class of 60 is in within about 6 minutes. Keep it at a few hundred: the limit is also what stops anyone from flooding the database with fake accounts. Students on mobile data each count separately.
5. **Realtime → Settings**: keep public channels allowed (the scoreboard signal uses the public channel `scoreboard`). If live updates don't arrive, the board still refreshes every minute.

Email template (subject: `Your LureLens sign-in code`):

```html
<h2>Your LureLens sign-in code</h2>
<p>Enter this code in LureLens:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Or <a href="{{ .ConfirmationURL }}">sign in with this link</a> on the device where you are playing.</p>
<!-- In "Change email address", say "confirm your email" instead of "sign in". -->
<p>If you didn't ask for this, you can ignore this email.</p>
```

### Keeping the project awake

Free Supabase projects pause after 7 days without activity, which would take the scoreboard, accounts and certificate checks offline. The **Keep Supabase awake** workflow (`.github/workflows/keep-alive.yml`) asks the scoreboard for its top score once a day, using only the public key, so the project never sits idle. Run it any time from **Actions → Keep Supabase awake → Run workflow**. If it fails, the project may already be paused: restore it from the Supabase dashboard.

GitHub turns off scheduled workflows after 60 days without commits to the repository and emails the owner; re-enable it from the same Actions page.

## When the messages change

`npm run check:data` fails until the answer key is regenerated:

```bash
npm run supabase:messages
```

Then run the new `supabase/messages.sql` in the SQL Editor.

## Moderation

In the Supabase Table Editor:

- **Remove a game from the scoreboard:** `scores` → set `hidden` to true (or delete the row).
- **Rename an offensive username:** `profiles` → edit `username` (the scoreboard shows the new name at once).
- **Withdraw a certificate:** `certificates` → set `hidden` to true.
- **Remove a player entirely:** Authentication → Users → delete the user (removes everything of theirs).

## About Supabase's security advisor

Expected notes: *RLS enabled, no policy* on `scores`, `messages` and `certificates` (closed on purpose), and *SECURITY DEFINER function executable* for the public functions listed above (they are the intended way in, and each checks its input).
