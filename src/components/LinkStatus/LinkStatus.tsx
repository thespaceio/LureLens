import { Link2 } from 'lucide-react';
import { hostOf } from '@/lib/game';

export interface InspectedLink {
  url: string;
  clicked: boolean;
}

/** Shows where a hovered or tapped link really goes, with the host highlighted. */
export function LinkStatus({ link, noun }: { link: InspectedLink | null; noun: string }) {
  // mailto: and other links without a web address have no host to highlight.
  const host = link ? hostOf(link.url) : '';
  const showHost = Boolean(host) && host !== link?.url;

  return (
    <div
      className={`mt-2 flex min-h-10 items-start gap-2 rounded-lg px-3 py-2 text-xs ${
        link ? 'bg-secondary text-foreground' : 'text-muted-foreground'
      }`}
      data-testid="link-status"
      aria-live="polite"
    >
      <Link2 className="mt-0.5 size-3.5 shrink-0" />
      {link ? (
        <span className="min-w-0 [overflow-wrap:anywhere]">
          <span className="text-muted-foreground">
            {link.clicked ? 'Links are disabled in training. This one goes to: ' : 'Link goes to: '}
          </span>
          <span className="font-mono">
            {showHost
              ? link.url.split(host).map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && <mark className="rounded bg-primary/20 px-0.5 text-primary">{host}</mark>}
                  </span>
                ))
              : link.url}
          </span>
        </span>
      ) : (
        <span>Hover over or tap a link in the {noun} to see where it really goes.</span>
      )}
    </div>
  );
}

export default LinkStatus;
