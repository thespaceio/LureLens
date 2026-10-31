import type { CSSProperties } from 'react';
import type { ReactNode } from 'react';
import RevealText from '@/components/ui/reveal';
import { CONTACT_EMAIL } from '@/lib/report';

const UPDATED = '26 October 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** Plain-language privacy notice for LureLens, written for the Nigeria Data Protection Act 2023. */
export function Privacy() {
  return (
    <article className="stagger-children mx-auto w-full max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground sm:text-base" data-testid="privacy">
      <div>
        <p className="text-in font-mono text-xs tracking-[0.16em] text-primary">SPACEIO // PRIVACY</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground sm:text-4xl"><RevealText text="Privacy notice" /></h1>
        <p className="text-in mt-1" style={{ '--d': '300ms' } as CSSProperties}>Last updated {UPDATED}.</p>
      </div>

      <p>
        LureLens is a free phishing-awareness game by <strong className="text-foreground">Th3 SpaceIO</strong>, based in
        Lagos, Nigeria. This notice explains what we keep, why, and what you can do about it. You can play without an
        account, and then nothing about you leaves your device.
      </p>

      <Section title="Without an account">
        <p>
          Your player name, scores and progress are saved only in your browser on this device. We can't see them. Clearing
          your browser data, or "Clear all data on this device" on the Progress page, deletes them.
        </p>
      </Section>

      <Section title="With an account">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-foreground">Email address:</strong> to send your sign-in code. It is never shown to
            other players and we don't send newsletters or marketing. Quick-join accounts have no email until you choose to
            add one.
          </li>
          <li>
            <strong className="text-foreground">Username:</strong> public, shown on the online scoreboard and on certificate
            checks.
          </li>
          <li>
            <strong className="text-foreground">Full name (optional):</strong> printed on your certificate and shown on its
            public check page, only if you make the certificate checkable online.
          </li>
          <li>
            <strong className="text-foreground">School or organisation (optional):</strong> private. We may use it later for
            school and team boards, and will ask before showing it anywhere.
          </li>
          <li>
            <strong className="text-foreground">Game history:</strong> your games (answers, scores and dates), private to
            you, so your progress follows you between devices.
          </li>
          <li>
            <strong className="text-foreground">Online scores:</strong> only games you choose to post appear on the public
            scoreboard, with your username, score, accuracy and date.
          </li>
          <li>
            <strong className="text-foreground">Class results:</strong> when you play a class round while signed in, your
            username, score and how you answered each message go to that class's board for your facilitator. Anyone with the
            class code can see the board for a day. Class rounds never appear on the public scoreboard.
          </li>
        </ul>
        <p>
          We use this information to run your account, the scoreboard and certificates (our legal basis is your consent and
          providing the service you asked for). We don't sell it, share it for advertising, or use it to profile you.
        </p>
      </Section>

      <Section title="Where it is stored">
        <p>
          Accounts, history and scores are stored with Supabase, in its data centre in Ireland (EU). The website is served
          by Netlify and GitHub Pages, and the fonts come from Google Fonts; like any website host, they see your IP address
          when you load the page. LureLens has no ads, analytics or tracking cookies.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Until you delete your account. Online scores and certificates you posted stay public until then, unless a
          moderator hides them for breaking the rules (for example an offensive name). We keep a private record of what
          was hidden and why; once you delete your account, that record no longer points to you.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under the Nigeria Data Protection Act 2023 you can ask to see, correct or delete your data, withdraw consent, or
          object to how we use it. You can edit your profile and <strong className="text-foreground">delete your account</strong>{' '}
          yourself on the Account page; deleting removes your profile, history, online scores and certificates. For anything
          else, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-lavender underline underline-offset-2 hover:text-foreground">
            {CONTACT_EMAIL}
          </a>
          . If you're not satisfied with our answer, you can complain to the Nigeria Data Protection Commission.
        </p>
      </Section>

      <Section title="Children">
        <p>
          LureLens is suitable for students. If you're under 18, please ask a parent, guardian or teacher before creating an
          account. You can always play without one.
        </p>
      </Section>

      <Section title="Changes">
        <p>If we change what we collect, we'll update this notice and the date above, and tell signed-in players in the app.</p>
      </Section>
    </article>
  );
}

export default Privacy;
