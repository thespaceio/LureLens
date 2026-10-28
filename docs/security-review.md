# LureLens security review

**Date:** 28 October 2026 · **Version reviewed:** 2.3.0 · **Scope:** the web app, the Supabase database and auth, hosting and the build.

LureLens is a free awareness game, so the main things to protect are players' accounts and personal data (email, optional full name and organisation, game history), the honesty of the scoreboards and certificates, and the free hosting limits that keep it online. This review looked at each of those, fixed what it found (seven fixes), and lists what is accepted or left for later.

## How it was reviewed

- **Access rules on the live database:** what the public key and a signed-in player can read, write and call, function by function and table by table.
- **Database functions:** inputs, limits, `SECURITY DEFINER` settings, and what each one reveals.
- **Abuse:** what a script could do with free quick-join accounts.
- **Browser:** where untrusted content is rendered, what the page can load, and what it sends to other sites.
- **Supply chain:** `npm audit`, and a scan of the whole git history for keys and tokens.
- **Supabase advisors** (security and performance).

## What it found and what changed

| # | Finding | Risk | Fix |
|---|---|---|---|
| 1 | Game history allowed 64 KB per game and 2,000 games per account, and quick-join accounts are free to create. A script could fill the free database (500 MB) and take the online features down. | High | A game can be at most 8 KB (a real one is about 1.3 KB). An account can save at most 200 games in 10 minutes, a quick-join account keeps at most 300, and everyone together at most 1,000 in 10 minutes. Applied live; tested in `supabase/schema.test.ts`. |
| 2 | Quick-join accounts that never pick a username pile up in Auth forever. | Low | A nightly job (`supabase/maintenance.sql`, pg_cron) removes them after 7 days. They can't post or save anything, so nothing is lost. Applied live. |
| 3 | The page had no Content Security Policy, so a script injection (for example through a future bug) could load outside code or send data anywhere. | Medium | Built pages now carry a policy: scripts only from LureLens, network calls only to the Supabase project, fonts from Google Fonts, no plugins, no forms to other sites. The two inline scripts moved to `public/boot.js`. All three end-to-end suites pass with it, with no violations. |
| 4 | No referrer policy. | Low | `strict-origin-when-cross-origin`: other sites only ever see the bare address. |
| 5 | The test runner (Vitest 3) had critical advisories (prototype pollution leading to code execution in its worker pool, file read through its mocker). It never ships to players, but it runs on developers' machines and in CI. | Medium | Upgraded to Vitest 5.0.5. `npm audit` now reports 0 vulnerabilities, and all 71 tests pass. |
| 6 | Certificate foreign keys had no indexes (slow deletes as data grows). | Low | Four indexes added, live and in the schema. |
| 7 | Nobody would know if the game or the database went down (for example, a paused free project) until a player complained. | Medium | An uptime check every 30 minutes (`.github/workflows/uptime.yml`) opens one GitHub issue when the game or scoreboard stops answering, and closes it when they're back. See [online.md](online.md#uptime-alerts-and-keeping-the-project-awake). |

## What was checked and is sound

- **Tables are closed.** Row level security is on everywhere. The public key can't read or write any table; a signed-in player can read only their own profile and their own history, and add or delete only their own history. Scores, certificates and the answer key are reachable only through functions.
- **Functions are the only way in, and each checks its input.** The public key can call exactly three: `leaderboard`, `class_board` and `check_certificate`, all read-only and capped (100, 300 and 1 rows). Posting, profiles, certificates and account deletion need a signed-in player and act only on their own data. Every `SECURITY DEFINER` function pins `search_path = public`. Internal helpers can't be called by anyone.
- **Scores can't be typed in.** The server recomputes every score from the answers against its own answer key, checks the level and that no message repeats, and limits posting (10 games per account in 10 minutes, 120 a minute overall).
- **Names are checked on the server:** letters, numbers and a few marks only, a list of offensive words and reserved names refused.
- **Training emails can't do anything.** They are bundled with the app, cleaned with DOMPurify, shown inside a shadow root, every link is disabled, and remote images are removed so opening one never tells anyone.
- **No secrets in the code or its history.** Only the publishable key is in the app, which is public by design.
- **Deleting an account deletes everything** (cascading deletes, tested).
- **Moderation is server-checked.** Moderators are listed by hand in a closed table. Every moderation function checks it, hides rather than deletes, and logs who did what. Players can't see or change the list or the log (tested).
- **Live updates leak nothing.** The scoreboard signal carries only the level; a class signal carries nothing and goes only to that class's channel.

## Accepted risks

- **Scripted perfect scores.** The game runs in the browser, so the answer key ships with it, and a determined person could script a perfect, fast game. The server stops made-up scores and floods, but not a script that answers correctly. For an awareness game this is acceptable. Moderators can hide such entries in a tap, and likely scripted games (perfect and very fast) are flagged for them to review.
- **Class boards are readable by anyone with the code**, for a day. They show only usernames, which are already public, and scores.
- **Certificate checks are public by reference**, which is their purpose. References are random.
- **No clickjacking protection.** GitHub Pages can't send the header that forbids framing, and the page has no actions worth tricking someone into.
- **Sessions are kept in the browser's storage** (Supabase's standard). The Content Security Policy is the defence against script injection that could read them.

## Recommended next (for Faith, in dashboards)

1. **Turn on two-factor authentication** for the GitHub, Supabase and Netlify accounts that own LureLens, if not already on. Whoever controls those controls the app and its data.
2. **Supabase Auth settings:** keep the email sign-in code expiry at 1 hour or less (Supabase's own recommendation).
3. **When quick join gets real traffic:** add CAPTCHA protection (Cloudflare Turnstile) in Supabase's Auth settings. It is free and stops scripted account creation at the source. It needs a small app change, which is ready to do when you want it.
4. **Backups:** the free Supabase plan has none. Before LureLens holds data people would miss (organisations, certificates for courses), move to Supabase Pro for daily backups.
5. **Review this document** at each phase, and before Phase 3 (real-inbox simulations), commission an independent penetration test, as the roadmap promises.
