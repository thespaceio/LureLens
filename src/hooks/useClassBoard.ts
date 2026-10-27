// A class's live results from the server, for the facilitator's panel, the
// debrief and the class big screen.
import { useEffect, useState } from 'react';
import { ONLINE, OnlineError, fetchClassBoard } from '@/lib/online';
import type { ClassBoardRow } from '@/lib/online';
import { useClassUpdates } from '@/lib/live';
import type { LiveStatus } from '@/lib/live';
import type { ClassResult, Mark } from '@/lib/classroom';

const MARK: Record<string, Mark> = { R: 'right', S: 'safe', W: 'wrong' };

export function toClassResult(row: ClassBoardRow): ClassResult {
  return { name: row.name, score: row.score, correct: row.correct, total: row.total, marks: [...(row.marks ?? '')].map(c => MARK[c] ?? 'wrong') };
}

export interface ClassBoard {
  /** null until the first load. */
  results: ClassResult[] | null;
  error: string | null;
  status: LiveStatus;
}

/** Live results for a class code. Pass null (or run without online features) for none. */
export function useClassBoard(code: string | null): ClassBoard {
  const [tick, setTick] = useState(0);
  const status = useClassUpdates(ONLINE ? code : null, () => setTick(n => n + 1));
  const [state, setState] = useState<{ code: string | null; results: ClassResult[] | null; error: string | null }>({ code: null, results: null, error: null });

  useEffect(() => {
    if (!ONLINE || !code) return;
    let cancelled = false;
    fetchClassBoard(code)
      .then(rows => !cancelled && setState({ code, results: rows.map(toClassResult), error: null }))
      .catch(e => {
        if (cancelled) return;
        const error = e instanceof OnlineError ? e.message : "Couldn't load the class results.";
        // Keep showing what we had; a refresh will try again.
        setState(s => (s.code === code ? { ...s, error } : { code, results: null, error }));
      });
    return () => {
      cancelled = true;
    };
  }, [code, tick]);

  const current = state.code === code;
  return { results: current ? state.results : null, error: current ? state.error : null, status };
}

/**
 * Online results first; pasted result lines fill in players who sent theirs by
 * message instead (matched by name, ignoring case).
 */
export function mergeResults(online: ClassResult[] | null, pasted: ClassResult[]): ClassResult[] {
  const seen = new Set((online ?? []).map(r => r.name.toLowerCase()));
  return [...(online ?? []), ...pasted.filter(r => !seen.has(r.name.toLowerCase()))].sort(
    (a, b) => b.score - a.score || b.correct - a.correct,
  );
}
