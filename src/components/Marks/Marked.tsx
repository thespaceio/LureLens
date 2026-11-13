import type { Piece } from '@/lib/marks';

/** Text cut into plain and marked pieces (see src/lib/marks.ts), as React elements. */
export function Marked({ pieces }: { pieces: Piece[] }) {
  return (
    <>
      {pieces.map((p, i) =>
        p.mark ? (
          <mark key={i} className={`lure-mark lure-${p.mark.tone}`} data-mark={p.mark.n}>
            {p.first && (
              <span className="lure-num" aria-hidden="true">
                {p.mark.n}
              </span>
            )}
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export default Marked;
