# Content review

LureLens teaches people which senders to trust, so a wrong "real domain" does real harm (an early version taught that a genuine DocuSign address was fake). This file records what has been checked and how.

**Last full review:** 23 October 2026, covering all 80 emails. The 30 SMS and WhatsApp scenarios added the same day were checked as they were written.

## What was checked

- Every **legitimate** email: that its sender domain is the organisation's real domain, and that its trust signals are actually reasons to trust it.
- Every **phishing** email: that any "the real domain is X" statement in its red flags or explanation is correct.
- General claims about how organisations behave (for example "banks never ask for your PIN").

Exact sender addresses (the part before the @) are illustrative. Players are taught to judge the domain, so only domains are claimed as real.

## Real domains used, and how they were confirmed

| Organisation | Domain | Confirmed by |
|---|---|---|
| GTBank (GeNS alerts) | gtbank.com | GTBank's own GeNS page on gtbank.com |
| Access Bank | accessbankplc.com | Bank's official site |
| Zenith Bank | zenithbank.com | Bank's official site |
| Kuda | kuda.com | kuda.com and help.kuda.com |
| Moniepoint | moniepoint.com | moniepoint.com personal banking pages |
| PiggyVest | piggyvest.com | Official site and app listing |
| Paystack | paystack.com | Official site |
| Flutterwave | flutterwave.com | Official developer docs on flutterwave.com |
| Remita | remita.net | Official site |
| Jumia Nigeria | jumia.com.ng | Official Nigerian store |
| Konga | konga.com | Official site |
| Chowdeck | chowdeck.com | Official site |
| GIG Logistics | giglogistics.com | Official site |
| Air Peace | flyairpeace.com | flyairpeace.com FAQ and contact pages |
| Bolt | bolt.eu | Bolt's company domain |
| Uber | uber.com | Official site |
| DStv | dstv.com | Official site |
| University of Ilorin | unilorin.edu.ng | Official site |
| JAMB | jamb.gov.ng | Official site (admissions on JAMB's own portal) |
| NYSC | nysc.gov.ng (main site), portal.nysc.org.ng (registration portal) | Wikipedia infobox; NYSC portal guidance |
| NIMC | nimc.gov.ng | Official site |
| CBN | cbn.gov.ng | Official site |
| FRSC | frsc.gov.ng | FRSC's own site; FRSC has publicly warned about fake traffic-fine texts and websites |
| Lagos State Internal Revenue Service | etax.lirs.net (eTax portal) | TechCabal's 2026 guide to the LIRS eTax portal. Note: not a .gov.ng address |
| GTBank app | GTWorld | Listed on gtbank.com's apps page |
| MTN | myMTN app | Official app listing |
| Ikeja Electric | ikejaelectric.com | Wikipedia; company pages |
| Facebook security alerts | facebookmail.com | Trend Micro: security@facebookmail.com is genuine |
| Google | google.com, accounts.google.com, docs/calendar/meet.google.com | Google's own services |
| Microsoft account security | accountprotection.microsoft.com | Microsoft's account security sender |
| LinkedIn | linkedin.com | Official site |
| GitHub | github.com | Official site |
| DocuSign | docusign.net | DocuSign's signing domain |
| Coursera | m.mail.coursera.org (coursera.org) | Coursera's mail subdomain |
| Spotify | spotify.com | Official site |

BrightPath Technologies (`brightpath.ng`), Zentrix Supplies and the people in them are fictional.

## Corrections made in this review

- **ng-i-p09 (NYSC):** the email said official government sites end in .gov.ng. NYSC's real registration portal is `portal.nysc.org.ng`, so that rule would have taught players to distrust the genuine portal. It now names both real addresses and tells players to check the exact name, not just the ending.
- **ng-b-p03 (grant scam):** removed the claim that government bodies always use .gov.ng addresses (adoption of .gov.ng is still incomplete); kept the points that matter: no ID numbers by email, no Yahoo or Gmail senders.
- **ng-b-l06 (Air Peace):** replaced the weak trust signal "addresses you by full name" (scammers often know your name) with the real domain.
- **ng-b-p12:** replaced a second "₦250,000 Federal Government grant" story that duplicated ng-b-p03 with an instant-loan upfront-fee scam.

## SMS and WhatsApp

- **Sender names on texts can be faked.** A fake text can appear in the same thread as genuine bank alerts (see police advisories on spoofed bank SMS). Scenarios teach players to judge what a text asks for, not who it claims to be from.
- **Phone numbers are fictional.** Every number uses the `555 01xx` pattern so that no real person's number is shown as a scammer. Keep to this pattern for new scenarios.
- **USSD codes and short codes are avoided** unless confirmed, because they change between networks and over time.

## Not checked

- Whether the made-up phishing domains (for example `kuda-verify.com.ng`) are registered by anyone. Links in the game never open, but avoid real company names in new fake domains where possible.

## Verify first

`verify_first` marks the few messages where checking through another channel is the real-world best move, because the sender can be a genuine account that has been hacked, so the message alone cannot settle it: the CEO's urgent favour, a supplier's new bank details (email and WhatsApp), a payroll account change, the MD's gift card text, a friend's WhatsApp asking for money, and the genuine bank text about a payment you did not make. The text says how to verify. Keep the list short: if most messages were marked, "Verify first" would become a free answer. Other messages use the general tip for their category in `src/types.ts`.

## Reports from players

Every explanation has a "Something wrong with this message?" link. It opens a GitHub issue (label `content`) or an email that already names the message id, level, channel and subject. To handle one: confirm the claim against the organisation's own website, fix `src/data/emails.json`, add a line under "Corrections made" above, and close the issue with the commit.

## Checking new emails

1. For SMS and WhatsApp, use a `555 01xx` phone number and avoid unconfirmed USSD or short codes.
2. Confirm the sender's real domain on the organisation's own website before writing a legitimate email or a "the real domain is X" red flag.
3. Prefer trust signals that are hard to fake: the domain, no request for credentials or money, being told to use the app or type the address yourself.
4. Add the organisation to the table above.
5. Run `npm run check:data`.
