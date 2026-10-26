import { useEffect, useMemo, useState } from 'react';
import { Award, Check, Download, Play, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CERTIFICATE_ACCURACY, certificateProgress, drawCertificate, formatCertificateDate } from '@/lib/certificate';
import { SITE_URL } from '@/lib/shareCard';
import { LEVELS, LEVEL_ORDER } from '@/types';
import type { GameSession, Level } from '@/types';

interface CertificatePanelProps {
  sessions: GameSession[];
  name: string;
  onPlay: (level: Level) => void;
}

/** Progress towards the certificate, and the certificate itself once earned. */
export function CertificatePanel({ sessions, name, onPlay }: CertificatePanelProps) {
  const progress = useMemo(() => certificateProgress(sessions, name), [sessions, name]);

  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="cert-heading" data-testid="certificate-panel">
      <h2 id="cert-heading" className="mb-1 flex items-center gap-2 font-semibold">
        <Award className="size-5 text-primary" /> LureLens certificate
      </h2>
      {progress.earned ? (
        <EarnedCertificate progress={progress} name={name} />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Score at least {CERTIFICATE_ACCURACY}% in a full round of every level to earn a certificate you can print, share or
            add to LinkedIn. Classroom rounds count; single-topic practice rounds don't.
          </p>
          <ul className="grid gap-3 md:grid-cols-3">
            {LEVEL_ORDER.map(level => {
              const { best, passedWith } = progress.levels[level];
              return (
                <li key={level} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 p-4 text-sm">
                  <div>
                    <div className="font-medium">{LEVELS[level].label}</div>
                    <div className="text-xs text-muted-foreground">
                      {passedWith
                        ? `Passed with ${passedWith.accuracy}% on ${formatCertificateDate(passedWith.date)}`
                        : best
                          ? `Best so far ${best.accuracy}%, need ${CERTIFICATE_ACCURACY}%`
                          : 'Not played yet'}
                    </div>
                  </div>
                  {passedWith ? (
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary" aria-label="Passed">
                      <Check className="size-4" />
                    </span>
                  ) : (
                    <Button size="sm" variant="secondary" className="shrink-0 gap-1.5" onClick={() => onPlay(level)}>
                      <Play className="size-3.5" /> Play
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function EarnedCertificate({ progress, name }: { progress: ReturnType<typeof certificateProgress>; name: string }) {
  const [displayName, setDisplayName] = useState(name);
  const [shownName, setShownName] = useState(name);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // Redraw shortly after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setShownName(displayName), 400);
    return () => clearTimeout(t);
  }, [displayName]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    drawCertificate(progress, shownName)
      .then(b => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
        setError(false);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [progress, shownName]);

  const fileName = `lurelens-certificate-${(shownName.trim() || 'player').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null;
  const canShareFile = Boolean(file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));
  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({
        files: [file],
        title: 'My LureLens certificate',
        text: `I completed all three levels of LureLens phishing awareness training. Try it: ${SITE_URL}`,
      });
    } catch {
      // The player closed the share sheet.
    }
  };

  const earned = new Date(progress.earnedOn!);
  const linkedIn = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: 'LureLens Phishing Awareness Training',
    organizationName: 'Th3 SpaceIO',
    issueYear: String(earned.getFullYear()),
    issueMonth: String(earned.getMonth() + 1),
    certId: progress.reference ?? '',
    certUrl: SITE_URL,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        You passed all three levels. Completed on <strong className="text-foreground">{formatCertificateDate(progress.earnedOn!)}</strong>,
        reference <span className="font-mono text-foreground">{progress.reference}</span>.
      </p>
      <div className="max-w-sm space-y-1.5">
        <label htmlFor="cert-name" className="text-sm text-muted-foreground">Name on the certificate</label>
        <Input
          id="cert-name"
          value={displayName}
          maxLength={48}
          className="h-11 bg-background"
          onChange={e => setDisplayName(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">You can use your full name here. Your scoreboard name stays the same.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {url ? (
          <img src={url} alt={`LureLens certificate for ${shownName}`} className="block h-auto w-full" width={2000} height={1414} data-testid="certificate-image" />
        ) : (
          <div className="grid aspect-[2000/1414] place-items-center text-sm text-[#5B4F7D]">
            {error ? 'Could not create the certificate on this device.' : 'Creating your certificate…'}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {url && (
          <Button asChild className="gap-2 font-semibold">
            <a href={url} download={fileName} data-testid="certificate-download">
              <Download className="size-4" /> Download
            </a>
          </Button>
        )}
        {canShareFile && (
          <Button variant="secondary" className="gap-2" onClick={share}>
            <Share2 className="size-4" /> Share
          </Button>
        )}
        <Button asChild variant="outline" className="bg-transparent">
          <a href={`https://www.linkedin.com/profile/add?${linkedIn.toString()}`} target="_blank" rel="noopener noreferrer" data-testid="certificate-linkedin">
            Add to LinkedIn
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The image is A4 landscape, ready to print. "Add to LinkedIn" fills in the Licenses &amp; certifications form on your profile.
      </p>
    </div>
  );
}

export default CertificatePanel;
