import { Check, CircleDot, ShieldCheck } from 'lucide-react';

// The public roadmap shown on the About page. Keep it in step with the
// "LureLens roadmap" document: plain words, no internal or business detail.

type Status = 'now' | 'next' | 'planned' | 'future';

interface Phase {
  n: number;
  title: string;
  status: Status;
  intro?: string;
  done?: string[];
  rolling?: string[];
  items?: string[];
  safely?: string[];
}

const STATUS: Record<Status, { label: string; className: string }> = {
  now: { label: 'Now', className: 'bg-primary text-primary-foreground' },
  next: { label: 'Next', className: 'bg-lavender text-primary-foreground' },
  planned: { label: 'Planned', className: 'border border-lavender/60 text-lavender' },
  future: { label: 'Future', className: 'border border-border text-muted-foreground' },
};

const PHASES: Phase[] = [
  {
    n: 1,
    title: 'Foundation',
    status: 'now',
    intro: 'A free, trustworthy way for anyone to practise spotting scams.',
    done: [
      '110 real-world scenarios across email, SMS and WhatsApp, built on the scams people in Nigeria actually get',
      'Beginner, Intermediate and Advanced levels, against the clock',
      'Verify first: an answer for checking through a channel you already trust',
      'Accounts, plus quick join with just a username',
      'A live online scoreboard and a big-screen view for events',
      'Classroom mode, where everyone plays the same messages, with a debrief',
      'Certificates anyone can check online',
      'A privacy notice, and deleting your account removes everything stored with it',
      "A live class board: results appear on the facilitator's screen as students finish",
      'A security review, with every finding fixed or documented',
      'An accessibility review of every screen and every training email',
      'Uptime alerts, so an outage is noticed and fixed quickly',
      'Moderation, so offensive names or fake scores can be hidden in a tap',
    ],
    rolling: ['Sign in by email for everyone, on our own domain'],
  },
  {
    n: 2,
    title: 'Organisations',
    status: 'next',
    intro: 'Schools, companies and training providers run LureLens for their own people.',
    items: [
      'Organisation spaces with roles for owners, admins, facilitators and learners',
      'Assignments with due dates, reminders and progress tracking',
      'An admin dashboard showing who has finished and which scam types people find hardest, with downloadable reports',
      'Branded certificates and organisation leaderboards',
      'Sign in with Google or Microsoft',
      'More scenario types: voice-call scams, QR and POS fraud, fake jobs, invoice fraud and voice-note impersonation',
      'More languages: Nigerian Pidgin first, then Yoruba, Hausa and Igbo',
    ],
  },
  {
    n: 3,
    title: 'Real-world practice',
    status: 'planned',
    intro: "Practice where attacks really happen, in people's own inboxes and phones.",
    items: [
      'Safe simulated phishing emails and texts, run by an organisation for its own staff',
      'An instant short lesson when someone clicks, instead of blame',
      'A "Report phishing" button for Outlook and Gmail that rewards people for reporting',
      'Reports showing how a team improves over time',
    ],
    safely: [
      'Only verified organisations can run simulations, and only for their own email domains.',
      'LureLens never records passwords or anything typed into a practice page.',
      'Independently security tested before launch.',
    ],
  },
  {
    n: 4,
    title: 'Smarter training',
    status: 'planned',
    items: [
      "Training that adapts to each person's weak spots",
      'Community scam reporting: forward a real scam and it can become a lesson within days',
      'A scam-trends view for Nigeria and West Africa',
      'Benchmarks by sector, such as banking, education and government',
      'Connections to HR, learning and security tools',
      'Reports that support data protection and cybersecurity compliance',
    ],
  },
  {
    n: 5,
    title: 'Scale across Africa',
    status: 'future',
    items: [
      'Enterprise-grade security certification for LureLens itself',
      'Options to keep data hosted in Nigeria',
      'Editions for training partners and security providers',
      'Mobile apps and offline-first training',
      'Local scam content for Ghana, Kenya, South Africa and beyond',
      'A public bug bounty programme',
    ],
  },
];

// [lead in bold, what joins it to the rest, the rest]
const ALWAYS = [
  ['Privacy first', ': ', 'we collect the minimum and explain why.'],
  ['Security built in', ', ', 'and regularly tested.'],
  ['Every scenario reviewed', ' ', 'for accuracy before it goes live.'],
];

function Items({ items, done }: { items: string[]; done?: boolean }) {
  return (
    <ul className="space-y-1.5">
      {items.map(t => (
        <li key={t} className="flex gap-2">
          {done ? (
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          ) : (
            <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-lavender" aria-hidden />
          )}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** The public roadmap: where LureLens is going, phase by phase. */
export function Roadmap() {
  return (
    <section className="space-y-4" aria-labelledby="roadmap-heading" id="roadmap" data-testid="roadmap">
      <div>
        <h2 id="roadmap-heading" className="text-2xl font-bold">Roadmap</h2>
        <p className="text-sm text-muted-foreground">LureLens helps people recognise phishing before it costs them. Here's where it's going.</p>
      </div>

      <ol className="space-y-3">
        {PHASES.map(p => (
          <li key={p.n} className={`rounded-xl border bg-card p-5 text-sm text-muted-foreground ${p.status === 'now' ? 'border-primary/50' : 'border-border'}`}>
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs tracking-[0.14em] text-lavender">PHASE {p.n}</span>
              <h3 className="text-base font-semibold text-foreground">{p.title}</h3>
              <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${STATUS[p.status].className}`}>
                {STATUS[p.status].label}
              </span>
            </div>
            {p.intro && <p className="mb-3">{p.intro}</p>}
            {p.done && (
              <div className="mb-3 space-y-2">
                <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">Done</h4>
                <Items items={p.done} done />
              </div>
            )}
            {p.rolling && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
                  <CircleDot className="size-3.5 text-primary" aria-hidden /> Rolling out
                </h4>
                <Items items={p.rolling} />
              </div>
            )}
            {p.items && <Items items={p.items} />}
            {p.safely && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-lavender/40 bg-lavender/10 p-3">
                <h4 className="flex items-center gap-1.5 font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-lavender" aria-hidden /> Built safely
                </h4>
                <Items items={p.safely} />
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <h3 className="mb-2 font-semibold text-foreground">Always</h3>
        <ul className="space-y-1.5">
          {ALWAYS.map(([lead, join, rest]) => (
            <li key={lead} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <strong className="text-foreground">{lead}</strong>
                {join}
                {rest}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Roadmap;
