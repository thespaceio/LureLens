import { Award, BadgeCheck, Flag, Globe, Lock, Map, MessageSquareText, MonitorPlay, Phone, Radio, Sparkles, UserRound, Users, Zap } from 'lucide-react';
import { isNewer } from '@/lib/whatsNew';
import type { WhatsNewKind } from '@/lib/whatsNew';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { APP_VERSION, REPO_URL } from '@/lib/report';

// Each release's highlights, newest first. Returning players see every
// release since the note they last saw.
const RELEASES = [
  {
    version: '2.3',
    items: [
      { icon: Users, title: 'Live class board', text: "In Classroom mode, results reach the facilitator's screen as players finish, with how the class answered every message for the debrief." },
      { icon: MonitorPlay, title: 'Class big screen', text: 'Put just your room on the projector, ranked as they finish, with a QR code to join.' },
      { icon: Map, title: 'Roadmap', text: 'See where LureLens is going, phase by phase, on the About page.' },
      { icon: Globe, title: 'New address', text: 'LureLens now lives at thespaceio.github.io/LureLens. Update your bookmark.' },
    ],
  },
  {
    version: '2.2',
    items: [
      { icon: UserRound, title: 'Accounts', text: 'Sign in with your email and a 6-digit code, no password. Your username is yours alone, and your progress and certificate follow you to every device.' },
      { icon: Zap, title: 'Quick join', text: 'In a class or at an event, join with just a username and post your score straight away, no email needed.' },
      { icon: Radio, title: 'Live scoreboard', text: 'New scores appear within seconds, and the top players of the week are on the home screen.' },
      { icon: Lock, title: 'Your data, your choice', text: 'Playing without an account works as before. A privacy notice explains what is stored, and you can delete your account at any time.' },
    ],
  },
  {
    version: '2.1',
    items: [
      { icon: Globe, title: 'Online scoreboard', text: 'After a ranked game, post your score and see how you rank against players everywhere, this week or all time.' },
      { icon: BadgeCheck, title: 'Checkable certificates', text: 'Make your certificate checkable online, so employers and trainers can confirm it from its reference.' },
    ],
  },
];

// New in 2.0: also shown to players returning from the PhishGuard days.
const SINCE_PHISHGUARD = [
  { icon: MessageSquareText, title: 'Texts and WhatsApp', text: '30 SMS and WhatsApp scams, from fake bank alerts to hijacked friends asking for money.' },
  { icon: Users, title: 'Classroom mode', text: 'Share a code and a whole class plays the same messages, then walk through them together.' },
  { icon: Phone, title: 'Verify first', text: 'A third answer for checking through a number you trust. It scores no points but keeps your streak.' },
  { icon: Award, title: 'Certificate', text: 'Score 80% on every level to earn a certificate you can print or add to LinkedIn.' },
  { icon: Flag, title: 'Report a mistake', text: 'Spot something wrong in a message? Report it straight from the explanation.' },
];

interface WhatsNewProps {
  open: boolean;
  kind: WhatsNewKind;
  onClose: () => void;
  onScoreboard: () => void;
}

export function WhatsNew({ open, kind, onClose, onScoreboard }: WhatsNewProps) {
  const renamed = kind === 'renamed';
  const seen = kind.startsWith('since:') ? kind.slice('since:'.length) : '0';
  const releases = renamed ? RELEASES : RELEASES.filter(r => isNewer(r.version, seen));
  const items = [...releases.flatMap(r => r.items), ...(renamed ? SINCE_PHISHGUARD : [])];
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto border-border bg-card p-0 sm:max-w-lg" data-testid="whats-new">
        <div className="border-b border-border bg-primary/10 px-6 pb-4 pt-6">
          <p className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-4" /> LureLens {APP_VERSION}
          </p>
          <DialogTitle className="text-xl font-semibold">
            {renamed ? 'PhishGuard is now LureLens' : 'Live class boards'}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {renamed
              ? 'New name, same mission, and a lot more to practise on. Your scores and progress came with you.'
              : 'Run a class and watch results arrive as students finish, ready for the debrief.'}
          </DialogDescription>
        </div>
        <ul className="space-y-3 px-6 py-5">
          {items.map(item => (
            <li key={item.title} className="flex gap-3">
              <item.icon className="mt-0.5 size-5 shrink-0 text-lavender" aria-hidden />
              <div className="text-sm">
                <div className="font-semibold">{item.title}</div>
                <div className="text-muted-foreground">{item.text}</div>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-4">
          <a
            href={`${REPO_URL}/blob/main/CHANGELOG.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-lavender underline underline-offset-2 hover:text-foreground"
          >
            Full list of changes
          </a>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-transparent" onClick={onScoreboard}>
              See the scoreboard
            </Button>
            <Button autoFocus className="font-semibold" onClick={onClose}>
              Start playing
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WhatsNew;
