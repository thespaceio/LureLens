// Live scoreboard updates. The database sends a tiny public "new_score"
// signal (just the level) on the "scoreboard" channel whenever a ranked game
// is posted; open scoreboards reload when they hear it. A slow refresh every
// minute covers networks that block live connections.
import { useEffect, useRef, useState } from 'react';
import { ONLINE, getSupabase } from '@/lib/supabase';

export type LiveStatus = 'connecting' | 'live' | 'polling';

/** Calls `onChange` when the scoreboard may have changed. Returns the connection status. */
export function useScoreboardUpdates(onChange: () => void, pollMs = 60_000): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    if (!ONLINE) return;
    let cancelled = false;
    let debounce = 0;
    let remove = () => {};
    // Several signals in a burst cause one reload.
    const changed = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => latest.current(), 800);
    };

    getSupabase()
      .then(sb => {
        if (cancelled) return;
        const channel = sb
          .channel('scoreboard', { config: { private: false } })
          .on('broadcast', { event: 'new_score' }, changed)
          .subscribe(state => {
            if (cancelled) return;
            if (state === 'SUBSCRIBED') setStatus('live');
            else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') setStatus('polling');
          });
        remove = () => void sb.removeChannel(channel);
      })
      .catch(() => !cancelled && setStatus('polling'));

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') latest.current();
    }, pollMs);
    const onVisible = () => document.visibilityState === 'visible' && latest.current();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      remove();
    };
  }, [pollMs]);

  return status;
}
