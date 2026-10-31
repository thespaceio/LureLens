import type { CSSProperties } from 'react';

/**
 * Text whose words appear one after another (CSS only; still for people who
 * ask for reduced motion). Put it inside the heading: <h1><RevealText text="…" /></h1>.
 * `delay` (ms) starts the first word later; each word follows 55 ms after the last.
 */
export function RevealText({ text, delay = 80 }: { text: string; delay?: number }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, i) => (
        <span key={`${i}-${word}`} className="word-in" style={{ '--w': i, '--d': `${delay}ms` } as CSSProperties}>
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

export default RevealText;
