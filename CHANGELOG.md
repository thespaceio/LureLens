# Changelog

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
