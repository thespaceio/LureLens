<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/lurelens-logo.svg">
    <img src="brand/lurelens-logo-daylight.svg" alt="LureLens" width="360">
  </picture>
</p>

# LureLens

**A timed phishing-detection training game by [Th3 SpaceIO](https://th3spaceio.community).**

**Play it:** [thespaceio.github.io/LureLens](https://thespaceio.github.io/LureLens/) · also at [lurelens.netlify.app](https://lurelens.netlify.app/), which may lag behind (Netlify's free plan limits how often it updates)

**Version 2.1** · see the [changelog](CHANGELOG.md) for what's new.

LureLens was previously called PhishGuard. Old links to `phishguard-by-faith.netlify.app` redirect here.

You play as Ada Okafor, an analyst at the fictional BrightPath Technologies (`brightpath.ng`). Realistic emails land in your inbox one at a time, and you have a few seconds to decide whether each one is **Legitimate** or **Phishing**. After every answer you see the red flags (or the signs it was safe) and why they matter.

Most scenarios are built around what people in Nigeria actually receive: GTBank, Access, Zenith, OPay, Moniepoint and Paystack alerts, BVN/NIN requests, CBN "directives", grants, NYSC and JAMB scams, delivery fees, fake jobs, and targeted attacks on businesses.

## Features

- **Three levels:**

  | Level | Time per email | Points | What you face |
  |---|---|---|---|
  | Beginner | 30s | ×1 | Free-email senders, spelling mistakes, fake prizes, obvious threats |
  | Intermediate | 25s | ×1.5 | Lookalike domains (`micros0ft`, `linkedln`), convincing branding, real alerts that look scary |
  | Advanced | 20s | ×2 | CEO fraud, changed supplier bank details, hidden link destinations, `.pdf.html` and macro attachments, MFA-code theft, OAuth consent and QR phishing |

- **Countdown timer** on every email. Running out of time counts as wrong.
- **Verify first**, a third answer for "I'd check through the official app or a number I trust". On messages where that is the real-world best move (a supplier's new bank details, the CEO's urgent favour, a friend's WhatsApp asking for money, a genuine bank warning) it counts as correct. It always scores 0 points, because points reward deciding, but it never resets the streak. Every verify answer shows how to check that kind of message.
- **Scoring:** 100 points per correct answer, plus up to 50 for speed, times the level multiplier. From 3 correct in a row, each further correct answer adds +50.
- **Emails, SMS and WhatsApp.** 110 scenarios: 80 emails, 15 text messages and 15 WhatsApp chats, including spoofed bank sender IDs, OTP tricks and hijacked friends asking for money. Every mixed round includes texts or chats.
- **Classroom mode** for trainers and lecturers: create a class code, link or QR code, and everyone who joins plays the same 10 messages in the same order. Players send back a one-line result, you paste the lines in to see the class table and which messages most people missed, then step through each message on the projector and reveal the answer after the room has voted. No server or sign-up needed.
- **Certificate** for scoring at least 80% in a full round of every level (ranked or classroom rounds; topic practice doesn't count). It is drawn in the browser as an A4 landscape image with the player's name, each level's result and date, and a reference, ready to download, print, share or add to LinkedIn through LinkedIn's "Add to profile" link. The Progress page shows how close each player is.
- **Share your result** as a branded image card (works offline), straight to WhatsApp, LinkedIn or X.
- **Feedback after every answer**, with the specific red flags or trust signals, and a **Report a mistake** link that opens a pre-filled GitHub issue (or an email) naming the exact message.
- **Safe link inspection.** Hover over or tap a link to see where it really goes. Links in training emails never open.
- **Scoreboard** with a top-3 podium, level tabs and best score per player.
- **Progress dashboard** showing accuracy per level and per attack type, weak spots to practise, and recent games.
- **Practice filters** for one channel (Email, SMS, WhatsApp) or one topic, such as Banking & Payments. Practice rounds count towards progress, not the scoreboard.
- Keyboard shortcuts: `L` legitimate, `P` phishing, `V` verify first, `S` skip, `Enter` next.
- **Pause** stops the clock and hides the email; switching apps pauses automatically.
- Works on phones, and offline from the first visit (PWA).

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build
npm run lint
npm test          # unit tests for scoring, rounds and the scoreboard
npm run check:data  # checks src/data/emails.json (also runs in CI)
```

Email content is reviewed for accuracy; see [docs/content-review.md](docs/content-review.md) before adding or editing emails.

## Deploy

**GitHub Pages:** in the repository go to Settings → Pages → Source and choose **GitHub Actions**. Every push to `main` then builds and publishes the site through `.github/workflows/deploy.yml`.

**Netlify or Vercel:** build command `npm run build`, output folder `dist`.

The app uses relative paths, so it works from a sub-path such as `username.github.io/LureLens/`.

## Project structure

```
src/
  App.tsx                          screens and navigation
  types.ts                         shared types, LEVELS (timers, points) and CATEGORIES
  data/emails.json                 the email bank
  lib/game.ts                      picking emails and scoring rules
  lib/classroom.ts                 class codes, seeded class rounds, result lines
  lib/stats.ts                     scoreboard and progress calculations
  hooks/useGameStore.ts            saved games and player name (localStorage)
  components/
    DifficultySelector/            start screen: name, level, topics
    Classroom/                     class codes, QR invite, class results and debrief
    QuizInterface/                 the timed game
    EmailViewer/                   safe email rendering and link inspection
    FeedbackModal/                 feedback after each answer
    ResultsScreen/                 end-of-game summary
    Leaderboard/                   scoreboard
    ProgressDashboard/             charts and history
    ui/                            shadcn/ui building blocks
public/                            icons, manifest, service worker
```

## Adding or editing emails

Every email in `src/data/emails.json` uses the same fields:

```json
{
  "id": "ng-i-p11",
  "level": "intermediate",
  "is_phishing": true,
  "category": "banking",
  "topic": "Fintech",
  "sender": { "name": "Kuda", "email": "support@kuda-verify.com" },
  "reply_to": "optional@another-domain.com",
  "subject": "…",
  "date": "2026-10-16T09:14:00",
  "body": "<div>HTML body. Use single quotes inside HTML attributes.</div>",
  "attachments": ["optional_file.pdf"],
  "red_flags": [{ "description": "…", "location": "optional: where it appears" }],
  "trust_signals": [],
  "explanation": "One or two sentences shown after answering.",
  "verify_first": "Optional. How to verify, for messages where checking through another channel is the best move."
}
```

- `level` is `beginner`, `intermediate` or `advanced`.
- `category` is one of `banking`, `workplace`, `accounts`, `shopping`, `government`, `offers` (labels are in `src/types.ts`).
- Phishing emails need `red_flags`. Legitimate emails need `trust_signals`.
- Inside `body`, use single quotes for HTML attributes (`style='…'`). A double quote ends the JSON string and breaks the file. `npm run build` reports the line if the JSON is invalid.
- Keep each level roughly half phishing and half legitimate. Each game picks 10 random emails with 4 to 6 phishing ones.

To change timers, points or emails per game, edit `LEVELS` in `src/types.ts`. Scoring constants are at the top of `src/lib/game.ts`.

## Online features (optional)

With a free Supabase project, LureLens adds email sign-in with profiles and synced progress, a live online scoreboard (players choose to post each game), a big-screen view for events, checkable certificates and a privacy notice with account deletion. Scores are recomputed by the server from the answers. Setup, moderation and privacy: [docs/online.md](docs/online.md).

## Notes

- A class code stores the level and a random seed, plus a check character tied to the message bank. If the messages change in a new version, old codes stop working instead of giving players a different round from the facilitator.
- Scores are stored in the browser's `localStorage`, so the **This device** scoreboard works with no account or server. The online scoreboard is separate and opt-in (see above).
- All emails are simulated. Brand names appear for education only, and the phishing domains are fictional.

## Brand

The logo, icons and social images live in [`brand/`](brand/README.md): two interlocking Ls for Lure and Lens, each with an "s" for SpaceIO, framing a lime lens. Colours: Midnight `#1B1035`, Lavender `#B9A6FF`, Lime `#C6F432`, Coral `#FF6B6B` for red flags only.

## Licence

Copyright © 2026 Faith Alabi (Th3 SpaceIO). All rights reserved. The code is public so you can read it and see how the game works, but it is not open source: you may not copy, host, sell or build on it without written permission. See [LICENSE](LICENSE). For permission, email th3officialspaceio@gmail.com.

## Keeping secrets out

This repository is public, so nothing secret ever goes into it. The only key in the code is Supabase's **publishable** key, which is public by design; the database is protected by its access rules ([docs/security-review.md](docs/security-review.md)). The Supabase secret (service role) key is never used by the app and never belongs here.

Three guards back this up: GitHub's secret scanning and push protection (on for this repository) refuse a push that contains a known kind of key; the **Secret scan** workflow scans every push and pull request with gitleaks; and `.gitignore` keeps `.env` files and key files out of commits.

---

TH3 SPACEIO · LEARN. BUILD. SECURE.
