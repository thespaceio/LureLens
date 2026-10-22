import { useEffect, useState } from 'react';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SITE_URL, drawResultCard, shareText } from '@/lib/shareCard';
import type { GameSession } from '@/types';

/** Result card preview with native share, download, copy and social links. */
export function SharePanel({ session }: { session: GameSession }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = shareText(session);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    drawResultCard(session)
      .then(b => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session]);

  const file = blob ? new File([blob], 'lurelens-result.png', { type: 'image/png' }) : null;
  const canShareFile = Boolean(file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));

  const nativeShare = async () => {
    try {
      if (file && canShareFile) await navigator.share({ files: [file], text, title: 'My LureLens result' });
      else await navigator.share({ text, url: SITE_URL, title: 'My LureLens result' });
    } catch {
      // The player closed the share sheet.
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const enc = encodeURIComponent;
  const links = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(text)}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(SITE_URL)}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text)}` },
  ];

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Share your result" data-testid="share-panel">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {url ? (
          <img src={url} alt={`Result card: ${text}`} className="block h-auto w-full" width={1200} height={630} data-testid="share-image" />
        ) : (
          <div className="grid aspect-[1200/630] place-items-center text-sm text-muted-foreground">
            {error ? 'Could not create the image on this device.' : 'Creating your result card…'}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{text}</p>

      <div className="flex flex-wrap gap-2">
        {'share' in navigator && (
          <Button onClick={nativeShare} className="gap-2 font-semibold" disabled={!blob && !error}>
            <Share2 className="size-4" /> Share
          </Button>
        )}
        {url && (
          <Button asChild variant="secondary" className="gap-2">
            <a href={url} download="lurelens-result.png">
              <Download className="size-4" /> Download image
            </a>
          </Button>
        )}
        <Button variant="outline" className="gap-2 bg-transparent" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy text'}
        </Button>
        {links.map(l => (
          <Button key={l.label} asChild variant="outline" className="bg-transparent">
            <a href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        LinkedIn and X can't attach the image from a link: download it first, then add it to your post.
      </p>
    </section>
  );
}

export default SharePanel;
