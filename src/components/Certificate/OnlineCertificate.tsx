import { useState } from 'react';
import { Check, Copy, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnlineError, certificateLink, postScore, registerCertificate } from '@/lib/online';
import type { PostedScore } from '@/lib/online';
import type { CertificateProgress } from '@/lib/certificate';
import { checkable, readRegistered, saveRegistered } from '@/lib/certificateOnline';
import { LEVEL_ORDER } from '@/types';

/** "Make it checkable online": posts the three passing games, then registers the certificate. */
export function OnlineCertificate({
  progress,
  displayName,
  onPosted,
  onRegistered,
  signedIn,
  onSignIn,
}: {
  progress: CertificateProgress;
  displayName: string;
  onPosted: (sessionId: string, posted: PostedScore) => void;
  onRegistered: () => void;
  signedIn: boolean;
  onSignIn?: () => void;
}) {
  const reference = progress.reference!;
  const [registeredName, setRegisteredName] = useState<string | undefined>(() => readRegistered()[reference]);
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const games = LEVEL_ORDER.map(l => progress.levels[l].passedWith!);
  const oldGames = games.filter(g => !g.onlineId && !checkable(g));
  const link = certificateLink(reference);

  const register = async () => {
    setState('working');
    try {
      const ids: string[] = [];
      for (const g of games) {
        if (g.onlineId) {
          ids.push(g.onlineId);
          continue;
        }
        // Classroom games back the certificate but stay off the public scoreboard.
        const posted = await postScore(g, !g.practice);
        onPosted(g.id, posted);
        ids.push(posted.id);
      }
      await registerCertificate(reference, displayName.trim() || null, ids);
      saveRegistered(reference, displayName.trim());
      setRegisteredName(displayName.trim());
      setState('idle');
      onRegistered();
    } catch (e) {
      setError(e instanceof OnlineError ? e.message : 'Something went wrong. Try again.');
      setState('error');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the link is on screen.
    }
  };

  if (registeredName !== undefined) {
    const renamed = registeredName !== displayName.trim();
    return (
      <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-4" data-testid="certificate-online">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check className="size-4 text-primary" /> Anyone can check this certificate online
        </p>
        <p className="font-mono text-xs [overflow-wrap:anywhere]">{link}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy check link'}
          </Button>
          {renamed && (
            <Button size="sm" className="gap-1.5" onClick={register} disabled={state === 'working'}>
              {state === 'working' && <Loader2 className="size-4 animate-spin" />} Update the name online
            </Button>
          )}
        </div>
        {state === 'error' && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/50 p-4" data-testid="certificate-online">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Globe className="size-4 text-lavender" /> Make it checkable online
      </p>
      {!signedIn ? (
        <>
          <p className="text-sm text-muted-foreground">
            Sign in so employers and trainers can confirm your certificate from its reference. It will be tied to your
            account.
          </p>
          {onSignIn && (
            <Button size="sm" className="gap-1.5 font-semibold" onClick={onSignIn} data-testid="certificate-sign-in">
              <Globe className="size-4" /> Sign in to make it checkable
            </Button>
          )}
        </>
      ) : oldGames.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          One of your passing games was played on an older version of LureLens, so the server can't check it. Pass that level
          again to make your certificate checkable online.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Employers and trainers can then confirm it with the reference. This posts your three passing games under your
            username, with the name on the certificate. Ranked games also appear on the online scoreboard.
          </p>
          <Button size="sm" className="gap-1.5 font-semibold" onClick={register} disabled={state === 'working'} data-testid="certificate-register">
            {state === 'working' ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
            {state === 'working' ? 'Registering…' : 'Make it checkable online'}
          </Button>
        </>
      )}
      {state === 'error' && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export default OnlineCertificate;
