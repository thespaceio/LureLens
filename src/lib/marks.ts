// Marking red flags (and reasons to trust) on the message itself.
//
// Each red flag can name a `spot`: the exact words in the message it is about,
// such as the sender's address, a button's text or a line of the body. After
// answering, those words are highlighted on the message with the flag's number,
// and the same number appears beside the flag in the explanation.
//
// A spot is matched once per message, at its first appearance in reading order
// (subject, sender, body, attachments), ignoring differences in spacing.
import type { Email } from '@/types';

export type MarkTone = 'flag' | 'trust';

export interface Mark {
  /** The number shown on the message and beside the explanation item. */
  n: number;
  text: string;
  tone: MarkTone;
}

export interface ReviewItem {
  description: string;
  spot?: string;
  /** Set when the item is marked on the message. */
  n?: number;
}

/** The explanation items for a message, numbered where they can be marked. */
export function reviewItems(email: Email): ReviewItem[] {
  let n = 0;
  const raw = email.is_phishing
    ? email.red_flags.map(f => ({ description: f.description, spot: f.spot }))
    : email.trust_signals.map(t => (typeof t === 'string' ? { description: t } : { description: t.description, spot: t.spot }));
  return raw.map(item => (item.spot?.trim() ? { ...item, n: ++n } : { description: item.description }));
}

export function marksFor(email: Email): Mark[] {
  const tone: MarkTone = email.is_phishing ? 'flag' : 'trust';
  return reviewItems(email)
    .filter((i): i is ReviewItem & { n: number; spot: string } => i.n !== undefined && Boolean(i.spot))
    .map(i => ({ n: i.n, text: i.spot, tone }));
}

/** A copy of `text` with runs of whitespace collapsed, and where each kept character came from. */
function squash(text: string): { flat: string; from: number[] } {
  let flat = '';
  const from: number[] = [];
  let space = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) {
      if (space) continue;
      space = true;
      flat += ' ';
    } else {
      space = false;
      flat += c;
    }
    from.push(i);
  }
  return { flat, from };
}

/** Where `needle` first appears in `text` (spacing ignored), as [start, end) in `text`. */
export function locate(text: string, needle: string, after = 0): [number, number] | null {
  const want = squash(needle.trim()).flat;
  if (!want) return null;
  const { flat, from } = squash(text);
  let at = flat.indexOf(want);
  while (at !== -1 && from[at] < after) at = flat.indexOf(want, at + 1);
  if (at === -1) return null;
  return [from[at], from[at + want.length - 1] + 1];
}

export interface Placed {
  mark: Mark;
  start: number;
  end: number;
}

/**
 * Place each mark at its first appearance across the message's text fields,
 * in reading order. A mark that would overlap one already placed in the same
 * field tries its next appearance. Returns the placements per field.
 */
export function placeMarks(fields: string[], marks: Mark[]): Placed[][] {
  const out: Placed[][] = fields.map(() => []);
  for (const mark of marks) {
    let placed = false;
    for (let f = 0; f < fields.length && !placed; f++) {
      let from = 0;
      for (;;) {
        const hit = locate(fields[f], mark.text, from);
        if (!hit) break;
        const [start, end] = hit;
        if (out[f].every(p => end <= p.start || start >= p.end)) {
          out[f].push({ mark, start, end });
          placed = true;
          break;
        }
        from = start + 1;
      }
    }
  }
  for (const list of out) list.sort((a, b) => a.start - b.start);
  return out;
}

export interface Piece {
  text: string;
  mark?: Mark;
  /** The first piece of a mark carries its number. */
  first?: boolean;
}

/** Cut `text` (which starts at `offset` within its field) into plain and marked pieces. */
export function cutPieces(text: string, placed: Placed[], offset = 0): Piece[] {
  const pieces: Piece[] = [];
  let pos = 0;
  for (const p of placed) {
    const start = Math.max(0, p.start - offset);
    const end = Math.min(text.length, p.end - offset);
    if (end <= 0 || start >= text.length || end <= start) continue;
    if (start > pos) pieces.push({ text: text.slice(pos, start) });
    pieces.push({ text: text.slice(start, end), mark: p.mark, first: p.start - offset >= 0 });
    pos = end;
  }
  if (pos < text.length) pieces.push({ text: text.slice(pos) });
  return pieces;
}

/**
 * Wrap the placed marks inside an HTML element's text, in place. Used for the
 * email body, which is plain DOM (inside a shadow root), not React.
 */
export function markElement(root: Element, placed: Placed[]) {
  if (!placed.length) return;
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes: { node: Text; start: number }[] = [];
  let total = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, start: total });
    total += (n as Text).data.length;
  }
  // Work backwards so earlier offsets stay valid while nodes are split.
  for (const p of [...placed].reverse()) {
    const hits = nodes.filter(({ node, start }) => start < p.end && start + node.data.length > p.start).reverse();
    hits.forEach(({ node, start }, i) => {
      const from = Math.max(0, p.start - start);
      const to = Math.min(node.data.length, p.end - start);
      const middle = node.splitText(from);
      middle.splitText(to - from);
      const mark = doc.createElement('mark');
      mark.className = `lure-mark lure-${p.mark.tone}`;
      mark.setAttribute('data-mark', String(p.mark.n));
      middle.replaceWith(mark);
      mark.append(middle);
      if (i === hits.length - 1) mark.prepend(badge(doc, p.mark));
    });
  }
}

function badge(doc: Document, mark: Mark): HTMLElement {
  const b = doc.createElement('span');
  b.className = 'lure-num';
  b.setAttribute('aria-hidden', 'true');
  b.textContent = String(mark.n);
  return b;
}

/** The text of an element as the marks see it: its text nodes joined in order. */
export function textOf(root: Element): string {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  let s = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) s += (n as Text).data;
  return s;
}

/** Bring a mark into view and make it pulse, from a numbered item in the explanation. */
export function showMark(scope: Element | null, n: number) {
  if (!scope) return;
  const roots: ParentNode[] = [scope];
  scope.querySelectorAll('[data-testid="email-body"]').forEach(h => h.shadowRoot && roots.push(h.shadowRoot));
  for (const r of roots) {
    const el = r.querySelector(`[data-mark="${n}"]`);
    if (!el) continue;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    el.classList.remove('lure-pulse');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('lure-pulse');
    return;
  }
}
