# LureLens

**A timed phishing-detection training game by [Th3 SpaceIO](https://th3spaceio.community).**

**Play it:** [lurelens.netlify.app](https://lurelens.netlify.app/) · [GitHub Pages mirror](https://thespaceio.github.io/LureLens/)

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
- **Scoring:** 100 points per correct answer, plus up to 50 for speed, times the level multiplier. From 3 correct in a row, each further correct answer adds +50.
- **Feedback after every answer**, with the specific red flags or trust signals.
- **Safe link inspection.** Hover over or tap a link to see where it really goes. Links in training emails never open.
- **Scoreboard** with a top-3 podium, level tabs and best score per player.
- **Progress dashboard** showing accuracy per level and per attack type, weak spots to practise, and recent games.
- **Topic filter** to practise one area, such as Banking & Payments.
- Keyboard shortcuts: `L` legitimate, `P` phishing, `S` skip, `Enter` next.
- Works on phones, and offline after the first visit (PWA).

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build
npm run lint
```

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
  lib/stats.ts                     scoreboard and progress calculations
  hooks/useGameStore.ts            saved games and player name (localStorage)
  components/
    DifficultySelector/            start screen: name, level, topics
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
  "explanation": "One or two sentences shown after answering."
}
```

- `level` is `beginner`, `intermediate` or `advanced`.
- `category` is one of `banking`, `workplace`, `accounts`, `shopping`, `government`, `offers` (labels are in `src/types.ts`).
- Phishing emails need `red_flags`. Legitimate emails need `trust_signals`.
- Inside `body`, use single quotes for HTML attributes (`style='…'`). A double quote ends the JSON string and breaks the file. `npm run build` reports the line if the JSON is invalid.
- Keep each level roughly half phishing and half legitimate. Each game picks 10 random emails with 4 to 6 phishing ones.

To change timers, points or emails per game, edit `LEVELS` in `src/types.ts`. Scoring constants are at the top of `src/lib/game.ts`.

## Notes

- Scores are stored in the browser's `localStorage`, so the scoreboard is **per device**. That suits a lab or event laptop. A shared online scoreboard would need a backend such as Supabase or Firebase.
- All emails are simulated. Brand names appear for education only, and the phishing domains are fictional.

---

TH3 SPACEIO · LEARN. BUILD. SECURE.
