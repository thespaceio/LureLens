import type { LiveStatus } from '@/lib/live';

/** A small "Live" indicator for scoreboards. */
export function LiveDot({ status, className = '' }: { status: LiveStatus; className?: string }) {
  const live = status === 'live';
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] ${live ? 'text-primary' : 'text-muted-foreground'} ${className}`}
      title={live ? 'Updates as soon as a score is posted' : 'Updates every minute'}
      data-testid="live-status"
      data-status={status}
    >
      <span className="relative flex size-2">
        {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />}
        <span className={`relative inline-flex size-2 rounded-full ${live ? 'bg-primary' : 'bg-muted-foreground'}`} />
      </span>
      {live ? 'Live' : status === 'connecting' ? 'Connecting' : 'Auto-refresh'}
    </span>
  );
}

export default LiveDot;
