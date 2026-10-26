import { Award, Flag, MessageSquareText, Phone, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { APP_VERSION, REPO_URL } from '@/lib/report';

const ITEMS = [
  { icon: MessageSquareText, title: 'Texts and WhatsApp', text: '30 new SMS and WhatsApp scams, from fake bank alerts to hijacked friends asking for money.' },
  { icon: Users, title: 'Classroom mode', text: 'Share a code and a whole class plays the same messages, then walk through them together.' },
  { icon: Phone, title: 'Verify first', text: 'A third answer for checking through a number you trust. It scores no points but keeps your streak.' },
  { icon: Award, title: 'Certificate', text: 'Score 80% on every level to earn a certificate you can print or add to LinkedIn.' },
  { icon: Flag, title: 'Report a mistake', text: 'Spot something wrong in a message? Report it straight from the explanation.' },
];

export function WhatsNew({ open, onClose, onClassroom }: { open: boolean; onClose: () => void; onClassroom: () => void }) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto border-border bg-card p-0 sm:max-w-lg" data-testid="whats-new">
        <div className="border-b border-border bg-primary/10 px-6 pb-4 pt-6">
          <p className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-4" /> LureLens {APP_VERSION}
          </p>
          <DialogTitle className="text-xl font-semibold">PhishGuard is now LureLens</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            New name, same mission, and a lot more to practise on. Your scores and progress came with you.
          </DialogDescription>
        </div>
        <ul className="space-y-3 px-6 py-5">
          {ITEMS.map(item => (
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
            <Button variant="outline" className="bg-transparent" onClick={onClassroom}>
              Try classroom mode
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
