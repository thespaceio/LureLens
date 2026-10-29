# Changelog

## Unreleased

### Changed
- **Every button shows it's under your pointer.** Main buttons brighten with a soft glow, secondary and quiet buttons take a lavender or deeper shade, and selected tabs, filters and level cards still change shade when you point at them. Menu items, the logo, slide dots and debrief question numbers respond too.
- **More motion across the game.** Screens slide in when you switch, cards and rows rise in one after another (results, progress, scoreboards, top players, About and the roadmap), accuracy bars grow into place, your results score counts up, and the score and streak pop as they change during a round. A streak of 3 or more turns the streak lime. All of it stays still if your device asks for reduced motion.
- **The About page shows the LureLens logo** beside the description of the game.
- The scoreboard's controls wrap neatly on the narrowest phones, and layouts were checked on phones turned sideways too.

## 2.4.0 (29 October 2026)

### New
- **Moderation.** Moderators get a Moderation page from their Account. It lists recent online games, flags likely scripted ones (perfect and very fast), and hides a single score or a whole player from the scoreboard, class boards and certificate checks in a tap. Nothing is deleted, anything can be restored, and every change is logged with who, when and why. Moderators are added by hand in the database ([docs/online.md](docs/online.md#moderation)).
- **New home screen.** The headline is now a set of animated slides: the game, fake bank alerts, hijacked WhatsApp friends, one-time codes, live classes and certificates, each with a small illustration. They move on by themselves every 6 seconds and pause when you hover, tap or tab into them, when the page is in the background, or with the pause button. They don't move by themselves if your device asks for reduced motion. Swipe, the arrows or the dots change slides. **Play now** jumps to setting up your round, and **Run a class** opens Classroom.

### Changed
- The privacy notice explains the moderation record.
- Buttons respond to a press with a quick squeeze, and level cards lift on hover.
- Works from 320 px phones to wide screens: the menu fits on the smallest phones and on tablets, and thin buttons (the week/all-time switch, "See the full scoreboard", "Play Intermediate", Privacy and What's new) are taller and easier to tap.

## 2.3.1 (28 October 2026)

### Security
- **Security review** of the app, database, hosting and build: findings, fixes and accepted risks are in [docs/security-review.md](docs/security-review.md).
- Online history can't be used as free storage or flooded: games are capped at 8 KB, with limits per account, per quick-join account and overall.
- Quick-join accounts that never chose a username are removed after 7 days.
- Built pages carry a Content Security Policy and a referrer policy; the two inline scripts moved to `boot.js`.
- Test tooling upgraded (Vitest 5); `npm audit` reports no vulnerabilities.

### Accessibility
- Every screen checked with axe on laptop and phone sizes, and all 80 training emails checked for contrast.
- Keyboard hints on buttons and the counts in level settings are easier to read.
- Wide tables (scoreboards, recent games) can be scrolled with the keyboard and are announced by name.
- The "Passed" badge on certificates is announced properly by screen readers.
- Nine training emails had brand text or buttons too faint to read; their colours are adjusted. Which messages are phishing, and why, is unchanged.

### Reliability
- **Uptime alerts.** Every 30 minutes a check opens the game and the scoreboard. If either is down it opens one GitHub issue (which emails watchers) and closes it when they're back. It also keeps the free Supabase project awake, replacing the daily keep-alive.

## 2.3.0 (28 October 2026)

### New
- **Live class board.** In Classroom mode, signed-in players' results go straight to the facilitator's class board as they finish, with no result lines to paste. The facilitator's panel and the debrief update live, showing how the class answered each message.
- **Class big screen.** "Big screen" in Classroom mode (or `?live&class=<code>`) shows just that room's players, ranked as they finish, with the class code and a QR code to join.
- Players joining a class are prompted to sign in or quick join first, and come back to the class with their code still filled in.
- **Roadmap** on the About page: where LureLens is going, phase by phase, from today's free game to organisations, real-world practice and scale across Africa.

### Changed
- **New main address: [thespaceio.github.io/LureLens](https://thespaceio.github.io/LureLens/).** Share cards, certificates and their check links, the big-screen QR codes and link previews now use it. lurelens.netlify.app still works but may lag behind, because Netlify's free plan limits how often it updates.
- Result lines still work for players without internet: they send their line and the facilitator pastes it in. Pasted players appear alongside online ones.

## 2.2.0 (27 October 2026)

### New
- **Accounts.** Sign in with your email and a 6-digit code, no password. Choose a public username that nobody else can use, and optionally add your full name (for certificates) and your school or organisation.
- **Quick join.** In a class or at an event, players can join with just a username and post to the live scoreboard straight away, no email needed. The account stays on that device until they add an email to keep it.
- **Your progress on every device.** Signed-in games are saved to your account and appear on any device you sign in on. Games played before signing in can be added to your account.
- **Live online scoreboard.** New scores appear within seconds, with a "Live" indicator. Posting needs an account, so names can't be impersonated.
- **Top players this week** on the home screen, and a **big-screen view** for projectors at classes and events (`?live`), with a QR code to join.
- **Certificates tied to your account**, using your full name, and shown as account-backed on the check page.
- **Privacy notice** (`?privacy`), and **delete my account**, which removes everything stored online.

### Fixed
- Names written with Yoruba and Igbo letters (ọ, ẹ, ṣ, ụ, ị and tone marks) were refused online. They're now accepted everywhere.

## 2.1.0 (26 October 2026)

### New
- **Online scoreboard.** After a ranked game, players can tap "Post to the online scoreboard" to see how they rank against everyone, this week or all time. Nothing is sent unless they tap it, and only the player name, scores and dates are stored. The server works the score out from the answers, so made-up scores can't be posted.
- **Checkable certificates.** "Make it checkable online" registers a certificate, and anyone can confirm it on the new **Check a certificate** page. The LinkedIn link now points to that check.

### Changed
- The game keeps answer times to a tenth of a second, the same precision the server checks, so both always show the same score.
- The "What's new" note now shows what changed since your last visit, and still explains the rename to anyone returning from the PhishGuard days.

## 2.0.0 (26 October 2026)

PhishGuard is now **LureLens**: a new name, a new brand, and the move from a side project to a phishing-awareness app built for real classrooms, teams and communities. Saved scores and progress carry over automatically, and old PhishGuard links redirect to the new site.

### New
- **SMS and WhatsApp scams.** 30 new scenarios (15 text messages, 15 WhatsApp chats) alongside 80 emails: spoofed bank sender IDs, OTP tricks, delivery fees, hijacked friends asking for money, fake suppliers changing bank details. Every mixed round includes at least two texts or chats, and links in them can be inspected safely.
- **Classroom mode.** A facilitator creates a class code, link or QR code; everyone who joins plays the same 10 messages in the same order. Players send back a one-line result, the facilitator pastes the lines in for a class table and the most-missed messages, then runs a projector debrief that reveals each answer after the room has voted. No server or sign-up.
- **Verify first.** A third answer for "I'd check through the official app or a number I trust". It scores 0 points but never resets the streak, counts as correct on the messages where checking first is the real best move, and always shows how to verify that kind of message.
- **Certificate.** Score at least 80% in a full round of every level to earn an A4 certificate with your name, each level's result and a reference. Download it, share it, or add it to LinkedIn.
- **Share your result** as a branded image card, straight to WhatsApp, LinkedIn or X.
- **Report a mistake** from any explanation: it opens a pre-filled GitHub issue or an email naming the exact message.
- **Pause.** Stops the clock and hides the message; switching apps pauses automatically.
- **Practice by channel or topic.** Practice rounds count towards progress but not the scoreboard.
- **What's new** note for returning players, and the app version on the About page.

### Changed
- **New name and brand.** Two interlocking Ls for Lure and Lens, each with an "s" for SpaceIO, framing a lime lens. New colours, type, app icons and link previews.
- **Nigerian scenarios throughout.** The American bank and shopping emails were replaced with what people in Nigeria actually receive: CBN and BVN scams, OPay and Kuda lookalikes, JAMB and NYSC, Remita, payroll and supplier fraud.
- **Content checked.** Every real sender domain and every "the real domain is X" claim was checked against the organisation's own website, and the corrections are recorded in `docs/content-review.md`. All phone numbers in the game are fictional.
- **Phone layout.** The header is a compact tab bar on phones and small tablets.

### Fixed
- The game works offline from the first visit (it used to show a blank page).
- Practice rounds no longer appear on the scoreboard, ranks or personal bests.
- Link inspection no longer breaks on `mailto:` links, and emails never load remote images.

### Under the hood
- Unit tests (53) for rounds, scoring, class codes, the certificate and the message bank, plus `npm run check:data`, all run before every deploy.
- 50 unused UI components and 37 unused packages removed; `npm audit` reports no known vulnerabilities in the app's dependencies.

## 1.0.0 (October 2026)

First public release, as **PhishGuard**: a timed phishing-detection game with Beginner, Intermediate and Advanced levels, scoring with speed and streak bonuses, feedback after every answer, a per-device scoreboard and a progress dashboard.
